import "server-only";

import { emptyB2bPartnerPrices, type B2bPartnerPriceOverrides } from "@/lib/b2b-partner-account";
import { listManualOrders } from "@/lib/admin-manual-orders";
import { readOrderDraftSummaries } from "@/lib/admin-order-draft-summaries";
import { remainingB2bCredits, type B2bCreditRemaining } from "@/lib/b2b-partner-credits";
import { resolvePartnerCreditRemaining } from "@/lib/b2b-partner-credit-seed";
import { readB2bCreditWallet } from "@/lib/b2b-partner-credit-store";
import { resolveActiveB2bPartner } from "@/lib/b2b-partner-auth";
import {
  normalizePartnerCompanyKey,
  tallyPartnerCreditSpend,
  type PartnerCreditSpendJob,
} from "@/lib/b2b-partner-credit-spend";

export type B2bAccountDashboard = {
  credits: B2bCreditRemaining;
  dealerEnabled: boolean;
  prices: B2bPartnerPriceOverrides;
};

export async function loadCreditsForPartners(
  partners: readonly { id: string; dealerEnabled: boolean }[],
): Promise<Record<string, B2bCreditRemaining>> {
  const entries = await Promise.all(
    partners.map(async (partner) => {
      const wallet = await readB2bCreditWallet(partner.id);
      const remaining =
        wallet.lots.length > 0
          ? remainingB2bCredits(wallet.lots, new Date())
          : resolvePartnerCreditRemaining(wallet.lots);
      const row: B2bCreditRemaining = {
        business: Math.max(0, remaining.business ?? 0),
        dealer: partner.dealerEnabled ? Math.max(0, remaining.dealer ?? 0) : 0,
      };
      return [partner.id, row] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export async function loadSpentCreditsForPartners(
  partners: readonly { id: string; companyName: string }[],
): Promise<Record<string, B2bCreditRemaining>> {
  const partnerIds = partners.map((p) => p.id);
  if (partnerIds.length === 0) return {};
  const companyToPartnerId = new Map<string, string>();
  for (const partner of partners) {
    const key = normalizePartnerCompanyKey(partner.companyName);
    if (key && !companyToPartnerId.has(key)) companyToPartnerId.set(key, partner.id);
  }
  const manuals = await listManualOrders();
  const drafts = await readOrderDraftSummaries(manuals.map((rec) => rec.id));
  const jobs: PartnerCreditSpendJob[] = manuals.map((rec) => ({
    partnerId: rec.partnerId,
    companyName: rec.companyName,
    checkoutLine: rec.checkoutLine,
    notes: drafts.get(rec.id)?.notes ?? null,
  }));
  return tallyPartnerCreditSpend(jobs, partnerIds, companyToPartnerId);
}

export async function loadB2bAccountDashboard(): Promise<B2bAccountDashboard | null> {
  const partner = await resolveActiveB2bPartner();
  if (!partner) return null;
  const wallet = await readB2bCreditWallet(partner.id);
  const remaining =
    wallet.lots.length > 0
      ? remainingB2bCredits(wallet.lots, new Date())
      : resolvePartnerCreditRemaining(wallet.lots);
  const dealerEnabled = partner.dealerEnabled === true;
  return {
    dealerEnabled,
    prices: partner.prices ?? emptyB2bPartnerPrices(),
    credits: {
      business: Math.max(0, remaining.business ?? 0),
      dealer: dealerEnabled ? Math.max(0, remaining.dealer ?? 0) : 0,
    },
  };
}
