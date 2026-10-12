/**
 * Ātrās VIN pārbaudes avoti (1. solis): servera JSON vai HTML, bez captcha un bez maksas pirkuma.
 * Maksas API / kvota šeit nav: nummerplade.net, OneAuto, Outvin, CSDD relejs (līguma limits),
 * car.info un lkf.ee (CapSolver par katru vaicājumu). Tie paliek pasūtījuma darba zonā.
 * Klienta panelis un servera zondes lieto šo pašu sarakstu.
 */

export const VIN_SCAN_SOURCE_IDS = [
  "tjekbil",
  "esyn",
  "dsb",
  "carpass",
  "mnt_ee",
  "nhtsa",
] as const;

export type VinScanSourceId = (typeof VIN_SCAN_SOURCE_IDS)[number];

export type VinScanCatalogItem = {
  id: VinScanSourceId;
  label: string;
  country: string;
  /** Ko nozīmē zaļais punkts. */
  hint: string;
  /** Šī VIN meklēšanas vai rezultāta lapa (vienmēr atverama jaunā cilnē). */
  openUrl: (vin: string) => string;
};

function vinQuery(vin: string): string {
  return encodeURIComponent(vin.trim().toUpperCase());
}

export const VIN_SCAN_CATALOG: readonly VinScanCatalogItem[] = [
  {
    id: "tjekbil",
    label: "tjekbil.dk",
    country: "DK",
    hint: "Dānijas reģistrs (DMR)",
    openUrl: (vin) => `https://www.tjekbil.dk/?vin=${vinQuery(vin)}`,
  },
  {
    id: "esyn",
    label: "esyn.dk",
    country: "DK",
    hint: "Dānijas tehniskās apskates ar odometru",
    openUrl: (vin) => `https://findsynsrapport.esyn.dk/?chassisNumber=${vinQuery(vin)}`,
  },
  {
    id: "dsb",
    label: "Digital Servicebook",
    country: "EU",
    hint: "Servisa ierakstu skaits. Pilns pārskats ir maksas",
    openUrl: (vin) => `https://app.digitalservicebog.dk/search?vin=${vinQuery(vin)}&country=eu`,
  },
  {
    id: "carpass",
    label: "Car-Pass",
    country: "BE",
    hint: "Beļģijas atsaukumi",
    openUrl: (vin) => `https://public.car-pass.be/recalls?vin=${vinQuery(vin)}`,
  },
  {
    id: "mnt_ee",
    label: "mnt.ee",
    country: "EE",
    hint: "Igaunijas transportlīdzekļu reģistrs",
    openUrl: (vin) => `https://eteenindus.mnt.ee/public/soidukTaustakontroll.jsf?vin=${vinQuery(vin)}`,
  },
  {
    id: "nhtsa",
    label: "NHTSA",
    country: "US",
    hint: "VIN dekodējums, ne vēsture",
    openUrl: (vin) => `https://vpic.nhtsa.dot.gov/decoder/VinDecoder?VIN=${vinQuery(vin)}`,
  },
];

export function vinScanCatalogItem(id: VinScanSourceId): VinScanCatalogItem {
  const item = VIN_SCAN_CATALOG.find((s) => s.id === id);
  if (!item) throw new Error(`unknown_vin_scan_source:${id}`);
  return item;
}

export function isVinScanSourceId(v: string): v is VinScanSourceId {
  return (VIN_SCAN_SOURCE_IDS as readonly string[]).includes(v);
}

export function defaultVinScanSourceIds(): VinScanSourceId[] {
  return [...VIN_SCAN_SOURCE_IDS];
}

/**
 * Pārlūka zondes (2. solis). URL jāsakrīt ar `SCAN_URLS` failā `public/userscripts/provin-vin-autofill.user.js`.
 * Serveris šos avotus neizsauc. Skripts aizpilda VIN un nolasa, vai ieraksts ir redzams pirms pirkuma.
 */
export const VIN_SCAN_BROWSER_IDS = [
  "vp_wanted",
  "lt_itpr",
  "stat_vin",
  "bid_cars",
  "vininspect",
  "auchistory",
  "carfax_eu",
  "cebia",
  "autodna_preview",
  "carvertical_preview",
  "auto_vin",
  "checkcar_vin",
  "plc_auction",
] as const;

export type VinScanBrowserId = (typeof VIN_SCAN_BROWSER_IDS)[number];

export type VinScanBrowserItem = {
  id: VinScanBrowserId;
  label: string;
  country: string;
  hint: string;
  openUrl: (vin: string) => string;
};

export const VIN_SCAN_BROWSER_CATALOG: readonly VinScanBrowserItem[] = [
  {
    id: "vp_wanted",
    label: "VP meklētie",
    country: "LV",
    hint: "Valsts policija, meklētie transportlīdzekļi. Forma pārlūkā",
    openUrl: (vin) => `https://www.vp.gov.lv/lv/mekletie-transportlidzekli?vin=${vinQuery(vin)}`,
  },
  {
    id: "lt_itpr",
    label: "LT policija",
    country: "LT",
    hint: "Lietuvas policija, ieškomos transporto priemonės. VIN lauks knr",
    openUrl: (vin) => `https://www.epolicija.lt/itpr_paieska/transportas_lt.php?knr=${vinQuery(vin)}`,
  },
  {
    id: "stat_vin",
    label: "stat.vin",
    country: "US",
    hint: "Izsoles ieraksts. Cloudflare var prasīt apstiprinājumu cilnē",
    openUrl: (vin) => `https://stat.vin/cars/${vinQuery(vin)}`,
  },
  {
    id: "bid_cars",
    label: "bid.cars",
    country: "US",
    hint: "Izsoļu arhīvs",
    openUrl: (vin) => `https://bid.cars/en/search?q=${vinQuery(vin)}`,
  },
  {
    id: "vininspect",
    label: "vininspect",
    country: "US",
    hint: "Vēstures priekšskatījums",
    openUrl: (vin) => `https://vininspect.com/vin/${vinQuery(vin)}`,
  },
  {
    id: "auchistory",
    label: "AucHistory",
    country: "US",
    hint: "Izsoles foto un bojājumi. Captcha jāapstiprina cilnē",
    openUrl: (vin) => `https://auchistory.com/?vin=${vinQuery(vin)}`,
  },
  {
    id: "carfax_eu",
    label: "CARFAX.eu",
    country: "EU",
    hint: "Bezmaksas priekšskatījums: ierakstu skaits",
    openUrl: (vin) => `https://www.carfax.eu/preview-page?vin=${vinQuery(vin)}`,
  },
  {
    id: "cebia",
    label: "Cebia",
    country: "CZ",
    hint: "VIN aizpilde. Captcha jāapstiprina cilnē",
    openUrl: (vin) => `https://en.cebia.com/?vin=${vinQuery(vin)}`,
  },
  {
    id: "autodna_preview",
    label: "AutoDNA",
    country: "EU",
    hint: "Priekšskatījums. Pirkums paliek operatoram",
    openUrl: (vin) => `https://www.autodna.lv/vin/${vinQuery(vin)}`,
  },
  {
    id: "carvertical_preview",
    label: "CarVertical",
    country: "EU",
    hint: "Priekšskatījums automātiski. Jaunu atskaiti pērk tikai ar Pirkt atskaiti pēc apstiprinājuma",
    openUrl: (vin) => `https://www.carvertical.com/lv/user/reports?vin=${vinQuery(vin)}`,
  },
  {
    id: "auto_vin",
    label: "auto.vin",
    country: "OEM",
    hint: "Vai VIN tiek atpazīts. Servisa ieraksti redzami pēc pirkuma",
    openUrl: (vin) => `https://www.auto.vin/en/checkout?vin=${vinQuery(vin)}`,
  },
  {
    id: "checkcar_vin",
    label: "CheckCar.vin",
    country: "US",
    hint: "Vai atskaitē ir foto",
    openUrl: (vin) => `https://checkcar.vin/report/check/${vinQuery(vin)}`,
  },
  {
    id: "plc_auction",
    label: "plc.auction",
    country: "EU",
    hint: "Izsoles lots. VIN ievada sākumlapas meklēšanā",
    openUrl: (vin) => `https://plc.auction/?vin=${vinQuery(vin)}`,
  },
];

export function isVinScanBrowserId(v: string): v is VinScanBrowserId {
  return (VIN_SCAN_BROWSER_IDS as readonly string[]).includes(v);
}

/** Minimālā Tampermonkey versija VIN SCAN paneļa zondēm un CarVertical checkout soļiem. */
export const VIN_SCAN_USERSCRIPT_MIN = { major: 1, minor: 15 } as const;

export function vinScanUserscriptMeetsMin(raw: string): boolean {
  const parts = raw.split(".").map((n) => Number.parseInt(n, 10));
  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  return major > VIN_SCAN_USERSCRIPT_MIN.major || (major === VIN_SCAN_USERSCRIPT_MIN.major && minor >= VIN_SCAN_USERSCRIPT_MIN.minor);
}

export function vinScanUserscriptMinLabel(): string {
  return `${VIN_SCAN_USERSCRIPT_MIN.major}.${VIN_SCAN_USERSCRIPT_MIN.minor}`;
}

export type VinScanAnyCatalogItem = {
  id: string;
  label: string;
  country: string;
  hint: string;
  openUrl: (vin: string) => string;
};

/** Servera un pārlūka katalogs vienā sarakstā (flīžu un manuālā pasūtījuma saitēm). */
export function vinScanAllCatalog(): readonly VinScanAnyCatalogItem[] {
  return [...VIN_SCAN_CATALOG, ...VIN_SCAN_BROWSER_CATALOG];
}

/** Šī VIN avota lapa: skenēšanas rezultāta URL, ja ir, citādi kataloga meklēšana. */
export function resolveVinScanOpenUrl(
  item: { openUrl: (vin: string) => string },
  vin: string,
  resultUrl?: string | null,
): string {
  const fromResult = String(resultUrl || "").trim();
  if (fromResult) return fromResult;
  const fromCatalog = item.openUrl(vin).trim();
  return fromCatalog;
}
