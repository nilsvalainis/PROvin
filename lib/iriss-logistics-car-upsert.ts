import {
  parseLogisticsAuctionName,
  parseLogisticsIsoDate,
  parseLogisticsOrderStatus,
  type LogisticsOrder,
} from "@/lib/iriss-logistics-types";

export const IRISS_LOGISTICS_CARS_API_PATH = "/api/iriss/logistics/cars";
export const IRISS_LOGISTICS_DOCUMENTS_API_PATH = "/api/iriss/logistics/documents";

const VIN_MIN = 8;
const VIN_MAX = 17;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function firstString(row: Record<string, unknown>, keys: readonly string[], max: number): string {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, max);
  }
  return "";
}

export function flattenLogisticsCarBody(raw: unknown): Record<string, unknown> {
  if (!isObj(raw)) return {};
  const nested = isObj(raw.car) ? raw.car : isObj(raw.order) ? raw.order : null;
  return nested ? { ...nested, ...raw } : { ...raw };
}

export function normalizeLogisticsVin(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().toUpperCase().replace(/[\s\u00A0\u202F\u2007\uFEFF-]+/g, "").slice(0, VIN_MAX);
}

export function isLogisticsUpsertVin(vin: string): boolean {
  return vin.length >= VIN_MIN && vin.length <= VIN_MAX && /^[A-HJ-NPR-Z0-9]+$/.test(vin);
}

export type LogisticsCarUpsertInput = {
  vin: string;
  pickupHint: string;
  patch: Partial<LogisticsOrder>;
  error: string;
};

export function parseLogisticsCarUpsertInput(raw: unknown): LogisticsCarUpsertInput {
  const row = flattenLogisticsCarBody(raw);
  const vin = normalizeLogisticsVin(row.vin);
  if (!isLogisticsUpsertVin(vin)) {
    return { vin, pickupHint: "", patch: {}, error: "invalid_vin" };
  }

  const make = firstString(row, ["make", "marka"], 40);
  const model = firstString(row, ["model", "modelis"], 80);
  const title = firstString(row, ["title", "makeModel", "make_model"], 160);
  let nextMake = make;
  let nextModel = model;
  if (!nextMake && !nextModel && title) {
    const parts = title.split(/\s+/).filter(Boolean);
    nextMake = parts[0] ?? "";
    nextModel = parts.slice(1).join(" ");
  }

  const auction = parseLogisticsAuctionName(firstString(row, ["auction", "izsole"], 40) || undefined);
  const statusRaw = firstString(row, ["status", "statuss", "pipelineStatus", "pipeline_status"], 80);
  const status = statusRaw ? parseLogisticsOrderStatus(statusRaw) : null;
  if (statusRaw && !status) {
    return { vin, pickupHint: "", patch: {}, error: "invalid_status" };
  }

  const pickupHint = firstString(
    row,
    ["pickupPointId", "pickup_point_id", "pickupPoint", "pickup_point", "point", "punkts"],
    160,
  );
  const pickupAddress = firstString(row, ["pickupAddress", "pickup_address", "address", "adrese"], 240);
  const pickupCode = firstString(row, ["pickupCode", "pickup_code", "pickupRef", "pickup_ref", "kods"], 80);
  const stockNo = firstString(row, ["stockNo", "stock_no", "stock", "lotNo", "lot_no", "lot", "lotNumber"], 80);
  const notes = firstString(row, ["notes", "note", "piezime", "piezīme"], 1200);
  const freeParkingUntil = parseLogisticsIsoDate(
    firstString(row, ["freeParkingUntil", "free_parking_until", "parkingUntil", "parking_until", "stāvvieta"], 40),
  );

  const patch: Partial<LogisticsOrder> = { vin };
  if (nextMake) patch.make = nextMake;
  if (nextModel) patch.model = nextModel;
  if (title) patch.title = title;
  else if (nextMake || nextModel) patch.title = [nextMake, nextModel].filter(Boolean).join(" ");
  if (auction) patch.auction = auction;
  if (status) patch.status = status;
  if (pickupAddress) patch.pickupAddress = pickupAddress;
  if (pickupCode) patch.pickupRef = pickupCode;
  if (stockNo) patch.stockNo = stockNo;
  if (notes) patch.notes = notes;
  if (freeParkingUntil) patch.freeParkingUntil = freeParkingUntil;
  if (pickupHint) patch.pickupPointId = pickupHint;

  return { vin, pickupHint, patch, error: "" };
}
