import type { PluginServerContext } from "@getpaseo/plugin/server";
import { actionsRpc, fileActionsSettings, runRpc } from "./shared/file-actions";
import { listActions, runById } from "./server/file-actions";

export default function contribute(server: PluginServerContext) {
  const settings = server.registerSettings(fileActionsSettings);
  server.handle(actionsRpc, () => listActions(settings));
  server.handle(runRpc, (input) => runById(input, settings));
  return () => {};
}
