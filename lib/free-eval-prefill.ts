/** Notikums, ar kuru sākumlapas kartīte "Iesūti sludinājumu" priekšaizpilda bezmaksas novērtējuma formu. */
export const FREE_EVAL_PREFILL_EVENT = "provin:free-eval-prefill";
/** `vin` - VIN vai numurzīme no bezmaksas pārbaudes (nav jāievada vēlreiz). */
export type FreeEvalPrefillDetail = { listingUrl: string; vin?: string };

/** Saite no citas lapas (piem. /vin-dekoders) uz sākumlapas formu ar priekšaizpildi. */
export function freeEvalPrefillHref(home: string, detail: FreeEvalPrefillDetail): string {
  const q = new URLSearchParams();
  if (detail.listingUrl) q.set("listing", detail.listingUrl);
  if (detail.vin) q.set("vin", detail.vin);
  const qs = q.toString();
  return `${home}${qs ? `?${qs}` : ""}#bezmaksas-novertejums`;
}
