import "server-only";

import { getOneautoApiConfig } from "@/lib/oneauto-api";
import { getOutvinConfig } from "@/lib/outvin-api";
import type { VinScanPaidKeys } from "@/lib/vin-scan/types";

export function vinScanPaidKeys(): VinScanPaidKeys {
  return {
    oneauto: Boolean(getOneautoApiConfig()),
    outvin: Boolean(getOutvinConfig()),
  };
}
