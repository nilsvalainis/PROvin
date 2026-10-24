/**
 * IRISS VIN mīkstā pārbaude: 17 zīmes, bez I/O/Q, ISO 3779 kontrolcipars.
 * Tukšs lauks nav kļūda. Brīdinājums nebloķē saglabāšanu.
 * Kontrolcipars (9. zīme) ir obligāts tikai Ziemeļamerikas izgatavotājiem (WMI 1. zīme "1"-"5" -
 * ASV, Kanāda, Meksika); citur (Eiropa, Āzija u.c.) tas nav standartizēts, tāpēc brīdinājumu nerāda.
 */

const VIN_TRANSLIT: Record<string, number> = {
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

const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

export function normalizeIrissVin(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]/g, "");
}

export function irissVinCheckDigitOk(vin: string): boolean {
  const v = normalizeIrissVin(vin);
  if (v.length !== 17) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const ch = v[i]!;
    const n = /[0-9]/.test(ch) ? Number(ch) : VIN_TRANSLIT[ch];
    if (n == null) return false;
    sum += n * VIN_WEIGHTS[i]!;
  }
  const rest = sum % 11;
  const expect = rest === 10 ? "X" : String(rest);
  return v[8] === expect;
}

/** Vai VIN 1. zīme (WMI) ir Ziemeļamerikas diapazonā ("1"-"5": ASV, Kanāda, Meksika). */
export function isNorthAmericanVin(vin: string): boolean {
  const v = normalizeIrissVin(vin);
  return /^[1-5]/.test(v);
}

/** Mīksts brīdinājums. `null` = tukšs vai derīgs. */
export function irissVinWarning(raw: string): string | null {
  const v = normalizeIrissVin(raw);
  if (!v) return null;
  if (v.length !== 17) return "VIN parasti ir 17 rakstzīmes.";
  if (/[IOQ]/.test(v)) return "VIN nedrīkst saturēt I, O vai Q.";
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) return "VIN satur nederīgas rakstzīmes.";
  if (isNorthAmericanVin(v) && !irissVinCheckDigitOk(v)) return "VIN kontrolcipars nesakrīt. Pārbaudi pārrakstīšanu.";
  return null;
}
