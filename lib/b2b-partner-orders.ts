import { b2bDateLocale } from "@/i18n/locales";
import type { B2bPartnerPlanId } from "@/lib/b2b-partner-copy";

export type B2bArchiveAmountKind = "money" | "credit" | "credit_restored";

export type B2bPartnerOrderRow = {
  id: string;
  createdAt: string;
  vin: string;
  invoiceNumber: string;
  amountLabel: string;
  amountKind?: B2bArchiveAmountKind;
  plan: B2bPartnerPlanId;
  /** Atskaite PDF. Tukšs, kamēr admin nav nosūtījis / saglabājis failu. */
  reportHref?: string | null;
};

/** Demo arhīvs, kamēr nav reālo Stripe pasūtījumu. */
export const B2B_PARTNER_DEMO_ORDERS: B2bPartnerOrderRow[] = [
  {
    id: "demo-order-1",
    createdAt: "2026-09-02T10:14:00+03:00",
    vin: "WVWZZZ3CZWE123456",
    invoiceNumber: "PRV-2026-0142",
    amountLabel: "69,99 €",
    plan: "business",
    reportHref: "/samples/provin-audits-piemers.pdf",
  },
  {
    id: "demo-order-2",
    createdAt: "2026-08-28T16:40:00+03:00",
    vin: "WBA3A5C50EF123456",
    invoiceNumber: "PRV-2026-0138",
    amountLabel: "19,99 €",
    plan: "dealer",
  },
  {
    id: "demo-order-3",
    createdAt: "2026-08-21T09:05:00+03:00",
    vin: "TMBJG7NE5K0123456",
    invoiceNumber: "PRV-2026-0129",
    amountLabel: "69,99 €",
    plan: "business",
  },
];

export function formatB2bArchiveAmount(cents: number | null | undefined, currency: string | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "-";
  const euros = (cents / 100).toFixed(2).replace(".", ",");
  const code = typeof currency === "string" && currency.trim() && currency.toUpperCase() !== "EUR"
    ? ` ${currency.toUpperCase()}`
    : " €";
  return `${euros}${code}`;
}

export function formatB2bPartnerOrderDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(b2bDateLocale(locale), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function partnerNotesMatchId(notes: string, partnerId: string): boolean {
  const id = partnerId.trim();
  return Boolean(id) && notes.includes(`partner_id=${id}`);
}
