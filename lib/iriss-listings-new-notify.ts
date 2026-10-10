/**
 * Īss kopsavilkums par jauniem IRISS LIST sludinājumiem (e-pastam).
 */

import type { IrissListingPlatform, IrissListingVehicle } from "@/lib/iriss-listings-types";

export type IrissNewListingOrderBrief = {
  id: string;
  clientName: string;
  brandModel: string;
};

const PLATFORM_LABEL: Record<IrissListingPlatform, string> = {
  autobid: "Autobid",
  openline: "Openlane",
  auto1: "Auto1",
};

function fmtPrice(v: IrissListingVehicle): string {
  const n = v.priceCurrent ?? v.priceStart ?? v.priceBuyNow;
  if (n == null) return "";
  return `${Math.round(n).toLocaleString("lv-LV")} €`;
}

export function newMatchingListings(vehicles: readonly IrissListingVehicle[], rejectedIds: Set<string>): IrissListingVehicle[] {
  return vehicles.filter((v) => v.change === "new" && !rejectedIds.has(v.id));
}

export function groupNewListingsByOrder(
  vehicles: readonly IrissListingVehicle[],
  orders: readonly IrissNewListingOrderBrief[],
): Array<{ order: IrissNewListingOrderBrief; vehicles: IrissListingVehicle[] }> {
  const byId = new Map(orders.map((o) => [o.id, o]));
  const grouped = new Map<string, IrissListingVehicle[]>();
  for (const v of vehicles) {
    const ids = v.orderIds.length > 0 ? v.orderIds : ["_unknown"];
    for (const orderId of ids) {
      const list = grouped.get(orderId) ?? [];
      list.push(v);
      grouped.set(orderId, list);
    }
  }
  const out: Array<{ order: IrissNewListingOrderBrief; vehicles: IrissListingVehicle[] }> = [];
  for (const [orderId, list] of grouped) {
    const order = byId.get(orderId) ?? { id: orderId, clientName: "", brandModel: orderId };
    out.push({ order, vehicles: list });
  }
  out.sort((a, b) => (a.order.brandModel || a.order.id).localeCompare(b.order.brandModel || b.order.id, "lv"));
  return out;
}

export function formatIrissNewListingsEmail(opts: {
  vehicles: IrissListingVehicle[];
  orders: IrissNewListingOrderBrief[];
}): { subject: string; text: string; html: string } | null {
  if (opts.vehicles.length === 0) return null;
  const groups = groupNewListingsByOrder(opts.vehicles, opts.orders);
  const n = opts.vehicles.length;
  const subject = n === 1 ? "IRISS LIST: 1 jauns sludinājums" : `IRISS LIST: ${n} jauni sludinājumi`;
  const lines: string[] = [`Jauni atbilstoši sludinājumi: ${n}`, ""];
  for (const g of groups) {
    const title = [g.order.brandModel, g.order.clientName].filter(Boolean).join(" · ") || g.order.id;
    lines.push(`${title} (${g.vehicles.length})`);
    for (const v of g.vehicles.slice(0, 12)) {
      const bits = [v.title || v.id, fmtPrice(v), PLATFORM_LABEL[v.platform]].filter(Boolean);
      lines.push(`- ${bits.join(", ")}`);
    }
    if (g.vehicles.length > 12) lines.push(`- … un vēl ${g.vehicles.length - 12}`);
    lines.push("");
  }
  const text = lines.join("\n").trim();
  const html = `<pre style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;white-space:pre-wrap">${escapeHtml(text)}</pre>`;
  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
