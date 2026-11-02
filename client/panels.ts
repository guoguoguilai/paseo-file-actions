import type { PluginClientContext } from "@getpaseo/plugin/client";
import { actionsRpc, type ListedAction } from "../shared/file-actions";
import { createPanel } from "./panel";

export interface Panels {
  /** Reads the action list again and re-registers every file panel. */
  refresh(): Promise<void>;
  dispose(): void;
}

/** One file panel per enabled action, so each one is its own entry in a tab's Open with… menu. */
export function installPanels(client: PluginClientContext): Panels {
  let removers: Array<() => void> = [];
  let disposed = false;

  const clear = () => {
    removers.forEach((remove) => remove());
    removers = [];
  };

  const register = (actions: readonly ListedAction[]) => {
    clear();
    for (const action of actions) {
      if (!action.command || action.extensions.length === 0) continue;
      removers.push(
        client.addFilePanel({
          id: action.id,
          title: action.name,
          icon: action.icon,
          files: { extensions: action.extensions },
          Component: createPanel(client, action),
        }),
      );
    }
  };

  const refresh = async () => {
    try {
      const { actions } = await client.rpc(actionsRpc, {});
      if (!disposed) register(actions);
    } catch (error) {
      console.error("[file-actions] cannot read actions", error);
    }
  };

  void refresh();
  return {
    refresh,
    dispose() {
      disposed = true;
      clear();
    },
  };
}
