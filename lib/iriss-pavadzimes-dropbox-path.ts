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
