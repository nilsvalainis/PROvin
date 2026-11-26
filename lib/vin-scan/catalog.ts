/**
 * VIN SCAN avoti: serveris nolasa visus uzreiz (CapSolver, kur captcha/Cloudflare).
 * openUrl vienmēr ir dziļā saite ar VIN, lai cilne atver jau aizpildītu meklēšanu.
 */

import { carinfoSwedenVinUrl } from "@/lib/vin-sources/carinfo-search";
import { kfzgutachtenSearchUrl } from "@/lib/kfzgutachten/kfzgutachten";
import { thecarapiVinScanEnabled } from "@/lib/vin-scan/thecarapi-flags";
import { type VinScanPlateKind, type VinScanPlates, emptyVinScanPlates, normalizeScanPlate } from "@/lib/vin-scan/plates";

export const VIN_SCAN_SOURCE_IDS = [
  "vin_decode",
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
  "stat_vin",
  "joj_copart_iaai",
  "thecarapi_eu",
  "bid_cars",
  "carfax_eu",
  "checkcar_vin",
  "autodna_precheck",
  "plc_auction",
  "bidfax",
  "poctra",
  "cz_rsv",
  "dvsa_mot",
  "eu_safety_gate",
  "kfz_at",
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
  "stat_vin",
  "bid_cars",
  "carfax_eu",
  "checkcar_vin",
  "plc_auction",
  "bidfax",
  "poctra",
] as const satisfies readonly VinScanSourceId[];

export type VinScanBrowserId = (typeof VIN_SCAN_BROWSER_IDS)[number];

export type VinScanNeed = "vin" | "listing" | VinScanPlateKind;

/**
 * Avotu kategorijas (26.11, Nila secība): Reģistri → Vēsture → Izsoles → Apdrošināšana → Zādzība → Ražotājs → Atsaukumi.
 * Datu modelis nākamajai VIN SCAN UI pārbūvei; pašreizējais izkārtojums tās vēl nelieto.
 */
export const VIN_SCAN_CATEGORIES = [
  { id: "registri", label: "Reģistri" },
  { id: "vesture", label: "Vēsture" },
  { id: "izsoles", label: "Izsoles" },
  { id: "apdrosinasana", label: "Apdrošināšana" },
  { id: "zadziba", label: "Zādzība" },
  { id: "razotajs", label: "Ražotājs" },
  { id: "atsaukumi", label: "Atsaukumi" },
] as const;

export type VinScanCategory = (typeof VIN_SCAN_CATEGORIES)[number]["id"];

export type VinScanCatalogItem = {
  id: VinScanSourceId;
  label: string;
  country: string;
  /** Grupa VIN SCAN sarakstā (`VIN_SCAN_CATEGORIES` secībā). */
  category: VinScanCategory;
  hint: string;
  /** Ko avots prasa. Tukšs = pietiek ar VIN. */
  needs: readonly VinScanNeed[];
  /** true: der VIN vai norādītā numurzīme. */
  needsAny?: boolean;
  /** true: avots paliek kodā, bet VIN SCAN sarakstā un automātiskajā skenēšanā nav redzams. */
  disabled?: boolean;
  openUrl: (vin: string, plates?: VinScanPlates, listingUrl?: string) => string;
};

function vinQuery(vin: string): string {
  return encodeURIComponent(vin.trim().toUpperCase());
}

/**
 * Ne-ASV VW Group atsaukumi. Volkswagen UK vispārīgā recalls.html ir HTTP 404.
 * GOV.UK lapa atbild 200. Tā nelasa VIN kā meklēšanas lauku (reģistrācija vai marka/modelis/gads),
 * tāpēc VIN ir tikai saitē un serveris šo HTML neinterpretē kā found/none.
 */
export function vwGroupRecallCheckUrl(vin: string): string {
  return `https://www.gov.uk/check-vehicle-recall?vin=${vinQuery(vin)}`;
}

/** BMW USA VIN forma. Agrākā bmwusa.com/recall.html ir 404, bmw.com/en/footer/recall.html pāradresē uz tirgus sākumlapu bez VIN. */
export function bmwRecallCheckUrl(vin: string): string {
  return `https://www.bmwusa.com/safety-and-emission-recalls.html?vin=${vinQuery(vin)}`;
}

/** Mercedes-Benz USA atsaukumu lapa. mercedes-benz.com/en/innovation/product-innovation/recalls/ ir 404. */
export function mercedesRecallCheckUrl(vin: string): string {
  return `https://www.mbusa.com/en/recall?vin=${vinQuery(vin)}`;
}

function plateQ(raw: string): string {
  return encodeURIComponent(raw.trim().toUpperCase());
}

/**
 * Traficom publiskā lapa. Meklēšana ir Suomi.fi forma (bankas ID), ne GET ar VIN.
 * `plate` paliek parakstā, lai izsaucēji nelūst; query vairs neliek, jo tukšs `plate=` deva 404.
 */
export function traficomVehicleInfoUrl(vin: string, plate = ""): string {
  void vin;
  void plate;
  return "https://www.traficom.fi/fi/autoilijat/ajoneuvon-osto-ja-myynti/tarkista-ajoneuvon-tiedot";
}

export function regitraVehicleCheckUrl(): string {
  return "https://www.regitra.lt/paslaugos/transporto-priemones/pasitikrinkite-ar-transporto-priemone-neturi-apribojimu/";
}

export function poctraSearchUrl(vin: string): string {
  return `https://poctra.com/search?q=${vinQuery(vin)}`;
}

export const VIN_SCAN_CATALOG: readonly VinScanCatalogItem[] = [
  {
    id: "vin_decode",
    label: "WMI",
    country: "ISO",
    category: "razotajs",
    hint: "Ražotājs, izcelsmes valsts, gads",
    needs: ["vin"],
    // Agrāk /decoder/Decoder?VIN= → bezgalīgs 302 uz /Error/NotFound (ERR_TOO_MANY_REDIRECTS). vPIC API JSON atveras droši.
    openUrl: (vin) => `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vinQuery(vin)}?format=json`,
  },
  {
    id: "tjekbil",
    label: "tjekbil.dk",
    country: "DK",
    category: "registri",
    hint: "Dānijas reģistrs (DMR)",
    needs: ["vin"],
    openUrl: (vin) => `https://www.tjekbil.dk/?vin=${vinQuery(vin)}`,
  },
  {
    id: "esyn",
    label: "esyn.dk",
    country: "DK",
    category: "vesture",
    hint: "Dānijas tehniskās apskates ar odometru",
    needs: ["vin"],
    openUrl: (vin) => `https://findsynsrapport.esyn.dk/?chassisNumber=${vinQuery(vin)}`,
  },
  {
    id: "dsb",
    label: "Digital Servicebook",
    country: "EU",
    category: "vesture",
    hint: "Servisa ierakstu skaits. Pilns pārskats ir maksas",
    needs: ["vin"],
    openUrl: (vin) => `https://app.digitalservicebog.dk/search?vin=${vinQuery(vin)}&country=eu`,
  },
  {
    id: "carpass",
    label: "Car-Pass",
    country: "BE",
    category: "atsaukumi",
    hint: "Beļģijas atsaukumi",
    needs: ["vin"],
    openUrl: (vin) => `https://public.car-pass.be/recalls?vin=${vinQuery(vin)}`,
  },
  {
    id: "mnt_ee",
    label: "mnt.ee",
    country: "EE",
    category: "registri",
    hint: "Igaunijas transportlīdzekļu reģistrs",
    needs: ["vin"],
    openUrl: (vin) => `https://eteenindus.mnt.ee/public/soidukTaustakontroll.jsf?vin=${vinQuery(vin)}`,
  },
  {
    id: "csdd",
    label: "CSDD",
    country: "LV",
    category: "registri",
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
    category: "vesture",
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
    category: "registri",
    hint: "Dānijas reģistrs. Publiskā lapa, Cloudflare caur CapSolver",
    needs: ["vin"],
    openUrl: (vin) => `https://www.nummerplade.net/stelnummer/${vin.trim().toLowerCase()}.html`,
  },
  {
    id: "carinfo",
    label: "car.info",
    country: "SE",
    category: "registri",
    hint: "Zviedrijas reģistrs pēc VIN. Numurs ir rezerve, ja VIN lapa auto neatrada",
    needs: ["vin"],
    openUrl: (vin) => carinfoSwedenVinUrl(vin),
  },
  {
    id: "lkf_ee",
    label: "lkf.ee",
    country: "EE",
    category: "apdrosinasana",
    hint: "Igaunijas OCTA atlīdzības",
    needs: ["vin"],
    openUrl: (vin) => `https://lkf.ee/et/kahjukontroll?vin=${vinQuery(vin)}`,
  },
  {
    id: "rdw",
    label: "RDW",
    country: "NL",
    category: "registri",
    hint: "Nīderlandes atvērtie dati: APK, NAP, atsaukumi. Vajag NL numuru",
    needs: ["nl"],
    openUrl: (vin, plates) => {
      void vin;
      const kenteken = plates?.nl ? plateQ(plates.nl) : "";
      if (kenteken) return `https://ovi.rdw.nl/?kenteken=${kenteken}`;
      return "https://ovi.rdw.nl/";
    },
  },
  {
    id: "vegvesen",
    label: "vegvesen.no",
    country: "NO",
    category: "registri",
    hint: "Norvēģijas reģistrs pēc VIN",
    needs: ["vin"],
    disabled: true,
    openUrl: (vin) =>
      `https://www.vegvesen.no/kjoretoy/kjop-og-salg/kjoretoyopplysninger/?understellsnummer=${vinQuery(vin)}`,
  },
  {
    id: "nhtsa_recalls",
    label: "NHTSA atsaukumi",
    country: "US",
    category: "atsaukumi",
    hint: "NHTSA recalls API pēc VIN",
    needs: ["vin"],
    openUrl: (vin) => `https://www.nhtsa.gov/recalls?vin=${vinQuery(vin)}`,
  },
  {
    id: "nicb",
    label: "NICB VINCheck",
    country: "US",
    category: "zadziba",
    hint: "ASV zagto un total loss pārbaude",
    needs: ["vin"],
    openUrl: (vin) => `https://www.nicb.org/vincheck?vin=${vinQuery(vin)}`,
  },
  {
    id: "recall_vw",
    label: "VW Group atsaukumi",
    country: "OEM",
    category: "atsaukumi",
    hint: "Volkswagen, Audi, Škoda, SEAT, Cupra. Ne-ASV VIN: GOV.UK pārbaude pārlūkā",
    needs: ["vin"],
    openUrl: (vin) => vwGroupRecallCheckUrl(vin),
  },
  {
    id: "recall_bmw",
    label: "BMW atsaukumi",
    country: "OEM",
    category: "atsaukumi",
    hint: "BMW / MINI atsaukumu pārbaude",
    needs: ["vin"],
    openUrl: (vin) => bmwRecallCheckUrl(vin),
  },
  {
    id: "recall_mercedes",
    label: "Mercedes atsaukumi",
    country: "OEM",
    category: "atsaukumi",
    hint: "Mercedes-Benz atsaukumu pārbaude",
    needs: ["vin"],
    openUrl: (vin) => mercedesRecallCheckUrl(vin),
  },
  {
    id: "recall_volvo",
    label: "Volvo atsaukumi",
    country: "OEM",
    category: "atsaukumi",
    hint: "Volvo atsaukumu pārbaude",
    needs: ["vin"],
    openUrl: (vin) => `https://www.volvocars.com/intl/support/car/recalls?vin=${vinQuery(vin)}`,
  },
  {
    id: "recall_toyota",
    label: "Toyota atsaukumi",
    country: "OEM",
    category: "atsaukumi",
    hint: "Toyota / Lexus atsaukumu pārbaude",
    needs: ["vin"],
    openUrl: (vin) => `https://www.toyota.com/recall/?vin=${vinQuery(vin)}`,
  },
  {
    id: "biluppgifter",
    label: "biluppgifter.se",
    country: "SE",
    category: "registri",
    hint: "Zviedrijas reģistrs pēc VIN",
    needs: ["vin"],
    openUrl: (vin) => `https://biluppgifter.se/${vinQuery(vin)}`,
  },
  {
    id: "regitra",
    label: "Regitra",
    country: "LT",
    category: "registri",
    hint: "Lietuvas reģistrs pēc LT numura",
    needs: ["lt"],
    openUrl: () => regitraVehicleCheckUrl(),
  },
  {
    id: "traficom",
    label: "Traficom",
    country: "FI",
    category: "registri",
    hint: "Somijas reģistrs. Publiskā saite pēc VIN",
    needs: ["vin"],
    openUrl: (vin, plates) => traficomVehicleInfoUrl(vin, plates?.fi ?? ""),
  },
  {
    id: "stat_vin",
    label: "stat.vin",
    country: "US",
    category: "izsoles",
    hint: "Izsoles ieraksts",
    needs: ["vin"],
    openUrl: (vin) => `https://stat.vin/cars/${vinQuery(vin)}`,
  },
  {
    id: "joj_copart_iaai",
    label: "Copart/IAAI (JoJ API)",
    country: "US",
    category: "izsoles",
    hint: "Copart/IAAI US/CA",
    needs: ["vin"],
    openUrl: (vin) => `https://www.copart.com/lotSearchResults/?free=true&query=${vinQuery(vin)}`,
  },
  {
    id: "thecarapi_eu",
    label: "EU izsoles (TheCarApi)",
    country: "EU",
    category: "izsoles",
    hint: "AUTO1/Openlane/BCA/Autorola arhīvs",
    needs: ["vin"],
    openUrl: (vin) => `https://api.thecarapi.com/api/vin/${vinQuery(vin)}/history`,
  },
  {
    id: "bid_cars",
    label: "bid.cars",
    country: "US",
    category: "izsoles",
    hint: "Izsoļu arhīvs",
    needs: ["vin"],
    openUrl: (vin) => `https://bid.cars/en/search?q=${vinQuery(vin)}`,
  },
  {
    id: "carfax_eu",
    label: "CARFAX.eu",
    country: "EU",
    category: "vesture",
    hint: "Bezmaksas priekšskatījums: ierakstu skaits",
    needs: ["vin"],
    openUrl: (vin) => `https://www.carfax.eu/preview-page?vin=${vinQuery(vin)}`,
  },
  {
    id: "checkcar_vin",
    label: "CheckCar.vin",
    country: "US",
    category: "izsoles",
    hint: "Vai atskaitē ir foto",
    needs: ["vin"],
    openUrl: (vin) => `https://checkcar.vin/report/check/${vinQuery(vin)}`,
  },
  {
    id: "autodna_precheck",
    label: "AutoDNA (priekšskatījums)",
    country: "EU",
    category: "vesture",
    hint: "Bezmaksas: ierakstu skaits sadaļās, bez pirkuma",
    needs: ["vin"],
    openUrl: (vin) => `https://www.autodna.lv/vin/${vinQuery(vin)}`,
  },
  {
    id: "plc_auction",
    label: "plc.auction",
    country: "EU",
    category: "izsoles",
    hint: "Izsoles lots",
    needs: ["vin"],
    openUrl: (vin) => `https://plc.auction/?vin=${vinQuery(vin)}`,
  },
  {
    id: "bidfax",
    label: "BidFax",
    country: "US",
    category: "izsoles",
    hint: "Izsoles foto arhīvs",
    needs: ["vin"],
    openUrl: (vin) => `https://bidfax.info/?s=${vinQuery(vin)}`,
  },
  {
    id: "poctra",
    label: "Poctra",
    country: "US",
    category: "izsoles",
    hint: "Izsoles foto arhīvs",
    needs: ["vin"],
    openUrl: (vin) => poctraSearchUrl(vin),
  },
  {
    id: "cz_rsv",
    label: "Datová kostka RSV",
    country: "CZ",
    category: "registri",
    hint: "Čehijas reģistrs (MD ČR): pirmā reģistrācija, īpašnieku skaits, apskate. Vajag CZ_RSV_API_KEY",
    needs: ["vin"],
    // Publiskā lapa ir SPA; VIN saitē nodod operatoram, meklēšanu lapā var nākties palaist ar roku.
    openUrl: (vin) => `https://dataovozidlech.cz/vyhledavani?vin=${vinQuery(vin)}`,
  },
  {
    id: "dvsa_mot",
    label: "UK MOT (DVSA)",
    country: "UK",
    category: "vesture",
    hint: "DVSA MOT vēsture: apskates, odometrs, defekti. Vajag UK numuru un DVSA API atslēgas",
    needs: ["uk"],
    openUrl: (vin, plates) => {
      void vin;
      const reg = plates?.uk ? encodeURIComponent(normalizeScanPlate(plates.uk)) : "";
      return reg ? `https://www.check-mot.service.gov.uk/results?registration=${reg}` : "https://www.gov.uk/check-mot-history";
    },
  },
  {
    id: "eu_safety_gate",
    label: "ES Safety Gate",
    country: "EU",
    category: "atsaukumi",
    hint: "ES brīdinājumi par bīstamiem auto (bij. RAPEX) pēc markas un modeļa. Modeļa līmenis, var neattiekties uz šo auto",
    needs: ["vin"],
    // Safety Gate nemeklē pēc VIN: saite atver meklēšanas lapu, marku ievada operators.
    openUrl: (vin) => {
      void vin;
      return "https://ec.europa.eu/safety-gate-alerts/screen/search?resetSearch=true";
    },
  },
  {
    id: "kfz_at",
    label: "Austrija · §57a apskates (kfzgutachten.at)",
    country: "AT",
    category: "vesture",
    hint: "Austrijas tehnisko apskašu saraksts bez maksas (vajag precīzu 1. reģ. datumu); atzinums 1,19 € gab. - pērk Nils",
    needs: ["vin"],
    // Meklēšanu sargā reCAPTCHA: saite atver formu ar VIN (un datumu, ja zināms), «Suchen» spiež cilvēks.
    openUrl: (vin) => kfzgutachtenSearchUrl(vin),
  },
];

export function vinScanCatalogItem(id: VinScanSourceId): VinScanCatalogItem {
  const item = VIN_SCAN_CATALOG.find((s) => s.id === id);
  if (!item) throw new Error(`unknown_vin_scan_source:${id}`);
  return item;
}

export function vinScanSourceCategory(id: string): VinScanCategory | null {
  return VIN_SCAN_CATALOG.find((item) => item.id === id)?.category ?? null;
}

export function vinScanCategoryLabel(category: VinScanCategory): string {
  return VIN_SCAN_CATEGORIES.find((c) => c.id === category)?.label ?? category;
}

export type VinScanCategoryGroup<T> = { category: VinScanCategory; label: string; items: T[] };

/**
 * Sagrupē avotus (vai rindas ar `id`) pēc kategorijas `VIN_SCAN_CATEGORIES` secībā.
 * Kategorijas iekšienē paliek ievades secība; tukšas grupas izlaiž; id, kas nav katalogā (izņemti avoti), izlaiž.
 */
export function groupVinScanByCategory<T extends { id: string }>(rows: readonly T[]): VinScanCategoryGroup<T>[] {
  const buckets = new Map<VinScanCategory, T[]>();
  for (const row of rows) {
    const category = vinScanSourceCategory(row.id);
    if (!category) continue;
    const list = buckets.get(category) ?? [];
    list.push(row);
    buckets.set(category, list);
  }
  return VIN_SCAN_CATEGORIES.flatMap((c) => {
    const items = buckets.get(c.id);
    return items?.length ? [{ category: c.id, label: c.label, items }] : [];
  });
}

export function isVinScanSourceId(v: string): v is VinScanSourceId {
  return (VIN_SCAN_SOURCE_IDS as readonly string[]).includes(v);
}

export function isVinScanBrowserId(v: string): v is VinScanBrowserId {
  return (VIN_SCAN_BROWSER_IDS as readonly string[]).includes(v);
}

export function vinScanSourceDisabled(id: string): boolean {
  return VIN_SCAN_CATALOG.find((item) => item.id === id)?.disabled === true;
}

/**
 * 26.11 avotu audits: 0 trāpījumu 40 skenējumos vai dublikāts (nummerplade = tjekbil). Kods paliek, bet serveris tos automātiski neprasa:
 * VIN SCAN rāda tikai saiti «Atvērt pārlūkā», un tie neskaitās statusa rindā «N/M OK».
 */
export const VIN_SCAN_LINK_ONLY_IDS = [
  "nummerplade",
  "biluppgifter",
  "stat_vin",
  "checkcar_vin",
  "plc_auction",
  "bidfax",
  "poctra",
  "recall_vw",
  "recall_bmw",
  "recall_mercedes",
  "recall_volvo",
  "recall_toyota",
  "carpass",
  "traficom",
  "regitra",
] as const satisfies readonly VinScanSourceId[];

export function vinScanSourceLinkOnly(id: string): boolean {
  return (VIN_SCAN_LINK_ONLY_IDS as readonly string[]).includes(id);
}

/** VIN SCAN UI un POST noklusējums: tikai bezmaksas avoti (bez JoJ / Speckr u.c. maksas API). */
export function defaultVinScanSourceIds(): VinScanSourceId[] {
  return vinScanPipelineSourceIds();
}

/** Ātrie vērtējumi un bezmaksas auto-scan: bez JoJ $0.50, bez TheCarApi, bez paslēptiem avotiem. */
export function vinScanPipelineSourceIds(): VinScanSourceId[] {
  const allowThecarapi = thecarapiVinScanEnabled();
  return VIN_SCAN_SOURCE_IDS.filter((id) => {
    if (id === "joj_copart_iaai") return false;
    if (id === "thecarapi_eu" && !allowThecarapi) return false;
    if (vinScanSourceLinkOnly(id)) return false;
    return !vinScanSourceDisabled(id);
  });
}

export function vinScanFastSourceIds(): VinScanSourceId[] {
  return vinScanPipelineSourceIds();
}

export const VIN_SCAN_BROWSER_CATALOG: readonly VinScanCatalogItem[] = VIN_SCAN_CATALOG.filter((item) =>
  isVinScanBrowserId(item.id),
);

/** Minimālā Tampermonkey versija VIN SCAN dziļajām saitēm, aizpildei, pārlūka HTML ielādei un kfzgutachten.at sarakstam (1.27). */
export const VIN_SCAN_USERSCRIPT_MIN = { major: 1, minor: 27 } as const;

export function vinScanUserscriptMeetsMin(raw: string): boolean {
  const parts = raw.split(".").map((n) => Number.parseInt(n, 10));
  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  return major > VIN_SCAN_USERSCRIPT_MIN.major || (major === VIN_SCAN_USERSCRIPT_MIN.major && minor >= VIN_SCAN_USERSCRIPT_MIN.minor);
}

/** Tukša virkne (skripts nav ieslēgts) nav „vecāka versija”. */
export function vinScanUserscriptUpdateNeeded(raw: string): boolean {
  const version = raw.trim();
  if (!version) return false;
  return !vinScanUserscriptMeetsMin(version);
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
  // 26.11 Nila lēmums: Lietuvas policija (epolicija.lt, reCAPTCHA caur CapSolver) un AucHistory izņemti pilnībā.
  "lt_itpr",
  "auchistory",
] as const;
