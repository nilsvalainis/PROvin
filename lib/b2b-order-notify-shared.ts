/**
 * B2B pasūtījumi no konta (iepriekš nopirkta paka vai kredīts): Stripe tos neredz, tāpēc paziņojums jāsūta mums.
 * Viena darbība = viens paziņojums (arī ja dīleris pasūta 10 VIN uzreiz).
 */
import type { AdminPushMessage } from "@/lib/admin-push-shared";
import { pushVinTail } from "@/lib/admin-push-shared";

export type B2bCreditOrderNotice = {
  partnerId: string;
  companyName: string;
  contactName: string;
  /** Piem. "Audits", "Dīlera dati (RAW)". */
  serviceLabel: string;
  orders: readonly { orderId: string; vin: string }[];
};

const SERVICE_LABEL: Record<string, string> = {
  business: "Audits",
  dealer: "Dīlera dati",
  dealer_raw: "Dīlera dati (RAW)",
  dealer_pro: "Dīlera dati PRO",
};

export function b2bServiceLabel(id: string): string {
  return SERVICE_LABEL[id] ?? id;
}

function who(n: B2bCreditOrderNotice): string {
  return n.companyName.trim() || n.contactName.trim() || "B2B partneris";
}

export function b2bCreditOrderPushMessage(n: B2bCreditOrderNotice): AdminPushMessage {
  const one = n.orders.length === 1 ? n.orders[0]! : null;
  return {
    title: one ? `Jauns B2B pasūtījums · ${who(n)}` : `${n.orders.length} jauni B2B pasūtījumi · ${who(n)}`,
    body: one ? `${n.serviceLabel} · VIN ${pushVinTail(one.vin)} · no konta` : `${n.serviceLabel} · no konta`,
    url: one ? `/admin/orders/${encodeURIComponent(one.orderId)}` : "/admin/dashboard",
    tag: one ? `order-${one.orderId}` : `b2b-${n.partnerId}-${n.orders[0]?.orderId ?? ""}`,
    audience: "pro",
  };
}

export function b2bCreditOrderEmailSubject(n: B2bCreditOrderNotice): string {
  const count = n.orders.length === 1 ? `VIN ${n.orders[0]!.vin}` : `${n.orders.length} pasūtījumi`;
  return `PROVIN B2B: ${who(n)} · ${count} (no konta)`;
}

export function b2bCreditOrderLines(n: B2bCreditOrderNotice, origin: string): string[] {
  return n.orders.map((o) => `${o.vin} · ${origin}/admin/orders/${encodeURIComponent(o.orderId)}`);
}
