import {
  marketplaceLoadsEnabled,
  marketplaceMonthKey,
  marketplaceMonthlyUsdCap,
  marketplacePerRunUsdCap,
  usageSpentUsd,
} from "@/lib/marketplace/cost-caps";
import { readMarketplaceUsageMonth } from "@/lib/marketplace/store";
import { buildIrissSettingsLimitsView, type IrissSettingsLimitsView } from "@/lib/iriss-iestatijumi-view";

export async function loadIrissSettingsLimits(now = new Date()): Promise<IrissSettingsLimitsView> {
  const monthKey = marketplaceMonthKey(now);
  const monthlyCapUsd = marketplaceMonthlyUsdCap();
  const perRunCapUsd = marketplacePerRunUsdCap();
  const loadsEnabled = marketplaceLoadsEnabled();
  let spentUsd = 0;
  try {
    spentUsd = usageSpentUsd(await readMarketplaceUsageMonth(monthKey));
  } catch {
    spentUsd = 0;
  }
  return buildIrissSettingsLimitsView({
    monthlyCapUsd,
    perRunCapUsd,
    spentUsd,
    loadsEnabled,
    monthKey,
  });
}
