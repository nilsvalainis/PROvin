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

/**
 * Nils 01.11: «VIN ielasa nepareizi». Viens kadrs OCR bieži kļūdās 1-2 rakstzīmēs, tāpēc VIN pieņem tikai,
 * kad vairāki kadri sakrīt. Balsojums pa pozīcijām: ja 3 kadros katrā kļūda citā vietā, vairākums to izlabo.
 */
export type CameraVinConsensus = { vin: string; checkDigitOk: boolean; agree: number; frames: number };

/** Kadri ar to pašu WMI (pirmās 3 rakstzīmes) kā biežākais - citi ir cits teksts kadrā. */
function sameWmiGroup(picks: readonly string[]): string[] {
  const count = new Map<string, number>();
  for (const v of picks) count.set(v.slice(0, 3), (count.get(v.slice(0, 3)) ?? 0) + 1);
  const wmi = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  return picks.filter((v) => v.startsWith(wmi));
}

/**
 * Kopējais VIN no kadru izvēlēm. `agree` = mazākais balsu skaits kādai pozīcijai (cik kadri apstiprina vājāko rakstzīmi).
 * Pieņem, kad agree >= minAgree (noklusējumā 2).
 */
export function cameraVinConsensus(picks: readonly string[], minAgree = 2): CameraVinConsensus | null {
  const valid = picks.map((v) => normalizeVin(v)).filter((v) => v.length === 17 && isValidVin(v));
  if (valid.length === 0) return null;
  const group = sameWmiGroup(valid);
  let vin = "";
  let agree = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 17; i++) {
    const votes = new Map<string, number>();
    for (const v of group) votes.set(v[i]!, (votes.get(v[i]!) ?? 0) + 1);
    const [ch, n] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]!;
    vin += ch;
    agree = Math.min(agree, n);
  }
  if (agree < minAgree) return null;
  return { vin, checkDigitOk: hasIso3779CheckDigit(vin), agree, frames: group.length };
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

/** Servera un pārlūka vēsture kopā: jaunākais augšā, katrs VIN vienreiz, ne vairāk kā 15. */
export function mergeVinScanHistory(
  a: readonly VinScanHistoryEntry[],
  b: readonly VinScanHistoryEntry[],
): VinScanHistoryEntry[] {
  const best = new Map<string, VinScanHistoryEntry>();
  for (const e of [...a, ...b]) {
    const prev = best.get(e.vin);
    if (!prev || e.at > prev.at) best.set(e.vin, e);
  }
  return [...best.values()].sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0)).slice(0, VIN_SCAN_HISTORY_MAX);
}
