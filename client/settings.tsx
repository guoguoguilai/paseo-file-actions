import { useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { useSettings, useTranslation, type PluginSurfaceProps } from "@getpaseo/plugin/client";
import { Icon, SettingsAction, SettingsCard, SettingsInput, SettingsRow, SettingsSection } from "@getpaseo/plugin/client/ui";
import { mergeActions, fileActionsSettings, PRESETS, isPresetId, resolveAction, type Action } from "../shared/file-actions";
import { messages } from "./messages";

export const SETTINGS_ID = "file-actions";

type Props = PluginSurfaceProps & { onSaved(): void };

export function SettingsScreen(props: Props) {
  const state = useSettings(fileActionsSettings);
  const { t } = useTranslation(messages);
  const c = props.theme.colors;
  if (state.status !== "ready") {
    return (
      <View style={{ padding: 24, gap: 12 }}>
        <Text style={{ color: state.status === "loading" ? c.foregroundMuted : c.statusDanger }}>
          {state.status === "loading" ? t("loading") : state.error}
        </Text>
        {state.status !== "loading" && (
          <SettingsCard>
            <SettingsAction label={t("reload")} actionLabel={t("reload")} onPress={() => void state.reload()} />
            {state.status === "invalid" && (
              <SettingsAction label={t("restoreDefaults")} actionLabel={t("reset")} onPress={() => void state.reset()} />
            )}
          </SettingsCard>
        )}
      </View>
    );
  }
  return (
    <Editor
      key={state.revision}
      {...props}
      stored={state.values.actions}
      saving={state.saving}
      saveError={state.saveError}
      save={(actions) => state.save({ actions }, state.revision)}
    />
  );
}

function Editor({
  theme,
  stored,
  saving,
  saveError,
  save,
  onSaved,
}: Props & {
  stored: Action[];
  saving: boolean;
  saveError: string | null;
  save(actions: Action[]): Promise<boolean>;
}) {
  const { t } = useTranslation(messages);
  const c = theme.colors;
  const [draft, setDraft] = useState(() => mergeActions(stored));
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const change = (next: Action[]) => {
    setDraft(next);
    setSaved(false);
    setError("");
  };
  const patch = (id: string, fields: Partial<Action>) => change(draft.map((a) => (a.id === id ? { ...a, ...fields } : a)));
  const add = () => {
    const id = `custom-${Date.now().toString(36)}`;
    change([...draft, { id, preset: "", name: "", icon: "", command: "", args: "", extensions: "", enabled: true }]);
    setEditing(id);
  };
  const saveNow = async () => {
    if (draft.some((a) => !a.preset && !a.command.trim())) {
      setError(t("commandRequired"));
      return;
    }
    if (await save(draft)) {
      setSaved(true);
      onSaved();
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <SettingsSection title={t("actions")}>
        <Text style={{ color: c.foregroundMuted, fontSize: 12, paddingHorizontal: 4, paddingBottom: 8 }}>{t("actionsHint")}</Text>
        <SettingsCard>
          {draft.map((action) => {
            const shown = resolveAction(action);
            const open = editing === action.id;
            return (
              <View key={action.id}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={shown.name || t("newAction")}
                  onPress={() => setEditing(open ? null : action.id)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}
                >
                  <Icon name={shown.icon} size={20} color={c.foreground} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: c.foreground, fontWeight: "500" }} numberOfLines={1}>
                      {shown.name || t("newAction")}
                    </Text>
                    <Text style={{ color: c.foregroundMuted, fontSize: 12 }} numberOfLines={1}>
                      {shown.extensions}
                    </Text>
                  </View>
                  <Switch value={action.enabled} onValueChange={(enabled) => patch(action.id, { enabled })} />
                </Pressable>
                {open && (
                  <View>
                    <SettingsInput label={t("name")} initialValue={action.name} placeholder={isPresetId(action.preset) ? PRESETS[action.preset].name : undefined} onChangeText={(name) => patch(action.id, { name })} />
                    <SettingsInput label={t("command")} initialValue={action.command} placeholder={isPresetId(action.preset) ? PRESETS[action.preset].command : "/usr/bin/open"} onChangeText={(command) => patch(action.id, { command })} />
                    <SettingsInput label={t("args")} hint={t("argsHint")} initialValue={action.args} placeholder={isPresetId(action.preset) ? PRESETS[action.preset].args : "{path}"} onChangeText={(args) => patch(action.id, { args })} />
                    <SettingsInput label={t("extensions")} hint={t("extensionsHint")} initialValue={action.extensions} placeholder={isPresetId(action.preset) ? PRESETS[action.preset].extensions : "md, txt"} onChangeText={(extensions) => patch(action.id, { extensions })} />
                    <SettingsInput label={t("icon")} hint={t("iconHint")} initialValue={action.icon} placeholder={isPresetId(action.preset) ? PRESETS[action.preset].icon : "AppWindow"} onChangeText={(icon) => patch(action.id, { icon })} />
                    <SettingsRow label="">
                      {action.preset ? (
                        <SettingsAction label="" actionLabel={t("reset")} onPress={() => patch(action.id, { name: "", command: "", args: "", extensions: "", icon: "" })} />
                      ) : (
                        <SettingsAction label="" actionLabel={t("remove")} onPress={() => change(draft.filter((a) => a.id !== action.id))} />
                      )}
                    </SettingsRow>
                  </View>
                )}
              </View>
            );
          })}
          <SettingsAction label="" actionLabel={t("add")} onPress={add} />
        </SettingsCard>
      </SettingsSection>
      {(error || saveError) && <Text style={{ color: c.statusDanger }}>{error || saveError}</Text>}
      <SettingsCard>
        <SettingsAction label={saved ? t("saved") : ""} actionLabel={t("save")} disabled={saving} onPress={() => void saveNow()} />
      </SettingsCard>
    </View>
  );
}
