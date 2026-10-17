/**
 * IRISS piedāvājuma rediģējamie bloki. Ja `blocks` nav saglabāti,
 * UI un PDF lieto noklusējuma blokus no jau esošajiem laukiem.
 */

import { applyProvinHumanDashes } from "@/lib/source-summary-comment-format";
import { parsePriceLike } from "@/lib/iriss-price-format";
import type { IrissOfferRecord } from "@/lib/iriss-pasutijumi-types";

export const IRISS_OFFER_BLOCK_KINDS = [
  "vehicle",
  "assessment",
  "warranty",
  "pricing",
  "photos",
  "auction",
  "text",
  "table",
] as const;

export type IrissOfferBlockKind = (typeof IRISS_OFFER_BLOCK_KINDS)[number];

export type IrissOfferBlockRow = {
  id: string;
  label: string;
  value: string;
};

export type IrissOfferBlock = {
  id: string;
  kind: IrissOfferBlockKind;
  title: string;
  visible: boolean;
  html?: string;
  rows?: IrissOfferBlockRow[];
};

export const IRISS_OFFER_PRICE_STEPS = [500, 100, -100, -500] as const;

const VEHICLE_KEYS: ReadonlyArray<{ key: keyof IrissOfferRecord; label: string }> = [
  { key: "brandModel", label: "Marka, modelis" },
  { key: "firstRegistration", label: "Pirmā reģistrācija" },
  { key: "odometerReading", label: "Nobraukums" },
  { key: "fuel", label: "Degviela" },
  { key: "transmission", label: "Ātrumkārba" },
  { key: "powerKw", label: "Jauda" },
  { key: "color", label: "Krāsa" },
];

function clip(v: unknown, max: number): string {
  const t = typeof v === "string" ? applyProvinHumanDashes(v) : "";
  return t.length > max ? t.slice(0, max) : t;
}

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function str(offer: IrissOfferRecord, key: keyof IrissOfferRecord): string {
  const v = offer[key];
  return typeof v === "string" ? v : "";
}

export function defaultIrissOfferBlocks(offer: IrissOfferRecord): IrissOfferBlock[] {
  const extraVehicle = extraVehicleRows(offer);
  return [
    {
      id: "vehicle",
      kind: "vehicle",
      title: "Transportlīdzeklis",
      visible: true,
      rows: [
        ...VEHICLE_KEYS.map((row) => ({
          id: String(row.key),
          label: row.label,
          value: str(offer, row.key) || (row.key === "firstRegistration" ? offer.year : row.key === "odometerReading" ? offer.mileage : ""),
        })),
        ...extraVehicle,
      ],
    },
    {
      id: "assessment",
      kind: "assessment",
      title: "Novērtējums klientam",
      visible: Boolean(
        offer.visualAssessment.trim() || offer.technicalAssessment.trim() || offer.summary.trim() || offer.specialNotes.trim(),
      ),
      html: [offer.visualAssessment, offer.technicalAssessment, offer.summary, offer.specialNotes]
        .map((s) => s.trim())
        .filter(Boolean)
        .join("\n\n"),
    },
    {
      id: "warranty",
      kind: "warranty",
      title: "Garantija un piegāde",
      visible: Boolean(offer.specialNotes.trim()),
      html: offer.specialNotes.trim(),
    },
    {
      id: "pricing",
      kind: "pricing",
      title: "Cenas",
      visible: true,
    },
    {
      id: "photos",
      kind: "photos",
      title: "Bildes",
      visible: offer.attachments.length > 0,
    },
    {
      id: "auction",
      kind: "auction",
      title: "Izsole",
      visible: Boolean(offer.auctionPlatform.trim() || offer.auctionStockNumber.trim() || offer.location.trim()),
    },
  ];
}

function extraVehicleRows(offer: IrissOfferRecord): IrissOfferBlockRow[] {
  const known = new Set(VEHICLE_KEYS.map((r) => String(r.key)));
  const stored = offer.blocks?.find((b) => b.kind === "vehicle")?.rows ?? [];
  return stored.filter((row) => !known.has(row.id) && (row.label.trim() || row.value.trim()));
}

export function resolveIrissOfferBlocks(offer: IrissOfferRecord): IrissOfferBlock[] {
  if (!offer.blocks?.length) return defaultIrissOfferBlocks(offer);
  return offer.blocks.map((block) => ({
    ...block,
    title: applyProvinHumanDashes(block.title),
    html: block.html ? applyProvinHumanDashes(block.html) : block.html,
    rows: block.rows?.map((row) => ({
      ...row,
      label: applyProvinHumanDashes(row.label),
      value: applyProvinHumanDashes(row.value),
    })),
  }));
}

export function visibleIrissOfferBlocks(offer: IrissOfferRecord): IrissOfferBlock[] {
  return resolveIrissOfferBlocks(offer).filter((block) => block.visible);
}

export function normalizeIrissOfferBlocks(raw: unknown): IrissOfferBlock[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: IrissOfferBlock[] = [];
  for (const item of raw.slice(0, 24)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = clip(o.id, 48);
    const kind = typeof o.kind === "string" ? o.kind : "";
    if (!id || !(IRISS_OFFER_BLOCK_KINDS as readonly string[]).includes(kind)) continue;
    const rowsRaw = Array.isArray(o.rows) ? o.rows : [];
    const rows: IrissOfferBlockRow[] = [];
    for (const row of rowsRaw.slice(0, 40)) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const rid = clip(r.id, 48) || newId("row");
      rows.push({
        id: rid,
        label: clip(r.label, 120),
        value: clip(r.value, 400),
      });
    }
    out.push({
      id,
      kind: kind as IrissOfferBlockKind,
      title: clip(o.title, 80) || "Bloks",
      visible: o.visible !== false,
      ...(typeof o.html === "string" ? { html: clip(o.html, 12_000) } : {}),
      ...(rows.length ? { rows } : {}),
    });
  }
  return out.length ? out : undefined;
}

export function moveIrissOfferBlock(blocks: IrissOfferBlock[], id: string, dir: -1 | 1): IrissOfferBlock[] {
  const i = blocks.findIndex((b) => b.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= blocks.length) return blocks;
  const next = blocks.slice();
  const [row] = next.splice(i, 1);
  next.splice(j, 0, row!);
  return next;
}

export function toggleIrissOfferBlockVisible(blocks: IrissOfferBlock[], id: string): IrissOfferBlock[] {
  return blocks.map((b) => (b.id === id ? { ...b, visible: !b.visible } : b));
}

export function addIrissOfferBlock(blocks: IrissOfferBlock[], kind: "text" | "table"): IrissOfferBlock[] {
  if (kind === "table") {
    return [
      ...blocks,
      {
        id: newId("table"),
        kind: "table",
        title: "Tabula",
        visible: true,
        rows: [{ id: newId("row"), label: "", value: "" }],
      },
    ];
  }
  return [
    ...blocks,
    { id: newId("text"), kind: "text", title: "Teksts", visible: true, html: "" },
  ];
}

export function upsertIrissOfferBlockRow(
  blocks: IrissOfferBlock[],
  blockId: string,
  row: IrissOfferBlockRow,
): IrissOfferBlock[] {
  return blocks.map((block) => {
    if (block.id !== blockId) return block;
    const rows = [...(block.rows ?? [])];
    const i = rows.findIndex((r) => r.id === row.id);
    if (i >= 0) rows[i] = { ...row, label: applyProvinHumanDashes(row.label), value: applyProvinHumanDashes(row.value) };
    else rows.push({ ...row, label: applyProvinHumanDashes(row.label), value: applyProvinHumanDashes(row.value) });
    return { ...block, rows };
  });
}

export function addIrissOfferBlockRow(blocks: IrissOfferBlock[], blockId: string): IrissOfferBlock[] {
  return blocks.map((block) => {
    if (block.id !== blockId) return block;
    return {
      ...block,
      rows: [...(block.rows ?? []), { id: newId("row"), label: "", value: "" }],
    };
  });
}

export function removeIrissOfferBlockRow(
  blocks: IrissOfferBlock[],
  blockId: string,
  rowId: string,
): IrissOfferBlock[] {
  return blocks.map((block) => {
    if (block.id !== blockId) return block;
    const rows = (block.rows ?? []).filter((r) => r.id !== rowId);
    return { ...block, rows: rows.length ? rows : [{ id: newId("row"), label: "", value: "" }] };
  });
}

export function applyIrissOfferBlocksToRecord(
  offer: IrissOfferRecord,
  blocks: IrissOfferBlock[],
): IrissOfferRecord {
  const vehicle = blocks.find((b) => b.kind === "vehicle");
  const warranty = blocks.find((b) => b.kind === "warranty");
  const assessment = blocks.find((b) => b.kind === "assessment");
  const next: IrissOfferRecord = { ...offer, blocks };
  if (vehicle?.rows) {
    for (const row of vehicle.rows) {
      if (row.id === "brandModel") next.brandModel = row.value;
      if (row.id === "firstRegistration") {
        next.firstRegistration = row.value;
        next.year = row.value;
      }
      if (row.id === "odometerReading") {
        next.odometerReading = row.value;
        next.mileage = row.value;
      }
      if (row.id === "fuel") next.fuel = row.value;
      if (row.id === "transmission") next.transmission = row.value;
      if (row.id === "powerKw") next.powerKw = row.value;
      if (row.id === "color") next.color = row.value;
    }
  }
  if (warranty?.html != null) next.specialNotes = warranty.html;
  if (assessment?.html != null && !warranty?.html) {
    /* novērtējuma teksts paliek savos laukos, ja operators to laboja blokā */
  }
  return next;
}

export function applyIrissOfferPriceStep(price: string, step: number): string {
  const n = parsePriceLike(price);
  const next = Math.max(0, Math.round(n + step));
  return String(next);
}

export function irissOfferPriceStepLabel(step: number): string {
  const sign = step > 0 ? "+" : "";
  return `${sign}${step}`;
}

export function irissOfferBlocksTouched(offer: IrissOfferRecord): boolean {
  return Boolean(offer.blocks?.length);
}

export function irissOfferPdfShows(offer: IrissOfferRecord, kind: IrissOfferBlockKind): boolean {
  if (!offer.blocks?.length) return true;
  const block = offer.blocks.find((b) => b.kind === kind);
  return block ? block.visible : true;
}

export function irissOfferCustomPdfBlocks(offer: IrissOfferRecord): IrissOfferBlock[] {
  if (!offer.blocks?.length) return [];
  return visibleIrissOfferBlocks(offer).filter((block) => block.kind === "text" || block.kind === "table");
}
