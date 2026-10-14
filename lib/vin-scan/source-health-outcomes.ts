/**
 * VIN SCAN rindu pārvēršana `recordSourceOutcomes` ierakstos.
 * found/none = avots atbildēja; Cloudflare / 429 / timeout = kļūda.
 */

import type { SourceOutcome } from "@/lib/source-health";

const SCAN_ERR = new Set(["Avots neatbildēja laikā", "Avotu neizdevās nolasīt"]);
const FAIL_RE =
  /cloudflare|http 429|http 403|pieprasījumu limits|bloķē|captcha netika|neatbildēja laikā|neizdevās nolasīt|zonde nav pieejama/i;

export function isVinScanHealthFailure(status: string, summary = ""): boolean {
  if (SCAN_ERR.has(summary)) return true;
  if (status === "found" || status === "none" || status === "needs_input" || status === "skipped" || status === "manual") {
    return false;
  }
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
