import type { RpcInput, RpcOutput } from "@getpaseo/plugin";
import type { PluginSettings } from "@getpaseo/plugin/server";
import { mergeActions, parseExtensions, resolveAction, settingsSchema, type actionsRpc, type runRpc } from "../shared/file-actions";
import { nodeRuntime, resolveCommand, runAction } from "./actions";

type Settings = PluginSettings<typeof settingsSchema>;

async function storedActions(settings: Settings) {
  const state = await settings.read();
  return mergeActions(state.status === "ready" ? state.values.actions : []).map(resolveAction);
}

export async function listActions(settings: Settings): Promise<RpcOutput<typeof actionsRpc>> {
  const actions = await storedActions(settings);
  return {
    actions: await Promise.all(
      actions
        .filter((action) => action.enabled)
        .map(async (action) => ({
          id: action.id,
          name: action.name,
          icon: action.icon,
          extensions: parseExtensions(action.extensions),
          command: await resolveCommand(action, nodeRuntime),
        })),
    ),
  };
}

export async function runById(input: RpcInput<typeof runRpc>, settings: Settings): Promise<RpcOutput<typeof runRpc>> {
  const action = (await storedActions(settings)).find((candidate) => candidate.id === input.actionId);
  if (!action || !action.enabled) return { ok: false, message: `Unknown action: ${input.actionId}` };
  return runAction(action, input.path);
}
