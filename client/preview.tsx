import { Image, ScrollView, Text, View } from "react-native";
import type { PluginTheme } from "@getpaseo/plugin";
import { useFileText, useFileUrl, type PluginFile } from "@getpaseo/plugin/client";
import { DocumentFrame, Loading, Markdown } from "@getpaseo/plugin/client/ui";

const MARKDOWN = new Set(["md", "markdown"]);
const HTML = new Set(["html", "htm"]);
const IMAGE = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
const TEXT = new Set(["txt", "json", "csv", "log", "yaml", "yml", "toml", "ini", "xml"]);

interface PreviewProps {
  file: PluginFile;
  theme: PluginTheme;
  padding: number;
}

function MarkdownPreview({ file, padding }: PreviewProps) {
  const state = useFileText(file);
  if (state.status === "loading") return <Loading />;
  if (state.status === "error") return null;
  return (
    <ScrollView contentContainerStyle={{ padding }}>
      <Markdown>{state.text}</Markdown>
    </ScrollView>
  );
}

function TextPreview({ file, theme, padding }: PreviewProps) {
  const state = useFileText(file);
  if (state.status === "loading") return <Loading />;
  if (state.status === "error") return null;
  return (
    <ScrollView contentContainerStyle={{ padding }}>
      <Text selectable style={{ color: theme.colors.foreground, fontFamily: "Menlo", fontSize: 12 }}>
        {state.text}
      </Text>
    </ScrollView>
  );
}

function FramePreview({ file }: PreviewProps) {
  const state = useFileUrl(file);
  if (state.status === "loading") return <Loading />;
  if (state.status === "error") return null;
  return <DocumentFrame url={state.url} />;
}

function ImagePreview({ file, padding }: PreviewProps) {
  const state = useFileUrl(file);
  if (state.status === "loading") return <Loading />;
  if (state.status === "error") return null;
  return (
    <ScrollView contentContainerStyle={{ padding }}>
      <Image source={{ uri: state.url }} resizeMode="contain" style={{ width: "100%", aspectRatio: 1 }} />
    </ScrollView>
  );
}

/** The file itself, drawn under the action bar. Types without a preview show nothing. */
export function Preview(props: PreviewProps) {
  const ext = props.file.extension;
  const body = MARKDOWN.has(ext) ? (
    <MarkdownPreview {...props} />
  ) : HTML.has(ext) ? (
    <FramePreview {...props} />
  ) : IMAGE.has(ext) ? (
    <ImagePreview {...props} />
  ) : TEXT.has(ext) ? (
    <TextPreview {...props} />
  ) : null;
  return body ? <View style={{ flex: 1 }}>{body}</View> : null;
}
