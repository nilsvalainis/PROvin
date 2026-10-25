/**
 * Saglabātais laiks (ISO ar Z, UTC) admin skatos: `DD.MM.GGGG HH:MM` Europe/Riga.
 * FABLE 25.10: vairākās vietās rādīja `iso.slice(0, 16)` - UTC laiks (2-3 h agrāk) un ISO formā.
 */
export function formatRigaIsoShort(iso: string | null | undefined): string {
  const raw = (iso ?? "").trim();
  const t = Date.parse(raw);
  if (!raw || !Number.isFinite(t)) return raw.slice(0, 16).replace("T", " ");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Riga",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(t));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}.${get("month")}.${get("year")} ${get("hour")}:${get("minute")}`;
}
