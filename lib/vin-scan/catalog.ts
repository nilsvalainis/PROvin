/**
 * Ātrās VIN pārbaudes avoti (1. solis): servera JSON vai HTML, bez captcha un bez maksas pirkuma.
 * Klienta panelis un servera zondes lieto šo pašu sarakstu.
 */

export const VIN_SCAN_SOURCE_IDS = [
  "tjekbil",
  "nummerplade",
  "esyn",
  "dsb",
  "carpass",
  "nhtsa",
  "oneauto",
  "outvin",
] as const;

export type VinScanSourceId = (typeof VIN_SCAN_SOURCE_IDS)[number];

export type VinScanCatalogItem = {
  id: VinScanSourceId;
  label: string;
  country: string;
  /** Ko nozīmē zaļais punkts. */
  hint: string;
  openUrl: (vin: string) => string | null;
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
    openUrl: () => "https://www.tjekbil.dk/",
  },
  {
    id: "nummerplade",
    label: "nummerplade.net",
    country: "DK",
    hint: "Dānijas reģistrs, maksas API ar dienas limitu",
    openUrl: () => "https://www.nummerplade.net/",
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
    openUrl: () => "https://public.car-pass.be/recalls",
  },
  {
    id: "nhtsa",
    label: "NHTSA",
    country: "US",
    hint: "VIN dekodējums, ne vēsture",
    openUrl: (vin) => `https://vpic.nhtsa.dot.gov/decoder/VinDecoder?VIN=${vinQuery(vin)}`,
  },
  {
    id: "oneauto",
    label: "OneAuto",
    country: "OEM",
    hint: "Maksas API. Skenēšana tikai pārbauda atslēgu",
    openUrl: () => "https://www.oneautoapi.com/home/api/",
  },
  {
    id: "outvin",
    label: "Outvin",
    country: "OEM",
    hint: "Maksas API. Skenēšana tikai pārbauda atslēgu",
    openUrl: () => "https://www.outvin.com/",
  },
];

export function vinScanCatalogItem(id: VinScanSourceId): VinScanCatalogItem {
  const item = VIN_SCAN_CATALOG.find((s) => s.id === id);
  if (!item) throw new Error(`unknown_vin_scan_source:${id}`);
  return item;
}

/**
 * Pārlūka zondes (2. solis). URL jāsakrīt ar `SCAN_URLS` failā `public/userscripts/provin-vin-autofill.user.js`.
 * Serveris šos avotus neizsauc. Skripts aizpilda VIN un nolasa, vai ieraksts ir redzams pirms pirkuma.
 */
export const VIN_SCAN_BROWSER_IDS = [
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
    openUrl: () => "https://auchistory.com/",
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
    openUrl: () => "https://en.cebia.com/",
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
    hint: "Priekšskatījums. Pirkums paliek operatoram",
    openUrl: () => "https://www.carvertical.com/lv/user/reports",
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
];
