import { defineRpc, defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

/**
 * Placeholders, replaced in every argument after the line is split, so a value with spaces or
 * Chinese characters stays one argument.
 *
 *   {path}     absolute path of the file
 *   {dir}      folder that holds the file
 *   {name}     file name with its extension
 *   {ext}      lowercase extension without the dot
 *   {vault}    Obsidian vault that contains the file (needs the Obsidian command line)
 *   {relPath}  path of the file inside that vault
 *   {uriPath}  {path} percent-encoded for a URI
 */
export const PLACEHOLDERS = ["{path}", "{dir}", "{name}", "{ext}", "{vault}", "{relPath}", "{uriPath}"] as const;

const OBSIDIAN_CLI = "/Applications/Obsidian.app/Contents/MacOS/obsidian-cli";

/** Text and image types that a built-in panel already shows, so the panel is only a menu choice. */
export const DEFAULT_EXTENSIONS = "md, markdown, txt, json, csv, html, png, jpg, jpeg, gif, webp";

export interface Preset {
  name: string;
  icon: string;
  command: string;
  args: string;
  extensions: string;
}

/** Built-in actions, macOS. Each field can be overridden in settings. */
export const PRESETS = {
  obsidian: {
    name: "Obsidian",
    icon: "NotebookText",
    command: OBSIDIAN_CLI,
    args: "vault={vault} open path={relPath}",
    extensions: "md, markdown",
  },
  "obsidian-uri": {
    name: "Obsidian (URI)",
    icon: "NotebookText",
    command: "/usr/bin/open",
    args: "obsidian://open?path={uriPath}",
    extensions: "md, markdown",
  },
  finder: {
    name: "Show in Finder",
    icon: "FolderSearch",
    command: "/usr/bin/open",
    args: "-R {path}",
    extensions: DEFAULT_EXTENSIONS,
  },
  "default-app": {
    name: "Default app",
    icon: "ExternalLink",
    command: "/usr/bin/open",
    args: "{path}",
    extensions: DEFAULT_EXTENSIONS,
  },
} as const satisfies Record<string, Preset>;

export type PresetId = keyof typeof PRESETS;
export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];

export function isPresetId(value: string): value is PresetId {
  return Object.prototype.hasOwnProperty.call(PRESETS, value);
}

/** Panel ids must match ^[a-z][a-z0-9-]*$. */
export const ACTION_ID = /^[a-z][a-z0-9-]{0,40}$/;

export const actionSchema = z.object({
  id: z.string().regex(ACTION_ID),
  /** A preset id, or "" for an action the user added. */
  preset: z.string().max(64).default(""),
  /** Empty fields fall back to the preset. */
  name: z.string().trim().max(80).default(""),
  icon: z.string().trim().max(64).default(""),
  command: z.string().trim().max(1024).default(""),
  args: z.string().trim().max(2048).default(""),
  /** Comma separated, no dots. The action's panel is offered for these file types. */
  extensions: z.string().trim().max(512).default(""),
  enabled: z.boolean().default(true),
});
export type Action = z.infer<typeof actionSchema>;

export const settingsSchema = z.object({
  actions: z.array(actionSchema).max(64).default([]),
});

/** Host scope: install paths differ between computers. */
export const fileActionsSettings = defineSettings({
  id: "actions",
  scope: "host",
  version: 1,
  schema: settingsSchema,
});

export function presetAction(preset: PresetId): Action {
  return { id: preset, preset, name: "", icon: "", command: "", args: "", extensions: "", enabled: true };
}

/** Stored actions in their order, then every preset the user has not stored yet. */
export function mergeActions(stored: readonly Action[]): Action[] {
  const ids = new Set<string>();
  const merged: Action[] = [];
  for (const action of stored) {
    if (ids.has(action.id)) continue;
    if (action.preset && !isPresetId(action.preset)) continue;
    ids.add(action.id);
    merged.push(action);
  }
  const storedPresets = new Set(merged.map((action) => action.preset));
  for (const preset of PRESET_IDS) {
    if (!storedPresets.has(preset) && !ids.has(preset)) merged.push(presetAction(preset));
  }
  return merged;
}

/** A stored action with every empty field filled from its preset. */
export function resolveAction(action: Action): Action {
  const base: Preset | undefined = isPresetId(action.preset) ? PRESETS[action.preset] : undefined;
  return {
    ...action,
    name: action.name || base?.name || action.command,
    icon: action.icon || base?.icon || "AppWindow",
    command: action.command || base?.command || "",
    args: action.args || base?.args || "{path}",
    extensions: action.extensions || base?.extensions || DEFAULT_EXTENSIONS,
  };
}

export function parseExtensions(text: string): string[] {
  const out = new Set<string>();
  for (const part of text.split(/[\s,]+/)) {
    const ext = part.replace(/^\./, "").toLowerCase();
    if (/^[a-z0-9_+-]{1,16}$/.test(ext)) out.add(ext);
  }
  return [...out];
}

/**
 * Splits an argument line on spaces. Double quotes group a value with spaces. Backslashes stay
 * literal.
 */
export function splitArgs(line: string): string[] {
  const args: string[] = [];
  let current = "";
  let quoted = false;
  let started = false;
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
      started = true;
    } else if (!quoted && /\s/.test(char)) {
      if (started) args.push(current);
      current = "";
      started = false;
    } else {
      current += char;
      started = true;
    }
  }
  if (started) args.push(current);
  return args;
}

export const listedActionSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  extensions: z.array(z.string()),
  /** The program that runs, or null when it was not found. */
  command: z.string().nullable(),
});
export type ListedAction = z.infer<typeof listedActionSchema>;

export const actionsRpc = defineRpc({
  name: "file-actions.actions",
  input: z.object({}),
  output: z.object({ actions: z.array(listedActionSchema) }),
});

export const runRpc = defineRpc({
  name: "file-actions.run",
  input: z.object({
    actionId: z.string().min(1).max(64),
    /** Absolute path of the file the panel shows. */
    path: z.string().min(1).max(4096),
  }),
  output: z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), output: z.string() }),
    z.object({ ok: z.literal(false), message: z.string() }),
  ]),
});
