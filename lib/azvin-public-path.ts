/** Unlisted AZ.VIN product URL. Not in sitemap; guessable `/demo/azvin` stays closed. */
export const AZVIN_PUBLIC_PATH = "/view/n7k4xw9q" as const;

export function isAzvinPublicPath(pathname: string): boolean {
  const raw = (pathname.split("?")[0] ?? pathname).trim();
  let p = raw.endsWith("/") && raw.length > 1 ? raw.slice(0, -1) : raw;
  if (p === "/lv" || p === "/en") return false;
  if (p.startsWith("/lv/")) p = p.slice(3);
  else if (p.startsWith("/en/")) p = p.slice(3);
  return p === AZVIN_PUBLIC_PATH || p.startsWith(`${AZVIN_PUBLIC_PATH}/`);
}
