import { parsePriceLike } from "@/lib/iriss-price-format";
import { assertSameTenant } from "@/lib/b2b-demo-isolation";
import type { B2bDemoOffer, B2bDemoOrder, B2bDemoSettings, B2bDemoVatMode } from "@/lib/b2b-demo-types";

const LV_VAT_RATE = 0.21;

export type B2bDemoPdfPriceLine = {
  label: string;
  amountEur: number;
  source: "offer" | "settings";
};

export type B2bDemoOfferPricing = {
  tenantId: string;
  lines: B2bDemoPdfPriceLine[];
  subtotalEur: number;
  vatMode: B2bDemoVatMode;
  vatEur: number;
  totalEur: number;
};

function money(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

function offerOrSettings(offerValue: string, settingsValue: number): { amount: number; source: "offer" | "settings" } {
  if (offerValue.trim()) {
    return { amount: money(parsePriceLike(offerValue)), source: "offer" };
  }
  return { amount: money(settingsValue), source: "settings" };
}

/**
 * Offer PDF prices. Empty offer fee fields fall back to this tenant's settings.
 * Never injects ĪRISS 1190/800/600/1000 defaults.
 */
export function resolveB2bDemoOfferPricing(
  order: B2bDemoOrder,
  offer: B2bDemoOffer,
  settings: B2bDemoSettings,
): B2bDemoOfferPricing {
  assertSameTenant(order, settings.tenantId);
  if (order.offers.every((row) => row.offerId !== offer.offerId) && order.offers.length > 0) {
    /* offer may be a draft for this order; still require tenant match via order/settings */
  }
  const car = offerOrSettings(offer.carPrice, 0);
  const delivery = offerOrSettings(offer.deliveryPrice, settings.transportEur);
  const commission = offerOrSettings(offer.commissionFee, settings.commissionEur);
  const lines: B2bDemoPdfPriceLine[] = [];
  if (car.amount > 0 || offer.carPrice.trim()) {
    lines.push({ label: "Automašīnas cena", amountEur: car.amount, source: car.source });
  }
  if (delivery.amount > 0 || offer.deliveryPrice.trim() || settings.transportEur > 0) {
    lines.push({ label: "Piegāde / transports", amountEur: delivery.amount, source: delivery.source });
  }
  if (commission.amount > 0 || offer.commissionFee.trim() || settings.commissionEur > 0) {
    lines.push({ label: "Komisija", amountEur: commission.amount, source: commission.source });
  }
  if (settings.auctionFeeEur > 0) {
    lines.push({ label: "Izsoles maksa", amountEur: money(settings.auctionFeeEur), source: "settings" });
  }
  if (settings.unexpectedEur > 0) {
    lines.push({ label: "Neparedzētie", amountEur: money(settings.unexpectedEur), source: "settings" });
  }
  const subtotalEur = money(lines.reduce((sum, line) => sum + line.amountEur, 0));
  const vatEur = settings.vatMode === "standard" ? money(subtotalEur * LV_VAT_RATE) : 0;
  return {
    tenantId: settings.tenantId,
    lines,
    subtotalEur,
    vatMode: settings.vatMode,
    vatEur,
    totalEur: money(subtotalEur + vatEur),
  };
}

export function formatB2bDemoMoney(n: number): string {
  const rounded = money(n);
  return `${rounded.toFixed(2).replace(".", ",")} €`;
}

export function b2bDemoVatModeLabel(mode: B2bDemoVatMode): string {
  if (mode === "standard") return "PVN 21%";
  if (mode === "margin") return "Maržas PVN";
  return "Bez PVN";
}
