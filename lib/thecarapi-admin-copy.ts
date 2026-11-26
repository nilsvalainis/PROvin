/**
 * TheCarApi admin bloka teksti (klientam drošs, bez `server-only`).
 * Pakete ir apmaksāta (120 €/mēn., 100 000 pieprasījumu) - vārds «maksas» UI nav vajadzīgs.
 */

/** Apmaksātās paketes apjoms mēnesī (Nila 17.11). Tikai rādīšanai - iekšēju limitu nav. */
export const THECARAPI_PACKAGE_MONTHLY_REQUESTS = 100_000;

function isNone(input: { status?: string; summary?: string }): boolean {
  return input.status === "none" || (!input.status && input.summary === "nav ierakstu");
}

function spaced(n: number): string {
  return String(Math.max(0, Math.floor(n))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** «paketē · šomēnes 188 no 100 000» (mūsu skaitītājs: veiksmīgie TheCarApi HTTP izsaukumi šajā UTC mēnesī). */
export function thecarapiUsageLabel(used: number): string {
  return `paketē · šomēnes ${spaced(used)} no ${spaced(THECARAPI_PACKAGE_MONTHLY_REQUESTS)}`;
}

/**
 * Saglabātā TheCarApi atbilde. «none» = TheCarApi šim VIN izsoles neatrada (nevis tukšs kešs).
 * Tukšs kešs = nekas netiek rādīts (null).
 */
export function thecarapiCacheLabel(input: { status?: string; summary?: string; cachedAt?: string }): string | null {
  const day = input.cachedAt ? input.cachedAt.slice(0, 10) : "";
  if (isNone(input)) return `TheCarApi šim VIN izsoles neatrada${day ? ` (pārbaudīts ${day})` : ""}`;
  if (!input.summary) return null;
  return `Saglabāts: ${input.summary}${day ? ` · ${day}` : ""}`;
}

/** Detaļas var ielādēt tikai tad, ja vēsture atrada izsoles un kādai lotei detaļu vēl nav. */
export function thecarapiDetailMissing(input: { status?: string; summary?: string; cacheHasDetail?: boolean }): boolean {
  if (isNone(input)) return false;
  if (!input.summary) return false;
  return input.cacheHasDetail === false;
}
