import "server-only";

import { applyAutoparksRegistryFile, type AutoparksRegistryImportResult } from "@/lib/iriss-autoparks-store";
import { parseRegistryFile } from "@/lib/iriss-autoparks-registry";
import { getDropboxClient } from "@/lib/dropbox-client";
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
  | { ok: true; skipped: true; reason: "no_file" | "unchanged" | "older"; file?: string }
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
  const meta = ((await readLogisticsJsonFile(IMPORT_META_FILE)) ?? {}) as ImportMeta;
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
  // Vecāks rokas fails pēc automātiskā nolasījuma nedrīkst atgriezt vecus akta nr./statusus.
  if (!opts.force && isOlderRegistry(parsed.file.generatedAt, meta.registryDate)) {
    return { ok: true, skipped: true, reason: "older", file: latest.name };
  }
  const result = await applyAutoparksRegistryFile(parsed.file, latest.name);
  await writeImportMeta({ file: latest.name, contentHash: latest.contentHash, registryDate: parsed.file.generatedAt, source: "dropbox" }, parsed.file.vehicles.length, result);
  return { ok: true, skipped: false, file: latest.name, invalidRows: parsed.skipped, ...result };
}

type ImportMeta = { contentHash?: string; registryDate?: string };

/** `generatedAt` salīdzinājums pēc datuma (YYYY-MM-DD...). Nezināms datums nekad nav "vecāks". */
export function isOlderRegistry(generatedAt: string, lastRegistryDate: string | undefined): boolean {
  const a = generatedAt.slice(0, 10);
  const b = (lastRegistryDate ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(a) && /^\d{4}-\d{2}-\d{2}$/.test(b) && a < b;
}

async function writeImportMeta(
  base: { file: string; contentHash: string; registryDate: string; source: "dropbox" | "hetzner" },
  vehicles: number,
  result: AutoparksRegistryImportResult,
) {
  await writeLogisticsJsonFile(IMPORT_META_FILE, {
    ...base,
    importedAt: new Date().toISOString(),
    vehicles,
    matched: result.matched,
    updated: result.updated,
    added: result.added,
    removed: result.removed,
    actUpdated: result.actUpdated,
    statusChanged: result.statusChanged,
    unmatched: result.unmatched.length,
  });
}

export type RegistryPushRun =
  | ({ ok: true; file: string; archived: boolean; invalidRows: number; vehicles: number } & AutoparksRegistryImportResult)
  | { ok: false; error: string; status: number };

/**
 * Hetzner cron (`POST /api/iriss/csdd-registrs`): pilns reģistra nolasījums tieši importētājam.
 * Fails tiek arī saglabāts Dropbox mapē (vēsturei, tā pati shēma), un Dropbox cron to vairs neimportē otrreiz.
 */
export async function runAutoparksRegistryPush(raw: unknown, now: Date = new Date()): Promise<RegistryPushRun> {
  const parsed = parseRegistryFile(raw);
  if (!parsed.ok) return { ok: false, error: parsed.error, status: 400 };
  if (!parsed.file.snapshot) return { ok: false, error: "snapshot_required", status: 400 };
  const stamp = now.toISOString().slice(0, 16).replace(/[-:T]/g, "").replace(/^(\d{8})(\d{4})$/, "$1-$2");
  let file = `registrs-auto-${stamp}.json`;
  let contentHash = "";
  let archived = false;
  const dbx = getDropboxClient();
  if (dbx) {
    try {
      const entry = await dbx.upload(`${dropboxRegistryPath()}/${file}`, new TextEncoder().encode(JSON.stringify(raw, null, 2)), "add");
      file = entry.name;
      contentHash = entry.contentHash;
      archived = true;
    } catch (e) {
      console.warn("[autoparks-registry] archive_upload_failed", e instanceof Error ? e.message : "error");
    }
  }
  const result = await applyAutoparksRegistryFile(parsed.file, file);
  await writeImportMeta({ file, contentHash, registryDate: parsed.file.generatedAt, source: "hetzner" }, parsed.file.vehicles.length, result);
  return { ok: true, file, archived, invalidRows: parsed.skipped, vehicles: parsed.file.vehicles.length, ...result };
}
