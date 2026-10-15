import { auditDeadlineMs, formatAuditDeadlineRemaining, type AuditDeadlineStatus } from "@/lib/admin-audit-deadline";
import { rigaCalendarDayKey } from "@/lib/admin-riga-calendar";
import {
  LISTING_PEEK_REPLY_DEADLINE_MS,
  formatListingPeekDeadlineRemaining,
  listingPeekCreatedMs,
} from "@/lib/listing-peek-deadline";
import { isOpenListingPeekWork } from "@/lib/listing-peek-queue";

export type MorningSummaryOrderInput = {
  id: string;
  created: number;
  deadlineFromUnix?: number | null;
  auditComplete?: boolean;
  isB2bPack?: boolean;
  makeModel?: string | null;
  vin?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
};

export type MorningSummaryPeekInput = {
  id: string;
  createdAt: string;
  status: string;
  commentSentAt?: string | null;
  email?: string;
  vin?: string | null;
  listingUrl?: string;
};

export type MorningQueueItemKind = "audit" | "peek";

export type MorningQueueItem = {
  kind: MorningQueueItemKind;
  id: string;
  href: string;
  title: string;
  subtitle: string;
  deadlineStatus: AuditDeadlineStatus | null;
  deadlineLabel: string | null;
  dueToday: boolean;
  isNew: boolean;
  unanswered: boolean;
};

export type MorningSummaryCounts = {
  open: number;
  urgent: number;
  overdue: number;
  openAudits: number;
  urgentAudits: number;
  overdueAudits: number;
  dueTodayAudits: number;
  openPeeks: number;
  unansweredPeeks: number;
  urgentPeeks: number;
  overduePeeks: number;
  newPeeksLast24h: number;
};

export type MorningFailingSource = {
  id: string;
  streak: number;
  msg: string;
};

export type MorningSummary = {
  counts: MorningSummaryCounts;
  overdueAudits: MorningQueueItem[];
  dueTodayAudits: MorningQueueItem[];
  urgentAudits: MorningQueueItem[];
  unansweredPeeks: MorningQueueItem[];
  newPeeksLast24h: MorningQueueItem[];
  /** VIN SCAN avoti, kas krīt vismaz 3 reizes pēc kārtas. */
  failingSources: MorningFailingSource[];
};

function peekHost(url: string | undefined): string {
  const raw = (url ?? "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return raw.replace(/^https?:\/\//i, "").split("/")[0] ?? raw;
  }
}

export function morningAuditTitle(order: MorningSummaryOrderInput): string {
  const model = (order.makeModel ?? "").trim();
  if (model) return model;
  const vin = (order.vin ?? "").trim();
  if (vin) return vin;
  const name = (order.customerName ?? "").trim();
  if (name) return name;
  const email = (order.customerEmail ?? "").trim();
  if (email) return email;
  return "Pasūtījums";
}

export function morningPeekTitle(peek: MorningSummaryPeekInput): string {
  const host = peekHost(peek.listingUrl);
  if (host) return host;
  const vin = (peek.vin ?? "").trim();
  if (vin) return vin;
  const email = (peek.email ?? "").trim();
  if (email) return email;
  return "Ātrais vērtējums";
}

function isActiveAudit(order: MorningSummaryOrderInput): boolean {
  return !order.auditComplete && !order.isB2bPack;
}

function deadlineUnix(order: MorningSummaryOrderInput): number {
  return order.deadlineFromUnix ?? order.created;
}

export function isAuditDueToday(order: MorningSummaryOrderInput, nowMs: number): boolean {
  if (!isActiveAudit(order)) return false;
  return rigaCalendarDayKey(auditDeadlineMs(deadlineUnix(order))) === rigaCalendarDayKey(nowMs);
}

function sortQueue(a: MorningQueueItem, b: MorningQueueItem): number {
  const rank = (s: AuditDeadlineStatus | null) => (s === "overdue" ? 0 : s === "urgent" ? 1 : s === "ok" ? 2 : 3);
  const d = rank(a.deadlineStatus) - rank(b.deadlineStatus);
  if (d !== 0) return d;
  if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
  return a.id.localeCompare(b.id);
}

function toAuditItem(order: MorningSummaryOrderInput, nowMs: number): MorningQueueItem {
  const sla = formatAuditDeadlineRemaining(deadlineUnix(order), nowMs);
  const email = (order.customerEmail ?? "").trim();
  const vin = (order.vin ?? "").trim();
  return {
    kind: "audit",
    id: order.id,
    href: `/admin/orders/${encodeURIComponent(order.id)}`,
    title: morningAuditTitle(order),
    subtitle: [vin && vin !== morningAuditTitle(order) ? vin : "", email].filter(Boolean).join(" · "),
    deadlineStatus: sla.status,
    deadlineLabel: sla.label,
    dueToday: isAuditDueToday(order, nowMs),
    isNew: false,
    unanswered: false,
  };
}

export function isPeekCreatedLast24h(peek: MorningSummaryPeekInput, nowMs: number): boolean {
  const created = listingPeekCreatedMs(peek.createdAt);
  if (created == null) return false;
  const age = nowMs - created;
  return age >= 0 && age < LISTING_PEEK_REPLY_DEADLINE_MS;
}

function toPeekItem(peek: MorningSummaryPeekInput, nowMs: number): MorningQueueItem {
  const sla = formatListingPeekDeadlineRemaining(peek.createdAt, nowMs);
  const open = isOpenListingPeekWork(peek);
  const unanswered = open && !(peek.commentSentAt ?? "").trim();
  const vin = (peek.vin ?? "").trim();
  const email = (peek.email ?? "").trim();
  return {
    kind: "peek",
    id: peek.id,
    href: `/admin/atras-vertesanas/${encodeURIComponent(peek.id)}`,
    title: morningPeekTitle(peek),
    subtitle: [vin, email].filter(Boolean).join(" · "),
    deadlineStatus: sla?.status ?? null,
    deadlineLabel: sla?.label ?? null,
    dueToday: false,
    isNew: peek.status === "new",
    unanswered,
  };
}

export function buildMorningSummary(
  orders: readonly MorningSummaryOrderInput[],
  peeks: readonly MorningSummaryPeekInput[],
  nowMs = Date.now(),
): MorningSummary {
  const activeOrders = orders.filter(isActiveAudit);
  const auditItems = activeOrders.map((o) => toAuditItem(o, nowMs)).sort(sortQueue);
  const openPeeks = peeks.filter((p) => isOpenListingPeekWork(p));
  const peekItems = openPeeks.map((p) => toPeekItem(p, nowMs)).sort(sortQueue);

  const overdueAudits = auditItems.filter((i) => i.deadlineStatus === "overdue");
  const dueTodayAudits = auditItems.filter((i) => i.dueToday && i.deadlineStatus !== "overdue");
  const listedAuditIds = new Set([...overdueAudits, ...dueTodayAudits].map((i) => i.id));
  const urgentAudits = auditItems.filter((i) => i.deadlineStatus === "urgent" && !listedAuditIds.has(i.id));
  const newPeeksLast24h = peeks
    .filter((p) => isPeekCreatedLast24h(p, nowMs))
    .slice()
    .sort((a, b) => (listingPeekCreatedMs(b.createdAt) ?? 0) - (listingPeekCreatedMs(a.createdAt) ?? 0))
    .map((p) => toPeekItem(p, nowMs));

  return {
    counts: {
      open: auditItems.length + peekItems.length,
      urgent:
        auditItems.filter((i) => i.deadlineStatus === "urgent").length +
        peekItems.filter((i) => i.deadlineStatus === "urgent").length,
      overdue:
        overdueAudits.length + peekItems.filter((i) => i.deadlineStatus === "overdue").length,
      openAudits: auditItems.length,
      urgentAudits: auditItems.filter((i) => i.deadlineStatus === "urgent").length,
      overdueAudits: overdueAudits.length,
      dueTodayAudits: auditItems.filter((i) => i.dueToday).length,
      openPeeks: peekItems.length,
      unansweredPeeks: peekItems.filter((i) => i.unanswered || i.isNew).length,
      urgentPeeks: peekItems.filter((i) => i.deadlineStatus === "urgent").length,
      overduePeeks: peekItems.filter((i) => i.deadlineStatus === "overdue").length,
      newPeeksLast24h: newPeeksLast24h.length,
    },
    overdueAudits,
    dueTodayAudits,
    urgentAudits,
    unansweredPeeks: peekItems,
    newPeeksLast24h,
    failingSources: [],
  };
}
