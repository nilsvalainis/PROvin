/**
 * VIN formāts un ISO 3779 kontrolcipars (17 zīmes). Īsāki kodi paliek derīgi pēc alfabēta, bez kontrolcipara.
 */

const TRANSLIT: Record<string, number> = {
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

const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

export function vinTransliterationValue(ch: string): number | null {
  const c = ch.toUpperCase();
  if (/[0-9]/.test(c)) return Number(c);
  return TRANSLIT[c] ?? null;
}

/** ISO 3779 kontrolcipars 17 zīmju VIN 9. pozīcijai (`0`-`9` vai `X`). */
export function iso3779CheckDigit(vin17: string): string | null {
  const v = vin17.trim().toUpperCase();
  if (v.length !== 17) return null;
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const n = vinTransliterationValue(v[i] ?? "");
    if (n == null) return null;
    sum += n * (WEIGHTS[i] ?? 0);
  }
  const rem = sum % 11;
  return rem === 10 ? "X" : String(rem);
}

export function vinCheckDigitOk(vin: string): boolean {
  const v = vin.trim().toUpperCase();
  if (v.length !== 17) return true;
  const expected = iso3779CheckDigit(v);
  if (!expected) return false;
  return v[8] === expected;
}

export type VinScanVinHint = {
  ok: boolean;
  warning: string;
};

export function vinScanFormatHint(vin: string): VinScanVinHint {
  const v = vin.trim().toUpperCase().replace(/[\s-]/g, "");
  if (!v) return { ok: false, warning: "" };
  if (v.length < 11 || v.length > 17) {
    return { ok: false, warning: "VIN ir 11-17 zīmes, bez I, O, Q" };
  }
  if (!/^[A-HJ-NPR-Z0-9]+$/.test(v)) {
    return { ok: false, warning: "VIN satur neatļautu zīmi (I, O, Q vai simbols)" };
  }
  if (v.length === 17 && !vinCheckDigitOk(v)) {
    const expected = iso3779CheckDigit(v);
    return {
      ok: true,
      warning: expected
        ? `ISO 3779 kontrolcipars nesakrīt (9. zīme ${v[8]}, jābūt ${expected}). Skenēšana turpinās.`
        : "ISO 3779 kontrolciparu neizdevās aprēķināt. Skenēšana turpinās.",
    };
  }
  return { ok: true, warning: "" };
}
