/**
 * Nils 30.10 (makets «Meklēšanas filtri»): zem budžeta redzams, ar kādu cenu filtri meklēs.
 * Izsolēs - budžets mīnus izmaksu pieņēmumi (tas pats aprēķins, ko izsoļu saites), mobile.de - no 55 % līdz budžets mīnus 2 000 €.
 */

import {
  marketplaceQueryFromOrder,
  orderSearchPriceBounds,
  type MarketplaceOrderCriteria,
} from "@/lib/marketplace/query-from-order";

function eur(n: number): string {
  return `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} €`;
}

function span(from: number | null, to: number | null): string {
  if (from != null && to != null) return `${eur(from).replace(" €", "")}-${eur(to)}`;
  if (to != null) return `līdz ${eur(to)}`;
  if (from != null) return `no ${eur(from)}`;
  return "";
}

export function irissOrderFilterPriceHint(order: MarketplaceOrderCriteria): string {
  const auction = orderSearchPriceBounds(order);
  const market = marketplaceQueryFromOrder(order);
  const parts: string[] = [];
  if (auction.to != null) parts.push(`izsolēs līdz ${eur(auction.to)}`);
  const m = span(market.priceFrom, market.priceTo);
  if (m) parts.push(`mobile.de ${m}`);
  return parts.length > 0 ? `Filtros: ${parts.join(" · ")}` : "";
}
