import "server-only";

import { fetchCsddTechDataCounted } from "@/lib/csdd-tech-data-counted";
import type { CsddTechData } from "@/lib/csdd-tech-data";
import {
  applyDealerCheckCsddResult,
  dealerCheckCsddLookupQuery,
} from "@/lib/dealer-check-csdd";
import { normalizeDealerCheckPlate } from "@/lib/dealer-check";
import { normalizeVin } from "@/lib/order-field-validation";

/** CSDD snapshot pirms OneAuto: tas pats reģistrs, ko admin CSDD poga. */
export async function prefetchDealerCheckCsdd(args: {
  vin?: string;
  plate?: string;
}): Promise<{ vin: string; plate: string; csdd: CsddTechData | null; message: string }> {
  const vin = normalizeVin(args.vin ?? "");
  const plate = normalizeDealerCheckPlate(args.plate ?? "");
  const query = dealerCheckCsddLookupQuery(plate, vin);
  if (!query) return { vin, plate, csdd: null, message: "" };
  try {
    const res = await fetchCsddTechDataCounted(query, "admin");
    const applied = applyDealerCheckCsddResult({ vin, plate }, res);
    return {
      vin: applied.vin,
      plate: applied.plate || plate,
      csdd: applied.csdd,
      message: applied.found ? "" : applied.message,
    };
  } catch {
    return { vin, plate, csdd: null, message: "Neizdevās savienoties ar CSDD releju" };
  }
}
