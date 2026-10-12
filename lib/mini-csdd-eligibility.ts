import type { CsddTechDataResult } from "@/lib/csdd-tech-data";

/** Public MINI pre-pay CSDD check. Keep this short so Stripe is never blocked on a slow relay. */
export const MINI_CSDD_LOOKUP_TIMEOUT_MS = 4000;

export const MINI_LV_REGISTRATION_MIN_YEARS = 3;

export type MiniCsddModalVariant = "normal" | "warning";

function isNotRegisteredInLatviaMessage(message: string): boolean {
  return /netika atrasts/i.test(message);
}

/** True when the ISO date is after (now minus `years`). Missing/invalid dates cannot confirm 3+ years. */
export function isIsoDateNewerThanYears(
  isoDate: string,
  years: number,
  now: Date = new Date(),
): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) return true;
  const registered = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const cutoff = Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate());
  return registered > cutoff;
}

/**
 * Warning when CSDD confirms the car is not in the LV register, or first registration
 * is under 3 years. Lookup failures/timeouts stay on the normal MINI confirm modal.
 */
export function miniCsddModalVariantFromLookup(
  result: CsddTechDataResult,
  now: Date = new Date(),
): MiniCsddModalVariant {
  if (!result.found) {
    return isNotRegisteredInLatviaMessage(result.message) ? "warning" : "normal";
  }
  if (
    isIsoDateNewerThanYears(
      result.data.firstRegistrationIso,
      MINI_LV_REGISTRATION_MIN_YEARS,
      now,
    )
  ) {
    return "warning";
  }
  return "normal";
}

export function parseMiniCsddVariantResponse(data: unknown): MiniCsddModalVariant {
  if (data && typeof data === "object" && "variant" in data) {
    const variant = (data as { variant: unknown }).variant;
    if (variant === "warning") return "warning";
  }
  return "normal";
}
