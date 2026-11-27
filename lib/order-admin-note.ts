/**
 * Iekšēja admina piezīme pasūtījumam (Nils 27.11, makets B: krāsains čips galvenē).
 * Glabājas melnrakstā `orderEdits.adminNote`. TIKAI adminā - nekad PDF, klienta e-pastos, AI promptos vai klienta saitēs.
 * Nav `server-only` - lieto arī klienta komponentes.
 */

export const ORDER_ADMIN_NOTE_COLORS = ["red", "yellow", "green"] as const;
export type OrderAdminNoteColor = (typeof ORDER_ADMIN_NOTE_COLORS)[number];

export type OrderAdminNote = {
  text: string;
  color: OrderAdminNoteColor;
  resolved: boolean;
  /** ISO laiks - pēdējā izmaiņa. */
  updatedAt: string;
};

export const ORDER_ADMIN_NOTE_MAX_LEN = 2000;

export function isOrderAdminNoteColor(v: unknown): v is OrderAdminNoteColor {
  return typeof v === "string" && (ORDER_ADMIN_NOTE_COLORS as readonly string[]).includes(v);
}

function cleanText(s: string): string {
  const t = s.replace(/\uFEFF/g, "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  return t.length > ORDER_ADMIN_NOTE_MAX_LEN ? t.slice(0, ORDER_ADMIN_NOTE_MAX_LEN) : t;
}

/** Stingra parsēšana (melnraksts, API, saraksta indekss). Nederīgs vai tukšs teksts -> `null`. */
export function parseOrderAdminNote(v: unknown): OrderAdminNote | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.text !== "string") return null;
  const text = cleanText(o.text);
  if (!text.trim()) return null;
  const updatedAt = typeof o.updatedAt === "string" && Number.isFinite(Date.parse(o.updatedAt)) ? o.updatedAt : "";
  if (!updatedAt) return null;
  return {
    text,
    color: isOrderAdminNoteColor(o.color) ? o.color : "red",
    resolved: o.resolved === true,
    updatedAt,
  };
}

const RIGA_NOTE = new Intl.DateTimeFormat("lv-LV", {
  timeZone: "Europe/Riga",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** «27.11. 14:32» Rīgas laikā. */
export function formatOrderAdminNoteTime(iso: string | null | undefined): string {
  const t = Date.parse(iso ?? "");
  if (!Number.isFinite(t)) return "";
  const parts = Object.fromEntries(RIGA_NOTE.formatToParts(new Date(t)).map((p) => [p.type, p.value]));
  return `${parts.day}.${parts.month}. ${parts.hour}:${parts.minute}`;
}

/** Viena rinda čipam / saraksta punktam (atstarpes saspiestas). */
export function orderAdminNoteOneLine(note: Pick<OrderAdminNote, "text"> | null | undefined): string {
  return (note?.text ?? "").replace(/\s+/g, " ").trim();
}
