/**
 * TheCarApi slēdži. Bez `server-only`, lai katalogs var nolasīt, vai VIN SCAN avotu iekļaut.
 * Atslēgas vērtība klientā nav pieejama (tikai servera `process.env`).
 */

export const THECARAPI_DEFAULT_BASE = "https://api.thecarapi.com";
export const THECARAPI_DISABLED_SUMMARY = "TheCarApi izslēgts (maksas)";
export const THECARAPI_KEY_INVALID_SUMMARY = "atslēga nederīga/beigusies";
export const THECARAPI_LIMITS_SUMMARY = "limits";

export type ThecarapiEnv = Record<string, string | undefined>;

export function thecarapiKey(env: ThecarapiEnv = process.env): string {
  return String(env.THECARAPI_API_KEY ?? "").trim();
}

export function thecarapiConfigured(env: ThecarapiEnv = process.env): boolean {
  return thecarapiKey(env).length > 0;
}

export function thecarapiBaseUrl(env: ThecarapiEnv = process.env): string {
  const raw = String(env.THECARAPI_BASE_URL ?? "").trim();
  return raw.replace(/\/+$/, "") || THECARAPI_DEFAULT_BASE;
}

export function thecarapiVinScanFlag(env: ThecarapiEnv = process.env): boolean {
  return String(env.THECARAPI_VIN_SCAN_ENABLED ?? "").trim() === "true";
}

export function thecarapiAdminFlag(env: ThecarapiEnv = process.env): boolean {
  return String(env.THECARAPI_ADMIN_ENABLED ?? "").trim() === "true";
}

/** VIN SCAN drīkst saukt tikai ar atslēgu UN THECARAPI_VIN_SCAN_ENABLED=true. */
export function thecarapiVinScanEnabled(env: ThecarapiEnv = process.env): boolean {
  return thecarapiConfigured(env) && thecarapiVinScanFlag(env);
}

/** Admin poga drīkst saukt tikai ar atslēgu UN THECARAPI_ADMIN_ENABLED=true. */
export function thecarapiAdminEnabled(env: ThecarapiEnv = process.env): boolean {
  return thecarapiConfigured(env) && thecarapiAdminFlag(env);
}

/** Jebkurš maksas ceļš (admin poga vai VIN SCAN). Bez šī klients neiet tīklā. */
export function thecarapiCallsAllowed(env: ThecarapiEnv = process.env): boolean {
  return thecarapiAdminEnabled(env) || thecarapiVinScanEnabled(env);
}

/** Nav mūsu pašu mēneša griestu. 0 nozīmē, ka lokāli neatsakām, arī ja env ir iestatīts. */
export function thecarapiMonthlyCap(env: ThecarapiEnv = process.env): number {
  void env.THECARAPI_MONTHLY_CAP;
  return 0;
}

export function thecarapiUsageMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}
