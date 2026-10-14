import { IRISS_LISTING_PLATFORMS, type IrissListingPlatform, type IrissListingSourceRun, type IrissListingVehicle } from "@/lib/iriss-listings-types";

export type IrissListingPlatformIngestStat = {
  platform: IrissListingPlatform;
  sourceCount: number;
  okCount: number;
  vehicleCount: number;
  status: IrissListingSourceRun["status"] | "none";
};

function worstSourceStatus(runs: readonly IrissListingSourceRun[]): IrissListingSourceRun["status"] | "none" {
  if (runs.length === 0) return "none";
  const rank: Record<IrissListingSourceRun["status"], number> = {
    ok: 0,
    skipped: 1,
    relay_not_configured: 2,
    parse_failed: 3,
    fetch_failed: 4,
    login_required: 5,
    blocked_by_waf: 6,
  };
  return runs.reduce((worst, run) => (rank[run.status] > rank[worst] ? run.status : worst), "ok" as IrissListingSourceRun["status"]);
}

/** Nolasīšanas statuss un auto skaits katram avotam (eCarsTrade ieskaitot). */
export function irissListingPlatformIngestStats(
  sources: readonly IrissListingSourceRun[],
  vehicles: readonly IrissListingVehicle[],
): IrissListingPlatformIngestStat[] {
  return IRISS_LISTING_PLATFORMS.map((platform) => {
    const runs = sources.filter((s) => s.platform === platform);
    return {
      platform,
      sourceCount: runs.length,
      okCount: runs.filter((s) => s.status === "ok").length,
      vehicleCount: vehicles.filter((v) => v.platform === platform && v.change !== "gone").length,
      status: worstSourceStatus(runs),
    };
  });
}
