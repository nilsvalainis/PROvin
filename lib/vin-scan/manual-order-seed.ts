/**
 * VIN SCAN → esošais manuālais pasūtījums (orderEdits + darba zona).
 * Tīra funkcija: neizsauc krātuvi un CSDD releju.
 */

import {
  applyCsddTechDataToBlock,
} from "@/lib/csdd-tech-data-apply";
import {
  createDefaultSourceBlocks,
  emptyCsddFields,
  emptyVendorAvotuBlock,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { isCarVerticalPurchasedScanSource } from "@/lib/carvertical-purchase";
import type { OrderDraftOrderEdits, OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";
import { emptyCsddTechData, type CsddTechData } from "@/lib/csdd-tech-data";
import { isValidVin, normalizePlateNumber, normalizeVin } from "@/lib/order-field-validation";
import {
  collectVinScanMileage,
  formatVinScanMileageLine,
  formatVinScanScannedAt,
  formatVinScanVehicleLine,
  pickVinScanVehicle,
  type VinScanOverviewRow,
} from "@/lib/vin-scan/summary";
import type { VinScanMileage, VinScanStatus, VinScanVehicle } from "@/lib/vin-scan/types";

const SOURCE_STATUS_LV: Record<string, string> = {
  found: "Ir dati",
  none: "Nav",
  unknown: "Neizdevās",
  manual: "Līdz pogai",
  skipped: "Nav atslēgas",
  needs_input: "Vajag ievadi",
  idle: "Gaida",
  checking: "Pārbauda",
};

export type VinScanManualOrderSource = {
  id: string;
  label: string;
  country?: string;
  status?: string;
  summary?: string;
  openUrl?: string | null;
  vehicle?: VinScanVehicle;
  mileage?: VinScanMileage[];
  purchased?: boolean;
  detail?: string;
};

export type VinScanManualOrderInput = {
  vin: string;
  plate?: string;
  plateStatus?: string;
  plates?: { lv?: string; nl?: string; lt?: string; fi?: string; uk?: string };
  csdd?: CsddTechData | null;
  vehicle?: VinScanVehicle | null;
  mileage?: VinScanMileage[];
  scannedAt?: string;
  sources?: VinScanManualOrderSource[];
};

export type VinScanManualOrderSeed = {
  orderEdits: OrderDraftOrderEdits;
  workspace: OrderDraftWorkspaceBody;
};

function clip(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? t.slice(0, max) : t;
}

export function parseCsddTechDataFromUnknown(v: unknown): CsddTechData | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const empty = emptyCsddTechData();
  const data: CsddTechData = { ...empty };
  let any = false;
  for (const key of Object.keys(empty) as (keyof CsddTechData)[]) {
    if (typeof o[key] !== "string") continue;
    data[key] = o[key];
    if (data[key].trim()) any = true;
  }
  return any ? data : null;
}

export function parseVinScanManualOrderInput(raw: unknown): VinScanManualOrderInput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const vin = typeof o.vin === "string" ? normalizeVin(o.vin) : "";
  if (!vin || !isValidVin(vin)) return null;

  const plate = typeof o.plate === "string" ? normalizePlateNumber(o.plate) : "";
  const plateStatus = typeof o.plateStatus === "string" ? o.plateStatus.trim() : "";
  const platesRaw = o.plates && typeof o.plates === "object" ? (o.plates as Record<string, unknown>) : null;
  const plates = platesRaw
    ? {
        lv: typeof platesRaw.lv === "string" ? normalizePlateNumber(platesRaw.lv) : "",
        nl: typeof platesRaw.nl === "string" ? normalizePlateNumber(platesRaw.nl) : "",
        lt: typeof platesRaw.lt === "string" ? normalizePlateNumber(platesRaw.lt) : "",
        fi: typeof platesRaw.fi === "string" ? normalizePlateNumber(platesRaw.fi) : "",
        uk: typeof platesRaw.uk === "string" ? normalizePlateNumber(platesRaw.uk) : "",
      }
    : undefined;
  const scannedAt = typeof o.scannedAt === "string" ? o.scannedAt.trim() : "";
  const csdd = parseCsddTechDataFromUnknown(o.csdd);
  const vehicle = asVehicle(o.vehicle);
  const mileage = asMileage(o.mileage);
  const sources = Array.isArray(o.sources) ? o.sources.map(asSource).filter((row): row is VinScanManualOrderSource => Boolean(row)) : [];

  return {
    vin,
    ...(plate ? { plate } : {}),
    ...(plateStatus ? { plateStatus } : {}),
    ...(plates && (plates.lv || plates.nl || plates.lt || plates.fi || plates.uk) ? { plates } : {}),
    ...(csdd ? { csdd } : {}),
    ...(vehicle ? { vehicle } : {}),
    ...(mileage.length ? { mileage } : {}),
    ...(scannedAt ? { scannedAt } : {}),
    ...(sources.length ? { sources } : {}),
  };
}

function asVehicle(v: unknown): VinScanVehicle | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const make = typeof o.make === "string" ? o.make.trim() : "";
  const model = typeof o.model === "string" ? o.model.trim() : "";
  const year = typeof o.year === "string" ? o.year.trim() : "";
  if (!make && !model && !year) return null;
  return { make, model, year };
}

function asMileage(v: unknown): VinScanMileage[] {
  if (!Array.isArray(v)) return [];
  const out: VinScanMileage[] = [];
  for (const row of v) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const date = typeof o.date === "string" ? o.date.trim() : "";
    const odometer = typeof o.odometer === "string" ? o.odometer.trim() : "";
    const source = typeof o.source === "string" ? o.source.trim() : "";
    if (!date && !odometer) continue;
    out.push({ date, odometer, source });
  }
  return out;
}

function asSource(v: unknown): VinScanManualOrderSource | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const label = typeof o.label === "string" ? o.label.trim() : "";
  if (!id && !label) return null;
  const country = typeof o.country === "string" ? o.country.trim() : "";
  const status = typeof o.status === "string" ? o.status.trim() : "";
  const summary = typeof o.summary === "string" ? o.summary.trim() : "";
  const openUrl = typeof o.openUrl === "string" && o.openUrl.trim() ? o.openUrl.trim() : null;
  const vehicle = asVehicle(o.vehicle) ?? undefined;
  const mileage = asMileage(o.mileage);
  return {
    id: id || label,
    label: label || id,
    ...(country ? { country } : {}),
    ...(status ? { status } : {}),
    ...(summary ? { summary } : {}),
    openUrl,
    ...(vehicle ? { vehicle } : {}),
    ...(mileage.length ? { mileage } : {}),
    ...(o.purchased === true ? { purchased: true } : {}),
    ...(typeof o.detail === "string" && o.detail.trim() ? { detail: o.detail.trim() } : {}),
  };
}

function asOverviewStatus(status: string | undefined): VinScanStatus | "idle" {
  if (status === "found" || status === "none" || status === "unknown" || status === "manual" || status === "skipped" || status === "idle") {
    return status;
  }
  return "idle";
}

function sourcesAsOverview(sources: VinScanManualOrderSource[] | undefined): VinScanOverviewRow[] {
  return (sources ?? []).map((src) => ({
    id: src.id,
    status: asOverviewStatus(src.status),
    label: src.label,
    vehicle: src.vehicle,
    mileage: src.mileage,
  }));
}

function resolveVehicle(input: VinScanManualOrderInput): VinScanVehicle | null {
  if (input.vehicle && (input.vehicle.make || input.vehicle.model || input.vehicle.year)) {
    return input.vehicle;
  }
  if (input.csdd && (input.csdd.make || input.csdd.model || input.csdd.year)) {
    return { make: input.csdd.make, model: input.csdd.model, year: input.csdd.year };
  }
  return pickVinScanVehicle(sourcesAsOverview(input.sources));
}

function resolveMileage(input: VinScanManualOrderInput): VinScanMileage[] {
  if (input.mileage && input.mileage.length > 0) return input.mileage;
  return collectVinScanMileage(sourcesAsOverview(input.sources));
}

function statusLabel(status: string): string {
  return SOURCE_STATUS_LV[status] || status || "Gaida";
}

export function buildVinScanManualOrderNotes(input: VinScanManualOrderInput): string {
  const vin = normalizeVin(input.vin);
  const plate = input.plate ? normalizePlateNumber(input.plate) : "";
  const vehicle = resolveVehicle(input);
  const mileage = resolveMileage(input);
  const vehicleLine = formatVinScanVehicleLine(vehicle);
  const scanned = input.scannedAt ? formatVinScanScannedAt(input.scannedAt) : "";
  const lines: string[] = [
    "VIN SCAN manuālais pasūtījums",
    `VIN: ${vin}`,
  ];
  if (plate) lines.push(`Reģ. nr.: ${plate}`);
  if (input.plates) {
    const extra = [
      input.plates.nl ? `NL ${input.plates.nl}` : "",
      input.plates.lt ? `LT ${input.plates.lt}` : "",
      input.plates.fi ? `FI ${input.plates.fi}` : "",
      input.plates.uk ? `UK ${input.plates.uk}` : "",
    ].filter(Boolean);
    if (extra.length) lines.push(`Citu valstu numuri: ${extra.join(", ")}`);
  }
  if (input.plateStatus) lines.push(`CSDD: ${input.plateStatus}`);
  if (vehicleLine) lines.push(`Auto: ${vehicleLine}`);
  if (scanned) lines.push(`Skenēts: ${scanned}`);
  if (mileage.length > 0) {
    lines.push(`Nobraukums: ${formatVinScanMileageLine(mileage)}`);
  }
  const sources = input.sources ?? [];
  if (sources.length > 0) {
    lines.push("", "Avoti:");
    for (const src of sources) {
      const bits = [src.label, src.country, statusLabel(src.status || ""), src.summary].filter(Boolean);
      lines.push(`- ${bits.join(" · ")}`);
      if (src.openUrl) lines.push(`  ${src.openUrl}`);
    }
  }
  return clip(lines.join("\n"), 20_000);
}

export function buildVinScanMileageComment(input: VinScanManualOrderInput): string {
  const mileage = resolveMileage(input);
  if (mileage.length === 0) return "";
  return clip(formatVinScanMileageLine(mileage), 8_000);
}

function seedCarverticalBlock(input: VinScanManualOrderInput): WorkspaceSourceBlocks["carvertical"] {
  const src = (input.sources ?? []).find((row) => row.id === "carvertical_preview");
  const block = emptyVendorAvotuBlock();
  if (!src) return block;
  if (!isCarVerticalPurchasedScanSource(src)) {
    if (src.openUrl) {
      block.aiContextRaw = clip(`CarVertical priekšskatījums: ${src.openUrl}`, 8_000);
    }
    return block;
  }
  const lines = [
    "CarVertical atskaite nopirkta no VIN SCAN pēc operatora apstiprinājuma.",
    src.openUrl ? `Atskaite: ${src.openUrl}` : "",
    src.summary && src.summary !== "CarVertical atskaite nopirkta" ? src.summary : "",
    src.detail || "",
  ].filter(Boolean);
  block.comments = clip(lines.slice(0, 2).join("\n"), 8_000);
  block.aiContextRaw = clip(lines.join("\n"), 12_000);
  return block;
}

function seedCsddBlock(input: VinScanManualOrderInput): WorkspaceSourceBlocks["csdd"] {
  let csdd = emptyCsddFields();
  const vin = normalizeVin(input.vin);
  const plate = input.plate ? normalizePlateNumber(input.plate) : "";
  if (input.csdd) {
    const applied = applyCsddTechDataToBlock(csdd, input.csdd, { nr1: plate || vin });
    if (applied) csdd = applied;
  }
  if (plate && !csdd.registrationNumber.trim()) csdd = { ...csdd, registrationNumber: plate };
  if (vin && !csdd.vin.trim()) csdd = { ...csdd, vin };
  const vehicle = resolveVehicle(input);
  if (vehicle) {
    const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(" ");
    if (makeModel && !csdd.makeModel.trim()) csdd = { ...csdd, makeModel };
    if (vehicle.year && !csdd.modelYear.trim()) csdd = { ...csdd, modelYear: vehicle.year };
  }
  return csdd;
}

export function buildVinScanManualOrderSeed(input: VinScanManualOrderInput): VinScanManualOrderSeed {
  const vin = normalizeVin(input.vin);
  const plate = input.plate ? normalizePlateNumber(input.plate) : "";
  const normalized: VinScanManualOrderInput = {
    ...input,
    vin,
    ...(plate ? { plate } : {}),
  };
  const notes = buildVinScanManualOrderNotes(normalized);
  const mileageComment = buildVinScanMileageComment(normalized);
  const blocks = createDefaultSourceBlocks();
  blocks.csdd = seedCsddBlock(normalized);
  blocks.carvertical = seedCarverticalBlock(normalized);

  const orderEdits: OrderDraftOrderEdits = { vin, notes };
  if (mileageComment) orderEdits.mileageComment = mileageComment;
  if (notes) orderEdits.internalComment = notes;

  const workspace: OrderDraftWorkspaceBody = {
    sourceBlocks: blocks,
    iriss: "",
    apskatesPlāns: "",
    tehniskoRiskuAnalize: "",
    cenasAtbilstiba: "",
    previewConfirmed: false,
  };

  return { orderEdits, workspace };
}
