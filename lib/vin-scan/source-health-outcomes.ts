/**
 * VIN SCAN rindu pārvēršana `recordSourceOutcomes` ierakstos.
 * found/none = avots atbildēja; Cloudflare / 429 / timeout = kļūda.
 */

import type { SourceHealthEntry, SourceOutcome } from "@/lib/source-health";
import { vinScanNeedsBrowser } from "@/lib/vin-scan/types";

const SCAN_ERR = new Set(["Avots neatbildēja laikā", "Avotu neizdevās nolasīt"]);
const FAIL_RE =
  /http \d{3}|pieprasījumu limits|captcha|neatbildēja laikā|neizdevās nolasīt|zonde nav pieejama|capsolver|invalid task|websitekey|cloudflare|bloķē|relej|ielase neizdevās|fetch failed|noildz/i;

export function isVinScanHealthFailure(status: string, summary = ""): boolean {
  if (status === "timeout" || status === "blocked") return true;
  if (SCAN_ERR.has(summary)) return true;
  if (
    status === "found" ||
    status === "none" ||
    status === "needs_input" ||
    status === "skipped" ||
    status === "manual" ||
    status === "config_missing" ||
    status === "browser_only"
  ) {
    return false;
  }
  if (vinScanNeedsBrowser(status, summary)) return false;
  return FAIL_RE.test(summary);
}

export function shouldRecordVinScanHealth(status: string, summary = ""): boolean {
  if (status === "found" || status === "none") return true;
  return isVinScanHealthFailure(status, summary);
}

/** Circuit breaker: pēc tik kļūdām pēc kārtas avotu uz laiku neizsauc. */
export const VIN_SCAN_BREAKER_STREAK_MIN = 5;
/** Cik ilgi pēc pēdējās kļūdas avots paliek atslēgts (pēc tam viens mēģinājums). */
export const VIN_SCAN_BREAKER_WINDOW_MS = 30 * 60 * 1000;
export const VIN_SCAN_BREAKER_SUMMARY_PREFIX = "Avots īslaicīgi atslēgts";

export type VinScanBreakerState = { streak: number; retryInMs: number };

/** Atslēgts, ja failStreak >= 5 un pēdējā kļūda pirms < 30 min. Citādi null (arī half-open pēc 30 min). */
export function vinScanBreakerState(
  entry: Pick<SourceHealthEntry, "failStreak" | "lastErrAt"> | undefined | null,
  nowMs = Date.now(),
): VinScanBreakerState | null {
  if (!entry) return null;
  const streak = entry.failStreak ?? 0;
  if (streak < VIN_SCAN_BREAKER_STREAK_MIN || !entry.lastErrAt) return null;
  const errAt = Date.parse(entry.lastErrAt);
  if (!Number.isFinite(errAt)) return null;
  const retryInMs = errAt + VIN_SCAN_BREAKER_WINDOW_MS - nowMs;
  if (retryInMs <= 0) return null;
  return { streak, retryInMs };
}

export function vinScanBreakerSummary(state: VinScanBreakerState): string {
  const min = Math.max(1, Math.ceil(state.retryInMs / 60_000));
  return `${VIN_SCAN_BREAKER_SUMMARY_PREFIX} (${state.streak} kļūdas pēc kārtas), nākamā pārbaude pēc ~${min} min`;
}

export function isVinScanBreakerRow(row: { breakerOpen?: boolean; summary?: string }): boolean {
  return row.breakerOpen === true || (row.summary ?? "").startsWith(VIN_SCAN_BREAKER_SUMMARY_PREFIX);
}

export function vinScanSourceHealthOutcomes(
  indicators: readonly { id: string; status: string; summary?: string; breakerOpen?: boolean }[],
): SourceOutcome[] {
  return indicators
    .filter((row) => !isVinScanBreakerRow(row))
    .filter((row) => shouldRecordVinScanHealth(row.status, row.summary))
    .map((row) => ({
      id: row.id,
      ok: row.status === "found" || row.status === "none",
      msg: row.summary,
    }));
}
