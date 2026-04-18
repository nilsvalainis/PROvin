/**
 * PROVIN SELECT (konsultācijas sadaļa, hero otrā poga, API).
 * Pēc noklusējuma redzams (produkcijā pēc deploy). Pilnībā slēpt: Vercel / `.env` →
 * `NEXT_PUBLIC_PROVIN_SELECT_PUBLIC=0` (vai `false` / `no` / `off`) — lapā nav, API 404.
 */
export function isProvinSelectPublic(): boolean {
  const v = (process.env.NEXT_PUBLIC_PROVIN_SELECT_PUBLIC ?? "").trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return true;
}
