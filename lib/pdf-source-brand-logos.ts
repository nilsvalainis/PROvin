/**
 * PDF avotu sadaļu zīmolu logotipi — CSDD, CAR INFO, LTAB, dīlera marka, sludinājuma portāls.
 * Šis fails iet client bundle (admin PDF preview) — bez node:fs / node:path.
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
  { needle: "volkswagen", file: "volkswagen" },
  { needle: "citroen", file: "citroen" },
  { needle: "mercedes", file: "mercedes" },
  { needle: "jaguar", file: "jaguar" },
  { needle: "peugeot", file: "peugeot" },
  { needle: "renault", file: "renault" },
  { needle: "skoda", file: "skoda" },
  { needle: "volvo", file: "volvo" },
  { needle: "dacia", file: "dacia" },
  { needle: "mini", file: "mini" },
  { needle: "opel", file: "opel" },
  { needle: "seat", file: "seat" },
  { needle: "audi", file: "audi" },
  { needle: "bmw", file: "bmw" },
  { needle: "smart", file: "smart" },
  { needle: "subaru", file: "subaru" },
  { needle: "toyota", file: "toyota" },
  { needle: "ford", file: "ford" },
  { needle: "hyundai", file: "hyundai" },
  { needle: "nissan", file: "nissan" },
  { needle: "mazda", file: "mazda" },
  { needle: "honda", file: "honda" },
  { needle: "porsche", file: "porsche" },
  { needle: "tesla", file: "tesla" },
  { needle: "kia", file: "kia" },
  { needle: "vw", file: "volkswagen" },
  { needle: "mb", file: "mercedes" },
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

/** Ja iegultā SVG nav — vienkāršs monograms, lai dīlera kartītei paliek markas zīme, ne atslēga. */
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
  return dataUri.includes("font-weight=\"700\"") || dataUri.includes("font-weight='700'");
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
    YV1: "volvo",
    YV2: "volvo",
    YV3: "volvo",
    YV4: "volvo",
    WAU: "audi",
    WUA: "audi",
    TRU: "audi",
    WAP: "audi",
    WBA: "bmw",
    WBS: "bmw",
    WBY: "bmw",
    WBW: "bmw",
    WDB: "mercedes",
    WDC: "mercedes",
    WDD: "mercedes",
    WDF: "mercedes",
    W1K: "mercedes",
    W1N: "mercedes",
    WVW: "volkswagen",
    WV1: "volkswagen",
    WV2: "volkswagen",
    TMB: "skoda",
    VSS: "seat",
    VF1: "renault",
    VF3: "peugeot",
    VF7: "citroen",
    W0L: "opel",
    UU1: "dacia",
    SAJ: "jaguar",
    SAL: "land-rover",
    JF1: "subaru",
    WF0: "ford",
    ZFA: "fiat",
  };
  if (WMI[wmi]) return WMI[wmi];
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
