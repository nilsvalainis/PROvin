import "server-only";

import { VIN_SCAN_CATALOG, isVinScanSourceId, vinScanSourceLinkOnly, type VinScanSourceId } from "@/lib/vin-scan/catalog";
import { freeVinScanSourceIds, isFreeVinScanSourceId } from "@/lib/vin-scan/free-sources";
import { sourceNeedsInput, vinScanProbeFor } from "@/lib/vin-scan/probes";
import { emptyVinScanPlates, type VinScanPlates } from "@/lib/vin-scan/plates";
import { applyFinlandLinkToIndicators } from "@/lib/vin-scan/finland-link";
import { runWithVinScanDeadline } from "@/lib/vin-scan/http";
import { withVinScanRelayDedupe } from "@/lib/vin-scan/listings-page-relay";
import { vinScanSourceTimeoutMs } from "@/lib/vin-scan/source-timeouts";
import { thecarapiVinScanEnabled } from "@/lib/vin-scan/thecarapi-flags";
import { buildVinScanIndicator, type VinScanContext, type VinScanIndicator } from "@/lib/vin-scan/types";
import { readSourceHealth } from "@/lib/source-health-store";
import { emptySourceHealthDoc, type SourceHealthDoc } from "@/lib/source-health";
import { vinScanBreakerState, vinScanBreakerSummary } from "@/lib/vin-scan/source-health-outcomes";
import { createVinScanFirstRegHint, createVinScanVehicleHint } from "@/lib/vin-scan/vehicle-hint";

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
  /** Precīzs 1. reģistrācijas datums (kfzgutachten.at). */
  firstRegDate?: string;
  sourceIds?: readonly string[];
  /** true: izsauc arī avotus ar atvērtu circuit breaker (force skenējums, ikdienas canary). */
  ignoreBreaker?: boolean;
  /** Testiem: avotu veselības lasītājs. Noklusējums - `readSourceHealth`. */
  readHealth?: () => Promise<SourceHealthDoc>;
  /** Testiem: pašreizējais laiks ms. */
  nowMs?: number;
  /**
   * Maksas avoti, ko admins skaidri ieķeksēja «Ātrā pārbaude» lapā (tikai JoJ).
   * Bez šī saraksta maksas avoti nekad neskrien.
   */
  allowPaid?: readonly string[];
};

/** Maksas VIN SCAN avoti, ko drīkst palaist pēc admina ķekša (ar cenu pirms palaišanas). */
export const VIN_SCAN_OPT_IN_PAID_IDS = ["joj_copart_iaai"] as const satisfies readonly VinScanSourceId[];

export function sanitizeVinScanPaidSourceIds(raw: unknown): VinScanSourceId[] {
  if (!Array.isArray(raw)) return [];
  return VIN_SCAN_OPT_IN_PAID_IDS.filter((id) => raw.includes(id));
}

const HEALTH_READ_TIMEOUT_MS = 3_000;

/** Viens veselības nolasījums uz skenējumu. Kļūda vai noildze - tukšs dokuments (breaker neko neatslēdz). */
async function readHealthBestEffort(read: () => Promise<SourceHealthDoc>): Promise<SourceHealthDoc> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<SourceHealthDoc>((resolve) => {
      timer = setTimeout(() => resolve(emptySourceHealthDoc()), HEALTH_READ_TIMEOUT_MS);
    });
    const doc = await Promise.race([Promise.resolve().then(read), timeout]);
    return doc && typeof doc === "object" && doc.sources && typeof doc.sources === "object" ? doc : emptySourceHealthDoc();
  } catch {
    return emptySourceHealthDoc();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Visi avoti paralēli. Viena zonde, kas krīt, kļūst par unknown un neaptur pārējās. */
function isRunnableVinScanSourceId(id: string, allowPaid: readonly string[] = []): id is VinScanSourceId {
  if (!isVinScanSourceId(id)) return false;
  // Tikai saite (26.11 audits): arī skaidrs `sources` saraksts tos neizsauc - nekādas CapSolver maksas.
  if (vinScanSourceLinkOnly(id)) return false;
  if ((VIN_SCAN_OPT_IN_PAID_IDS as readonly string[]).includes(id)) return allowPaid.includes(id);
  if (id === "thecarapi_eu") return thecarapiVinScanEnabled();
  return isFreeVinScanSourceId(id);
}

export async function runVinScan(
  vinOrInput: string | RunVinScanInput,
  sourceIds?: readonly string[],
): Promise<VinScanIndicator[]> {
  const input: RunVinScanInput = typeof vinOrInput === "string" ? { vin: vinOrInput, sourceIds } : vinOrInput;
  const ctx: VinScanContext = {
    vin: input.vin.trim().toUpperCase(),
    plates: input.plates ?? emptyVinScanPlates(),
    listingUrl: input.listingUrl?.trim() ?? "",
    ...(input.firstRegDate?.trim() ? { firstRegDate: input.firstRegDate.trim() } : {}),
  };
  const ids = input.sourceIds?.length
    ? input.sourceIds.filter((id): id is VinScanSourceId => isRunnableVinScanSourceId(id, input.allowPaid))
    : freeVinScanSourceIds();
  const wanted = VIN_SCAN_CATALOG.filter((item) => ids.includes(item.id));
  const nowMs = input.nowMs ?? Date.now();
  const needsHealth = !input.ignoreBreaker && wanted.some((item) => item.id !== "vin_decode");
  const health = needsHealth
    ? await readHealthBestEffort(input.readHealth ?? readSourceHealth)
    : emptySourceHealthDoc();
  const hint = createVinScanVehicleHint(wanted.map((item) => item.id));
  ctx.vehicleHint = hint.wait;
  // kfzgutachten.at: bez dota datuma gaida šī skenējuma CSDD 1. reģ. datumu (26.11 - visiem CSDD auto).
  if (!ctx.firstRegDate && wanted.some((item) => item.id === "kfz_at")) {
    const firstReg = createVinScanFirstRegHint(wanted.some((item) => item.id === "csdd"));
    ctx.firstRegHint = firstReg.wait;
    ctx.reportFirstReg = firstReg.report;
  }
  return withVinScanRelayDedupe(async () => {
  const rows = await Promise.all(
    wanted.map(async (item) => {
      const started = Date.now();
      const finish = (row: VinScanIndicator): VinScanIndicator => {
        hint.report(row);
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
      if (missing) {
        if (item.id === "csdd") ctx.reportFirstReg?.("");
        return finish(missing);
      }
      const breaker = item.id === "vin_decode" ? null : vinScanBreakerState(health.sources[item.id], nowMs);
      if (breaker) {
        if (item.id === "csdd") ctx.reportFirstReg?.("");
        return finish({
          ...buildVinScanIndicator(item.id, ctx.vin, { status: "unknown", summary: vinScanBreakerSummary(breaker) }, ctx.plates),
          breakerOpen: true,
        });
      }
      const probe = vinScanProbeFor(item.id);
      if (!probe) {
        return finish(buildVinScanIndicator(item.id, ctx.vin, { status: "unknown", summary: "Zonde nav pieejama" }, ctx.plates));
      }
      const ms = timeoutMsFor(item.id);
      try {
        const row = await runWithVinScanDeadline(Date.now() + ms, () => withTimeout(item.id, ctx, probe(ctx)));
        if (item.id === "csdd") ctx.reportFirstReg?.("");
        return finish(row);
      } catch {
        if (item.id === "csdd") ctx.reportFirstReg?.("");
        return finish(buildVinScanIndicator(item.id, ctx.vin, { status: "unknown", summary: "Avotu neizdevās nolasīt" }, ctx.plates));
      }
    }),
  );
  return applyFinlandLinkToIndicators(rows, ctx.plates);
  });
}

export function sanitizeVinScanSourceIds(raw: unknown, allowPaid: readonly string[] = []): VinScanSourceId[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids = raw
    .filter((v): v is string => typeof v === "string")
    .filter((id): id is VinScanSourceId => isRunnableVinScanSourceId(id, allowPaid));
  return ids.length > 0 ? ids : undefined;
}
