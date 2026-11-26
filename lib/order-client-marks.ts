/**
 * Pasūtījuma klienta saziņas atzīmes (tīrā loģika): dīlera datu sūtīšanas žurnāls un
 * Google atsauksmes lūgums. Jauns lauks - veci pasūtījumi netiek migrēti; atzīmes nav = nav sūtīts.
 */
import type { DealerSendChannel, DealerSendSituation } from "@/lib/dealer-send-message";
import { DEALER_SEND_CHANNEL_LV } from "@/lib/dealer-send-message";

export type DealerSendRecord = {
  at: string;
  channel: DealerSendChannel;
  situation: DealerSendSituation;
  offer: boolean;
  review: boolean;
};

export type OrderClientMarks = {
  dealerSends?: DealerSendRecord[];
  reviewRequestedAt?: string;
  reviewRequestChannel?: DealerSendChannel;
  /** Adminā «Nelūgt» / «Atcelt»: automātiski vairs nesūta. */
  reviewOptOutAt?: string;
};

export const DEALER_SEND_LOG_MAX = 20;

/** Atsauksmes lūgumu rinda: izpildīts vismaz pirms 2 dienām, bet ne senāk par 30 dienām. */
export const REVIEW_REQUEST_MIN_AGE_MS = 2 * 24 * 60 * 60 * 1000;
export const REVIEW_REQUEST_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function isDealerSendChannel(v: unknown): v is DealerSendChannel {
  return v === "email" || v === "whatsapp";
}

export function isDealerSendSituation(v: unknown): v is DealerSendSituation {
  return v === "ready" || v === "no_data" || v === "cancelled";
}

export function parseOrderClientMarks(raw: unknown): OrderClientMarks {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: OrderClientMarks = {};
  if (Array.isArray(r.dealerSends)) {
    const list = r.dealerSends
      .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object")
      .filter((x) => typeof x.at === "string" && isDealerSendChannel(x.channel) && isDealerSendSituation(x.situation))
      .map((x) => ({
        at: x.at as string,
        channel: x.channel as DealerSendChannel,
        situation: x.situation as DealerSendSituation,
        offer: x.offer === true,
        review: x.review === true,
      }));
    if (list.length > 0) out.dealerSends = list;
  }
  if (typeof r.reviewRequestedAt === "string" && r.reviewRequestedAt) out.reviewRequestedAt = r.reviewRequestedAt;
  if (isDealerSendChannel(r.reviewRequestChannel)) out.reviewRequestChannel = r.reviewRequestChannel;
  if (typeof r.reviewOptOutAt === "string" && r.reviewOptOutAt) out.reviewOptOutAt = r.reviewOptOutAt;
  return out;
}

export function withDealerSend(marks: OrderClientMarks, rec: DealerSendRecord): OrderClientMarks {
  const sends = [...(marks.dealerSends ?? []), rec].slice(-DEALER_SEND_LOG_MAX);
  const next: OrderClientMarks = { ...marks, dealerSends: sends };
  if (rec.review && !marks.reviewRequestedAt) {
    next.reviewRequestedAt = rec.at;
    next.reviewRequestChannel = rec.channel;
  }
  return next;
}

export function withReviewRequested(
  marks: OrderClientMarks,
  channel: DealerSendChannel,
  atIso: string,
): OrderClientMarks {
  return { ...marks, reviewRequestedAt: atIso, reviewRequestChannel: channel };
}

/** «Nelūgt» (pirms lūguma) / «Atcelt» (pēc lūguma) - ieslēgt vai noņemt. */
export function withReviewOptOut(marks: OrderClientMarks, optOut: boolean, atIso: string): OrderClientMarks {
  if (optOut) return marks.reviewOptOutAt ? marks : { ...marks, reviewOptOutAt: atIso };
  const { reviewOptOutAt: _drop, ...rest } = marks;
  void _drop;
  return rest;
}

/** Dīlera sūtījums «Datu nav - atmaksa» vai «Atcelts»: pasūtījums nav izpildīts - atsauksmi nelūdz. */
export function isOrderCancelledByClientMarks(marks: OrderClientMarks | null | undefined): boolean {
  return (marks?.dealerSends ?? []).some((s) => s.situation === "cancelled" || s.situation === "no_data");
}

export function lastDealerSend(marks: OrderClientMarks | null | undefined): DealerSendRecord | null {
  const list = marks?.dealerSends ?? [];
  return list.length > 0 ? list[list.length - 1]! : null;
}

const RIGA_SHORT = new Intl.DateTimeFormat("lv-LV", {
  timeZone: "Europe/Riga",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** «19.11 14:32» Rīgas laikā. */
export function formatRigaDayTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const parts = Object.fromEntries(RIGA_SHORT.formatToParts(new Date(t)).map((p) => [p.type, p.value]));
  return `${parts.day}.${parts.month} ${parts.hour}:${parts.minute}`;
}

const RIGA_FULL = new Intl.DateTimeFormat("lv-LV", {
  timeZone: "Europe/Riga",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** «21.11.2026 14:32» Rīgas laikā. */
export function formatRigaDateTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const parts = Object.fromEntries(RIGA_FULL.formatToParts(new Date(t)).map((p) => [p.type, p.value]));
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
}

/** Sūtījuma veids klienta žurnālā. */
export const DEALER_SEND_KIND_LV: Record<DealerSendSituation, string> = {
  ready: "Atskaite gatava",
  no_data: "Datu nav - atmaksa",
  cancelled: "Atcelts",
};

/** Rinda zem «Sūtīt klientam»: «Nosūtīts klientam: 19.11.2026 14:32 (Atskaite gatava, e-pasts)» vai «Nav nosūtīts». */
export function dealerSendStatusLine(rec: DealerSendRecord | null): string {
  if (!rec) return "Nav nosūtīts";
  const extra = [
    DEALER_SEND_KIND_LV[rec.situation],
    DEALER_SEND_CHANNEL_LV[rec.channel].toLowerCase(),
    rec.offer ? "ar piedāvājumu" : "",
    rec.review ? "ar atsauksmi" : "",
  ].filter(Boolean);
  return `Nosūtīts klientam: ${formatRigaDateTime(rec.at)} (${extra.join(", ")})`;
}

/** Servera maršrutiem: sūtījuma ieraksts no pieprasījuma laukiem (tie paši noteikumi kā `dealer_send`). */
export function dealerSendRecordFromInput(
  raw: { situation?: unknown; offer?: unknown; review?: unknown },
  channel: DealerSendChannel,
  atIso: string,
  fallbackSituation: DealerSendSituation,
): DealerSendRecord {
  const situation = isDealerSendSituation(raw.situation) ? raw.situation : fallbackSituation;
  const offer = situation === "ready" && (raw.offer === true || raw.offer === "true");
  const review = situation === "ready" && (raw.review === true || raw.review === "true");
  return { at: atIso, channel, situation, offer, review };
}

/** Pēc cik ilga laika gatavi dīlera dati bez sūtījuma sarakstā kļūst sarkani. */
export const DEALER_NOT_SENT_ALERT_MS = 2 * 60 * 60 * 1000;

/**
 * «Nav nosūtīts» atzīme pasūtījumu sarakstā: dati gatavi (`readyAt`) vairāk nekā pirms 2 h,
 * bet klientam pēc tam nekas nav sūtīts.
 */
export function dealerNotSentAlert(args: {
  readyAt: string | null | undefined;
  marks: OrderClientMarks | null | undefined;
  nowMs: number;
}): boolean {
  const t = Date.parse(args.readyAt ?? "");
  if (!Number.isFinite(t)) return false;
  if (args.nowMs - t < DEALER_NOT_SENT_ALERT_MS) return false;
  return (args.marks?.dealerSends ?? []).length === 0;
}

/**
 * Vai pasūtījums gaida atsauksmes lūgumu: izpildīts (piegādāts) pirms 2-30 dienām,
 * lūgums vēl nav sūtīts, nav B2B partneris.
 */
export function isAwaitingReviewRequest(args: {
  completedAt?: string | null;
  reviewRequestedAt?: string | null;
  b2b?: boolean;
  nowMs: number;
}): boolean {
  if (args.b2b || args.reviewRequestedAt) return false;
  const t = Date.parse(args.completedAt ?? "");
  if (!Number.isFinite(t)) return false;
  const age = args.nowMs - t;
  return age >= REVIEW_REQUEST_MIN_AGE_MS && age <= REVIEW_REQUEST_MAX_AGE_MS;
}

/** «pirms 3 d.» */
export function daysAgoLabel(iso: string, nowMs: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = Math.max(0, Math.floor((nowMs - t) / (24 * 60 * 60 * 1000)));
  return d === 0 ? "šodien" : `pirms ${d} d.`;
}
