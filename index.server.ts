import type { PluginServerContext } from "@getpaseo/plugin/server";
import { actionsRpc, checkRpc, fileActionsSettings, runRpc } from "./shared/file-actions";
import { checkFile, listActions, runById } from "./server/file-actions";

export default function contribute(server: PluginServerContext) {
  const settings = server.registerSettings(fileActionsSettings);
  server.handle(actionsRpc, () => listActions(settings));
  server.handle(checkRpc, (input) => checkFile(input));
  server.handle(runRpc, (input) => runById(input, settings));
  return () => {};
}
