/**
 * Edge-droša Google admin stāvokļa lasīšana vārtiem. Tikai Blob; lokālais `.data` šeit nav.
 * Lasīšanas kļūda / nav tokena = `null` (vārti produkcijā atsakās, nevis fail-open).
 */

import { ADMIN_GOOGLE_STATE_BLOB_PATH, emptyAdminGoogleState, parseAdminGoogleState, type AdminGoogleState } from "@/lib/admin-google-session-live";
import { readPrivateBlobText } from "@/lib/blob-read";

export async function loadAdminGoogleStateForGate(
  env: NodeJS.ProcessEnv = process.env,
): Promise<AdminGoogleState | null> {
  const token = env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  if (!token) return null;
  try {
    const snap = await readPrivateBlobText({ pathname: ADMIN_GOOGLE_STATE_BLOB_PATH, token });
    if (snap.state === "missing") return emptyAdminGoogleState();
    return parseAdminGoogleState(JSON.parse(snap.text) as unknown);
  } catch {
    return null;
  }
}

export function adminApiGateIsProduction(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}
