import { isValidOrderEmail } from "@/lib/order-field-validation";

const MANUAL_ORDER_ID_PREFIX = "manual_order_";

function isManualOrderId(id: string): boolean {
  return typeof id === "string" && id.startsWith(MANUAL_ORDER_ID_PREFIX) && /^[a-zA-Z0-9_]+$/.test(id);
}

export type NotifyClientOrderLike = {
  id?: string;
  paymentStatus?: string | null;
  isManual?: boolean;
  customerEmail?: string | null;
};

export function isManualNotifyClientOrder(order: NotifyClientOrderLike): boolean {
  return order.isManual === true || (order.id ? isManualOrderId(order.id) : false);
}

export function canNotifyClientOrder(order: NotifyClientOrderLike, email?: string | null): boolean {
  const resolvedEmail = (email ?? order.customerEmail ?? "").trim();
  if (!resolvedEmail || !isValidOrderEmail(resolvedEmail)) return false;
  if (String(order.paymentStatus ?? "").trim().toLowerCase() === "paid") return true;
  return isManualNotifyClientOrder(order);
}

export function notifyClientBlockedMessage(order: NotifyClientOrderLike): string {
  if (canNotifyClientOrder(order)) return "";
  if (isManualNotifyClientOrder(order)) {
    return "Nepieciešams derīgs klienta e-pasts (sadaļā „Klienta dati”).";
  }
  return "Nosūtīt var tikai apmaksātam pasūtījumam.";
}
