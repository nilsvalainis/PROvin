/**
 * Klienta IP (Vercel). `x-vercel-forwarded-for` un `x-real-ip` uzstāda Vercel malas tīkls;
 * `x-forwarded-for` Vercel arī pārraksta, bet citur to var padot klients, tāpēc tas ir pēdējais.
 */
export function getClientIpFromHeaders(headers: Pick<Headers, "get">): string {
  const vercel = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return xff;
  return "unknown";
}

/** Klienta IP Route Handler pieprasījumam. */
export function getClientIpFromRequest(req: Request): string {
  return getClientIpFromHeaders(req.headers);
}
