import type { ClientReportLang } from "@/lib/client-report-i18n";
import type { CheckoutLineKind } from "@/lib/stripe-session";

/**
 * VIENA vieta visiem klienta PDF failu nosaukumiem (Nils 25.11): nosaukums klienta valodā visur -
 * «Ģenerēt PDF», «Citi PDF», e-pasta pielikums, servera PDF (Dropbox mape, klienta saite, partneru arhīvs).
 *
 * Shēma: <PRODUKTS>[_<IZVILKUMS>]_<VIN>[_<VALODA>][_<DRUKAI>].pdf
 *   - produkta un «izvilkuma» vārdi tulkoti; RU - latīņu transliterācija (bez kirilicas failu nosaukumā);
 *   - tikai A-Z, 0-9 un «_» (bez diakritikas: Ä -> AE), lai droši visās e-pasta programmās un Dropbox;
 *   - ne-LV valodām paliek galotne _EN / _RU / _DE: EN un DE produkta vārds bieži sakrīt
 *     (PROVIN_AUDIT, PROVIN_MINI), un abas valodu versijas vienā pasūtījuma mapē nedrīkst pārrakstīt viena otru;
 *   - LV nosaukumi nemainās (PROVIN_AUDITS_<VIN>.pdf, OFICIALA_DILERA_DATI_<VIN>.pdf).
 */

export type ReportPdfKind =
  | "audits"
  | "mini"
  | "business"
  | "dealer"
  | "oem_dealer"
  | "asv"
  | "auction_archive";

const KIND_WORD: Record<ReportPdfKind, Record<ClientReportLang, string>> = {
  audits: { lv: "PROVIN_AUDITS", en: "PROVIN_AUDIT", de: "PROVIN_AUDIT", ru: "PROVIN_AUDIT" },
  mini: { lv: "PROVIN_MINI", en: "PROVIN_MINI", de: "PROVIN_MINI", ru: "PROVIN_MINI" },
  business: { lv: "PROVIN_BUSINESS", en: "PROVIN_BUSINESS", de: "PROVIN_BUSINESS", ru: "PROVIN_BUSINESS" },
  dealer: {
    lv: "OFICIALA_DILERA_DATI",
    en: "OFFICIAL_DEALER_DATA",
    de: "OFFIZIELLE_HAENDLERDATEN",
    ru: "OFITSIALNYE_DANNYE_DILERA",
  },
  oem_dealer: { lv: "OEM_DILERA_DATI", en: "OEM_DEALER_DATA", de: "OEM_HAENDLERDATEN", ru: "OEM_DANNYE_DILERA" },
  asv: { lv: "PROVIN_ASV", en: "PROVIN_USA", de: "PROVIN_USA", ru: "PROVIN_SSHA" },
  auction_archive: { lv: "IZSOLU_ARHIVS", en: "AUCTION_ARCHIVE", de: "AUKTIONSARCHIV", ru: "ARKHIV_AUKTSIONOV" },
};

/** «Izvilkums» ķeksis (saīsinātā PDF versija). */
export const REPORT_PDF_EXTRACT_WORD: Record<ClientReportLang, string> = {
  lv: "IZVILKUMS",
  en: "EXTRACT",
  de: "AUSZUG",
  ru: "VYPISKA",
};

/** Tumšākā drukas versija (Nila papīra drukai). */
export const REPORT_PDF_PRINT_WORD: Record<ClientReportLang, string> = {
  lv: "DRUKAI",
  en: "PRINT",
  de: "DRUCK",
  ru: "PECHAT",
};

/** Visi produktu vārdi visās valodās (piem. «vai šis ir mūsu atskaites PDF?»). */
export const REPORT_PDF_KIND_WORDS: readonly string[] = [
  ...new Set(Object.values(KIND_WORD).flatMap((m) => Object.values(m))),
];

/** Vai faila nosaukums ir PROVIN atskaites PDF (jebkurā valodā, ar «v2-» u.c. priedēkli vai bez). */
export function isProvinReportPdfFilename(filename: string): boolean {
  const name = (filename ?? "").trim().toUpperCase().replace(/^V\d+-/, "");
  if (!name.endsWith(".PDF")) return false;
  return REPORT_PDF_KIND_WORDS.some((w) => name.startsWith(`${w}_`)) || name.startsWith("PROVIN_SELECT");
}

/** Produkta veids pēc PDF nosaukuma (jebkurā valodā, ar «v2-» priedēkli vai bez); nezināms - null. */
export function reportPdfKindFromFilename(filename: string): ReportPdfKind | null {
  const name = (filename ?? "").trim().toUpperCase().replace(/^V\d+-/, "");
  if (!name.endsWith(".PDF")) return null;
  let best: { kind: ReportPdfKind; len: number } | null = null;
  for (const [kind, words] of Object.entries(KIND_WORD) as [ReportPdfKind, Record<ClientReportLang, string>][]) {
    for (const w of Object.values(words)) {
      if (name.startsWith(`${w}_`) && (!best || w.length > best.len)) best = { kind, len: w.length };
    }
  }
  return best?.kind ?? null;
}

function vinSlug(vin: string | null | undefined): string {
  const v = (vin ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return v.length > 0 ? v : "NAV_VIN";
}

/** "" latviski, citādi "_EN" / "_RU" / "_DE" pirms ".pdf". */
export function reportLangFilenameSuffix(lang?: ClientReportLang | null): string {
  if (lang === "en") return "_EN";
  if (lang === "ru") return "_RU";
  if (lang === "de") return "_DE";
  return "";
}

/** Vienīgā funkcija klienta PDF nosaukumam - to lieto visas vietas. */
export function buildReportPdfFilename(args: {
  kind: ReportPdfKind;
  vin: string | null | undefined;
  lang?: ClientReportLang | null;
  /** «Izvilkums» ķeksis. */
  extract?: boolean;
  /** Tumšākā drukas versija. */
  print?: boolean;
  /** Papildu galotne (piem. «DZA» Dzintarzeme veidnei). */
  variant?: string | null;
}): string {
  const lang: ClientReportLang = args.lang ?? "lv";
  const parts = [KIND_WORD[args.kind][lang]];
  if (args.extract) parts.push(REPORT_PDF_EXTRACT_WORD[lang]);
  parts.push(vinSlug(args.vin));
  const suffix = reportLangFilenameSuffix(lang);
  if (suffix) parts.push(suffix.slice(1));
  const variant = (args.variant ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (variant) parts.push(variant);
  if (args.print) parts.push(REPORT_PDF_PRINT_WORD[lang]);
  return `${parts.join("_")}.pdf`;
}

export type ProvinAuditPdfProductBrand =
  | "PROVIN_AUDITS"
  | "PROVIN_MINI"
  | "PROVIN_DILERIS"
  | "PROVIN_BUSINESS";

/** MINI = 39,99 €; AUDITS = 99,99 € (un vecāki 79,99 € audit pasūtījumi). */
const MINI_AMOUNT_CENTS = 3999;

export function resolveProvinAuditPdfProductBrand(args: {
  checkoutLine?: CheckoutLineKind | string | null;
  amountTotalCents?: number | null;
}): ProvinAuditPdfProductBrand {
  const line = (args.checkoutLine ?? "").toString().trim().toLowerCase();
  if (line === "mini" || line === "plus" || line === "listing_filter") return "PROVIN_MINI";
  if (line === "premium" || line === "audit" || line === "audits") return "PROVIN_AUDITS";
  // Audits 20.11: Business un Dīlera dati pēc līnijas (agrāk krita uz PROVIN_AUDITS).
  if (line === "business") return "PROVIN_BUSINESS";
  if (line === "dealer") return "PROVIN_DILERIS";
  // SELECT / unknown - pēc summas; 39,99 € = MINI.
  if (args.amountTotalCents === MINI_AMOUNT_CENTS) return "PROVIN_MINI";
  return "PROVIN_AUDITS";
}

const BRAND_KIND: Record<ProvinAuditPdfProductBrand, ReportPdfKind> = {
  PROVIN_AUDITS: "audits",
  PROVIN_MINI: "mini",
  PROVIN_DILERIS: "dealer",
  PROVIN_BUSINESS: "business",
};

export function reportPdfKindFromBrand(brand: ProvinAuditPdfProductBrand): ReportPdfKind {
  return BRAND_KIND[brand];
}

export function buildProvinAuditPdfFilename(
  vin: string | null | undefined,
  product?: {
    checkoutLine?: CheckoutLineKind | string | null;
    amountTotalCents?: number | null;
    brand?: ProvinAuditPdfProductBrand | null;
    lang?: ClientReportLang | null;
    extract?: boolean;
    print?: boolean;
  },
): string {
  const brand =
    product?.brand ??
    resolveProvinAuditPdfProductBrand({
      checkoutLine: product?.checkoutLine,
      amountTotalCents: product?.amountTotalCents,
    });
  return buildReportPdfFilename({
    kind: BRAND_KIND[brand],
    vin,
    lang: product?.lang,
    extract: product?.extract,
    print: product?.print,
  });
}

/** PROVIN SELECT konsultācijas PDF nosaukums e-pasta pielikumam (bez VIN). */
export function buildProvinSelectConsultationPdfFilename(sessionId: string): string {
  const slug = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(-40) || "session";
  return `PROVIN_SELECT_${slug}.pdf`;
}

/** Tikai OFICIĀLĀ DĪLERA DATI, bez citiem avotiem. */
export function buildProvinDilerisPdfFilename(
  vin: string | null | undefined,
  lang?: ClientReportLang | null,
  opts?: { extract?: boolean; print?: boolean; variant?: string | null },
): string {
  return buildReportPdfFilename({ kind: "dealer", vin, lang, ...opts });
}

/** OEM-stila dīlera API izdruka (atsevišķs fails). */
export function buildOemDealerPdfFilename(vin: string | null | undefined, lang?: ClientReportLang | null): string {
  return buildReportPdfFilename({ kind: "oem_dealer", vin, lang });
}

/** PROVIN BUSINESS datu atskaite (tā pati atskaite, cits virsraksts). */
export function buildProvinBusinessPdfFilename(
  vin: string | null | undefined,
  lang?: ClientReportLang | null,
  opts?: { extract?: boolean; print?: boolean },
): string {
  return buildReportPdfFilename({ kind: "business", vin, lang, ...opts });
}

/** Tikai ASV vēsture (VIN Audit / PROVIN noformējums). */
export function buildProvinAsvPdfFilename(
  vin: string | null | undefined,
  lang?: ClientReportLang | null,
  opts?: { extract?: boolean; print?: boolean },
): string {
  return buildReportPdfFilename({ kind: "asv", vin, lang, ...opts });
}

/** Izsoļu arhīva PDF (piedāvājums un atsevišķais pakalpojums). */
export function buildAuctionArchivePdfFilename(vin: string | null | undefined, lang?: ClientReportLang | null): string {
  return buildReportPdfFilename({ kind: "auction_archive", vin, lang });
}
