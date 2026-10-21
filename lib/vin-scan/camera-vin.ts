/**
 * VIN SCAN kamera: VIN izvēle no OCR teksta un pēdējo skenējumu saraksts (tikai pārlūkā).
 */
import { hasIso3779CheckDigit, vinOcrAlphabetVariants } from "@/lib/vin-iso3779";
import { decodeVinLocal } from "@/lib/vin-scan/vin-decode";
import { isPlaceholderVin, isValidVin, normalizeVin } from "@/lib/order-field-validation";

export type CameraVinPick = { vin: string; checkDigitOk: boolean; alts: string[] };

type CameraVinHit = { vin: string; edge: number };

/** Logi pa 17 no katras rindas (arī bez atstarpēm). edge: 3 ja rinda ir tieši VIN, 1 ja logs sākas vai beidzas rindas malā. */
function cameraVinHits(text: string): CameraVinHit[] {
  const hits: CameraVinHit[] = [];
  const chunks = new Set<string>();
  for (const line of text.toUpperCase().split(/\r?\n/)) {
    for (const c of line.match(/[A-Z0-9]{17,}/g) ?? []) chunks.add(c);
    const joined = line.replace(/[^A-Z0-9]/g, "");
    if (joined.length >= 17) chunks.add(joined);
  }
  for (const chunk of chunks) {
    for (let i = 0; i <= chunk.length - 17; i++) {
      const edge = chunk.length === 17 ? 3 : i === 0 || i === chunk.length - 17 ? 1 : 0;
      for (const vin of vinOcrAlphabetVariants(chunk.slice(i, i + 17))) {
        if (!isPlaceholderVin(vin)) hits.push({ vin, edge });
      }
    }
  }
  return hits;
}

/** Kandidāti no teksta, arī ja VIN uz plāksnītes ir ar atstarpēm. */
export function cameraVinCandidates(text: string): string[] {
  const out: string[] = [];
  for (const h of cameraVinHits(text)) if (!out.includes(h.vin)) out.push(h.vin);
  return out;
}

/**
 * Punkti: zināms WMI ražotājs, ISO 3779 kontrolcipars, cik OCR variantos atkārtojas, vai logs sakrīt ar rindas malu.
 * Eiropas VIN bieži nav kontrolcipara, tāpēc tas vien neizšķir.
 */
export function pickCameraVin(texts: readonly string[]): CameraVinPick | null {
  const score = new Map<string, number>();
  for (const t of texts) {
    const best = new Map<string, number>();
    for (const h of cameraVinHits(t)) best.set(h.vin, Math.max(best.get(h.vin) ?? 0, h.edge));
    for (const [vin, edge] of best) score.set(vin, (score.get(vin) ?? 0) + 1 + edge);
  }
  if (score.size === 0) return null;
  const ranked = [...score.entries()]
    .map(([vin, s]) => [vin, s + (decodeVinLocal(vin).make ? 3 : 0) + (hasIso3779CheckDigit(vin) ? 2 : 0)] as const)
    .sort((a, b) => b[1] - a[1]);
  const vin = ranked[0]![0];
  return { vin, checkDigitOk: hasIso3779CheckDigit(vin), alts: ranked.slice(1, 4).map(([v]) => v) };
}

export const VIN_SCAN_HISTORY_KEY = "provin-vin-scan-history-v1";
export const VIN_SCAN_HISTORY_MAX = 15;

export type VinScanHistoryEntry = { vin: string; at: string };

export function parseVinScanHistory(raw: string | null): VinScanHistoryEntry[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (e): e is VinScanHistoryEntry =>
          Boolean(e) && typeof e === "object" && typeof (e as VinScanHistoryEntry).vin === "string" && typeof (e as VinScanHistoryEntry).at === "string",
      )
      .filter((e) => isValidVin(normalizeVin(e.vin)))
      .slice(0, VIN_SCAN_HISTORY_MAX);
  } catch {
    return [];
  }
}

/** Jaunākais augšā, viens VIN vienreiz, ne vairāk kā 15. */
export function pushVinScanHistory(list: readonly VinScanHistoryEntry[], vin: string, at: string): VinScanHistoryEntry[] {
  const v = normalizeVin(vin);
  if (!isValidVin(v)) return [...list];
  return [{ vin: v, at }, ...list.filter((e) => e.vin !== v)].slice(0, VIN_SCAN_HISTORY_MAX);
}

/** Īsa WMI rinda: ražotājs · valsts · gads. */
export function vinScanHistoryInfo(vin: string): string {
  const d = decodeVinLocal(vin);
  return [d.make, d.countryName, d.year].filter(Boolean).join(" · ") || `WMI ${d.wmi}`;
}
