import "server-only";

import { applyAutoparksRegistryFile, type AutoparksRegistryImportResult } from "@/lib/iriss-autoparks-store";
import { parseRegistryFile } from "@/lib/iriss-autoparks-registry";
import { downloadDropboxFile, getDropboxAccessToken } from "@/lib/iriss-pavadzimes-dropbox";
import { readLogisticsJsonFile, writeLogisticsJsonFile } from "@/lib/iriss-logistics-store";

const DROPBOX_API = "https://api.dropboxapi.com/2";
/** Pēdējā importa atzīme (lai to pašu failu neimportē katru dienu no jauna). */
const IMPORT_META_FILE = "autoparks-registry-import.json";

/** Mape, kurā Aivars ieliek reģistra JSON failus. */
export function dropboxRegistryPath(): string {
  return process.env.DROPBOX_CSDD_REGISTRS_PATH?.trim() || "/CSDD_registrs_IRISS";
}

export type RegistryDropboxEntry = { id: string; name: string; path: string; contentHash: string; serverModified: string };

type ListEntry = { ".tag"?: string; id?: string; name?: string; path_display?: string; content_hash?: string; server_modified?: string };

/** Jaunākais `.json` fails pēc Dropbox laika (vienādam laikam - pēc nosaukuma). */
export function pickLatestRegistryEntry(entries: readonly ListEntry[]): RegistryDropboxEntry | null {
  const files = entries
    .filter((e) => (e[".tag"] ?? "file") === "file" && typeof e.name === "string" && e.name.toLowerCase().endsWith(".json"))
    .map((e) => ({
      id: e.id ?? "",
      name: e.name!,
      path: e.path_display ?? e.name!,
      contentHash: e.content_hash ?? "",
      serverModified: e.server_modified ?? "",
    }));
  files.sort((a, b) => b.serverModified.localeCompare(a.serverModified) || b.name.localeCompare(a.name));
  return files[0] ?? null;
}

async function listRegistryFolder(token: string): Promise<ListEntry[]> {
  const out: ListEntry[] = [];
  let body: Record<string, unknown> = { path: dropboxRegistryPath(), recursive: false, limit: 500 };
  let url = `${DROPBOX_API}/files/list_folder`;
  for (let i = 0; i < 10; i++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`dropbox_list_${res.status}`);
    const json = (await res.json()) as { entries?: ListEntry[]; has_more?: boolean; cursor?: string };
    out.push(...(json.entries ?? []));
    if (!json.has_more || !json.cursor) break;
    url = `${DROPBOX_API}/files/list_folder/continue`;
    body = { cursor: json.cursor };
  }
  return out;
}

export type RegistryImportRun =
  | { ok: true; skipped: true; reason: "no_file" | "unchanged"; file?: string }
  | ({ ok: true; skipped: false; file: string; invalidRows: number } & AutoparksRegistryImportResult)
  | { ok: false; error: string };

/** Cron: nolasa jaunāko failu no Dropbox caur API un ieliek kartītēs. Bez AI. */
export async function runAutoparksRegistryImport(opts: { force?: boolean } = {}): Promise<RegistryImportRun> {
  const token = await getDropboxAccessToken().catch(() => null);
  if (!token) return { ok: false, error: "dropbox_not_configured" };
  let latest: RegistryDropboxEntry | null;
  try {
    latest = pickLatestRegistryEntry(await listRegistryFolder(token));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "dropbox_list_failed" };
  }
  if (!latest) return { ok: true, skipped: true, reason: "no_file" };
  const meta = ((await readLogisticsJsonFile(IMPORT_META_FILE)) ?? {}) as { contentHash?: string };
  if (!opts.force && latest.contentHash && meta.contentHash === latest.contentHash) {
    return { ok: true, skipped: true, reason: "unchanged", file: latest.name };
  }
  let raw: unknown;
  try {
    raw = JSON.parse((await downloadDropboxFile(latest.id || latest.path)).toString("utf8"));
  } catch {
    return { ok: false, error: "invalid_json" };
  }
  const parsed = parseRegistryFile(raw);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const result = await applyAutoparksRegistryFile(parsed.file, latest.name);
  await writeLogisticsJsonFile(IMPORT_META_FILE, {
    file: latest.name,
    contentHash: latest.contentHash,
    importedAt: new Date().toISOString(),
    vehicles: parsed.file.vehicles.length,
    matched: result.matched,
    updated: result.updated,
    unmatched: result.unmatched.length,
  });
  return { ok: true, skipped: false, file: latest.name, invalidRows: parsed.skipped, ...result };
}
