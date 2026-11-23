/**
 * «Izsoļu arhīvs» kā ATSEVIŠĶS PDF/pakalpojums jebkuram pasūtījumam (Nils 23.11, 3. punkts) - papildus
 * piedāvājumam «dīlera datu vietā» (#1140), kas paliek kā ir. Tīra loģika: sūtīšanas logs (tie paši
 * 3 gadījumi kā dīlera datiem), teksti no šablonu reģistra, sūtījumu žurnāls, faila nosaukums. Tikai LV.
 */
import {
  auctionArchiveCountries,
  formatIsoDayLv,
  lvCount,
  type AuctionArchiveSummary,
} from "@/lib/auction-archive-offer";
import { DEALER_SEND_AUDITS_URL, DEALER_SEND_CHANNEL_LV, type DealerSendChannel, type DealerSendOffer, type DealerSendSituation } from "@/lib/dealer-send-message";
import { AUCTION_ARCHIVE_VALUE_SENTENCE } from "@/lib/email/auction-archive-email";
import { renderTemplateById } from "@/lib/messages/render-template-id";
import { GOOGLE_REVIEW_URL } from "@/lib/messages/shared-blocks";
import { reportReadyVinVar } from "@/lib/messages/template-vars";
import type { MessageTemplatesDoc } from "@/lib/messages/types";
import { formatRigaDateTime } from "@/lib/order-client-marks";
import { formatEurFromCents } from "@/lib/order-upsell";

export type AuctionArchiveSendSituation = DealerSendSituation;

export const AUCTION_ARCHIVE_SEND_SITUATION_LV: Record<AuctionArchiveSendSituation, string> = {
  ready: "Arhīvs gatavs",
  no_data: "Datu nav (atmaksa)",
  cancelled: "Atcelts",
};

const SENT_KIND_LV: Record<AuctionArchiveSendSituation, string> = {
  ready: "izsoļu arhīvs",
  no_data: "datu nav",
  cancelled: "atcelts",
};

/** Klientam nosūtītais fails (Nils 23.11): «IZSOLU_ARHIVS_<VIN>.pdf». */
export function auctionArchiveReportPdfFilename(vin: string | null | undefined): string {
  const v = (vin ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 17).toUpperCase() || "VIN";
  return `IZSOLU_ARHIVS_${v}.pdf`;
}

/** «Arhīvā: 2 izsoles (21.10.2026, Itālija), 84 oriģinālās izsoles bildes ar datumiem, …» + vērtības teikums. */
export function auctionArchiveReportContentsLine(s: AuctionArchiveSummary, showPrices: boolean): string {
  if (s.auctions.length === 0 && s.photoCount === 0) return "";
  const last = [...s.auctions].reverse().find((a) => a.date)?.date ?? "";
  const where = [formatIsoDayLv(last), auctionArchiveCountries(s).join(", ")].filter(Boolean).join(", ");
  const parts = [
    `${lvCount(Math.max(1, s.auctions.length), "izsole", "izsoles")}${where ? ` (${where})` : ""}`,
    s.photoCount > 0 ? `${s.photoCount} oriģinālās izsoles bildes ar datumiem` : "",
    showPrices ? "cenas" : "",
    "nobraukums un bojājumi pa zonām",
  ].filter(Boolean);
  const head = `Arhīvā: ${parts.slice(0, -1).join(", ")}${parts.length > 1 ? ", " : ""}${parts[parts.length - 1]}.`;
  return s.photoCount > 0 ? `${head} ${AUCTION_ARCHIVE_VALUE_SENTENCE}` : head;
}

export function auctionArchiveSendTemplateId(channel: DealerSendChannel, situation: AuctionArchiveSendSituation): string {
  return `${channel === "email" ? "email" : "wa"}.auction_archive_send.${situation}`;
}

export type AuctionArchiveSendMessageInput = {
  channel: DealerSendChannel;
  situation: AuctionArchiveSendSituation;
  b2b: boolean;
  vin?: string | null;
  summary?: AuctionArchiveSummary | null;
  showPrices?: boolean;
  refundCents?: number | null;
  offer?: DealerSendOffer | null;
  review?: boolean;
  doc?: MessageTemplatesDoc | null;
};

function tidy(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildAuctionArchiveSendVars(input: AuctionArchiveSendMessageInput): Record<string, string> {
  const ready = input.situation === "ready";
  const offer = ready && input.offer ? input.offer : null;
  const refund = input.refundCents != null && input.refundCents > 0 ? formatEurFromCents(input.refundCents) : "";
  return {
    vin: reportReadyVinVar(input.vin),
    zimols: input.b2b ? "PROVIN" : "PROVIN.LV",
    apraksts: ready && input.summary ? auctionArchiveReportContentsLine(input.summary, input.showPrices === true) : "",
    summa: refund,
    karte: input.b2b ? "" : "1",
    atlikums: input.b2b ? "1" : "",
    audits_saite: DEALER_SEND_AUDITS_URL,
    jau_samaksats: offer ? formatEurFromCents(offer.priorCents) : "",
    piemaksa: offer ? formatEurFromCents(offer.chargeCents) : "",
    kopa: offer ? formatEurFromCents(offer.targetCents) : "",
    maksajuma_saite: offer?.url ?? "",
    atsauksmes_saite: ready && input.review ? GOOGLE_REVIEW_URL : "",
  };
}

export function buildAuctionArchiveSendMessage(input: AuctionArchiveSendMessageInput): { subject?: string; text: string } {
  const rendered = renderTemplateById(auctionArchiveSendTemplateId(input.channel, input.situation), buildAuctionArchiveSendVars(input), input.doc);
  const text = tidy(rendered?.text ?? "");
  const subject = input.channel === "email" ? rendered?.subject?.trim() : undefined;
  return subject ? { subject, text } : { text };
}

/* ---------- Stāvoklis (pasūtījuma mapē) ---------- */

export type AuctionArchiveReportSend = {
  at: string;
  channel: DealerSendChannel;
  situation: AuctionArchiveSendSituation;
  offer: boolean;
  review: boolean;
};

export type AuctionArchiveReportDoc = {
  sessionId: string;
  generatedAt?: string;
  pdfBytes?: number;
  photos?: number;
  missingPhotos?: number;
  /** Ar kādu «Rādīt izsoļu cenas» izvēli ģenerēts pēdējais PDF. */
  showPrices?: boolean;
  sends: AuctionArchiveReportSend[];
};

export const AUCTION_ARCHIVE_REPORT_SENDS_MAX = 20;

const SITUATIONS: readonly AuctionArchiveSendSituation[] = ["ready", "no_data", "cancelled"];

export function isAuctionArchiveSendSituation(v: unknown): v is AuctionArchiveSendSituation {
  return SITUATIONS.includes(v as AuctionArchiveSendSituation);
}

export function parseAuctionArchiveReportDoc(raw: unknown, sessionId: string): AuctionArchiveReportDoc {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : undefined);
  const iso = (v: unknown) => (typeof v === "string" && Number.isFinite(Date.parse(v)) ? v.slice(0, 40) : undefined);
  const sends: AuctionArchiveReportSend[] = [];
  for (const item of Array.isArray(o.sends) ? o.sends : []) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const at = iso(r.at);
    if (!at || !isAuctionArchiveSendSituation(r.situation) || (r.channel !== "email" && r.channel !== "whatsapp")) continue;
    const ready = r.situation === "ready";
    sends.push({ at, channel: r.channel, situation: r.situation, offer: ready && r.offer === true, review: ready && r.review === true });
  }
  const out: AuctionArchiveReportDoc = { sessionId, sends: sends.slice(-AUCTION_ARCHIVE_REPORT_SENDS_MAX) };
  const g = iso(o.generatedAt);
  if (g) out.generatedAt = g;
  for (const k of ["pdfBytes", "photos", "missingPhotos"] as const) {
    const v = n(o[k]);
    if (v != null) out[k] = v;
  }
  if (o.showPrices === true) out.showPrices = true;
  return out;
}

export function appendAuctionArchiveReportSend(doc: AuctionArchiveReportDoc, rec: AuctionArchiveReportSend): AuctionArchiveReportDoc {
  return { ...doc, sends: [...doc.sends, rec].slice(-AUCTION_ARCHIVE_REPORT_SENDS_MAX) };
}

/** Tā pati rinda kā dīlera datiem: «Nosūtīts klientam: 23.11.2026 14:32 (izsoļu arhīvs, e-pasts, ar atsauksmi)». */
export function auctionArchiveReportStatusLine(doc: AuctionArchiveReportDoc | null | undefined): string {
  const rec = doc?.sends.length ? doc.sends[doc.sends.length - 1]! : null;
  if (!rec) return "Nav nosūtīts";
  const extra = [
    SENT_KIND_LV[rec.situation],
    DEALER_SEND_CHANNEL_LV[rec.channel].toLowerCase(),
    rec.offer ? "ar piedāvājumu" : "",
    rec.review ? "ar atsauksmi" : "",
  ].filter(Boolean);
  return `Nosūtīts klientam: ${formatRigaDateTime(rec.at)} (${extra.join(", ")})`;
}
