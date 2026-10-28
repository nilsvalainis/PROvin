/**
 * Bezmaksas VIN dekoders (audits P10 A): tikai no paša VIN struktūras (ISO 3779/3780), bez ārējiem
 * pieprasījumiem un bez CSDD kvotas. Ražotājs pēc WMI (1.-3. zīme), reģions/valsts pēc 1.-2. zīmes,
 * iespējamie modeļa gadi pēc 10. zīmes, kontrolcipars (9. zīme) tikai Ziemeļamerikas VIN.
 */

const VIN_CHARS = /^[A-HJ-NPR-Z0-9]{17}$/;

/** Bieži sastopamie WMI Latvijas tirgū: marka (bez valodas paskaidrojumiem) un ražošanas valsts (ISO). Nav pilnīgs saraksts. */
const WMI: Record<string, { make: string; country: string }> = {
  WVW: { make: "Volkswagen", country: "DE" },
  WV1: { make: "Volkswagen", country: "DE" },
  WV2: { make: "Volkswagen", country: "DE" },
  WVG: { make: "Volkswagen", country: "DE" },
  WAU: { make: "Audi", country: "DE" },
  WUA: { make: "Audi Sport", country: "DE" },
  WBA: { make: "BMW", country: "DE" },
  WBS: { make: "BMW M", country: "DE" },
  WBY: { make: "BMW i", country: "DE" },
  WMW: { make: "MINI", country: "DE" },
  WDD: { make: "Mercedes-Benz", country: "DE" },
  WDB: { make: "Mercedes-Benz", country: "DE" },
  WDC: { make: "Mercedes-Benz", country: "DE" },
  W1K: { make: "Mercedes-Benz", country: "DE" },
  W1N: { make: "Mercedes-Benz", country: "DE" },
  W1V: { make: "Mercedes-Benz", country: "DE" },
  WDF: { make: "Mercedes-Benz", country: "DE" },
  WP0: { make: "Porsche", country: "DE" },
  WP1: { make: "Porsche", country: "DE" },
  W0L: { make: "Opel", country: "DE" },
  W0V: { make: "Opel", country: "DE" },
  WF0: { make: "Ford", country: "DE" },
  WME: { make: "smart", country: "DE" },
  TMB: { make: "Škoda", country: "CZ" },
  TMA: { make: "Hyundai", country: "CZ" },
  VSS: { make: "SEAT / Cupra", country: "ES" },
  VS6: { make: "Ford", country: "ES" },
  VF1: { make: "Renault", country: "FR" },
  VF3: { make: "Peugeot", country: "FR" },
  VF7: { make: "Citroën", country: "FR" },
  VR3: { make: "Peugeot", country: "FR" },
  VR1: { make: "DS Automobiles", country: "FR" },
  VNK: { make: "Toyota", country: "FR" },
  UU1: { make: "Dacia", country: "RO" },
  ZFA: { make: "Fiat", country: "IT" },
  ZAR: { make: "Alfa Romeo", country: "IT" },
  ZFF: { make: "Ferrari", country: "IT" },
  ZHW: { make: "Lamborghini", country: "IT" },
  ZAM: { make: "Maserati", country: "IT" },
  YV1: { make: "Volvo", country: "SE" },
  YV4: { make: "Volvo", country: "SE" },
  YS3: { make: "Saab", country: "SE" },
  SAL: { make: "Land Rover", country: "GB" },
  SAJ: { make: "Jaguar", country: "GB" },
  SCC: { make: "Lotus", country: "GB" },
  SJN: { make: "Nissan", country: "GB" },
  SB1: { make: "Toyota", country: "GB" },
  NMT: { make: "Toyota", country: "TR" },
  U5Y: { make: "Kia", country: "SK" },
  TSM: { make: "Suzuki", country: "HU" },
  XTA: { make: "Lada", country: "RU" },
  JTD: { make: "Toyota", country: "JP" },
  JTE: { make: "Toyota", country: "JP" },
  JTN: { make: "Toyota", country: "JP" },
  JTH: { make: "Lexus", country: "JP" },
  JHM: { make: "Honda", country: "JP" },
  JN1: { make: "Nissan", country: "JP" },
  JMZ: { make: "Mazda", country: "JP" },
  JM1: { make: "Mazda", country: "JP" },
  JF1: { make: "Subaru", country: "JP" },
  JS3: { make: "Suzuki", country: "JP" },
  JMB: { make: "Mitsubishi", country: "JP" },
  KMH: { make: "Hyundai", country: "KR" },
  KNA: { make: "Kia", country: "KR" },
  KND: { make: "Kia", country: "KR" },
  KMT: { make: "Genesis", country: "KR" },
  "5YJ": { make: "Tesla", country: "US" },
  "7SA": { make: "Tesla", country: "US" },
  LRW: { make: "Tesla", country: "CN" },
  XP7: { make: "Tesla", country: "DE" },
  "1FA": { make: "Ford", country: "US" },
  "1FM": { make: "Ford", country: "US" },
  "1G1": { make: "Chevrolet", country: "US" },
  "1C4": { make: "Jeep / Chrysler", country: "US" },
  "2T1": { make: "Toyota", country: "CA" },
  "1HG": { make: "Honda", country: "US" },
  "19X": { make: "Honda", country: "US" },
  "5J6": { make: "Honda", country: "US" },
  "2HG": { make: "Honda", country: "CA" },
  "19U": { make: "Acura", country: "US" },
  "4T1": { make: "Toyota", country: "US" },
  "5TD": { make: "Toyota", country: "US" },
  "5TF": { make: "Toyota", country: "US" },
  "1N4": { make: "Nissan", country: "US" },
  "5N1": { make: "Nissan", country: "US" },
  "5NP": { make: "Hyundai", country: "US" },
  "5XY": { make: "Kia", country: "US" },
  "4S4": { make: "Subaru", country: "US" },
  "5UX": { make: "BMW", country: "US" },
  "4JG": { make: "Mercedes-Benz", country: "US" },
  "1VW": { make: "Volkswagen", country: "US" },
  "1FT": { make: "Ford", country: "US" },
  "1GC": { make: "Chevrolet", country: "US" },
  "1GT": { make: "GMC", country: "US" },
  "1G6": { make: "Cadillac", country: "US" },
  "5LM": { make: "Lincoln", country: "US" },
  "2C3": { make: "Dodge / Chrysler", country: "CA" },
  "1C6": { make: "Ram", country: "US" },
  "7JR": { make: "Volvo", country: "US" },
  "3VW": { make: "Volkswagen", country: "MX" },
  LVS: { make: "Ford", country: "CN" },
  LSJ: { make: "MG", country: "CN" },
  LVV: { make: "Chery", country: "CN" },
  LGX: { make: "BYD", country: "CN" },
};

export type VinRegion = "africa" | "asia" | "europe" | "northAmerica" | "oceania" | "southAmerica";

/** ISO 3780 reģions pēc 1. zīmes (atslēga; tekstu dod lapas tulkojumi). */
function regionOf(first: string): VinRegion {
  if ("ABCDEFGH".includes(first)) return "africa";
  if ("JKLMNP".includes(first)) return "asia";
  if ("RSTUVWXYZ".includes(first)) return "europe";
  if ("12345".includes(first)) return "northAmerica";
  if ("67".includes(first)) return "oceania";
  return "southAmerica";
}

/** Ziemeļamerikas valsts pēc 1. zīmes, ja WMI nav sarakstā (ISO 3780). */
function northAmericaCountry(first: string): string | null {
  if ("145".includes(first)) return "US";
  if (first === "2") return "CA";
  if (first === "3") return "MX";
  return null;
}

/** 10. zīmes gadu kods (bez I, O, Q, U, Z un 0); cikls atkārtojas ik pēc 30 gadiem. */
const YEAR_CODES = "ABCDEFGHJKLMNPRSTVWXY123456789";

export function vinModelYears(code: string, now: Date = new Date()): number[] {
  const idx = YEAR_CODES.indexOf(code);
  if (idx < 0) return [];
  const maxYear = now.getUTCFullYear() + 1;
  const years: number[] = [];
  for (let y = 1980 + idx; y <= maxYear; y += 30) years.push(y);
  return years.reverse();
}

const TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/** Kontrolcipars (9. zīme). Obligāts Ziemeļamerikas VIN; Eiropā bieži netiek lietots. */
export function vinCheckDigitValid(vin: string): boolean {
  let sum = 0;
  for (let i = 0; i < 17; i += 1) {
    const ch = vin[i];
    const v = /\d/.test(ch) ? Number(ch) : TRANSLIT[ch];
    if (v === undefined) return false;
    sum += v * WEIGHTS[i];
  }
  const rem = sum % 11;
  return vin[8] === (rem === 10 ? "X" : String(rem));
}

export type VinDecodeResult =
  | { ok: false; error: "length" | "chars" }
  | {
      ok: true;
      vin: string;
      wmi: string;
      make: string | null;
      country: string | null;
      region: VinRegion;
      modelYears: number[];
      plantCode: string;
      serial: string;
      /** `null` = kontrolcipars šim reģionam nav obligāts. */
      checkDigitValid: boolean | null;
    };

export function decodeVin(raw: string, now: Date = new Date()): VinDecodeResult {
  const vin = raw.replace(/\s+/g, "").toUpperCase();
  if (vin.length !== 17) return { ok: false, error: "length" };
  if (!VIN_CHARS.test(vin)) return { ok: false, error: "chars" };
  const wmi = vin.slice(0, 3);
  const known = WMI[wmi] ?? null;
  const northAmerica = "12345".includes(vin[0]);
  return {
    ok: true,
    vin,
    wmi,
    make: known?.make ?? null,
    country: known?.country ?? northAmericaCountry(vin[0]),
    region: regionOf(vin[0]),
    modelYears: vinModelYears(vin[9], now),
    plantCode: vin[10],
    serial: vin.slice(11),
    checkDigitValid: northAmerica ? vinCheckDigitValid(vin) : null,
  };
}
