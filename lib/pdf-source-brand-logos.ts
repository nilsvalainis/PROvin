/**
 * PDF avotu sadaļu zīmolu logotipi - CSDD, CAR INFO, LTAB, dīlera marka, sludinājuma portāls.
 * Šis fails iet client bundle (admin PDF preview) - bez node:fs / node:path.
 */

import { PDF_DEALER_LOGO_DATA_URI, PDF_SOURCE_LOGO_DATA_URI } from "@/lib/pdf-source-brand-logo-data";

export type PdfListingPortalLogoId = "sslv" | "auto24" | "mobilede";

const DEALER_BRAND_ALIASES: { needle: string; file: string }[] = [
  { needle: "mercedes-benz", file: "mercedes" },
  { needle: "mercedes benz", file: "mercedes" },
  { needle: "rolls-royce", file: "rolls-royce" },
  { needle: "rolls royce", file: "rolls-royce" },
  { needle: "land rover", file: "land-rover" },
  { needle: "land-rover", file: "land-rover" },
  { needle: "landrover", file: "land-rover" },
  { needle: "alfa romeo", file: "alfa-romeo" },
  { needle: "alfa-romeo", file: "alfa-romeo" },
  { needle: "alfaromeo", file: "alfa-romeo" },
  { needle: "aston martin", file: "aston-martin" },
  { needle: "aston-martin", file: "aston-martin" },
  { needle: "astonmartin", file: "aston-martin" },
  { needle: "ds automobiles", file: "ds" },
  { needle: "dsautomobiles", file: "ds" },
  { needle: "volkswagen", file: "volkswagen" },
  { needle: "citroen", file: "citroen" },
  { needle: "mercedes", file: "mercedes" },
  { needle: "jaguar", file: "jaguar" },
  { needle: "peugeot", file: "peugeot" },
  { needle: "renault", file: "renault" },
  { needle: "skoda", file: "skoda" },
  { needle: "volvo", file: "volvo" },
  { needle: "polestar", file: "polestar" },
  { needle: "dacia", file: "dacia" },
  { needle: "mini", file: "mini" },
  { needle: "opel", file: "opel" },
  { needle: "vauxhall", file: "vauxhall" },
  { needle: "seat", file: "seat" },
  { needle: "cupra", file: "cupra" },
  { needle: "audi", file: "audi" },
  { needle: "bmw", file: "bmw" },
  { needle: "smart", file: "smart" },
  { needle: "subaru", file: "subaru" },
  { needle: "toyota", file: "toyota" },
  { needle: "lexus", file: "lexus" },
  { needle: "ford", file: "ford" },
  { needle: "hyundai", file: "hyundai" },
  { needle: "nissan", file: "nissan" },
  { needle: "mazda", file: "mazda" },
  { needle: "honda", file: "honda" },
  { needle: "porsche", file: "porsche" },
  { needle: "bentley", file: "bentley" },
  { needle: "lamborghini", file: "lamborghini" },
  { needle: "infiniti", file: "infiniti" },
  { needle: "mitsubishi", file: "mitsubishi" },
  { needle: "suzuki", file: "suzuki" },
  { needle: "fiat", file: "fiat" },
  { needle: "abarth", file: "abarth" },
  { needle: "lancia", file: "lancia" },
  { needle: "jeep", file: "jeep" },
  { needle: "alpine", file: "alpine" },
  { needle: "kia", file: "kia" },
  { needle: "genesis", file: "genesis" },
  { needle: "ferrari", file: "ferrari" },
  { needle: "maserati", file: "maserati" },
  { needle: "lotus", file: "lotus" },
  { needle: "tesla", file: "tesla" },
  { needle: "vw", file: "volkswagen" },
  { needle: "mb", file: "mercedes" },
  { needle: "mg", file: "mg" },
];

function normalizeMake(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_./]+/g, " ")
    .replace(/\s+/g, " ");
}

/** Hero „Dīlera dati” markas atslēga no CSDD / atskaites markas teksta. */
export function pdfDealerBrandFileKey(makeModel: string): string | null {
  const n = normalizeMake(makeModel);
  if (!n) return null;
  for (const { needle, file } of DEALER_BRAND_ALIASES) {
    if (n === needle || n.startsWith(`${needle} `) || n.includes(` ${needle} `)) return file;
  }
  const first = n.split(" ")[0] ?? "";
  if (first && PDF_DEALER_LOGO_DATA_URI[first]) return first;
  if (/^[a-z][a-z0-9-]{1,24}$/.test(first)) return first;
  return null;
}

/** Ja iegultā SVG nav - vienkāršs monograms, lai dīlera kartītei paliek markas zīme, ne atslēga. */
function dealerMonogramDataUri(fileKey: string): string {
  const letter = (fileKey.replace(/-/g, " ").trim().charAt(0) || "?").toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-label="${fileKey}"><rect width="24" height="24" rx="5" fill="#0f172a"/><text x="12" y="16.5" text-anchor="middle" fill="#fff" font-size="12" font-family="Inter,Arial,sans-serif" font-weight="700">${letter}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function pdfDealerLogoDataUri(makeModel: string): string | null {
  const key = pdfDealerBrandFileKey(makeModel);
  if (!key) return null;
  return PDF_DEALER_LOGO_DATA_URI[key] ?? dealerMonogramDataUri(key);
}

/** True when the URI is the generated letter tile (not a brand SVG asset). */
export function pdfDealerLogoIsMonogram(dataUri: string): boolean {
  // Monogram tiles are emitted via encodeURIComponent (data:...;charset=utf-8,<encoded>),
  // so the raw `"` / `=` characters are percent-encoded - match both forms.
  return (
    dataUri.includes("font-weight=\"700\"") ||
    dataUri.includes("font-weight='700'") ||
    dataUri.includes("font-weight%3D%22700%22") ||
    dataUri.includes("font-weight%3D%27700%27")
  );
}

/**
 * Common WMI → brand file key (for OEM PDF when CSDD make is empty).
 * YV1… = Volvo, WAU… = Audi, etc.
 */
export function pdfDealerBrandFileKeyFromVin(vin: string): string | null {
  const v = vin.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (v.length < 3) return null;
  const wmi = v.slice(0, 3);
  const WMI: Record<string, string> = {
    "1C4": "jeep",
    "1C6": "jeep",
    "1FA": "ford",
    "1FT": "ford",
    JA3: "mitsubishi",
    JF1: "subaru",
    JF2: "subaru",
    JH4: "acura",
    JHM: "honda",
    JM1: "mazda",
    JN1: "nissan",
    JN8: "nissan",
    JS1: "suzuki",
    JT2: "toyota",
    JT3: "toyota",
    JT8: "lexus",
    JTD: "toyota",
    JTH: "lexus",
    KMH: "hyundai",
    KNA: "kia",
    SAJ: "jaguar",
    SAL: "land-rover",
    SCA: "rolls-royce",
    SCC: "lotus",
    SCF: "aston-martin",
    SGZ: "mg",
    SJA: "bentley",
    TMB: "skoda",
    TRU: "audi",
    UU1: "dacia",
    VF1: "renault",
    VF3: "peugeot",
    VF6: "alpine",
    VF7: "citroen",
    VSS: "seat",
    W0L: "opel",
    W0V: "opel",
    W1K: "mercedes",
    W1N: "mercedes",
    W1V: "mercedes",
    WAP: "audi",
    WAU: "audi",
    WBA: "bmw",
    WBS: "bmw",
    WBW: "bmw",
    WBY: "bmw",
    WDB: "mercedes",
    WDC: "mercedes",
    WDD: "mercedes",
    WDF: "mercedes",
    WF0: "ford",
    WMW: "mini",
    WP0: "porsche",
    WP1: "porsche",
    WUA: "audi",
    WV1: "volkswagen",
    WV2: "volkswagen",
    WV3: "volkswagen",
    WVW: "volkswagen",
    YV1: "volvo",
    YV2: "volvo",
    YV3: "volvo",
    YV4: "volvo",
    ZAM: "maserati",
    ZAR: "alfa-romeo",
    ZFA: "fiat",
    ZFF: "ferrari",
    ZHW: "lamborghini",
  };
  // LSJA/LSJW (MG SAIC) - 4-char plant codes; match via prefix below.
  if (WMI[wmi]) return WMI[wmi];
  if (v.startsWith("LSJ")) return "mg";
  if (wmi.startsWith("WV")) return "volkswagen";
  if (wmi.startsWith("WB")) return "bmw";
  return null;
}

export function pdfDealerLogoDataUriFromVin(vin: string): string | null {
  const key = pdfDealerBrandFileKeyFromVin(vin);
  if (!key) return null;
  return PDF_DEALER_LOGO_DATA_URI[key] ?? dealerMonogramDataUri(key);
}

function listingHostname(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const href = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(href).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Sludinājuma saite → portāla logo. Tikai ss.lv / m.ss.lv, auto24.ee, mobile.de.
 * Cita saite vai tukšums → null (paliek esošā ikona).
 */
export function pdfListingPortalLogoId(listingUrl: string | null | undefined): PdfListingPortalLogoId | null {
  const raw = (listingUrl ?? "").trim();
  if (!raw) return null;
  const host = listingHostname(raw) ?? "";
  const hay = `${host} ${raw}`.toLowerCase();
  if (hay.includes("auto24.ee")) return "auto24";
  if (hay.includes("mobile.de")) return "mobilede";
  if (hay.includes("m.ss.lv") || hay.includes("ss.lv")) return "sslv";
  return null;
}

export function pdfListingPortalLogoDataUri(listingUrl: string | null | undefined): string | null {
  const id = pdfListingPortalLogoId(listingUrl);
  if (!id) return null;
  return PDF_SOURCE_LOGO_DATA_URI[id];
}

export function pdfBrandLogoImgHtml(dataUri: string): string {
  return `<img class="pdf-ico pdf-ico--brand-logo" src="${dataUri}" alt="" width="16" height="16"/>`;
}

export { PDF_SOURCE_LOGO_DATA_URI, PDF_DEALER_LOGO_DATA_URI };
