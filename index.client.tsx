import { ScrollView } from "react-native";
import type { PluginClientContext, PluginSurfaceProps } from "@getpaseo/plugin/client";
import { messages } from "./client/messages";
import { installPanels } from "./client/panels";
import { SETTINGS_ID, SettingsScreen } from "./client/settings";

export default function contribute(client: PluginClientContext) {
  const panels = installPanels(client);
  const Settings = (props: PluginSurfaceProps) => (
    <ScrollView contentContainerStyle={{ padding: 18, maxWidth: 720 }}>
      <SettingsScreen {...props} onSaved={() => void panels.refresh()} />
    </ScrollView>
  );
  const removeSettings = client.addSettingsScreen({
    id: SETTINGS_ID,
    title: client.i18n.t(messages, "settings"),
    icon: "SquareArrowOutUpRight",
    Component: Settings,
  });
  return () => {
    removeSettings();
    panels.dispose();
  };
}
