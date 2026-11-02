import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { PluginClientContext, PluginFilePanelProps } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/ui";
import { runRpc, type ListedAction } from "../shared/file-actions";
import { messages } from "./messages";
import { Preview } from "./preview";

type State = { phase: "idle" } | { phase: "running" } | { phase: "done"; output: string } | { phase: "error"; message: string };

/**
 * The panel body for one action: an action bar that runs the action on the tab's file, and the
 * file's own preview below it.
 */
export function createPanel(client: PluginClientContext, action: ListedAction) {
  return function ActionPanel({ file, theme, layout }: PluginFilePanelProps) {
    const c = theme.colors;
    const padding = layout.compact ? 12 : 20;
    const [state, setState] = useState<State>({ phase: "idle" });

    const run = useCallback(() => {
      setState({ phase: "running" });
      client
        .rpc(runRpc, { actionId: action.id, path: file.path })
        .then((result) => setState(result.ok ? { phase: "done", output: result.output } : { phase: "error", message: result.message }))
        .catch((error: unknown) => setState({ phase: "error", message: error instanceof Error ? error.message : String(error) }));
    }, [file.path]);

    const failed = state.phase === "error";
    const buttonLabel = client.i18n.t(messages, state.phase === "idle" ? "open" : "again", { name: action.name });
    const title =
      state.phase === "idle"
        ? file.name
        : state.phase === "running"
        ? client.i18n.t(messages, "opening", { name: action.name })
        : state.phase === "done"
          ? client.i18n.t(messages, "opened", { name: action.name })
          : client.i18n.t(messages, "failed", { name: action.name });

    return (
      <View style={{ flex: 1, backgroundColor: c.surface0 }}>
        <View style={{ paddingHorizontal: padding, paddingVertical: 10, gap: 6, borderBottomWidth: 1, borderBottomColor: c.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name={failed ? "CircleAlert" : state.phase === "idle" ? "FileText" : action.icon} size={16} color={failed ? c.statusDanger : c.foregroundMuted} />
            <Text style={{ flex: 1, color: failed ? c.statusDanger : c.foregroundMuted, fontSize: 13 }} numberOfLines={1}>
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={buttonLabel}
              disabled={state.phase === "running"}
              onPress={run}
              style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: c.accent, opacity: state.phase === "running" ? 0.5 : 1 }}
            >
              <Text style={{ color: c.accentForeground, fontSize: 12 }}>{buttonLabel}</Text>
            </Pressable>
          </View>
          {failed && (
            <Text selectable style={{ color: c.statusDanger, fontSize: 12 }}>
              {state.message}
            </Text>
          )}
        </View>
        <Preview file={file} theme={theme} padding={padding} />
      </View>
    );
  };
}
