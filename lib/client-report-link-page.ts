import "server-only";

import { readOrderDraft } from "@/lib/admin-order-draft-store";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { loadReportEmailExtras } from "@/lib/email/dealer-email-context-server";
import { resolveReportReadyProductKind } from "@/lib/email/report-ready-copy";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { formatEurFromCents, isOfferExpired, upsellPublicPath } from "@/lib/order-upsell";
import { readSessionUpsellDoc } from "@/lib/order-upsell-store";
import {
  clientReportLinkPdfPath,
  formatClientReportDate,
  type ClientReportLinkRecord,
} from "@/lib/client-report-link";
import { readClientReportPdfInfo } from "@/lib/client-report-link-store";
import type { AppLocale } from "@/i18n/locales";

export type ClientReportLinkOffer = {
  href: string;
  priorLabel: string;
  chargeLabel: string;
  totalLabel: string;
  validUntil: string;
};

export type ClientReportLinkView = {
  locale: AppLocale;
  product: "dealer" | "mini" | "audits";
  vin: string;
  date: string;
  facts: { value: string; label: string }[];
  pdfHref: string;
  downloadHref: string;
  offer: ClientReportLinkOffer | null;
};

/**
 * Lapas dati derīgai saitei. Bez klienta personas datiem (vārds, e-pasts, tālrunis netiek lasīti lapai).
 * Atgriež null, ja PDF vairs nav (lapa tad rāda neitrālo tekstu).
 */
export async function loadClientReportLinkView(args: {
  token: string;
  sessionId: string;
  record: ClientReportLinkRecord;
  locale: AppLocale;
}): Promise<ClientReportLinkView | null> {
  const { sessionId, locale } = args;
  const info = await readClientReportPdfInfo(sessionId);
  if (!info.available) return null;

  const [order, draft] = await Promise.all([
    getCheckoutSessionDetail(sessionId).catch(() => null),
    readOrderDraft(sessionId).catch(() => null),
  ]);
  const product = resolveReportReadyProductKind({
    checkoutLine: order?.checkoutLine ?? null,
    amountTotalCents: order?.amountTotal ?? null,
  });
  const vinRaw = (order?.vin ?? "").trim() || (draft?.orderEdits?.vin ?? "").trim();
  const vin = vinRaw && isValidVin(vinRaw) ? normalizeVin(vinRaw) : "";

  const extras = await loadReportEmailExtras({ sessionId, productKind: product, lang: locale, draft }).catch(() => null);
  const facts = (extras?.facts ?? []).filter((f) => f.value.trim() && f.label.trim()).slice(0, 3);

  let offer: ClientReportLinkOffer | null = null;
  if (product === "dealer") {
    const doc = await readSessionUpsellDoc(sessionId).catch(() => null);
    const o = doc?.offers.dealer_to_audit;
    if (o && o.status === "open" && !isOfferExpired(o.expiresAt)) {
      offer = {
        href: upsellPublicPath(o.token),
        priorLabel: formatEurFromCents(o.priorCents),
        chargeLabel: formatEurFromCents(o.chargeCents),
        totalLabel: formatEurFromCents(o.targetCents),
        validUntil: formatClientReportDate(o.expiresAt),
      };
    }
  }

  return {
    locale,
    product,
    vin,
    date: formatClientReportDate(info.sentAt),
    facts,
    pdfHref: clientReportLinkPdfPath(args.token),
    downloadHref: clientReportLinkPdfPath(args.token, true),
    offer,
  };
}
