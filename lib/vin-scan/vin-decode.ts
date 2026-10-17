/**
 * ISO 3779 VIN dekodēšana bez tīkla: WMI (ražotājs + izcelsmes valsts),
 * modeļa gads (10. zīme), rūpnīcas kods (11. zīme).
 * NHTSA vPIC paliek bagātināšana; šis vienmēr dod vismaz valsti/marku.
 */

import { iso3779CheckDigit } from "@/lib/vin-scan/vin-check";
import type { VinScanParse } from "@/lib/vin-scan/types";

const NORDIC_COUNTRIES = new Set(["SE", "NO", "FI", "DK"]);

const COUNTRY_LV: Record<string, string> = {
  SE: "Zviedrija",
  NO: "Norvēģija",
  FI: "Somija",
  DK: "Dānija",
  DE: "Vācija",
  NL: "Nīderlande",
  BE: "Beļģija",
  FR: "Francija",
  ES: "Spānija",
  IT: "Itālija",
  GB: "Lielbritānija",
  CZ: "Čehija",
  SK: "Slovākija",
  HU: "Ungārija",
  RO: "Rumānija",
  PL: "Polija",
  AT: "Austrija",
  JP: "Japāna",
  KR: "Dienvidkoreja",
  CN: "Ķīna",
  US: "ASV",
  CA: "Kanāda",
  MX: "Meksika",
  TR: "Turcija",
  ZA: "Dienvidāfrika",
};

/** 3 zīmju WMI → marka (PROVIN tirgus + biežākie Eiropas/ASV). */
const WMI_MAKE: Record<string, string> = {
  "1C4": "Jeep",
  "1C6": "Ram",
  "1FA": "Ford",
  "1FT": "Ford",
  "1G1": "Chevrolet",
  "1HG": "Honda",
  "1VW": "Volkswagen",
  "2T1": "Toyota",
  "3VW": "Volkswagen",
  "4JG": "Mercedes-Benz",
  "4T1": "Toyota",
  "5TD": "Toyota",
  "5TF": "Toyota",
  "5UX": "BMW",
  "5YM": "BMW",
  "58A": "Lexus",
  "7MU": "Lexus",
  "8AC": "Mercedes-Benz",
  AAV: "Volkswagen",
  JA3: "Mitsubishi",
  JF1: "Subaru",
  JF2: "Subaru",
  JH4: "Acura",
  JHM: "Honda",
  JM1: "Mazda",
  JN1: "Nissan",
  JN8: "Nissan",
  JS1: "Suzuki",
  JT2: "Toyota",
  JT3: "Toyota",
  JT4: "Toyota",
  JT6: "Toyota",
  JT8: "Lexus",
  JTD: "Toyota",
  JTE: "Toyota",
  JTH: "Lexus",
  JTJ: "Lexus",
  KMH: "Hyundai",
  KNA: "Kia",
  LYV: "Volvo",
  SAJ: "Jaguar",
  SAL: "Land Rover",
  SCA: "Rolls-Royce",
  SCC: "Lotus",
  SCF: "Aston Martin",
  SGZ: "MG",
  SJA: "Bentley",
  TMB: "Škoda",
  TRU: "Audi",
  U5Y: "Kia",
  UH1: "Opel",
  UU1: "Dacia",
  VF1: "Renault",
  VF3: "Peugeot",
  VF6: "Renault",
  VF7: "Citroën",
  VSS: "SEAT",
  W0L: "Opel",
  W0V: "Opel",
  W1K: "Mercedes-Benz",
  W1N: "Mercedes-Benz",
  W1V: "Mercedes-Benz",
  WAP: "BMW",
  WAU: "Audi",
  WBA: "BMW",
  WBS: "BMW",
  WBW: "BMW",
  WBX: "BMW",
  WBY: "BMW",
  WDB: "Mercedes-Benz",
  WDC: "Mercedes-Benz",
  WDD: "Mercedes-Benz",
  WDF: "Mercedes-Benz",
  WD4: "Mercedes-Benz",
  WF0: "Ford",
  WMW: "MINI",
  WP0: "Porsche",
  WP1: "Porsche",
  WUA: "Audi",
  WV1: "Volkswagen",
  WV2: "Volkswagen",
  WV3: "Volkswagen",
  WVG: "Volkswagen",
  WVW: "Volkswagen",
  YS2: "Scania",
  YS3: "Saab",
  YS4: "Scania",
  YV1: "Volvo",
  YV2: "Volvo",
  YV3: "Volvo",
  YV4: "Volvo",
  ZAM: "Maserati",
  ZAR: "Alfa Romeo",
  ZFA: "Fiat",
  ZFF: "Ferrari",
  ZHW: "Lamborghini",
};

/** Pirmās 2 WMI zīmes → ISO 3780 valsts. */
const WMI2_COUNTRY: Record<string, string> = {
  YS: "SE",
  YT: "SE",
  YV: "SE",
  YF: "FI",
  YH: "FI",
  YJ: "FI",
  YK: "FI",
  YN: "NO",
  YP: "NO",
  UH: "DK",
  UJ: "DK",
  UK: "DK",
  UL: "DK",
  UM: "DK",
  UU: "RO",
  U5: "SK",
  VF: "FR",
  VR: "FR",
  VS: "ES",
  WA: "DE",
  WB: "DE",
  WD: "DE",
  WF: "DE",
  WM: "DE",
  WP: "DE",
  WU: "DE",
  WV: "DE",
  W0: "DE",
  W1: "DE",
  TM: "CZ",
  TR: "HU",
  SA: "GB",
  SC: "GB",
  SH: "GB",
  SJ: "GB",
  ZA: "IT",
  ZF: "IT",
  ZH: "IT",
  JN: "JP",
  JT: "JP",
  JH: "JP",
  JF: "JP",
  JM: "JP",
  JS: "JP",
  KM: "KR",
  KN: "KR",
  LY: "CN",
  LS: "CN",
};

const WMI1_COUNTRY: Record<string, string> = {
  "1": "US",
  "2": "CA",
  "3": "MX",
  "4": "US",
  "5": "US",
  J: "JP",
  K: "KR",
  L: "CN",
  S: "GB",
  T: "CZ",
  V: "FR",
  W: "DE",
  Y: "SE",
  Z: "IT",
};

const YEAR_LETTER: Record<string, number> = {
  A: 2010,
  B: 2011,
  C: 2012,
  D: 2013,
  E: 2014,
  F: 2015,
  G: 2016,
  H: 2017,
  J: 2018,
  K: 2019,
  L: 2020,
  M: 2021,
  N: 2022,
  P: 2023,
  R: 2024,
  S: 2025,
  T: 2026,
  V: 2027,
  W: 2028,
  X: 2029,
  Y: 2030,
};

export type VinDecode = {
  ok: boolean;
  vin: string;
  wmi: string;
  make: string;
  model: string;
  year: string;
  plant: string;
  countryCode: string;
  countryName: string;
  nordic: boolean;
  checkDigitOk: boolean | null;
};

export function vinOriginCountryLabel(code: string): string {
  const c = code.trim().toUpperCase();
  if (!c) return "";
  return COUNTRY_LV[c] || c;
}

export function isNordicCountryCode(code: string): boolean {
  return NORDIC_COUNTRIES.has(code.trim().toUpperCase());
}

function countryFromWmi(wmi: string): string {
  const three = wmi.slice(0, 3);
  if (three === "LYV") return "CN";
  const two = WMI2_COUNTRY[wmi.slice(0, 2)];
  if (two) return two;
  return WMI1_COUNTRY[wmi.slice(0, 1)] ?? "";
}

function makeFromWmi(wmi: string): string {
  const three = wmi.slice(0, 3);
  if (WMI_MAKE[three]) return WMI_MAKE[three]!;
  if (three.startsWith("WV")) return "Volkswagen";
  if (three.startsWith("WB")) return "BMW";
  if (three.startsWith("YS")) return "Saab";
  if (three.startsWith("YV")) return "Volvo";
  return "";
}

function modelYearFromVin(vin: string): string {
  if (vin.length < 10) return "";
  const ch = vin[9] ?? "";
  if (/[1-9]/.test(ch)) return String(2000 + Number(ch));
  const base = YEAR_LETTER[ch];
  if (base == null) return "";
  const now = new Date().getFullYear();
  return String(base > now + 1 ? base - 30 : base);
}

export function decodeVinLocal(raw: string): VinDecode {
  const vin = raw.trim().toUpperCase().replace(/[\s-]/g, "");
  const empty: VinDecode = {
    ok: false,
    vin,
    wmi: "",
    make: "",
    model: "",
    year: "",
    plant: "",
    countryCode: "",
    countryName: "",
    nordic: false,
    checkDigitOk: null,
  };
  if (vin.length < 3 || !/^[A-HJ-NPR-Z0-9]+$/.test(vin)) return empty;
  const wmi = vin.slice(0, 3);
  const make = makeFromWmi(wmi);
  const countryCode = countryFromWmi(wmi);
  const countryName = vinOriginCountryLabel(countryCode);
  const year = modelYearFromVin(vin);
  const plant = vin.length >= 11 ? vin[10] ?? "" : "";
  const checkDigitOk = vin.length === 17 ? iso3779CheckDigit(vin) === vin[8] : null;
  const ok = Boolean(make || countryCode || year);
  return {
    ok,
    vin,
    wmi,
    make,
    model: "",
    year,
    plant,
    countryCode,
    countryName,
    nordic: isNordicCountryCode(countryCode),
    checkDigitOk,
  };
}

export function isNordicVinOrigin(vin: string): boolean {
  return decodeVinLocal(vin).nordic;
}

/** ISO 3780 Eiropas WMI valstis (ES + EEA + GB + CH), ko NHTSA modeļa vaicājums nesaista ar šo VIN. */
const EU_WMI_COUNTRY = new Set([
  "AT",
  "BE",
  "BG",
  "CH",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GB",
  "GR",
  "HR",
  "HU",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
]);

export function isUsWmiVin(vin: string): boolean {
  return decodeVinLocal(vin).countryCode === "US";
}

/** Eiropas WMI: NHTSA / ASV OEM lapas nav šī VIN atsaukums. */
export function isEuWmiVin(vin: string): boolean {
  const d = decodeVinLocal(vin);
  if (d.countryCode) return EU_WMI_COUNTRY.has(d.countryCode);
  const w = (d.wmi || vin).trim().toUpperCase();
  return /^[STUVWXYZ]/.test(w);
}

export type NordicVinSearchLink = {
  id: "biluppgifter" | "carinfo";
  label: string;
  href: string;
};

/** Publiskās meklēšanas saites. Nav skrāpēšana; Biluppgifter API nāks vēlāk. */
export function nordicVinSearchLinks(vin: string): NordicVinSearchLink[] {
  const d = decodeVinLocal(vin);
  if (!d.ok || !d.nordic) return [];
  const v = encodeURIComponent(d.vin);
  const locale =
    d.countryCode === "DK" ? "en-dk" : d.countryCode === "NO" ? "en-no" : d.countryCode === "FI" ? "en-fi" : "en-se";
  const carinfoHref =
    d.countryCode === "SE" ? `https://www.car.info/en-se/vin/S/${v}` : `https://www.car.info/${locale}/vin/${v}`;
  return [
    { id: "biluppgifter", label: "biluppgifter.se", href: `https://biluppgifter.se/${v}` },
    { id: "carinfo", label: "car.info", href: carinfoHref },
  ];
}

export function vinDecodeParseFromLocal(decoded: VinDecode): VinScanParse {
  if (!decoded.ok) return { status: "none", summary: "VIN dekodēt neizdevās" };
  const bits = [decoded.year, decoded.make, decoded.countryName].filter(Boolean);
  const detail = [
    decoded.wmi ? `WMI ${decoded.wmi}` : "",
    decoded.plant ? `rūpnīca ${decoded.plant}` : "",
    decoded.checkDigitOk === false ? "ISO 3779 kontrolcipars nesakrīt" : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    status: "found",
    summary: bits.join(" ") || decoded.wmi,
    detail,
    vehicle: {
      make: decoded.make,
      model: decoded.model,
      year: decoded.year,
    },
    flags: decoded.countryCode ? { registrationCountry: decoded.countryCode } : undefined,
  };
}

/** vPIC bieži dod 1980. ciklu (B=1981), lokālais ISO 2010. ciklu (B=2011). */
export function preferVinModelYear(localYear: string, vpicYear: string, nowYear = new Date().getFullYear()): string {
  if (!vpicYear) return localYear;
  if (!localYear) return vpicYear;
  if (localYear === vpicYear) return localYear;
  const localN = Number(localYear);
  const vpicN = Number(vpicYear);
  if (!Number.isFinite(localN)) return vpicYear;
  if (!Number.isFinite(vpicN)) return localYear;
  if (Math.abs(localN - vpicN) === 30) {
    const inWindow = (y: number) => y >= 1990 && y <= nowYear + 1;
    if (inWindow(localN) && !inWindow(vpicN)) return localYear;
    if (inWindow(vpicN) && !inWindow(localN)) return vpicYear;
    return String(Math.max(localN, vpicN));
  }
  return vpicYear;
}

export function mergeVinDecodeWithVpic(local: VinDecode, vpic: VinScanParse | null): VinScanParse {
  const base = vinDecodeParseFromLocal(local);
  if (base.status !== "found") return vpic && vpic.status === "found" ? vpic : base;
  const vpicOk = vpic && vpic.status === "found" && vpic.vehicle && (vpic.vehicle.make || vpic.vehicle.model || vpic.vehicle.year);
  if (!vpicOk || !vpic?.vehicle) return base;
  const make = vpic.vehicle.make || base.vehicle?.make || "";
  const model = vpic.vehicle.model || base.vehicle?.model || "";
  const year = preferVinModelYear(base.vehicle?.year || local.year, vpic.vehicle.year);
  const countryCode = local.countryCode || vpic.flags?.registrationCountry || "";
  const countryName = vinOriginCountryLabel(countryCode) || local.countryName;
  return {
    status: "found",
    summary: [year, make, model, countryName].filter(Boolean).join(" "),
    detail: [base.detail, vpic.detail].filter(Boolean).join("\n"),
    vehicle: { make, model, year },
    flags: countryCode ? { registrationCountry: countryCode } : undefined,
  };
}
