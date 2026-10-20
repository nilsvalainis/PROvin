import type { AbstractIntlMessages } from "next-intl";

/**
 * Vārdnīcas, ko lieto klienta komponentes (`useTranslations` failos ar "use client").
 * Pārējās (Meta, Legal, Faq u.c.) tiek lietotas tikai serverī, tāpēc HTML tās nesūta.
 * `lib/i18n/client-messages.test.ts` pārbauda, ka jauns klienta namespace netiek aizmirsts.
 */
export const CLIENT_MESSAGE_NAMESPACES = [
  "Cookies",
  "Header",
  "Misc",
  "Order",
  "ProvinSelect",
  "RiskAuditGuide",
  "Samples",
  "SiteRail",
] as const;

/** Tikai `/partneriem` (partneru portāls) - ~20 KB, sākumlapā nav vajadzīgs. */
export const PARTNER_CLIENT_MESSAGE_NAMESPACES = [...CLIENT_MESSAGE_NAMESPACES, "Partner"] as const;

export function pickClientMessages(
  messages: AbstractIntlMessages,
  namespaces: readonly string[],
): AbstractIntlMessages {
  const out: AbstractIntlMessages = {};
  for (const ns of namespaces) {
    if (ns in messages) out[ns] = messages[ns];
  }
  return out;
}
