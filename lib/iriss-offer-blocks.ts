/**
 * IRISS piedāvājuma rediģējamie bloki. Ja `blocks` nav saglabāti,
 * UI un PDF lieto noklusējuma blokus no jau esošajiem laukiem.
 */

import { applyProvinHumanDashes } from "@/lib/source-summary-comment-format";
import { parsePriceLike } from "@/lib/iriss-price-format";
import type { IrissOfferRecord } from "@/lib/iriss-pasutijumi-types";

export const IRISS_OFFER_BLOCK_KINDS = [
  "vehicle",
  "specialNotes",
  "visualAssessment",
  "technicalAssessment",
  "assessment",
  "warranty",
  "pricing",
  "photos",
  "auction",
  "text",
  "table",
] as const;

/** j50 correction: katrai no šīm sadaļām savs atsevišķs slēdzis, nevis kopīgs "Apraksti" bloks. */
const APRAKSTI_SECTION_KINDS = ["specialNotes", "visualAssessment", "technicalAssessment"] as const;
const APRAKSTI_SECTION_TITLES: Record<(typeof APRAKSTI_SECTION_KINDS)[number], string> = {
  specialNotes: "Īpašas atzīmes",
  visualAssessment: "Vizuālais novērtējums",
  technicalAssessment: "Tehniskais novērtējums",
};

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
    ...APRAKSTI_SECTION_KINDS.map((kind) => ({
      id: kind,
      kind,
      title: APRAKSTI_SECTION_TITLES[kind],
      visible: true,
    })),
    {
      id: "assessment",
      kind: "assessment",
      title: "Novērtējums klientam",
      // j50: Īpašas atzīmes/Vizuālais/Tehniskais novērtējums ir atsevišķi bloki -
      // šis bloks sedz tikai atzīmes (Pilna servisa vēsture u.c.) un Kopsavilkumu.
      // j61: noklusējums vienmēr ieslēgts (kā PDF/saite lasa vecos piedāvājumus bez blocks).
      visible: true,
      html: offer.summary.trim(),
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
      visible: true,
    },
    {
      id: "auction",
      kind: "auction",
      title: "Izsole",
      visible: true,
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
  const stored = offer.blocks.map((block) => ({
    ...block,
    title: applyProvinHumanDashes(block.title),
    html: block.html ? applyProvinHumanDashes(block.html) : block.html,
    rows: block.rows?.map((row) => ({
      ...row,
      label: applyProvinHumanDashes(row.label),
      value: applyProvinHumanDashes(row.value),
    })),
  }));
  // j50 korekcija: tagad brīvi saglabāts vecais, kopīgais "apraksti" bloks (ja tāds jau
  // paspēts saglabāt) tiek izlasīts kā sākumstāvoklis trim atsevišķajiem slēdžiem un pats
  // izkrīt no saraksta - offer.blocks šeit netiek mainīts, tikai rādīšanas izvads.
  const legacyApraksti = stored.find((b) => (b.kind as string) === "apraksti");
  const withoutLegacy = stored.filter((b) => (b.kind as string) !== "apraksti");
  const missingKinds = APRAKSTI_SECTION_KINDS.filter((kind) => !withoutLegacy.some((b) => b.kind === kind));
  if (!missingKinds.length) return withoutLegacy;
  const inserted: IrissOfferBlock[] = missingKinds.map((kind) => ({
    id: kind,
    kind,
    title: APRAKSTI_SECTION_TITLES[kind],
    visible: legacyApraksti ? legacyApraksti.visible : true,
  }));
  const vehicleIdx = withoutLegacy.findIndex((b) => b.kind === "vehicle");
  const insertAt = vehicleIdx >= 0 ? vehicleIdx + 1 : 0;
  return [...withoutLegacy.slice(0, insertAt), ...inserted, ...withoutLegacy.slice(insertAt)];
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

/** j61: sadaļas, kuru zaļā svira ir pašas sadaļas virsrakstā (Pamatinfo, Apraksti, Cenas, Bildes). */
export const IRISS_OFFER_SECTION_KINDS = [
  "vehicle",
  "auction",
  "specialNotes",
  "visualAssessment",
  "technicalAssessment",
  "assessment",
  "pricing",
  "photos",
] as const;

export type IrissOfferSectionKind = (typeof IRISS_OFFER_SECTION_KINDS)[number];

/**
 * Sviras stāvoklis lasīšanai: tieši tā pati loģika kā PDF/publiskajai saitei ({@link irissOfferPdfShows}) -
 * vecs piedāvājums bez `blocks` vai bez šī bloka = ieslēgts. Datus nemaina.
 */
export function irissOfferSectionVisible(blocks: readonly IrissOfferBlock[] | undefined, kind: IrissOfferSectionKind): boolean {
  if (!blocks?.length) return true;
  const block = blocks.find((b) => b.kind === kind);
  return block ? block.visible : true;
}

/**
 * Pārslēdz vienas sadaļas redzamību. Ja piedāvājumam vēl nav `blocks`, tie tiek izveidoti no noklusējuma
 * (visi ieslēgti), lai pārējās sadaļas nemainītos. Lauku vērtības (marka, cena u.c.) netiek pārrakstītas.
 */
export function setIrissOfferSectionVisible(
  offer: IrissOfferRecord,
  kind: IrissOfferSectionKind,
  visible: boolean,
): IrissOfferBlock[] {
  const base = resolveIrissOfferBlocks(offer);
  if (!base.some((b) => b.kind === kind)) {
    const fallback = defaultIrissOfferBlocks(offer).find((b) => b.kind === kind);
    if (fallback) base.push(fallback);
  }
  return base.map((b) => (b.kind === kind ? { ...b, visible } : b));
}

/** Papildu (lietotāja pievienotie) bloki - tikai tos var dzēst lapā "Secība un papildu bloki". */
export function isIrissOfferExtraBlock(block: Pick<IrissOfferBlock, "kind">): boolean {
  return block.kind === "text" || block.kind === "table";
}

export function removeIrissOfferExtraBlock(blocks: IrissOfferBlock[], id: string): IrissOfferBlock[] {
  return blocks.filter((b) => !(b.id === id && isIrissOfferExtraBlock(b)));
}

/** Vilkšanai: pārvieto bloku uz cita bloka vietu. */
export function moveIrissOfferBlockTo(blocks: IrissOfferBlock[], activeId: string, overId: string): IrissOfferBlock[] {
  const from = blocks.findIndex((b) => b.id === activeId);
  const to = blocks.findIndex((b) => b.id === overId);
  if (from < 0 || to < 0 || from === to) return blocks;
  const next = blocks.slice();
  const [row] = next.splice(from, 1);
  next.splice(to, 0, row!);
  return next;
}

/** Apakšvirsraksts sarakstā "Secība un papildu bloki": kur sadaļu labo. */
export function irissOfferBlockPlaceLabel(block: Pick<IrissOfferBlock, "kind">, photoCount: number): string {
  switch (block.kind) {
    case "vehicle":
    case "auction":
      return "Pamatinfo";
    case "specialNotes":
    case "visualAssessment":
    case "technicalAssessment":
    case "assessment":
      return "Apraksti";
    case "pricing":
      return "Cenas";
    case "photos":
      return photoCount === 1 ? "1 bilde" : `${photoCount} bildes`;
    case "table":
      return "Tabula · papildu";
    case "warranty":
      return "Teksts";
    default:
      return "Teksts · papildu";
  }
}
