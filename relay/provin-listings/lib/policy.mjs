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
 * Publiskie dati, ja auto-login neizdodas. Autobid vienmēr, Openlane ja
 * OPENLANE_ALLOW_PUBLIC_FALLBACK. `error` (ne tikai login_required) arī lasa publiski.
 */
export function shouldReadPublic(platform, sessionStatus, openlanePublicFallback) {
  const allow = platform === "autobid" || (platform === "openlane" && Boolean(openlanePublicFallback));
  return allow && (sessionStatus === "login_required" || sessionStatus === "error");
}

