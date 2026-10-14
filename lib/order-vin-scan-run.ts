import "server-only";

import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { isSafeOrderDraftSessionId, readOrderDraft, upsertOrderDraftVinScan } from "@/lib/admin-order-draft-store";
import { isPlaceholderVin, isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { parseOrderVinScanRecord, type OrderVinScanRecord } from "@/lib/order-vin-scan";
import { freeVinScanSourceIds } from "@/lib/vin-scan/free-sources";
import { runVinScan } from "@/lib/vin-scan/run";
import { vinScanSourceHealthOutcomes } from "@/lib/vin-scan/source-health-outcomes";
import { recordSourceOutcomes } from "@/lib/source-health-store";
import { emptyVinScanPlates } from "@/lib/vin-scan/plates";
import { writeVinScanSnapshot } from "@/lib/vin-scan/store";

export type RunOrderFreeVinScanInput = {
  vin?: string | null;
  listingUrl?: string | null;
  force?: boolean;
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

export async function runOrderFreeVinScan(
  sessionId: string,
  opts: RunOrderFreeVinScanInput,
): Promise<RunOrderFreeVinScanResult> {
  if (!isSafeOrderDraftSessionId(sessionId)) return skip("invalid_session");
  const vin = normalizeVin(opts.vin ?? "");
  if (!vin || !isValidVin(vin) || isPlaceholderVin(vin)) return skip("no_vin");

  const order = await getCheckoutSessionDetail(sessionId).catch(() => null);
  if (order?.checkoutLine === "provin_select") return skip("consultation");

  const prev = parseOrderVinScanRecord((await readOrderDraft(sessionId))?.vinScan);
  if (!opts.force && prev?.status === "done" && prev.vin === vin && prev.indicators.length > 0) {
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
    const indicators = await runVinScan({
      vin,
      listingUrl: opts.listingUrl?.trim() || "",
      sourceIds: freeVinScanSourceIds(),
    });
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
