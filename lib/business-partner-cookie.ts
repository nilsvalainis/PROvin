/**
 * Partnera saite der tikai pārlūkā, kurā nospiesta partnera poga: `/b/p` pāradresācija uzliek
 * HttpOnly sīkdatni, `/b/{token}` lapa un apmaksa to pieprasa. Pārsūtīta saite neatveras.
 */
export const BUSINESS_PARTNER_COOKIE_MAX_AGE_SEC = 60 * 60;

export function businessPartnerCookieName(tokenHash: string): string {
  return `pvb_${tokenHash.slice(0, 24)}`;
}

/** `Cookie` galvenē ir šīs saites sīkdatne. */
export function hasBusinessPartnerCookie(cookieHeader: string | null | undefined, tokenHash: string): boolean {
  if (!cookieHeader || !/^[a-f0-9]{64}$/.test(tokenHash)) return false;
  const name = businessPartnerCookieName(tokenHash);
  return cookieHeader.split(";").some((part) => {
    const [k, v] = part.trim().split("=");
    return k === name && v === tokenHash.slice(24, 48);
  });
}

export function businessPartnerCookieValue(tokenHash: string): string {
  return tokenHash.slice(24, 48);
}
