/** Normalizē Dropbox ceļu salīdzināšanai (reģistrjutīgs pret path_lower). */
export function normalizeDropboxPath(p: string): string {
  let s = p.trim().replace(/\\/g, "/");
  if (!s) return "";
  if (!s.startsWith("/")) s = `/${s}`;
  return s.replace(/\/+$/, "") || "/";
}

/**
 * Tikai tieši mapes bērni (ne apakšmapes, piem. Arhīvs).
 * App Folder režīmā mape var būt "" — tad ceļā nedrīkst būt `/`.
 */
export function isDirectChildOfDropboxFolder(filePath: string, folderPath: string): boolean {
  const file = normalizeDropboxPath(filePath);
  if (!file) return false;
  const folder = normalizeDropboxPath(folderPath);
  if (!folder || folder === "/") {
    const rel = file.startsWith("/") ? file.slice(1) : file;
    return rel.length > 0 && !rel.includes("/");
  }
  const prefix = `${folder}/`;
  if (!file.startsWith(prefix)) return false;
  const rel = file.slice(prefix.length);
  return rel.length > 0 && !rel.includes("/");
}

/** Arhīva apakšmape (CSDD aģents pārvieto beigušās/aizstātās pavadzīmes). */
const ARCHIVE_DIR_RE = /^arh[iī]vs$/i;

export type DropboxWaybillPlacement = "current" | "archive";

/**
 * Pavadzīmju mapes PDF: tieši mapē = "current", `Arhīvs/` tiešie bērni = "archive".
 * Citas apakšmapes ignorē. Admin rāda abas — pavadzīme nedrīkst pazust no saraksta, kad to arhivē.
 */
export function classifyDropboxWaybillPath(filePath: string, folderPath: string): DropboxWaybillPlacement | null {
  const file = normalizeDropboxPath(filePath);
  if (!file) return null;
  const folder = normalizeDropboxPath(folderPath);
  let rel: string;
  if (!folder || folder === "/") {
    rel = file.startsWith("/") ? file.slice(1) : file;
  } else {
    const prefix = `${folder}/`;
    if (!file.toLowerCase().startsWith(prefix.toLowerCase())) return null;
    rel = file.slice(prefix.length);
  }
  if (!rel) return null;
  const parts = rel.split("/");
  if (parts.length === 1) return "current";
  if (parts.length === 2 && ARCHIVE_DIR_RE.test((parts[0] ?? "").normalize("NFC")) && parts[1]) return "archive";
  return null;
}
