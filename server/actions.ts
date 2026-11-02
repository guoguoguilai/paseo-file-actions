import { execFile } from "node:child_process";
import { access, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, relative, sep } from "node:path";
import { PRESETS, splitArgs, type Action } from "../shared/file-actions";

const RUN_TIMEOUT_MS = 15_000;
const OUTPUT_LIMIT = 400;

export interface Runtime {
  home: string;
}

export const nodeRuntime: Runtime = { home: homedir() };

/** Expands a leading ~ in the program path. */
export function expandHome(path: string, runtime: Runtime): string {
  return path === "~" || path.startsWith("~/") ? runtime.home + path.slice(1) : path;
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(() => true, () => false);
}

/**
 * The program to run. The Obsidian command line sits inside the app bundle, so an app moved to
 * ~/Applications is found too. A bare name is left for the system to find on PATH.
 */
export async function resolveCommand(action: Action, runtime: Runtime): Promise<string | null> {
  const command = expandHome(action.command, runtime);
  if (!command) return null;
  if (!command.includes("/")) return command;
  if (await exists(command)) return command;
  if (command === PRESETS.obsidian.command) {
    const moved = `${runtime.home}/Applications/Obsidian.app/Contents/MacOS/obsidian-cli`;
    if (await exists(moved)) return moved;
  }
  return null;
}

function run(command: string, args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: RUN_TIMEOUT_MS, maxBuffer: 1024 * 1024, cwd }, (error, stdout, stderr) => {
      const text = `${stdout}${stderr}`.trim();
      if (error) {
        const reason = error.killed ? `timed out after ${RUN_TIMEOUT_MS / 1000}s` : error.message;
        reject(new Error(text ? `${reason}\n${text.slice(0, OUTPUT_LIMIT)}` : reason));
      } else {
        resolve(text.slice(0, OUTPUT_LIMIT));
      }
    });
  });
}

export interface Vault {
  name: string;
  path: string;
}

/** Parses `obsidian-cli vaults verbose`: one `name<TAB>path` per line. */
export function parseVaults(text: string): Vault[] {
  const vaults: Vault[] = [];
  for (const line of text.split("\n")) {
    const [name, path] = line.split("\t");
    if (name && path) vaults.push({ name: name.trim(), path: path.trim() });
  }
  return vaults;
}

/** The vault with the longest path that contains the file. */
export function vaultFor(file: string, vaults: readonly Vault[]): Vault | null {
  let best: Vault | null = null;
  for (const vault of vaults) {
    const root = vault.path.endsWith(sep) ? vault.path : vault.path + sep;
    if (file.startsWith(root) && (!best || vault.path.length > best.path.length)) best = vault;
  }
  return best;
}

export function uriPath(path: string): string {
  return encodeURIComponent(path).replace(/%2F/g, "/");
}

export interface Context {
  path: string;
  vault?: Vault;
}

export function expandArg(arg: string, ctx: Context): string {
  const rel = ctx.vault ? relative(ctx.vault.path, ctx.path).split(sep).join("/") : "";
  return arg
    .replaceAll("{path}", ctx.path)
    .replaceAll("{dir}", dirname(ctx.path))
    .replaceAll("{name}", basename(ctx.path))
    .replaceAll("{ext}", extname(ctx.path).slice(1).toLowerCase())
    .replaceAll("{vault}", ctx.vault?.name ?? "")
    .replaceAll("{relPath}", rel)
    .replaceAll("{uriPath}", uriPath(ctx.path));
}

const NEEDS_VAULT = /\{(vault|relPath)\}/;

export type RunResult = { ok: true; output: string } | { ok: false; message: string };

export async function runAction(action: Action, file: string, runtime: Runtime = nodeRuntime): Promise<RunResult> {
  const info = await stat(file).catch(() => null);
  if (!info) return { ok: false, message: `File not found: ${file}` };

  const command = await resolveCommand(action, runtime);
  if (!command) {
    const hint = action.preset === "obsidian" ? " Turn on Settings > General > Advanced > Command line interface in Obsidian." : "";
    return { ok: false, message: `${action.name} was not found (${action.command}).${hint}` };
  }

  const ctx: Context = { path: file };
  if (NEEDS_VAULT.test(action.args)) {
    let vaults: Vault[];
    try {
      vaults = parseVaults(await run(command, ["vaults", "verbose"]));
    } catch (error) {
      return { ok: false, message: `Cannot list Obsidian vaults: ${error instanceof Error ? error.message : String(error)}` };
    }
    const vault = vaultFor(file, vaults);
    if (!vault) return { ok: false, message: `This file is not inside any Obsidian vault: ${file}` };
    ctx.vault = vault;
  }

  const args = splitArgs(action.args).map((arg) => expandArg(arg, ctx));
  try {
    return { ok: true, output: await run(command, args, info.isDirectory() ? file : dirname(file)) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

/** Clock skew and file systems that round times make an exact match too strict. */
const MTIME_TOLERANCE_MS = 2000;

/**
 * True when this machine holds the same file: it exists here with the same size and modification
 * time. A path that only happens to exist on another machine does not match.
 */
export async function isSameFile(path: string, size: number, modifiedAt: string): Promise<boolean> {
  const info = await stat(path).catch(() => null);
  if (!info?.isFile() || info.size !== size) return false;
  const expected = Date.parse(modifiedAt);
  return Number.isNaN(expected) || Math.abs(info.mtimeMs - expected) <= MTIME_TOLERANCE_MS;
}
