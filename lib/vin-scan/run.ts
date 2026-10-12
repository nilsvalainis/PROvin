import "server-only";

import { VIN_SCAN_CATALOG, isVinScanSourceId, type VinScanSourceId } from "@/lib/vin-scan/catalog";
import { sourceNeedsInput, vinScanProbeFor } from "@/lib/vin-scan/probes";
import { emptyVinScanPlates, type VinScanPlates } from "@/lib/vin-scan/plates";
import { buildVinScanIndicator, type VinScanContext, type VinScanIndicator } from "@/lib/vin-scan/types";

const SLOW_SOURCES = new Set<VinScanSourceId>([
  "mnt_ee",
  "lkf_ee",
  "carinfo",
  "nicb",
  "auchistory",
  "stat_vin",
  "bidfax",
  "poctra",
  "checkcar_vin",
  "regitra",
  "traficom",
  "biluppgifter",
]);
const SLOW_TIMEOUT_MS = 45_000;
const DEFAULT_TIMEOUT_MS = 14_000;
const CAPTCHA_TIMEOUT_MS = 90_000;

const CAPTCHA_SOURCES = new Set<VinScanSourceId>(["lkf_ee", "carinfo", "nicb", "auchistory", "stat_vin", "mnt_ee"]);

function timeoutMsFor(id: VinScanSourceId): number {
  if (CAPTCHA_SOURCES.has(id)) return CAPTCHA_TIMEOUT_MS;
  if (SLOW_SOURCES.has(id)) return SLOW_TIMEOUT_MS;
  return DEFAULT_TIMEOUT_MS;
}

function withTimeout(id: VinScanSourceId, ctx: VinScanContext, job: Promise<VinScanIndicator> | VinScanIndicator): Promise<VinScanIndicator> {
  const run = Promise.resolve(job);
  const ms = timeoutMsFor(id);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(buildVinScanIndicator(id, ctx.vin, { status: "unknown", summary: "Avots neatbildēja laikā" }, ctx.plates));
    }, ms);
    run
      .then((row) => {
        clearTimeout(timer);
        resolve(row);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(buildVinScanIndicator(id, ctx.vin, { status: "unknown", summary: "Avotu neizdevās nolasīt" }, ctx.plates));
      });
  });
}

export type RunVinScanInput = {
  vin: string;
  plates?: VinScanPlates;
  sourceIds?: readonly string[];
};

/** Visi avoti paralēli. Viena zonde, kas krīt, kļūst par unknown un neaptur pārējās. */
export async function runVinScan(
  vinOrInput: string | RunVinScanInput,
  sourceIds?: readonly string[],
): Promise<VinScanIndicator[]> {
  const input: RunVinScanInput = typeof vinOrInput === "string" ? { vin: vinOrInput, sourceIds } : vinOrInput;
  const ctx: VinScanContext = {
    vin: input.vin.trim().toUpperCase(),
    plates: input.plates ?? emptyVinScanPlates(),
  };
  const wanted = input.sourceIds?.length
    ? VIN_SCAN_CATALOG.filter((item) => input.sourceIds!.includes(item.id))
    : VIN_SCAN_CATALOG;
  const rows = await Promise.all(
    wanted.map(async (item) => {
      const missing = sourceNeedsInput(item.id, ctx);
      if (missing) return missing;
      const probe = vinScanProbeFor(item.id);
      if (!probe) {
        return buildVinScanIndicator(item.id, ctx.vin, { status: "unknown", summary: "Zonde nav pieejama" }, ctx.plates);
      }
      try {
        return await withTimeout(item.id, ctx, probe(ctx));
      } catch {
        return buildVinScanIndicator(item.id, ctx.vin, { status: "unknown", summary: "Avotu neizdevās nolasīt" }, ctx.plates);
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
