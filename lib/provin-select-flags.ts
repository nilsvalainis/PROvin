/**
 * PROVIN SELECT (konsultācijas sadaļa, hero otrā poga, API).
 * Publicēšana bez koda izmaiņām: Vercel / `.env.local` → `NEXT_PUBLIC_PROVIN_SELECT_PUBLIC=1`
 * Bez mainīgā vai ar `0` / `false` — pilnībā slēpts (lapā nav, API atgriež 404).
 */
export function isProvinSelectPublic(): boolean {
  const v = (process.env.NEXT_PUBLIC_PROVIN_SELECT_PUBLIC ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}
