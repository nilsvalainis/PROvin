import type { LogisticsOrder, LogisticsPoint, LogisticsPreviousPointRow } from "@/lib/iriss-logistics-types";

const MONTH_MS = 365.25 / 12 * 24 * 60 * 60 * 1000;

export function previousLogisticsPoints(input: {
  orders: readonly LogisticsOrder[];
  points: readonly LogisticsPoint[];
  nowMs?: number;
  months?: number;
}): LogisticsPreviousPointRow[] {
  const nowMs = input.nowMs ?? Date.now();
  const months = input.months ?? 12;
  const since = nowMs - months * MONTH_MS;
  const byId = new Map(input.points.map((p) => [p.id, p]));
  const acc = new Map<string, LogisticsPreviousPointRow>();

  for (const order of input.orders) {
    const pointId = order.pickupPointId.trim();
    if (!pointId) continue;
    const pickupMs = Date.parse(order.pickupDate) || Date.parse(order.createdAt);
    if (!Number.isFinite(pickupMs) || pickupMs < since) continue;
    const point = byId.get(pointId);
    if (!point) continue;
    const prev = acc.get(pointId);
    const last = order.pickupDate || order.createdAt;
    if (!prev) {
      acc.set(pointId, {
        pointId,
        name: point.name,
        auction: point.auction,
        city: point.city,
        lat: point.lat,
        lng: point.lng,
        useCount: 1,
        lastPickupDate: last,
      });
      continue;
    }
    prev.useCount += 1;
    if (last > prev.lastPickupDate) prev.lastPickupDate = last;
  }

  return [...acc.values()].sort((a, b) => b.useCount - a.useCount || b.lastPickupDate.localeCompare(a.lastPickupDate));
}
