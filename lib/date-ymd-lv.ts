/**
 * Datums no `<input type="date">` (YYYY-MM-DD) klienta dokumentos - `DD.MM.YYYY`.
 * Cits teksts paliek kā ievadīts (vecie ieraksti ar brīvu tekstu).
 */
export function formatYmdLv(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : t;
}
