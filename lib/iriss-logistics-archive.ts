import {
  isLogisticsArchivedStatus,
  type LogisticsListView,
  type LogisticsOrder,
  type LogisticsOrderStatus,
} from "@/lib/iriss-logistics-types";

export const LOGISTICS_WAKE_ACTION = "pamodināt";
export const LOGISTICS_WAKE_DEFAULT_STATUS: LogisticsOrderStatus = "ready";

export function isLogisticsOrderArchived(order: Pick<LogisticsOrder, "archived" | "status">): boolean {
  if (order.archived) return true;
  return isLogisticsArchivedStatus(order.status);
}

/** Aktīvie = vēl nav izņemti un nav piegādāti. */
export function isLogisticsOrderActive(order: Pick<LogisticsOrder, "archived" | "status">): boolean {
  return !isLogisticsOrderArchived(order);
}

export function archiveLogisticsOrder(
  order: LogisticsOrder,
  status: Extract<LogisticsOrderStatus, "picked_up" | "delivered" | "archived">,
  at = new Date().toISOString(),
): LogisticsOrder {
  const previous = isLogisticsOrderArchived(order)
    ? order.previousStatus || LOGISTICS_WAKE_DEFAULT_STATUS
    : order.status;
  return {
    ...order,
    status,
    archived: true,
    archivedAt: order.archivedAt || at,
    previousStatus: isLogisticsArchivedStatus(previous) ? LOGISTICS_WAKE_DEFAULT_STATUS : previous,
    updatedAt: at,
  };
}

/** Atgriež auto no arhīva uz aktīvo sarakstu. */
export function wakeLogisticsOrder(order: LogisticsOrder, at = new Date().toISOString()): LogisticsOrder {
  const candidate = order.previousStatus;
  const nextStatus: LogisticsOrderStatus =
    candidate && !isLogisticsArchivedStatus(candidate) ? candidate : LOGISTICS_WAKE_DEFAULT_STATUS;
  return {
    ...order,
    status: nextStatus,
    archived: false,
    archivedAt: "",
    previousStatus: "",
    updatedAt: at,
  };
}

export function markLogisticsOrderPickedUp(order: LogisticsOrder, at = new Date().toISOString()): LogisticsOrder {
  return archiveLogisticsOrder(order, "picked_up", at);
}

export function markLogisticsOrderDelivered(order: LogisticsOrder, at = new Date().toISOString()): LogisticsOrder {
  return archiveLogisticsOrder(order, "delivered", at);
}

export function filterLogisticsOrdersByView(
  orders: readonly LogisticsOrder[],
  view: LogisticsListView,
  todayIso = new Date().toISOString().slice(0, 10),
): LogisticsOrder[] {
  const active = orders.filter(isLogisticsOrderActive);
  if (view === "archive") return orders.filter(isLogisticsOrderArchived);
  if (view === "active") return active;
  if (view === "today") {
    return active.filter((o) => pickupIsToday(o.pickupDate, todayIso) || /šodien|jādara/i.test(o.nextAction));
  }
  if (view === "due") {
    return active.filter((o) => pickupIsDueSoon(o.pickupDate, todayIso));
  }
  if (view === "trips") return active;
  return active;
}

export function countLogisticsActiveOrders(orders: readonly Pick<LogisticsOrder, "archived" | "status">[]): number {
  return orders.filter(isLogisticsOrderActive).length;
}

function pickupIsToday(pickupDate: string, todayIso: string): boolean {
  const d = pickupDate.trim().slice(0, 10);
  return Boolean(d) && d === todayIso;
}

function pickupIsDueSoon(pickupDate: string, todayIso: string): boolean {
  const d = pickupDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t0 = Date.parse(`${todayIso}T00:00:00Z`);
  const t1 = Date.parse(`${d}T00:00:00Z`);
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) return false;
  const days = (t1 - t0) / 86_400_000;
  return days >= 0 && days <= 3;
}
