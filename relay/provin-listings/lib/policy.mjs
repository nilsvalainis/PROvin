/**
 * Tīras palīgfunkcijas bez Playwright, lai tās var testēt ar node:test.
 */

/** systemd EnvironmentFile komentāru aiz `=` ieliek vērtībā. Atstāj tikai pirmo vārdu. */
export function envToken(raw, fallback) {
  const token = String(raw ?? "")
    .split("#")[0]
    .trim()
    .split(/\s+/)[0];
  return token || fallback;
}

/**
 * Pozitīvs vesels skaitlis no env. Komentārs, teksts vai 0 dod noklusējumu, nevis NaN
 * (`n >= NaN` vienmēr ir false, un dienas limits pazustu).
 */
export function envPositiveInt(raw, fallback, max = Number.MAX_SAFE_INTEGER) {
  const n = Number(envToken(raw, ""));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

/**
 * Publiskie dati, ja auto-login neizdodas. Autobid vienmēr, Openlane ja
 * OPENLANE_ALLOW_PUBLIC_FALLBACK. `error` (ne tikai login_required) arī lasa publiski.
 */
export function shouldReadPublic(platform, sessionStatus, openlanePublicFallback) {
  const allow =
    platform === "autobid" ||
    platform === "ecarstrade" ||
    (platform === "openlane" && Boolean(openlanePublicFallback));
  return allow && (sessionStatus === "login_required" || sessionStatus === "error");
}

