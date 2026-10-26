import { shouldCloseModalBackdrop } from "@/lib/modal-backdrop-close";
import { waybillLifecycleLabel } from "@/lib/iriss-pavadzimes-lifecycle";
import type { IrissPavadzimeLifecycle } from "@/lib/iriss-pavadzimes-types";

export const SARUNA_UNREAD_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** Overlay rāda tikai pēdējās 48h; vecākas ziņas neielādē UI. */
export const SARUNA_VISIBLE_WINDOW_MS = 48 * 60 * 60 * 1000;
export const SARUNA_SEEN_STORAGE_KEY = "iriss-waybill-saruna-seen";

export type SarunaCloseReason = "escape" | "outside" | "button";

export type SarunaAttachment = {
  name: string;
  href?: string;
  sizeLabel?: string;
};

export type SarunaFeedItem =
  | { kind: "day"; id: string; label: string }
  | { kind: "system"; id: string; text: string; at: string }
  | {
      kind: "message";
      id: string;
      from: string;
      mine: boolean;
      text: string;
      at: string;
      attachments: SarunaAttachment[];
    };

export type SarunaFeedSourceRow = {
  id: string;
  number: string;
  brandModel: string;
  fileName: string;
  issuedAt: string;
  lifecycle?: IrissPavadzimeLifecycle;
};

/** Badge teksts: 0 = nav, 1-99 = skaitlis, virs 99 = 99+. */
export function formatSarunaUnreadBadge(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  const n = Math.floor(count);
  return n > 99 ? "99+" : String(n);
}

export function shouldCloseSarunaOverlay(input: {
  open: boolean;
  reason: SarunaCloseReason;
  outside?: { mouseDownOnBackdrop: boolean; mouseUpOnBackdrop: boolean };
}): boolean {
  if (!input.open) return false;
  if (input.reason === "escape" || input.reason === "button") return true;
  return shouldCloseModalBackdrop({
    mouseDownOnBackdrop: Boolean(input.outside?.mouseDownOnBackdrop),
    mouseUpOnBackdrop: Boolean(input.outside?.mouseUpOnBackdrop),
    enabled: true,
  });
}

export function isSarunaEscapeKey(key: string): boolean {
  return key === "Escape";
}

function rigaDayKey(ms: number, timeZone = "Europe/Riga"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

export function formatSarunaClock(iso: string, timeZone = "Europe/Riga"): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(t));
}

export function formatSarunaDayLabel(iso: string, nowMs = Date.now(), timeZone = "Europe/Riga"): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const key = rigaDayKey(t, timeZone);
  if (key === rigaDayKey(nowMs, timeZone)) return "Šodien";
  if (key === rigaDayKey(nowMs - 86_400_000, timeZone)) return "Vakar";
  return new Intl.DateTimeFormat("lv-LV", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(new Date(t))
    .replace(/\.$/, "");
}

export function sarunaItemTime(item: SarunaFeedItem): string {
  return item.kind === "day" ? "" : item.at;
}

export function isWithinSarunaWindow(iso: string, nowMs: number): boolean {
  const at = Date.parse(iso);
  return Number.isFinite(at) && at >= nowMs - SARUNA_VISIBLE_WINDOW_MS;
}

function sarunaKindRank(kind: SarunaFeedItem["kind"]): number {
  if (kind === "system") return 0;
  if (kind === "message") return 1;
  return 2;
}

/**
 * Overlay feed: tikai pēdējās 48h, jaunākais saraksta sākumā, dienu čipi pārbūvēti.
 */
export function prepareSarunaFeed(
  items: readonly SarunaFeedItem[],
  nowMs = Date.now(),
): SarunaFeedItem[] {
  const timed = items.filter((item) => item.kind !== "day" && isWithinSarunaWindow(item.at, nowMs));
  timed.sort((a, b) => {
    const ta = Date.parse(sarunaItemTime(a)) || 0;
    const tb = Date.parse(sarunaItemTime(b)) || 0;
    if (ta !== tb) return tb - ta;
    const kind = sarunaKindRank(a.kind) - sarunaKindRank(b.kind);
    if (kind !== 0) return kind;
    return a.id.localeCompare(b.id);
  });
  const out: SarunaFeedItem[] = [];
  let lastDay = "";
  for (const item of timed) {
    const day = formatSarunaDayLabel(item.at, nowMs);
    if (day && day !== lastDay) {
      out.push({ kind: "day", id: `day-${item.id}`, label: day });
      lastDay = day;
    }
    out.push(item);
  }
  return out;
}

/** Neizlasītie: pēc last-seen, vai pirmajā reizē pēdējās 7 dienas. */
export function countSarunaUnread(
  items: readonly SarunaFeedItem[],
  seenAt: string | null,
  nowMs = Date.now(),
): number {
  const seen = seenAt ? Date.parse(seenAt) : Number.NaN;
  const cutoff = Number.isFinite(seen) ? seen : nowMs - SARUNA_UNREAD_WINDOW_MS;
  return items.filter((item) => {
    const at = Date.parse(sarunaItemTime(item));
    return Number.isFinite(at) && at > cutoff;
  }).length;
}

export function readSarunaSeenAt(storage?: Pick<Storage, "getItem"> | null): string | null {
  try {
    const raw = storage?.getItem(SARUNA_SEEN_STORAGE_KEY);
    return raw && raw.trim() ? raw.trim() : null;
  } catch {
    return null;
  }
}

export function writeSarunaSeenAt(iso: string, storage?: Pick<Storage, "setItem"> | null): void {
  try {
    storage?.setItem(SARUNA_SEEN_STORAGE_KEY, iso);
  } catch {
    /* ignore quota / private mode */
  }
}

function pdfHref(id: string): string {
  return `/api/admin/iriss-pavadzimes/${encodeURIComponent(id)}/pdf`;
}

function attachmentName(fileName: string, number: string): string {
  const name = fileName.trim();
  if (name) return name;
  const nr = number.trim();
  return nr ? `${nr}.pdf` : "pavadzime.pdf";
}

function waybillRowToSarunaItems(row: SarunaFeedSourceRow): SarunaFeedItem[] {
  const at = row.issuedAt.trim();
  if (!at) return [];
  const out: SarunaFeedItem[] = [];
  const status = waybillLifecycleLabel(row.lifecycle);
  if (status) {
    out.push({
      kind: "system",
      id: `st-${row.id}`,
      text: `Statuss → ${status}`,
      at,
    });
  }
  const title = [row.number.trim(), row.brandModel.trim()].filter(Boolean).join(" · ");
  out.push({
    kind: "message",
    id: `msg-${row.id}`,
    from: title || "Pavadzīme",
    mine: false,
    text: title ? `Pavadzīme ${title}` : "Pavadzīme",
    at,
    attachments: [
      {
        name: attachmentName(row.fileName, row.number),
        href: pdfHref(row.id),
      },
    ],
  });
  return out;
}

/** Feed no izdotajām pavadzīmēm: pēdējās 48h, jaunākais augšā, statuss + PDF kartītes. */
export function buildWaybillSarunaFeed(
  rows: readonly SarunaFeedSourceRow[],
  nowMs = Date.now(),
): SarunaFeedItem[] {
  return prepareSarunaFeed(rows.flatMap(waybillRowToSarunaItems), nowMs);
}

export function sarunaOverlayTitle(waybillNo?: string): string {
  const nr = waybillNo?.trim();
  return nr ? `Saruna · ${nr}` : "Saruna";
}
