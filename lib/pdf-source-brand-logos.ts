/**
 * PDF avotu sadaļu zīmolu logotipi — CSDD, CAR INFO, LTAB, dīlera marka, sludinājuma portāls.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PDF_DEALER_LOGO_DATA_URI, PDF_SOURCE_LOGO_DATA_URI } from "@/lib/pdf-source-brand-logo-data";

export type PdfListingPortalLogoId = "sslv" | "auto24" | "mobilede";

const DEALER_BRAND_ALIASES: { needle: string; file: string }[] = [
  { needle: "mercedes-benz", file: "mercedes" },
  { needle: "mercedes benz", file: "mercedes" },
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

const publicSvgCache = new Map<string, string | null>();

function publicBrandSvgDataUri(fileKey: string): string | null {
  if (publicSvgCache.has(fileKey)) return publicSvgCache.get(fileKey) ?? null;
  let uri: string | null = null;
  try {
    const p = join(process.cwd(), "public", "brand-logos", `${fileKey}.svg`);
    if (existsSync(p)) {
      const svg = readFileSync(p, "utf8");
      if (svg.includes("<svg")) uri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    }
  } catch {
    uri = null;
  }
  publicSvgCache.set(fileKey, uri);
  return uri;
}

/** Ja faila nav — vienkāršs monograms, lai dīlera kartītei paliek markas zīme, ne atslēga. */
function dealerMonogramDataUri(fileKey: string): string {
  const letter = (fileKey.replace(/-/g, " ").trim().charAt(0) || "?").toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-label="${fileKey}"><rect width="24" height="24" rx="5" fill="#0f172a"/><text x="12" y="16.5" text-anchor="middle" fill="#fff" font-size="12" font-family="Inter,Arial,sans-serif" font-weight="700">${letter}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function pdfDealerLogoDataUri(makeModel: string): string | null {
  const key = pdfDealerBrandFileKey(makeModel);
  if (!key) return null;
  return PDF_DEALER_LOGO_DATA_URI[key] ?? publicBrandSvgDataUri(key) ?? dealerMonogramDataUri(key);
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
