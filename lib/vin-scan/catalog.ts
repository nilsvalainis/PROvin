/**
 * VIN SCAN avoti: serveris nolasa visus uzreiz (CapSolver, kur captcha/Cloudflare).
 * openUrl vienmēr ir dziļā saite ar VIN, lai cilne atver jau aizpildītu meklēšanu.
 */

import { type VinScanPlateKind, type VinScanPlates, emptyVinScanPlates } from "@/lib/vin-scan/plates";

export const VIN_SCAN_SOURCE_IDS = [
  "vin_decode",
  "speckr",
  "tjekbil",
  "esyn",
  "dsb",
  "carpass",
  "mnt_ee",
  "csdd",
  "listing_history",
  "nummerplade",
  "carinfo",
  "lkf_ee",
  "rdw",
  "vegvesen",
  "nhtsa_recalls",
  "nicb",
  "recall_vw",
  "recall_bmw",
  "recall_mercedes",
  "recall_volvo",
  "recall_toyota",
  "biluppgifter",
  "regitra",
  "traficom",
  "lt_itpr",
  "stat_vin",
  "joj_copart_iaai",
  "bid_cars",
  "auchistory",
  "carfax_eu",
  "checkcar_vin",
  "plc_auction",
  "bidfax",
  "poctra",
] as const;

export type VinScanSourceId = (typeof VIN_SCAN_SOURCE_IDS)[number];

/**
 * Ātrie vērtējumi un VIN SCAN lapa lieto vienu katalogu (pilnu `VIN_SCAN_SOURCE_IDS`).
 * Vārds paliek vēsturisks; saturā tas vairs nav HTTP apakškopa.
 */
export const VIN_SCAN_FAST_IDS = VIN_SCAN_SOURCE_IDS;

/**
 * Userscript aizpilda VIN, kad operators atver avota cilni.
 * Serveris šos avotus tomēr nolasa pats; skripts nav captcha apstiprinājums.
 */
export const VIN_SCAN_BROWSER_IDS = [
  "mnt_ee",
  "csdd",
  "nummerplade",
  "carinfo",
  "lkf_ee",
  "rdw",
  "vegvesen",
  "nicb",
  "biluppgifter",
  "regitra",
  "traficom",
  "lt_itpr",
  "stat_vin",
  "bid_cars",
  "auchistory",
  "carfax_eu",
  "checkcar_vin",
  "plc_auction",
  "bidfax",
  "poctra",
] as const satisfies readonly VinScanSourceId[];

export type VinScanBrowserId = (typeof VIN_SCAN_BROWSER_IDS)[number];

export type VinScanNeed = "vin" | "listing" | VinScanPlateKind;

export type VinScanCatalogItem = {
  id: VinScanSourceId;
  label: string;
  country: string;
  hint: string;
  /** Ko avots prasa. Tukšs = pietiek ar VIN. */
  needs: readonly VinScanNeed[];
  /** true: der VIN vai norādītā numurzīme. */
  needsAny?: boolean;
  openUrl: (vin: string, plates?: VinScanPlates, listingUrl?: string) => string;
};

function vinQuery(vin: string): string {
  return encodeURIComponent(vin.trim().toUpperCase());
}

function plateQ(raw: string): string {
  return encodeURIComponent(raw.trim().toUpperCase());
}

/** Traficom VIN-only URL. Empty `plate=` 404s; only append plate when present. */
export function traficomVehicleInfoUrl(vin: string, plate = ""): string {
  const p = plate.trim();
  return `https://www.traficom.fi/en/transport/road/vehicle-information?vin=${vinQuery(vin)}${
    p ? `&plate=${plateQ(p)}` : ""
  }`;
}

export const VIN_SCAN_CATALOG: readonly VinScanCatalogItem[] = [
  {
    id: "vin_decode",
    label: "WMI",
    country: "ISO",
    hint: "Ražotājs, izcelsmes valsts, gads",
    needs: ["vin"],
    // Agrāk /decoder/Decoder?VIN= → bezgalīgs 302 uz /Error/NotFound (ERR_TOO_MANY_REDIRECTS). vPIC API JSON atveras droši.
    openUrl: (vin) => `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vinQuery(vin)}?format=json`,
  },
  {
    id: "speckr",
    label: "Speckr",
    country: "OEM",
    hint: "Tesla VIN specs, opcijas un baterija (API, 1 kredīts)",
    needs: ["vin"],
    openUrl: (vin) => `https://speckr.com/?vin=${vinQuery(vin)}`,
  },
  {
    id: "tjekbil",
    label: "tjekbil.dk",
    country: "DK",
    hint: "Dānijas reģistrs (DMR)",
    needs: ["vin"],
    openUrl: (vin) => `https://www.tjekbil.dk/?vin=${vinQuery(vin)}`,
  },
  {
    id: "esyn",
    label: "esyn.dk",
    country: "DK",
    hint: "Dānijas tehniskās apskates ar odometru",
    needs: ["vin"],
    openUrl: (vin) => `https://findsynsrapport.esyn.dk/?chassisNumber=${vinQuery(vin)}`,
  },
  {
    id: "dsb",
    label: "Digital Servicebook",
    country: "EU",
    hint: "Servisa ierakstu skaits. Pilns pārskats ir maksas",
    needs: ["vin"],
    openUrl: (vin) => `https://app.digitalservicebog.dk/search?vin=${vinQuery(vin)}&country=eu`,
  },
  {
    id: "carpass",
    label: "Car-Pass",
    country: "BE",
    hint: "Beļģijas atsaukumi",
    needs: ["vin"],
    openUrl: (vin) => `https://public.car-pass.be/recalls?vin=${vinQuery(vin)}`,
  },
  {
    id: "mnt_ee",
    label: "mnt.ee",
    country: "EE",
    hint: "Igaunijas transportlīdzekļu reģistrs",
    needs: ["vin"],
    openUrl: (vin) => `https://eteenindus.mnt.ee/public/soidukTaustakontroll.jsf?vin=${vinQuery(vin)}`,
  },
  {
    id: "csdd",
    label: "CSDD",
    country: "LV",
    hint: "Latvijas reģistrs. VIN vai LV numurs",
    needs: ["vin", "lv"],
    needsAny: true,
    openUrl: (vin, plates) => {
      const q = vin || plates?.lv || "";
      return `https://e.csdd.lv/tadati/?vin=${vinQuery(q)}`;
    },
  },
  {
    id: "listing_history",
    label: "Sludinājuma vēsture",
    country: "LV",
    hint: "Adify / Tirgus Dati sludinājuma cenu vēsture",
    needs: ["listing"],
    openUrl: (_vin, _plates, listingUrl) => {
      const url = String(listingUrl || "").trim();
      return url ? `https://adify.lv/history?url=${encodeURIComponent(url)}` : "https://adify.lv/history";
    },
  },
  {
    id: "nummerplade",
    label: "nummerplade.net",
    country: "DK",
    hint: "Dānijas reģistrs. Publiskā lapa, Cloudflare caur CapSolver",
    needs: ["vin"],
    openUrl: (vin) => `https://www.nummerplade.net/stelnummer/${vin.trim().toLowerCase()}.html`,
  },
  {
    id: "carinfo",
    label: "car.info",
    country: "SE",
    hint: "Zviedrijas un Nordics agregators",
    needs: ["vin"],
    openUrl: (vin) => `https://www.car.info/en-se/vin/${vinQuery(vin)}`,
  },
  {
    id: "lkf_ee",
    label: "lkf.ee",
    country: "EE",
    hint: "Igaunijas OCTA atlīdzības",
    needs: ["vin"],
    openUrl: (vin) => `https://lkf.ee/et/kahjukontroll?vin=${vinQuery(vin)}`,
  },
  {
    id: "rdw",
    label: "RDW",
    country: "NL",
    hint: "Nīderlandes atvērtie dati: APK, NAP, atsaukumi",
    needs: ["nl", "vin"],
    needsAny: true,
    openUrl: (vin, plates) => {
      const kenteken = plates?.nl ? plateQ(plates.nl) : "";
      if (kenteken) return `https://ovi.rdw.nl/?kenteken=${kenteken}&vin=${vinQuery(vin)}`;
      return `https://opendata.rdw.nl/resource/m9d7-ebf2.json?vin=${vinQuery(vin)}`;
    },
  },
  {
    id: "vegvesen",
    label: "vegvesen.no",
    country: "NO",
    hint: "Norvēģijas reģistrs pēc VIN",
    needs: ["vin"],
    openUrl: (vin) =>
      `https://www.vegvesen.no/kjoretoy/kjop-og-salg/kjoretoyopplysninger/?understellsnummer=${vinQuery(vin)}`,
  },
  {
    id: "nhtsa_recalls",
    label: "NHTSA atsaukumi",
    country: "US",
    hint: "NHTSA recalls API pēc VIN",
    needs: ["vin"],
    openUrl: (vin) => `https://www.nhtsa.gov/recalls?vin=${vinQuery(vin)}`,
  },
  {
    id: "nicb",
    label: "NICB VINCheck",
    country: "US",
    hint: "ASV zagto un total loss pārbaude",
    needs: ["vin"],
    openUrl: (vin) => `https://www.nicb.org/vincheck?vin=${vinQuery(vin)}`,
  },
  {
    id: "recall_vw",
    label: "VW Group atsaukumi",
    country: "OEM",
    hint: "Volkswagen, Audi, Škoda, SEAT, Cupra",
    needs: ["vin"],
    openUrl: (vin) => `https://www.volkswagen.co.uk/en/owners-and-services/recalls.html?vin=${vinQuery(vin)}`,
  },
  {
    id: "recall_bmw",
    label: "BMW atsaukumi",
    country: "OEM",
    hint: "BMW / MINI atsaukumu pārbaude",
    needs: ["vin"],
    openUrl: (vin) => `https://www.bmw.com/en/footer/recall.html?vin=${vinQuery(vin)}`,
  },
  {
    id: "recall_mercedes",
    label: "Mercedes atsaukumi",
    country: "OEM",
    hint: "Mercedes-Benz atsaukumu pārbaude",
    needs: ["vin"],
    openUrl: (vin) => `https://www.mercedes-benz.com/en/innovation/product-innovation/recalls/?vin=${vinQuery(vin)}`,
  },
  {
    id: "recall_volvo",
    label: "Volvo atsaukumi",
    country: "OEM",
    hint: "Volvo atsaukumu pārbaude",
    needs: ["vin"],
    openUrl: (vin) => `https://www.volvocars.com/intl/support/car/recalls?vin=${vinQuery(vin)}`,
  },
  {
    id: "recall_toyota",
    label: "Toyota atsaukumi",
    country: "OEM",
    hint: "Toyota / Lexus atsaukumu pārbaude",
    needs: ["vin"],
    openUrl: (vin) => `https://www.toyota.com/recall/?vin=${vinQuery(vin)}`,
  },
  {
    id: "biluppgifter",
    label: "biluppgifter.se",
    country: "SE",
    hint: "Zviedrijas reģistrs pēc VIN",
    needs: ["vin"],
    openUrl: (vin) => `https://biluppgifter.se/${vinQuery(vin)}`,
  },
  {
    id: "regitra",
    label: "Regitra",
    country: "LT",
    hint: "Lietuvas reģistrs pēc LT numura",
    needs: ["lt"],
    openUrl: (vin, plates) => {
      const plate = plates?.lt ? plateQ(plates.lt) : "";
      return `https://www.regitra.lt/lt/e-paslaugos/transporto-priemones-duomenu-patikra?vin=${vinQuery(vin)}${plate ? `&plate=${plate}` : ""}`;
    },
  },
  {
    id: "traficom",
    label: "Traficom",
    country: "FI",
    hint: "Somijas reģistrs. Publiskā saite pēc VIN",
    needs: ["vin"],
    openUrl: (vin, plates) => traficomVehicleInfoUrl(vin, plates?.fi ?? ""),
  },
  {
    id: "lt_itpr",
    label: "LT policija",
    country: "LT",
    hint: "Lietuvas policija, ieškomos transporto priemonės",
    needs: ["vin"],
    openUrl: (vin) => `https://www.epolicija.lt/itpr_paieska/transportas_lt.php?knr=${vinQuery(vin)}`,
  },
  {
    id: "stat_vin",
    label: "stat.vin",
    country: "US",
    hint: "Izsoles ieraksts",
    needs: ["vin"],
    openUrl: (vin) => `https://stat.vin/cars/${vinQuery(vin)}`,
  },
  {
    id: "joj_copart_iaai",
    label: "Copart/IAAI (JoJ API)",
    country: "US",
    hint: "Copart/IAAI US/CA",
    needs: ["vin"],
    openUrl: (vin) => `https://www.copart.com/lotSearchResults/?free=true&query=${vinQuery(vin)}`,
  },
  {
    id: "bid_cars",
    label: "bid.cars",
    country: "US",
    hint: "Izsoļu arhīvs",
    needs: ["vin"],
    openUrl: (vin) => `https://bid.cars/en/search?q=${vinQuery(vin)}`,
  },
  {
    id: "auchistory",
    label: "AucHistory",
    country: "US",
    hint: "Izsoles foto un bojājumi",
    needs: ["vin"],
    openUrl: (vin) => `https://auchistory.com/?vin=${vinQuery(vin)}`,
  },
  {
    id: "carfax_eu",
    label: "CARFAX.eu",
    country: "EU",
    hint: "Bezmaksas priekšskatījums: ierakstu skaits",
    needs: ["vin"],
    openUrl: (vin) => `https://www.carfax.eu/preview-page?vin=${vinQuery(vin)}`,
  },
  {
    id: "checkcar_vin",
    label: "CheckCar.vin",
    country: "US",
    hint: "Vai atskaitē ir foto",
    needs: ["vin"],
    openUrl: (vin) => `https://checkcar.vin/report/check/${vinQuery(vin)}`,
  },
  {
    id: "plc_auction",
    label: "plc.auction",
    country: "EU",
    hint: "Izsoles lots",
    needs: ["vin"],
    openUrl: (vin) => `https://plc.auction/?vin=${vinQuery(vin)}`,
  },
  {
    id: "bidfax",
    label: "BidFax",
    country: "US",
    hint: "Izsoles foto arhīvs",
    needs: ["vin"],
    openUrl: (vin) => `https://bidfax.info/?s=${vinQuery(vin)}`,
  },
  {
    id: "poctra",
    label: "Poctra",
    country: "US",
    hint: "Izsoles foto arhīvs",
    needs: ["vin"],
    openUrl: (vin) => `https://poctra.com/search/${vinQuery(vin)}`,
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

export function isVinScanBrowserId(v: string): v is VinScanBrowserId {
  return (VIN_SCAN_BROWSER_IDS as readonly string[]).includes(v);
}

export function defaultVinScanSourceIds(): VinScanSourceId[] {
  return [...VIN_SCAN_SOURCE_IDS];
}

/** Ātrie vērtējumi un bezmaksas auto-scan: bez JoJ $0.50. VIN SCAN lapa lieto `defaultVinScanSourceIds`. */
const VIN_SCAN_METERED_EXCLUDE_FROM_PIPELINE = new Set<VinScanSourceId>(["joj_copart_iaai", "speckr"]);

export function vinScanPipelineSourceIds(): VinScanSourceId[] {
  return VIN_SCAN_SOURCE_IDS.filter((id) => !VIN_SCAN_METERED_EXCLUDE_FROM_PIPELINE.has(id));
}

export function vinScanFastSourceIds(): VinScanSourceId[] {
  return vinScanPipelineSourceIds();
}

export const VIN_SCAN_BROWSER_CATALOG: readonly VinScanCatalogItem[] = VIN_SCAN_CATALOG.filter((item) =>
  isVinScanBrowserId(item.id),
);

/** Minimālā Tampermonkey versija VIN SCAN dziļajām saitēm un aizpildei. */
export const VIN_SCAN_USERSCRIPT_MIN = { major: 1, minor: 18 } as const;

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
  openUrl: (vin: string, plates?: VinScanPlates, listingUrl?: string) => string;
};

export function vinScanAllCatalog(): readonly VinScanAnyCatalogItem[] {
  return VIN_SCAN_CATALOG;
}

export function resolveVinScanOpenUrl(
  item: { openUrl: (vin: string, plates?: VinScanPlates, listingUrl?: string) => string },
  vin: string,
  resultUrl?: string | null,
  plates?: VinScanPlates,
  listingUrl?: string,
): string {
  const fromResult = String(resultUrl || "").trim();
  if (fromResult) return fromResult;
  return item.openUrl(vin, plates ?? emptyVinScanPlates(), listingUrl).trim();
}

export const VIN_SCAN_TTL_MS = 12 * 60 * 60 * 1000;

export const VIN_SCAN_REMOVED_IDS = [
  "nhtsa",
  "cebia",
  "autodna_preview",
  "carvertical_preview",
  "auto_vin",
  "vininspect",
  "oneauto",
  "outvin",
  "vp_wanted",
  "uk_mot",
] as const;
