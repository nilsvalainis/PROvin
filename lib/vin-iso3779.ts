/**
 * ISO 3779 VIN check digit (position 9). Used when OCR or a noisy string
 * must not be accepted as a VIN just because it is 17 characters.
 * Order/CSDD `isValidVin` stays 11-17 without the check digit.
 */

import { isPlaceholderVin, normalizeVin } from "@/lib/order-field-validation";

const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2] as const;

const TRANSLIT: Record<string, number> = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  J: 1,
  K: 2,
  L: 3,
  M: 4,
  N: 5,
  P: 7,
  R: 9,
  S: 2,
  T: 3,
  U: 4,
  V: 5,
  W: 6,
  X: 7,
  Y: 8,
  Z: 9,
};

const VIN17_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

export function normalizeIsoVin(raw: string): string {
  return normalizeVin(raw).replace(/[^A-Z0-9]/g, "");
}

/** ISO 3779 check character for a 17-char VIN, or null if the alphabet is invalid. */
export function iso3779CheckDigit(vin17: string): string | null {
  const v = normalizeIsoVin(vin17);
  if (v.length !== 17) return null;
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const n = TRANSLIT[v[i]!];
    if (n == null) return null;
    sum += n * WEIGHTS[i]!;
  }
  const r = sum % 11;
  return r === 10 ? "X" : String(r);
}

/** True only for a 17-char VIN whose 9th character matches the ISO 3779 check digit. */
export function hasIso3779CheckDigit(vin: string): boolean {
  const v = normalizeIsoVin(vin);
  if (!VIN17_RE.test(v)) return false;
  return iso3779CheckDigit(v) === v[8];
}

/**
 * OCR often reads 0 as O, 1 as I, 9 as Q. Only those substitutions; valid VIN
 * letters are left alone so we do not invent a check-digit match.
 */
export function vinOcrAlphabetVariants(raw17: string): string[] {
  const v = normalizeIsoVin(raw17);
  if (v.length !== 17) return [];
  const subst = v.replace(/I/g, "1").replace(/O/g, "0").replace(/Q/g, "0");
  const out: string[] = [];
  if (VIN17_RE.test(v)) out.push(v);
  if (subst !== v && VIN17_RE.test(subst)) out.push(subst);
  return out;
}

/** Sliding 17-char windows from OCR / document text; check-digit required. */
export function extractIso3779VinsFromText(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const chunks = text.toUpperCase().match(/[A-Z0-9]{17,}/g) ?? [];
  for (const chunk of chunks) {
    for (let i = 0; i <= chunk.length - 17; i++) {
      for (const cand of vinOcrAlphabetVariants(chunk.slice(i, i + 17))) {
        if (!hasIso3779CheckDigit(cand) || isPlaceholderVin(cand) || seen.has(cand)) continue;
        seen.add(cand);
        found.push(cand);
      }
    }
  }
  return found;
}
