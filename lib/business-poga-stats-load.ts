import "server-only";

import { listB2bPartners } from "@/lib/b2b-partner-store";
import { businessPogaDateRange, summarizeBusinessPoga, type BusinessPogaSale, type BusinessPogaSummary } from "@/lib/business-poga-stats";
import { readBusinessPogaDays } from "@/lib/business-poga-stats-store";
import type { BusinessPogaPeriod } from "@/lib/business-poga-period";
import { listPartnerBusinessSales } from "@/lib/business-partner-sales";

export type BusinessPogaStatsView = {
  summary: BusinessPogaSummary;
  partnerNames: Record<string, string>;
  /** false = Stripe pirkumus neizdevās nolasīt (skaitļi bez pirkumiem). */
  salesOk: boolean;
};

/** Pogas statistika periodā: dienas skaitītāji + Stripe pirkumi. `partnerId` - tikai vienam partnerim. */
export async function loadBusinessPogaStats(period: BusinessPogaPeriod, partnerId?: string): Promise<BusinessPogaStatsView> {
  const partners = await listB2bPartners().catch(() => []);
  const partnerNames: Record<string, string> = {};
  for (const p of partners) partnerNames[p.id] = p.businessEmbed?.displayName || p.companyName;

  const salesPartners = partners.filter(
    (p) => (partnerId ? p.id === partnerId : true) && (p.businessEmbed?.enabled || p.businessEmbed?.domains?.length),
  );
  const [days, salesLists] = await Promise.all([
    readBusinessPogaDays(businessPogaDateRange(period.from, period.to)).catch(() => []),
    Promise.all(salesPartners.map((p) => listPartnerBusinessSales(p.id).then((list) => ({ id: p.id, list })))),
  ]);
  let salesOk = true;
  const sales: BusinessPogaSale[] = [];
  for (const { id, list } of salesLists) {
    if (list == null) {
      salesOk = false;
      continue;
    }
    for (const s of list) sales.push({ partnerId: id, created: s.created, amountCents: s.amountCents, vin: s.vin });
  }
  return {
    summary: summarizeBusinessPoga(days, sales, { from: period.from, to: period.to, partnerId }),
    partnerNames,
    salesOk,
  };
}
