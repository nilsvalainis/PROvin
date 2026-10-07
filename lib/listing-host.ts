/**
 * Sludinājuma portāla saimnieks → tirdzniecības valsts (tirgus odometra rinda).
 * Nav apgalvojums, kur auto fiziski atrodas.
 */

import { canonicalizeListingUrl, isPlausibleListingUrl } from "@/lib/order-field-validation";

const HOST_COUNTRY: readonly { host: string; country: string }[] = [
  { host: "ss.lv", country: "Latvija" },
  { host: "ss.com", country: "Latvija" },
  { host: "city24.lv", country: "Latvija" },
  { host: "rentinriga.lv", country: "Latvija" },
  { host: "cityreal.lv", country: "Latvija" },
  { host: "auto24.ee", country: "Igaunija" },
  { host: "osta.ee", country: "Igaunija" },
  { host: "autoplius.lt", country: "Lietuva" },
  { host: "autogidas.lt", country: "Lietuva" },
  { host: "mobile.de", country: "Vācija" },
  { host: "autoscout24.de", country: "Vācija" },
  { host: "autoscout24.com", country: "Vācija" },
  { host: "blocket.se", country: "Zviedrija" },
  { host: "bytbil.se", country: "Zviedrija" },
  { host: "bilbasen.dk", country: "Dānija" },
  { host: "dba.dk", country: "Dānija" },
  { host: "tori.fi", country: "Somija" },
  { host: "nettiauto.com", country: "Somija" },
];

export function listingHostname(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  try {
    return new URL(canonicalizeListingUrl(t)).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function hostMatches(hostname: string, suffix: string): boolean {
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

/** Tirdzniecības valsts no sludinājuma saites; tukšs, ja portāls nav zināms. */
export function listingCountryFromUrl(raw: string | null | undefined): string {
  const host = listingHostname(raw);
  if (!host) return "";
  for (const row of HOST_COUNTRY) {
    if (hostMatches(host, row.host)) return row.country;
  }
  return "";
}

/** Vai pēc apmaksas / admin ielases vispār mēģināt vēsturi un lapas scrape. */
export function isListingAutofillUrl(raw: string | null | undefined): boolean {
  const t = (raw ?? "").trim();
  if (!t) return false;
  return isPlausibleListingUrl(t);
}
