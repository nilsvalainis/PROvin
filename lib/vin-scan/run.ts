import "server-only";

import { VIN_SCAN_CATALOG, isVinScanSourceId, type VinScanSourceId } from "@/lib/vin-scan/catalog";
import {
  probeCarinfo,
  probeCarpass,
  probeCsdd,
  probeDsb,
  probeEsyn,
  probeLkfEe,
  probeMntEe,
  probeNhtsa,
  probeNummerplade,
  probeOneauto,
  probeOutvin,
  probeTjekbil,
} from "@/lib/vin-scan/probes";
import { buildVinScanIndicator, type VinScanIndicator } from "@/lib/vin-scan/types";

const PROBES: Record<VinScanSourceId, (vin: string) => Promise<VinScanIndicator> | VinScanIndicator> = {
  csdd: probeCsdd,
  tjekbil: probeTjekbil,
  nummerplade: probeNummerplade,
  esyn: probeEsyn,
  dsb: probeDsb,
  carpass: probeCarpass,
  mnt_ee: probeMntEe,
  lkf_ee: probeLkfEe,
  carinfo: probeCarinfo,
  nhtsa: probeNhtsa,
  oneauto: probeOneauto,
  outvin: probeOutvin,
};

const SLOW_SOURCES = new Set<VinScanSourceId>(["mnt_ee", "lkf_ee", "carinfo", "csdd"]);
const SLOW_TIMEOUT_MS = 28_000;

function withTimeout(id: VinScanSourceId, vin: string, job: Promise<VinScanIndicator> | VinScanIndicator): Promise<VinScanIndicator> {
  const run = Promise.resolve(job);
  if (!SLOW_SOURCES.has(id)) return run;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(buildVinScanIndicator(id, vin, { status: "unknown", summary: "Avots neatbildēja laikā" }));
    }, SLOW_TIMEOUT_MS);
    run
      .then((row) => {
        clearTimeout(timer);
        resolve(row);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(buildVinScanIndicator(id, vin, { status: "unknown", summary: "Avotu neizdevās nolasīt" }));
      });
  });
}

/** Visi A līmeņa avoti paralēli. Viena zonde, kas krīt, kļūst par unknown un neaptur pārējās. */
export async function runVinScan(vin: string, sourceIds?: readonly string[]): Promise<VinScanIndicator[]> {
  const normalized = vin.trim().toUpperCase();
  const wanted = sourceIds?.length
    ? VIN_SCAN_CATALOG.filter((item) => sourceIds.includes(item.id))
    : VIN_SCAN_CATALOG;
  const rows = await Promise.all(
    wanted.map(async (item) => {
      try {
        return await withTimeout(item.id, normalized, PROBES[item.id](normalized));
      } catch {
        return buildVinScanIndicator(item.id, normalized, { status: "unknown", summary: "Avotu neizdevās nolasīt" });
      }
    }),
  );
  return rows;
}

export function sanitizeVinScanSourceIds(raw: unknown): VinScanSourceId[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids = raw.filter((v): v is string => typeof v === "string").filter(isVinScanSourceId);
  return ids.length > 0 ? ids : undefined;
}
