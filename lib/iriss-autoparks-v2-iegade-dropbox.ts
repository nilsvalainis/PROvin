import "server-only";

import type { DropboxClient } from "@/lib/dropbox-client";
import { getDropboxClient } from "@/lib/dropbox-client";
import { joinDropboxPath, sanitizeDropboxName } from "@/lib/iriss-autoparks-dropbox-path";

/** Auto Dropbox /STOCK mapes dokumentu apakšmape (J36 struktūra). `null` = auto nav sasaistīts ar Dropbox. */
export function iegadeStockDocFolder(car: { dropboxFolderPath?: string }): string | null {
  const path = (car.dropboxFolderPath ?? "").trim();
  return path ? joinDropboxPath(path, "doc") : null;
}

/** Dokumenta faila nosaukums Dropbox mapē: nosaukums no kartītes + oriģinālā paplašinājuma. */
export function iegadeDocDropboxFileName(title: string, fileName: string, contentType: string): string {
  const ext = (fileName.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? (contentType.includes("pdf") ? ".pdf" : "")).toLowerCase();
  const base = sanitizeDropboxName(title || fileName.replace(/\.[a-z0-9]{2,5}$/i, ""), 140) || "Dokuments";
  return `${base}${ext}`;
}

/**
 * Augšupielādē Iegādes dokumentu Dropbox /STOCK `doc/` mapē (J30 F1). Labākā piepūle - `null`, ja
 * Dropbox nav konfigurēts, auto nav sasaistīts, vai pieprasījums neizdevās (nekad nebloķē
 * saglabāšanu blob krātuvē - tā paliek patiesais avots).
 */
export async function uploadIegadeDocumentToStock(
  folder: string,
  fileName: string,
  bytes: Buffer,
  client: DropboxClient | null = getDropboxClient(),
): Promise<string | null> {
  if (!client) return null;
  try {
    await client.ensureFolder(folder);
    const entry = await client.upload(joinDropboxPath(folder, fileName), bytes, "add", { autorename: true });
    return entry.pathDisplay || null;
  } catch {
    return null;
  }
}

/** Pārdēvē/pārvieto Dropbox failu uz jauno nosaukumu (tajā pašā mapē). Labākā piepūle - `null` pie kļūmes. */
export async function renameIegadeDocumentInStock(
  oldPath: string,
  newFileName: string,
  client: DropboxClient | null = getDropboxClient(),
): Promise<string | null> {
  if (!client || !oldPath) return null;
  const folder = oldPath.replace(/\/[^/]+$/, "");
  if (!folder) return null;
  try {
    const entry = await client.move(oldPath, joinDropboxPath(folder, newFileName), { autorename: true });
    return entry.pathDisplay || null;
  } catch {
    return null;
  }
}

/** Dzēš Dropbox failu (uz "Deleted files" - atgūstams). Labākā piepūle - kļūdas tiek apslāpētas. */
export async function deleteIegadeDocumentFromStock(path: string, client: DropboxClient | null = getDropboxClient()): Promise<void> {
  if (!client || !path) return;
  await client.deleteFile(path).catch(() => undefined);
}
