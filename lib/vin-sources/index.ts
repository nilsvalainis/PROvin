import "server-only";

import { isVinSourcesBrowserAllowed, VIN_SOURCES_BROWSER_UNAVAILABLE } from "@/lib/vin-sources/browser";
import { fetchCarInfo } from "@/lib/vin-sources/carinfo";
import { fetchLkf, fetchMnt } from "@/lib/vin-sources/estonia";
import { fetchTjekbil } from "@/lib/vin-sources/tjekbil";
import { emptyVinSourceResult, type VinSourceFetchResult, type VinSourceId } from "@/lib/vin-sources/types";

/** Vai avotam vajadzīgs redzams pārlūks (reCAPTCHA / bot aizsardzība). */
export const VIN_SOURCE_NEEDS_BROWSER: Record<VinSourceId, boolean> = {
  tjekbil: false,
  mnt_ee: true,
  lkf_ee: true,
  carinfo: true,
};

export async function fetchVinSource(source: VinSourceId, vin: string, regMark = ""): Promise<VinSourceFetchResult> {
  if (VIN_SOURCE_NEEDS_BROWSER[source] && !isVinSourcesBrowserAllowed()) {
    return emptyVinSourceResult(source, vin, VIN_SOURCES_BROWSER_UNAVAILABLE);
  }
  switch (source) {
    case "tjekbil":
      return fetchTjekbil(vin);
    case "mnt_ee":
      return fetchMnt(vin, regMark);
    case "lkf_ee":
      return fetchLkf(vin);
    case "carinfo":
      return fetchCarInfo(vin);
  }
}
