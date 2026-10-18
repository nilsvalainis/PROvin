/**
 * `npm run eval:vendor-pdf-models` salīdzinājuma loģika: vai Gemini lasījums nav sliktāks par Sonnet.
 * Tīra funkcija (bez tīkla), lai kritēriju var pārbaudīt Vitest.
 */
import {
  vendorPdfGeminiShortfall,
  vendorPdfRecordCounts,
  type VendorPdfRecordCounts,
} from "@/lib/vendor-pdf-model-route";
import type { VendorReportExtract } from "@/lib/vendor-report-extract";

export type VendorPdfModelRead = { extract: VendorReportExtract | null; error: string; ms: number };

export type VendorPdfModelComparison = {
  local: VendorPdfRecordCounts;
  gemini: VendorPdfRecordCounts | null;
  sonnet: VendorPdfRecordCounts | null;
  /** Sonnet nobraukuma rindu (datums + km) daļa, ko atrada arī Gemini. */
  geminiMileageRecall: number | null;
  geminiShortfall: string | null;
  geminiNotWorse: boolean;
  reasons: string[];
};

/** Mazāk par šo Sonnet nobraukuma rindu atradušu daļu = Gemini sliktāks. */
export const MIN_GEMINI_MILEAGE_RECALL = 0.95;

function mileageKeys(extract: VendorReportExtract): Set<string> {
  return new Set(extract.mileage.map((r) => `${r.date}|${String(r.odometer).replace(/\D/g, "")}`));
}

export function compareVendorPdfModelReads(opts: {
  local: VendorReportExtract;
  gemini: VendorPdfModelRead;
  sonnet: VendorPdfModelRead;
}): VendorPdfModelComparison {
  const reasons: string[] = [];
  const g = opts.gemini.extract;
  const s = opts.sonnet.extract;
  const gemini = g ? vendorPdfRecordCounts(g) : null;
  const sonnet = s ? vendorPdfRecordCounts(s) : null;

  if (!g) reasons.push(`gemini_error: ${opts.gemini.error || "unknown"}`);
  const geminiShortfall = g ? vendorPdfGeminiShortfall(g, opts.local) : null;
  if (geminiShortfall) reasons.push(`text_layer: ${geminiShortfall}`);

  let geminiMileageRecall: number | null = null;
  if (g && s && gemini && sonnet) {
    for (const key of ["mileage", "incidents", "serviceHistory"] as const) {
      if (gemini[key] < sonnet[key]) reasons.push(`fewer_${key}: gemini ${gemini[key]} < sonnet ${sonnet[key]}`);
    }
    const sonnetKeys = mileageKeys(s);
    if (sonnetKeys.size > 0) {
      const geminiKeys = mileageKeys(g);
      let hit = 0;
      for (const k of sonnetKeys) if (geminiKeys.has(k)) hit++;
      geminiMileageRecall = hit / sonnetKeys.size;
      if (geminiMileageRecall < MIN_GEMINI_MILEAGE_RECALL) {
        reasons.push(`mileage_recall: ${(geminiMileageRecall * 100).toFixed(0)}%`);
      }
    }
  }

  return {
    local: vendorPdfRecordCounts(opts.local),
    gemini,
    sonnet,
    geminiMileageRecall,
    geminiShortfall,
    geminiNotWorse: reasons.length === 0,
    reasons,
  };
}
