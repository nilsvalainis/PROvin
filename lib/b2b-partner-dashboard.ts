import "server-only";

import { emptyB2bPartnerPrices, type B2bPartnerPriceOverrides } from "@/lib/b2b-partner-account";
import { remainingB2bCredits, type B2bCreditRemaining } from "@/lib/b2b-partner-credits";
import { resolvePartnerCreditRemaining } from "@/lib/b2b-partner-credit-seed";
import { readB2bCreditWallet } from "@/lib/b2b-partner-credit-store";
import { resolveActiveB2bPartner } from "@/lib/b2b-partner-auth";

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
