/**
 * Dīlera datu pārbaude → esošais manuālais pasūtījums.
 * Tīra funkcija: neizsauc OneAuto, Speckr, CSDD releju un krātuvi.
 * Aizpilda tikai laukus, ko pasūtījuma melnraksts jau prot (VIN, numurzīme, CSDD bloks, auto_records).
 */
import {
  createDefaultSourceBlocks,
  emptyAutoRecordsBlock,
  emptyCsddFields,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import type { OrderDraftOrderEdits, OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";
import { applyCsddTechDataToBlock } from "@/lib/csdd-tech-data-apply";
import { emptyCsddTechData, type CsddTechData } from "@/lib/csdd-tech-data";
import {
  dealerCheckHasResult,
  type DealerCheckComments,
  type DealerCheckRecord,
} from "@/lib/dealer-check";
import { dealerCheckHasCsddPreview } from "@/lib/dealer-check-csdd";
import { emptyOneautoBlock, parseResultMap, type OneautoProductResult } from "@/lib/oneauto-block";
import {
  oneautoDisplayHasRows,
  parseOneautoDisplay,
  parseOneautoProductIds,
  type OneautoDisplaySections,
  type OneautoProductId,
} from "@/lib/oneauto-catalog";
import { applyOneautoToAutoRecords, emptyOneautoIngest } from "@/lib/oneauto-to-auto-records";
import { isValidPlateNumber, isValidVin, normalizePlateNumber, normalizeVin } from "@/lib/order-field-validation";

export const DEALER_CHECK_MANUAL_ORDER_ORIGIN = "dealer-check" as const;

export const DEALER_CHECK_MANUAL_ORDER_LABEL = "Izveidot manuālo pasūtījumu";

export type DealerCheckManualOrderDealer = {
  selectedProducts: OneautoProductId[];
  results: Partial<Record<OneautoProductId, OneautoProductResult>>;
  display: OneautoDisplaySections;
  displayOriginal: OneautoDisplaySections;
  comments: DealerCheckComments;
  fetchedAt: string;
  chargedCents: number;
};

export type DealerCheckManualOrderInput = {
  vin: string;
  plate: string;
  csdd: CsddTechData | null;
  dealer: DealerCheckManualOrderDealer | null;
};

export type DealerCheckManualOrderSeed = {
  orderEdits: OrderDraftOrderEdits;
  workspace: Omit<OrderDraftWorkspaceBody, "sourceBlocks"> & {
    sourceBlocks: WorkspaceSourceBlocks;
  };
};

export type DealerCheckManualOrderPageState = {
  vin: string;
  plate: string;
  csdd: CsddTechData | null;
  record: DealerCheckRecord | null;
  comments?: DealerCheckComments | null;
};

function clip(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? t.slice(0, max) : t;
}

function usableVin(raw: string): string {
  const vin = normalizeVin(raw);
  return isValidVin(vin) ? vin : "";
}

function usablePlate(raw: string): string {
  const plate = normalizePlateNumber(raw);
  return isValidPlateNumber(plate) ? plate : "";
}

function resolveVin(state: { vin: string; recordVin?: string; csddVin?: string }): string {
  const typed = normalizeVin(state.vin);
  if (typed) return isValidVin(typed) ? typed : "";
  return usableVin(state.recordVin ?? "") || usableVin(state.csddVin ?? "");
}

function resolvePlate(state: { plate: string; recordPlate?: string; csddPlate?: string }): string {
  const typed = state.plate.trim();
  if (typed) {
    const plate = usablePlate(typed);
    if (plate) return plate;
  }
  return usablePlate(state.csddPlate ?? "") || usablePlate(state.recordPlate ?? "");
}

function commentsFrom(raw: DealerCheckComments | null | undefined): DealerCheckComments {
  return {
    serviceHistory: clip(typeof raw?.serviceHistory === "string" ? raw.serviceHistory : "", 12_000),
    oilIntervals: clip(typeof raw?.oilIntervals === "string" ? raw.oilIntervals : "", 12_000),
  };
}

function chargedCentsFrom(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return 0;
  return Math.trunc(raw);
}

function dealerFromRecord(
  record: DealerCheckRecord | null,
  comments: DealerCheckComments | null | undefined,
): DealerCheckManualOrderDealer | null {
  if (!record || !dealerCheckHasResult(record)) return null;
  const nextComments = commentsFrom(comments ?? record.comments);
  return {
    selectedProducts: [...record.selectedProducts],
    results: record.results,
    display: record.display,
    displayOriginal: record.displayOriginal,
    comments: nextComments,
    fetchedAt: record.fetchedAt,
    chargedCents: record.chargedCents,
  };
}

function dealerUseful(dealer: DealerCheckManualOrderDealer | null): boolean {
  if (!dealer) return false;
  if (dealer.fetchedAt.trim()) return true;
  if (Object.keys(dealer.results).length > 0) return true;
  if (oneautoDisplayHasRows(dealer.display) || oneautoDisplayHasRows(dealer.displayOriginal)) return true;
  if (dealer.comments.serviceHistory || dealer.comments.oilIntervals) return true;
  return false;
}

function csddUseful(csdd: CsddTechData | null): boolean {
  return dealerCheckHasCsddPreview(csdd);
}

export function dealerCheckManualOrderCanCreate(state: DealerCheckManualOrderPageState): boolean {
  const vin = resolveVin({
    vin: state.vin,
    recordVin: state.record?.vin,
    csddVin: state.csdd?.vin,
  });
  if (!vin) return false;
  const dealer = dealerFromRecord(state.record, state.comments);
  return csddUseful(state.csdd) || dealerUseful(dealer);
}

export function buildDealerCheckManualOrderBody(state: DealerCheckManualOrderPageState): Record<string, unknown> {
  const vin = resolveVin({
    vin: state.vin,
    recordVin: state.record?.vin,
    csddVin: state.csdd?.vin,
  });
  const plate = resolvePlate({
    plate: state.plate,
    recordPlate: state.record?.plate,
    csddPlate: state.csdd?.registrationNumber,
  });
  const dealer = dealerFromRecord(state.record, state.comments);
  return {
    origin: DEALER_CHECK_MANUAL_ORDER_ORIGIN,
    vin,
    ...(plate ? { plate } : {}),
    ...(state.csdd && csddUseful(state.csdd) ? { csdd: state.csdd } : {}),
    ...(dealer ? { dealer } : {}),
  };
}

function parseCsdd(raw: unknown): CsddTechData | null {
  if (!raw || typeof raw !== "object") return null;
  const empty = emptyCsddTechData();
  const o = raw as Record<string, unknown>;
  const data: CsddTechData = { ...empty };
  let any = false;
  for (const key of Object.keys(empty) as (keyof CsddTechData)[]) {
    if (typeof o[key] !== "string") continue;
    data[key] = o[key];
    if (data[key].trim()) any = true;
  }
  return any && dealerCheckHasCsddPreview(data) ? data : null;
}

function parseDealer(raw: unknown): DealerCheckManualOrderDealer | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const commentsRaw = o.comments && typeof o.comments === "object" ? (o.comments as Record<string, unknown>) : {};
  const dealer: DealerCheckManualOrderDealer = {
    selectedProducts: parseOneautoProductIds(o.selectedProducts),
    results: parseResultMap(o.results),
    display: parseOneautoDisplay(o.display),
    displayOriginal: parseOneautoDisplay(o.displayOriginal),
    comments: commentsFrom({
      serviceHistory: typeof commentsRaw.serviceHistory === "string" ? commentsRaw.serviceHistory : "",
      oilIntervals: typeof commentsRaw.oilIntervals === "string" ? commentsRaw.oilIntervals : "",
    }),
    fetchedAt: typeof o.fetchedAt === "string" ? o.fetchedAt.trim().slice(0, 40) : "",
    chargedCents: chargedCentsFrom(o.chargedCents),
  };
  return dealerUseful(dealer) ? dealer : null;
}

export function parseDealerCheckManualOrderBody(
  raw: unknown,
): { ok: true; input: DealerCheckManualOrderInput } | { ok: false; error: "invalid_vin" | "insufficient_data" } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "invalid_vin" };
  const o = raw as Record<string, unknown>;
  const vin = typeof o.vin === "string" ? usableVin(o.vin) : "";
  if (!vin) return { ok: false, error: "invalid_vin" };
  const plate = typeof o.plate === "string" ? usablePlate(o.plate) : "";
  const csdd = parseCsdd(o.csdd);
  const dealer = parseDealer(o.dealer);
  if (!csdd && !dealer) return { ok: false, error: "insufficient_data" };
  return {
    ok: true,
    input: {
      vin,
      plate,
      csdd,
      dealer,
    },
  };
}

function seedCsdd(input: DealerCheckManualOrderInput): WorkspaceSourceBlocks["csdd"] {
  let csdd = emptyCsddFields();
  if (input.csdd) {
    const applied = applyCsddTechDataToBlock(csdd, input.csdd, { nr1: input.plate || input.vin });
    if (applied) csdd = applied;
  }
  if (input.plate && !csdd.registrationNumber.trim()) {
    csdd = { ...csdd, registrationNumber: input.plate };
  }
  if (input.vin && !csdd.vin.trim()) csdd = { ...csdd, vin: input.vin };
  return csdd;
}

function seedAutoRecords(input: DealerCheckManualOrderInput): WorkspaceSourceBlocks["auto_records"] {
  const base = emptyAutoRecordsBlock();
  const dealer = input.dealer;
  if (!dealer) return base;
  const ingest = {
    ...emptyOneautoIngest(),
    lastFetchedVin: input.vin,
    fetchedAt: dealer.fetchedAt,
    selectedProducts: dealer.selectedProducts.length > 0 ? dealer.selectedProducts : emptyOneautoIngest().selectedProducts,
    lastCostEur: (dealer.chargedCents / 100).toFixed(2),
    results: dealer.results,
    serviceTimelineOriginal: dealer.displayOriginal.serviceTimeline,
  };
  return applyOneautoToAutoRecords(base, {
    display: oneautoDisplayHasRows(dealer.display) ? dealer.display : dealer.displayOriginal,
    ingest,
    notes: {
      serviceHistoryNotes: dealer.comments.serviceHistory,
      oilChangeIntervalNotes: dealer.comments.oilIntervals,
    },
    vehicleOverride: true,
  });
}

export function buildDealerCheckManualOrderSeed(input: DealerCheckManualOrderInput): DealerCheckManualOrderSeed {
  const blocks = createDefaultSourceBlocks();
  blocks.csdd = seedCsdd(input);
  blocks.auto_records = seedAutoRecords(input);
  blocks.oneauto = emptyOneautoBlock();

  const orderEdits: OrderDraftOrderEdits = { vin: input.vin };
  if (input.plate) orderEdits.licensePlate = input.plate;

  return {
    orderEdits,
    workspace: {
      sourceBlocks: blocks,
      iriss: "",
      apskatesPlāns: "",
      tehniskoRiskuAnalize: "",
      cenasAtbilstiba: "",
      previewConfirmed: false,
    },
  };
}
