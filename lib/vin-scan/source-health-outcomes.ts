/**
 * VIN SCAN rindu pārvēršana `recordSourceOutcomes` ierakstos.
 * found/none = avots atbildēja; Cloudflare / 429 / timeout = kļūda.
 */

import type { SourceOutcome } from "@/lib/source-health";
import { vinScanNeedsBrowser } from "@/lib/vin-scan/types";

const SCAN_ERR = new Set(["Avots neatbildēja laikā", "Avotu neizdevās nolasīt"]);
const FAIL_RE =
  /http \d{3}|pieprasījumu limits|captcha|neatbildēja laikā|neizdevās nolasīt|zonde nav pieejama|capsolver|invalid task|websitekey|cloudflare|bloķē/i;

export function isVinScanHealthFailure(status: string, summary = ""): boolean {
  if (SCAN_ERR.has(summary)) return true;
  if (status === "found" || status === "none" || status === "needs_input" || status === "skipped" || status === "manual") {
    return false;
  }
  if (vinScanNeedsBrowser(status, summary)) return false;
  return FAIL_RE.test(summary);
}

export function shouldRecordVinScanHealth(status: string, summary = ""): boolean {
  if (status === "found" || status === "none") return true;
  return isVinScanHealthFailure(status, summary);
}

export function vinScanSourceHealthOutcomes(
  indicators: readonly { id: string; status: string; summary?: string }[],
): SourceOutcome[] {
  return indicators
    .filter((row) => shouldRecordVinScanHealth(row.status, row.summary))
    .map((row) => ({
      id: row.id,
      ok: row.status === "found" || row.status === "none",
      msg: row.summary,
    }));
}
