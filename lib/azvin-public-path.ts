import { stripLocalePrefix } from "@/i18n/locales";

/** Unlisted AZ.VIN product URL. Not in sitemap; guessable `/demo/azvin` stays closed. */
export const AZVIN_PUBLIC_PATH = "/view/n7k4xw9q" as const;

export function isAzvinPublicPath(pathname: string): boolean {
  const p = stripLocalePrefix(pathname);
  return p === AZVIN_PUBLIC_PATH || p.startsWith(`${AZVIN_PUBLIC_PATH}/`);
}
