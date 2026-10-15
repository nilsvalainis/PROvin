import "server-only";

import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { isSafeOrderDraftSessionId, readOrderDraft, upsertOrderDraftVinScan } from "@/lib/admin-order-draft-store";
import { isPlaceholderVin, isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { mergeVinScanIndicators, parseOrderVinScanRecord, type OrderVinScanRecord } from "@/lib/order-vin-scan";
import {
  orderVinScanAlreadyDone,
  orderVinScanDedupeKey,
  orderVinScanRunningIsStuck,
  orderVinScanSourceNeedsRescan,
  takeOrderVinScanSlot,
} from "@/lib/order-vin-scan-run-decision";
import { isPaidVinScanSourceId, vinScanAutoSourceIds } from "@/lib/vin-scan/free-sources";
import { isVinScanSourceId } from "@/lib/vin-scan/catalog";
import { runVinScan } from "@/lib/vin-scan/run";
import { vinScanSourceHealthOutcomes } from "@/lib/vin-scan/source-health-outcomes";
import { recordSourceOutcomes } from "@/lib/source-health-store";
import { emptyVinScanPlates } from "@/lib/vin-scan/plates";
import { writeVinScanSnapshot } from "@/lib/vin-scan/store";

export type RunOrderFreeVinScanInput = {
  vin?: string | null;
  listingUrl?: string | null;
  force?: boolean;
  sourceIds?: readonly string[];
};

export type RunOrderFreeVinScanResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  vin?: string;
  found?: number;
  none?: number;
  error?: number;
};

function skip(reason: string): RunOrderFreeVinScanResult {
  return { ok: true, skipped: true, reason };
}

async function runOrderFreeVinScanOnce(
  sessionId: string,
  opts: RunOrderFreeVinScanInput,
): Promise<RunOrderFreeVinScanResult> {
  if (!isSafeOrderDraftSessionId(sessionId)) return skip("invalid_session");
  const vin = normalizeVin(opts.vin ?? "");
  if (!vin || !isValidVin(vin) || isPlaceholderVin(vin)) return skip("no_vin");

  const order = await getCheckoutSessionDetail(sessionId).catch(() => null);
  if (order?.checkoutLine === "provin_select") return skip("consultation");

  const prev = parseOrderVinScanRecord((await readOrderDraft(sessionId))?.vinScan);
  if (prev?.vin === vin && prev.status === "running" && orderVinScanRunningIsStuck(prev.at)) {
    const stuck: OrderVinScanRecord = {
      ...prev,
      at: new Date().toISOString(),
      status: "error",
      error: "Skenēšana apstājās (ilgāk par 10 min)",
    };
    await upsertOrderDraftVinScan(sessionId, stuck).catch(() => null);
    if (!opts.force) return { ok: false, vin, reason: "stuck_running" };
  } else if (!opts.force && prev?.vin === vin && prev.status === "running") {
    return skip("already_running");
  }
  const retryIds =
    prev?.vin === vin ? prev.indicators.filter((row) => orderVinScanSourceNeedsRescan(row.status)).map((row) => row.id) : [];
  if (
    !opts.force &&
    prev?.status === "done" &&
    prev.vin === vin &&
    !opts.sourceIds?.length &&
    orderVinScanAlreadyDone(prev.indicators)
  ) {
    return skip("already_done");
  }

  const running: OrderVinScanRecord = {
    at: new Date().toISOString(),
    vin,
    status: "running",
    indicators: prev?.vin === vin ? prev.indicators : [],
  };
  await upsertOrderDraftVinScan(sessionId, running).catch(() => null);

  try {
    const wanted = (opts.sourceIds ?? []).filter(
      (id) => isVinScanSourceId(id) && !isPaidVinScanSourceId(id),
    );
    const sourceIds = vinScanAutoSourceIds({
      sourceIds: opts.sourceIds?.length ? opts.sourceIds : retryIds.length && !opts.force ? retryIds : undefined,
    });
    const scanned = await runVinScan({
      vin,
      listingUrl: opts.listingUrl?.trim() || "",
      sourceIds,
    });
    const indicators = wanted.length ? mergeVinScanIndicators(prev?.vin === vin ? prev.indicators : [], scanned) : scanned;
    const scannedAt = new Date().toISOString();
    const done: OrderVinScanRecord = { at: scannedAt, vin, status: "done", indicators };
    await upsertOrderDraftVinScan(sessionId, done).catch((err) => {
      console.error("[order-vin-scan] persist failed", sessionId, err);
    });
    await writeVinScanSnapshot({ vin, plates: emptyVinScanPlates(), scannedAt, indicators }).catch(
      () => undefined,
    );
    await recordSourceOutcomes(vinScanSourceHealthOutcomes(indicators)).catch(() => undefined);
    return {
      ok: true,
      vin,
      found: indicators.filter((r) => r.status === "found").length,
      none: indicators.filter((r) => r.status === "none").length,
      error: indicators.filter((r) => r.status === "unknown").length,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "scan_failed";
    console.error("[order-vin-scan] run failed", sessionId, msg);
    const keep = prev?.vin === vin && prev.indicators.length > 0 ? prev.indicators : [];
    await upsertOrderDraftVinScan(sessionId, {
      at: new Date().toISOString(),
      vin,
      status: keep.length ? "done" : "error",
      error: msg.slice(0, 300),
      indicators: keep,
    }).catch(() => null);
    return { ok: false, vin, reason: msg };
  }
}

export function runOrderFreeVinScan(
  sessionId: string,
  opts: RunOrderFreeVinScanInput,
): Promise<RunOrderFreeVinScanResult> {
  const vin = normalizeVin(opts.vin ?? "");
  if (!vin) return runOrderFreeVinScanOnce(sessionId, opts);
  return takeOrderVinScanSlot(orderVinScanDedupeKey(sessionId, vin), opts.force === true, () =>
    runOrderFreeVinScanOnce(sessionId, opts),
  );
}
