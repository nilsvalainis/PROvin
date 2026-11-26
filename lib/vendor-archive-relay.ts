import "server-only";

/**
 * 2. fāze: pilnās arhīva bildes no CarVertical / AutoDNA releja (jau nopirktai atskaitei, tikai lasīšana).
 * Relejs: POST {baseUrl}/report-photos {vin} -> {status, groups:[{date, photos:[{base64, contentType}]}]}.
 * Ja relejs nav konfigurēts, aizņemts vai atskaites nav - paliek PDF sīktēli (nekas netiek mainīts).
 */

import { readAutodnaRelayConfig } from "@/lib/autodna-auto";
import { readCarverticalRelayConfig } from "@/lib/carvertical-auto";
import type { VendorArchiveSource } from "@/lib/vendor-archive-photo-group";
import { normalizeArchiveJpeg, parseArchiveGroupDate, type ExtractedArchiveGroup } from "@/lib/vendor-archive-photos-pdf";

const RELAY_TIMEOUT_MS = 180_000;
const MAX_PHOTOS = 100;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export type RelayArchivePhotosResult =
  | { ok: true; groups: ExtractedArchiveGroup[] }
  | { ok: false; reason: "not_configured" | "busy" | "needs_login" | "not_found" | "no_photos" | "error" };

export function vendorArchiveRelayConfigured(source: VendorArchiveSource, env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(source === "carvertical" ? readCarverticalRelayConfig(env) : readAutodnaRelayConfig(env));
}

/** Releja atbilde -> grupas (JPEG ≤1600 px / ≤320 KB); svešu formātu / bojātu bildi izlaiž. */
export async function parseRelayArchivePhotos(json: unknown): Promise<ExtractedArchiveGroup[]> {
  const raw = json && typeof json === "object" ? (json as { groups?: unknown }).groups : null;
  if (!Array.isArray(raw)) return [];
  const out: ExtractedArchiveGroup[] = [];
  let total = 0;
  for (const g of raw) {
    if (!g || typeof g !== "object") continue;
    const date = parseArchiveGroupDate(String((g as { date?: unknown }).date ?? "")) ?? "";
    const photos: ExtractedArchiveGroup["photos"] = [];
    for (const ph of Array.isArray((g as { photos?: unknown }).photos) ? ((g as { photos: unknown[] }).photos) : []) {
      if (total >= MAX_PHOTOS) break;
      const b64 = ph && typeof ph === "object" ? (ph as { base64?: unknown }).base64 : null;
      const ct = ph && typeof ph === "object" ? String((ph as { contentType?: unknown }).contentType ?? "") : "";
      if (typeof b64 !== "string" || !/^image\/(jpeg|jpg|png|webp)/i.test(ct)) continue;
      const buf = Buffer.from(b64, "base64");
      if (buf.length < 1000 || buf.length > MAX_PHOTO_BYTES) continue;
      const norm = await normalizeArchiveJpeg(buf);
      if (!norm) continue;
      photos.push(norm);
      total++;
    }
    if (photos.length) {
      const same = out.find((x) => x.date === date);
      if (same) same.photos.push(...photos);
      else out.push({ date, photos });
    }
  }
  return out;
}

export async function fetchVendorArchiveRelayPhotos(
  source: VendorArchiveSource,
  vin: string,
  opts: { timeoutMs?: number } = {},
): Promise<RelayArchivePhotosResult> {
  const config = source === "carvertical" ? readCarverticalRelayConfig() : readAutodnaRelayConfig();
  if (!config) return { ok: false, reason: "not_configured" };
  try {
    const res = await fetch(`${config.baseUrl}/report-photos`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ vin }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? RELAY_TIMEOUT_MS),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { status?: string };
    const status = json.status ?? "";
    if (status === "busy" || status === "needs_login" || status === "not_found" || status === "no_photos") {
      return { ok: false, reason: status };
    }
    if (!res.ok || status !== "ok") return { ok: false, reason: "error" };
    const groups = await parseRelayArchivePhotos(json);
    return groups.length ? { ok: true, groups } : { ok: false, reason: "no_photos" };
  } catch {
    return { ok: false, reason: "error" };
  }
}

export const RELAY_ARCHIVE_REASON_LV: Record<Exclude<RelayArchivePhotosResult, { ok: true }>["reason"], string> = {
  not_configured: "",
  busy: "Relejs aizņemts - pilnās bildes vēlāk ar pogu «Ielādēt arhīva foto».",
  needs_login: "Relejs nav pieslēgts - pilnās bildes pēc pieslēgšanas.",
  not_found: "Relejs atskaiti kontā neatrada - paliek PDF bildes.",
  no_photos: "Relejs pilnās bildes neatrada - paliek PDF bildes.",
  error: "Releja pilnās bildes neizdevās ielādēt - paliek PDF bildes.",
};
