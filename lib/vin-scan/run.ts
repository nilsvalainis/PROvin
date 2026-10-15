import "server-only";

import { VIN_SCAN_CATALOG, isVinScanSourceId, type VinScanSourceId } from "@/lib/vin-scan/catalog";
import { freeVinScanSourceIds, isFreeVinScanSourceId } from "@/lib/vin-scan/free-sources";
import { sourceNeedsInput, vinScanProbeFor } from "@/lib/vin-scan/probes";
import { emptyVinScanPlates, type VinScanPlates } from "@/lib/vin-scan/plates";
import { applyFinlandLinkToIndicators } from "@/lib/vin-scan/finland-link";
import { runWithVinScanDeadline } from "@/lib/vin-scan/http";
import { vinScanSourceTimeoutMs } from "@/lib/vin-scan/source-timeouts";
import { buildVinScanIndicator, type VinScanContext, type VinScanIndicator } from "@/lib/vin-scan/types";

function timeoutMsFor(id: VinScanSourceId): number {
  return vinScanSourceTimeoutMs(id);
}

function withTimeout(id: VinScanSourceId, ctx: VinScanContext, job: Promise<VinScanIndicator> | VinScanIndicator): Promise<VinScanIndicator> {
  const run = Promise.resolve(job);
  const ms = timeoutMsFor(id);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(buildVinScanIndicator(id, ctx.vin, { status: "timeout", summary: "Avots neatbildēja laikā" }, ctx.plates));
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
  listingUrl?: string;
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
    listingUrl: input.listingUrl?.trim() ?? "",
  };
  const ids = input.sourceIds?.length
    ? input.sourceIds.filter((id): id is VinScanSourceId => isVinScanSourceId(id) && isFreeVinScanSourceId(id))
    : freeVinScanSourceIds();
  const wanted = VIN_SCAN_CATALOG.filter((item) => ids.includes(item.id));
  const rows = await Promise.all(
    wanted.map(async (item) => {
      const started = Date.now();
      const finish = (row: VinScanIndicator): VinScanIndicator => {
        console.info(
          JSON.stringify({
            id: row.id,
            status: row.status,
            reason: row.summary.slice(0, 240),
            ms: Date.now() - started,
          }),
        );
        return row;
      };
      const missing = sourceNeedsInput(item.id, ctx);
      if (missing) return finish(missing);
      const probe = vinScanProbeFor(item.id);
      if (!probe) {
        return finish(buildVinScanIndicator(item.id, ctx.vin, { status: "unknown", summary: "Zonde nav pieejama" }, ctx.plates));
      }
      const ms = timeoutMsFor(item.id);
      try {
        const row = await runWithVinScanDeadline(Date.now() + ms, () => withTimeout(item.id, ctx, probe(ctx)));
        return finish(row);
      } catch {
        return finish(buildVinScanIndicator(item.id, ctx.vin, { status: "unknown", summary: "Avotu neizdevās nolasīt" }, ctx.plates));
      }
    }),
  );
  return applyFinlandLinkToIndicators(rows, ctx.plates);
}

export function sanitizeVinScanSourceIds(raw: unknown): VinScanSourceId[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids = raw
    .filter((v): v is string => typeof v === "string")
    .filter((id): id is VinScanSourceId => isFreeVinScanSourceId(id));
  return ids.length > 0 ? ids : undefined;
}
