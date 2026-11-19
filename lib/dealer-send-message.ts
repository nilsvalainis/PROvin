/**
 * Dīlera dati «Sūtīt klientam» logs: teksts no šablonu reģistra (labojams adminā «Šabloni»).
 * Tīra loģika - der klienta komponentei un testiem.
 */
import { renderTemplateById } from "@/lib/messages/render-template-id";
import { GOOGLE_REVIEW_URL } from "@/lib/messages/shared-blocks";
import { reportReadyVinVar } from "@/lib/messages/template-vars";
import type { MessageTemplatesDoc } from "@/lib/messages/types";
import { formatEurFromCents } from "@/lib/order-upsell";

export type DealerSendChannel = "email" | "whatsapp";
export type DealerSendSituation = "ready" | "no_data" | "cancelled";

export const DEALER_SEND_AUDITS_URL = "https://www.provin.lv/lv?plan=audits";

export const DEALER_SEND_SITUATION_LV: Record<DealerSendSituation, string> = {
  ready: "Dati gatavi",
  no_data: "Datu nav (atmaksa)",
  cancelled: "Atcelts",
};

export const DEALER_SEND_CHANNEL_LV: Record<DealerSendChannel, string> = {
  email: "E-pasts",
  whatsapp: "WhatsApp",
};

export type DealerSendOffer = {
  url: string;
  priorCents: number;
  chargeCents: number;
  targetCents: number;
};

export type DealerSendOptions = { offer: boolean; review: boolean };

/** Piedāvājums un atsauksmes lūgums nekad nav vienā ziņā (Nila lēmums 19.11). */
export function toggleDealerSendOption(
  current: DealerSendOptions,
  which: keyof DealerSendOptions,
  checked: boolean,
): DealerSendOptions {
  if (!checked) return { ...current, [which]: false };
  return which === "offer" ? { offer: true, review: false } : { offer: false, review: true };
}

export function dealerSendTemplateId(channel: DealerSendChannel, situation: DealerSendSituation): string {
  const prefix = channel === "email" ? "email" : "wa";
  return `${prefix}.dealer_send.${situation}`;
}

export type DealerSendMessageInput = {
  channel: DealerSendChannel;
  situation: DealerSendSituation;
  b2b: boolean;
  vin?: string | null;
  /** Atgrieztā summa centos (no_data / cancelled). */
  refundCents?: number | null;
  /** Tikai «Dati gatavi»: piedāvājuma saite un cenas. */
  offer?: DealerSendOffer | null;
  /** Tikai «Dati gatavi»: Google atsauksmes lūgums (nekad kopā ar piedāvājumu). */
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

export function buildDealerSendVars(input: DealerSendMessageInput): Record<string, string> {
  const ready = input.situation === "ready";
  const offer = ready && input.offer && !input.review ? input.offer : null;
  const refund = input.refundCents != null && input.refundCents > 0 ? formatEurFromCents(input.refundCents) : "";
  return {
    vin: reportReadyVinVar(input.vin),
    zimols: input.b2b ? "PROVIN" : "PROVIN.LV",
    summa: refund,
    karte: input.b2b ? "" : "1",
    atlikums: input.b2b ? "1" : "",
    audits_saite: DEALER_SEND_AUDITS_URL,
    jau_samaksats: offer ? formatEurFromCents(offer.priorCents) : "",
    piemaksa: offer ? formatEurFromCents(offer.chargeCents) : "",
    kopa: offer ? formatEurFromCents(offer.targetCents) : "",
    maksajuma_saite: offer?.url ?? "",
    atsauksmes_saite: ready && input.review && !input.offer ? GOOGLE_REVIEW_URL : "",
  };
}

export function buildDealerSendMessage(input: DealerSendMessageInput): { subject?: string; text: string } {
  const id = dealerSendTemplateId(input.channel, input.situation);
  const rendered = renderTemplateById(id, buildDealerSendVars(input), input.doc);
  const text = tidy(rendered?.text ?? "");
  const subject = input.channel === "email" ? rendered?.subject?.trim() : undefined;
  return subject ? { subject, text } : { text };
}

/** wa.me saite ar tekstu (tālrunis tikai cipari). Bez tālruņa - izvēle WhatsApp pusē. */
export function dealerSendWhatsappUrl(phoneDigits: string | null | undefined, text: string): string {
  const digits = (phoneDigits ?? "").replace(/\D/g, "");
  const q = `text=${encodeURIComponent(text)}`;
  return digits ? `https://wa.me/${digits}?${q}` : `https://wa.me/?${q}`;
}
