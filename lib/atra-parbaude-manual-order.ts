/**
 * «Ātrā pārbaude» → viens manuālais pasūtījums ar VIN SCAN rezultātiem UN dīlera datiem (OneAuto),
 * plus Speckr, ja tas ielādēts. Tīra funkcija: neizsauc krātuvi, OneAuto, Speckr vai CSDD.
 */
import type { WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import {
  buildDealerCheckManualOrderSeed,
  parseDealerCheckManualOrderBody,
  type DealerCheckManualOrderInput,
} from "@/lib/dealer-check-manual-order";
import { parseSpeckrOrderSnapshotRaw, type SpeckrOrderSnapshot } from "@/lib/speckr-order";
import {
  buildVinScanManualOrderSeed,
  parseVinScanManualOrderInput,
  type VinScanManualOrderInput,
  type VinScanManualOrderSeed,
} from "@/lib/vin-scan/manual-order-seed";

export const ATRA_MANUAL_ORDER_ORIGIN = "atra-parbaude" as const;
export const ATRA_MANUAL_ORDER_LABEL = "Izveidot manuālu pasūtījumu";

export type AtraManualOrderInput = {
  vinScan: VinScanManualOrderInput;
  dealer: DealerCheckManualOrderInput | null;
  speckr: SpeckrOrderSnapshot | null;
};

export function buildAtraManualOrderBody(args: {
  vinScan: Record<string, unknown>;
  dealer?: Record<string, unknown> | null;
  speckr?: SpeckrOrderSnapshot | null;
}): Record<string, unknown> {
  return {
    origin: ATRA_MANUAL_ORDER_ORIGIN,
    vinScan: args.vinScan,
    ...(args.dealer ? { dealer: args.dealer } : {}),
    ...(args.speckr ? { speckr: args.speckr } : {}),
  };
}

export function parseAtraManualOrderBody(
  raw: unknown,
): { ok: true; input: AtraManualOrderInput } | { ok: false; error: "invalid_vin" } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "invalid_vin" };
  const o = raw as Record<string, unknown>;
  const vinScan = parseVinScanManualOrderInput(o.vinScan);
  if (!vinScan) return { ok: false, error: "invalid_vin" };
  const dealerParsed = o.dealer ? parseDealerCheckManualOrderBody(o.dealer) : null;
  // Dīlera dati tikai tam pašam VIN (cits VIN - ignorē, nevis jauc pasūtījumā).
  const dealer = dealerParsed?.ok && dealerParsed.input.vin === vinScan.vin ? dealerParsed.input : null;
  const speckrRaw = parseSpeckrOrderSnapshotRaw(o.speckr);
  const speckr = speckrRaw && speckrRaw.vin.toUpperCase() === vinScan.vin ? speckrRaw : null;
  return { ok: true, input: { vinScan, dealer, speckr } };
}

/** VIN SCAN sēkla + dīlera bloki (auto_records, oneauto) + Speckr momentuzņēmums. */
export function buildAtraManualOrderSeed(input: AtraManualOrderInput): VinScanManualOrderSeed {
  const base = buildVinScanManualOrderSeed(input.vinScan);
  const blocks = base.workspace.sourceBlocks as WorkspaceSourceBlocks;
  const orderEdits = { ...base.orderEdits };
  if (input.dealer) {
    const dealerSeed = buildDealerCheckManualOrderSeed(input.dealer);
    const d = dealerSeed.workspace.sourceBlocks;
    blocks.auto_records = d.auto_records;
    blocks.oneauto = d.oneauto;
    if (!input.vinScan.csdd && input.dealer.csdd) blocks.csdd = d.csdd;
    if (!orderEdits.licensePlate && dealerSeed.orderEdits.licensePlate) {
      orderEdits.licensePlate = dealerSeed.orderEdits.licensePlate;
    }
  }
  if (input.speckr) {
    blocks.auto_records = { ...blocks.auto_records, speckrSnapshot: input.speckr };
  }
  return { orderEdits, workspace: { ...base.workspace, sourceBlocks: blocks } };
}
