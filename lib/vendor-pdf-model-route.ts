/**
 * Avotu PDF (AutoDNA / CarVertical / dīleris) AI lasījuma modeļa maršruts.
 *
 * `VENDOR_PDF_PRIMARY=gemini` - lētākais Gemini Flash lasa pirmais; Sonnet pārņem, ja Gemini
 * krīt, atgriež nederīgu JSON vai nolasa skaidri mazāk ierakstu nekā teksta slāņa parseris.
 * Noklusējums `sonnet` - uzvedība nemainīta, kamēr eval nav pierādījis Gemini kvalitāti.
 */
import type { VendorReportExtract } from "@/lib/vendor-report-extract";

export type VendorPdfPrimary = "sonnet" | "gemini";

export const VENDOR_PDF_PRIMARY_DEFAULT: VendorPdfPrimary = "sonnet";

export function resolveVendorPdfPrimary(raw: string | undefined | null): VendorPdfPrimary {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "gemini" ? "gemini" : VENDOR_PDF_PRIMARY_DEFAULT;
}

export type VendorPdfRecordCounts = {
  mileage: number;
  incidents: number;
  serviceHistory: number;
};

export function vendorPdfRecordCounts(extract: VendorReportExtract): VendorPdfRecordCounts {
  return {
    mileage: extract.mileage.length,
    incidents: extract.incidents.length,
    serviceHistory: extract.serviceHistory.length,
  };
}

/** Pieļaujamā nobīde zem teksta slāņa novērtējuma (dublikāti, apvienotas rindas). */
const SHORTFALL_TOLERANCE = 0.2;

/**
 * `null` - Gemini lasījums ir pietiekams. Citādi iemesls, kāpēc jāpārlasa ar Sonnet.
 * Teksta slāņa parseris nekad neizdomā rindas, tāpēc tā skaits ir apakšējā robeža.
 */
export function vendorPdfGeminiShortfall(
  ai: VendorReportExtract,
  local: VendorReportExtract,
): string | null {
  const got = vendorPdfRecordCounts(ai);
  const expected = vendorPdfRecordCounts(local);
  const total = got.mileage + got.incidents + got.serviceHistory;
  if (total === 0) return "gemini_empty_extract";

  for (const key of ["mileage", "incidents", "serviceHistory"] as const) {
    const want = expected[key];
    if (want <= 0) continue;
    const min = Math.ceil(want * (1 - SHORTFALL_TOLERANCE));
    if (got[key] < min) return `gemini_shortfall_${key}:${got[key]}<${want}`;
  }
  return null;
}

export type VendorPdfModelUsed = "sonnet" | "gemini";

export type VendorPdfExtractOutcome = {
  extract: VendorReportExtract;
  used: VendorPdfModelUsed;
  /** Kāpēc Gemini rezultāts netika izmantots (tukšs, ja nebija pārslēgšanās). */
  fallbackReason: string;
};

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Gemini (ja ieslēgts) → Sonnet rezerve. Sonnet kļūda pēc nepilnīga Gemini lasījuma
 * nav fatāla: tad paliek Gemini daļējais rezultāts (tas tāpat tiek apvienots ar teksta slāni).
 */
export async function runVendorPdfExtractWithFallback(opts: {
  primary: VendorPdfPrimary;
  local: VendorReportExtract;
  runGemini: () => Promise<VendorReportExtract>;
  runSonnet: () => Promise<VendorReportExtract>;
  onFallback?: (reason: string) => void;
}): Promise<VendorPdfExtractOutcome> {
  if (opts.primary !== "gemini") {
    return { extract: await opts.runSonnet(), used: "sonnet", fallbackReason: "" };
  }

  let partial: VendorReportExtract | null = null;
  let reason: string;
  try {
    const gemini = await opts.runGemini();
    const shortfall = vendorPdfGeminiShortfall(gemini, opts.local);
    if (!shortfall) return { extract: gemini, used: "gemini", fallbackReason: "" };
    partial = gemini;
    reason = shortfall;
  } catch (e) {
    reason = `gemini_error:${errorMessage(e)}`;
  }

  opts.onFallback?.(reason);
  try {
    return { extract: await opts.runSonnet(), used: "sonnet", fallbackReason: reason };
  } catch (e) {
    if (partial) return { extract: partial, used: "gemini", fallbackReason: `${reason}; sonnet_error:${errorMessage(e)}` };
    throw e;
  }
}

/** Gemini PDF lasījuma griesti, lai Sonnet rezervei paliek laiks maršruta limitā. */
export const VENDOR_PDF_GEMINI_TIMEOUT_MS = 60_000;

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}_timeout`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Claude JSON Schema (mazie burti) → Gemini OpenAPI apakškopa (lielie burti, bez neatbalstītām atslēgām). */
export function toGeminiResponseSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === "additionalProperties") continue;
      if (k === "type" && typeof v === "string") out.type = v.toUpperCase();
      else if (k === "properties" && v && typeof v === "object") {
        out.properties = Object.fromEntries(
          Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [pk, walk(pv)]),
        );
      } else out[k] = walk(v);
    }
    return out;
  };
  return walk(schema) as Record<string, unknown>;
}
