import "server-only";

import { VIN_SCAN_CATALOG, type VinScanSourceId } from "@/lib/vin-scan/catalog";
import {
  probeCarpass,
  probeDsb,
  probeEsyn,
  probeNhtsa,
  probeNummerplade,
  probeOneauto,
  probeOutvin,
  probeTjekbil,
} from "@/lib/vin-scan/probes";
import { buildVinScanIndicator, type VinScanIndicator } from "@/lib/vin-scan/types";

const PROBES: Record<VinScanSourceId, (vin: string) => Promise<VinScanIndicator> | VinScanIndicator> = {
  tjekbil: probeTjekbil,
  nummerplade: probeNummerplade,
  esyn: probeEsyn,
  dsb: probeDsb,
  carpass: probeCarpass,
  nhtsa: probeNhtsa,
  oneauto: probeOneauto,
  outvin: probeOutvin,
};

/** Visi A līmeņa avoti paralēli. Viena zonde, kas krīt, kļūst par unknown un neaptur pārējās. */
export async function runVinScan(vin: string): Promise<VinScanIndicator[]> {
  const normalized = vin.trim().toUpperCase();
  const rows = await Promise.all(
    VIN_SCAN_CATALOG.map(async (item) => {
      try {
        return await PROBES[item.id](normalized);
      } catch {
        return buildVinScanIndicator(item.id, normalized, { status: "unknown", summary: "Avotu neizdevās nolasīt" });
      }
    }),
  );
  return rows;
}
