/**
 * CSDD PDF → forma: apvieno PDF teksta slāni ar AI izvilkumu un lokālo parseri.
 */
import { CSDD_FORM_STRUCTURED_FIELDS, emptyCsddFields, type CsddFormFields } from "@/lib/admin-source-blocks";
import type { PdfIngestEngine } from "@/lib/pdf-ingest-types";
import {
  normalizeCsddRawText,
  previousInspectionBlockHasData,
  resolvePrevInspectionBlockFromRaw,
  type CsddInspectionDefectRow,
  type CsddOwnerChangeRow,
  type CsddPreviousInspectionBlock,
  type CsddTechnicalInspectionRow,
} from "@/lib/csdd-extended-parse";
import { mergeCsddPdfRawSources } from "@/lib/csdd-pdf-raw-merge";

export { mergeCsddPdfRawSources } from "@/lib/csdd-pdf-raw-merge";
import {
  applyCsddPasteToForm,
  backfillCsddExtendedFromRaw,
  isLikelyStructuredCsddPaste,
  parseCsddPaste,
  type CsddPasteParseResult,
} from "@/lib/csdd-paste-parse";

export type CsddPdfParseResult = {
  rawUnprocessedData: string;
  fields: CsddFormFields;
  warnings: string[];
  meta: {
    charCount: number;
    engine: PdfIngestEngine;
    extractionMethod: "ai" | "text_layer";
  };
};

const CSDD_TEXT_LAYER_MIN_CHARS = 280;

/** Vai PDF teksta slānis pietiek lokālajam CSDD parserim (tāpat kā veiksmīgs raw paste). */
export function csddPdfTextLayerUsable(text: string): boolean {
  const t = normalizeCsddRawText(text).trim();
  if (t.replace(/\s/g, "").length < CSDD_TEXT_LAYER_MIN_CHARS) return false;
  return isLikelyStructuredCsddPaste(t);
}

/** Lokālais parsers no jebkura CSDD teksta (PDF slānis vai apvienots raw). */
export function buildCsddLocalParseFromText(text: string, fileName: string): CsddPdfParseResult {
  const { fields, rawUnprocessedData } = buildCsddFieldsFromPdfSources({
    textHint: text,
    aiRaw: "",
  });
  return {
    rawUnprocessedData,
    fields,
    warnings: [`Datu avots: lokālais CSDD parsers (${fileName}).`],
    meta: {
      charCount: rawUnprocessedData.length,
      engine: "local_parser",
      extractionMethod: "text_layer",
    },
  };
}

function countMileageRows(fields: CsddFormFields): number {
  return fields.mileageHistory.filter((r) => r.odometer.trim()).length;
}

function countPrevDefects(fields: CsddFormFields): number {
  return fields.prevInspectionBlock.defects?.length ?? 0;
}

function countTaDefectsInFields(fields: CsddFormFields): number {
  return (fields.technicalInspectionHistory ?? []).reduce(
    (n, r) => n + (r.defects?.length ?? 0),
    0,
  );
}

function richerTaHistory(primary: CsddFormFields, secondary: CsddFormFields) {
  const primaryDefects = countTaDefectsInFields(primary);
  const secondaryDefects = countTaDefectsInFields(secondary);
  const primaryRows = (primary.technicalInspectionHistory ?? []).filter((row) => row.date.trim()).length;
  const secondaryRows = (secondary.technicalInspectionHistory ?? []).filter((row) => row.date.trim()).length;
  if (secondaryDefects > primaryDefects) return secondary.technicalInspectionHistory;
  if (primaryDefects > secondaryDefects) return primary.technicalInspectionHistory;
  if (secondaryRows > primaryRows) return secondary.technicalInspectionHistory;
  return primaryRows > 0 ? primary.technicalInspectionHistory : secondary.technicalInspectionHistory;
}

function richerPrevBlock(primary: CsddFormFields, secondary: CsddFormFields) {
  const primaryDefects = countPrevDefects(primary);
  const secondaryDefects = countPrevDefects(secondary);
  if (secondaryDefects > primaryDefects && previousInspectionBlockHasData(secondary.prevInspectionBlock)) {
    return secondary.prevInspectionBlock;
  }
  if (primaryDefects > 0 || previousInspectionBlockHasData(primary.prevInspectionBlock)) {
    return primary.prevInspectionBlock;
  }
  return secondary.prevInspectionBlock;
}

function richerOwnerEvents(primary: CsddFormFields, secondary: CsddFormFields) {
  const count = (fields: CsddFormFields) =>
    (fields.ownerRegistrationEvents ?? []).filter((event) => event.date.trim() || event.label.trim()).length;
  if (count(secondary) > count(primary)) return secondary.ownerRegistrationEvents;
  if (count(primary) > 0) return primary.ownerRegistrationEvents;
  return secondary.ownerRegistrationEvents ?? primary.ownerRegistrationEvents;
}

function fillEmptyCsddScalar<K extends (typeof CSDD_FORM_STRUCTURED_FIELDS)[number]["key"]>(
  target: CsddFormFields,
  key: K,
  value: CsddFormFields[K],
): void {
  const current = String(target[key] ?? "").trim();
  const incoming = String(value ?? "").trim();
  if (!current && incoming) target[key] = value;
}

/**
 * AI (primary) + teksta slānis (secondary).
 * Tukšs secondary nedrīkst izdzēst jau nolasītu īpašnieku skaitu, valsti vai apskates defektus.
 */
export function pickRicherCsddFields(primary: CsddFormFields, secondary: CsddFormFields): CsddFormFields {
  const next: CsddFormFields = { ...primary };
  for (const { key } of CSDD_FORM_STRUCTURED_FIELDS) {
    fillEmptyCsddScalar(next, key, secondary[key]);
  }
  if (secondary.registrationNumber.trim()) next.registrationNumber = secondary.registrationNumber.trim();
  const mileage =
    countMileageRows(secondary) > countMileageRows(primary)
      ? secondary.mileageHistory
      : primary.mileageHistory;
  const secondaryRaw = (secondary.rawUnprocessedData ?? "").trim();
  const primaryRaw = (primary.rawUnprocessedData ?? "").trim();
  return {
    ...next,
    mileageHistory: mileage.length > 0 ? mileage : primary.mileageHistory,
    technicalInspectionHistory: richerTaHistory(primary, secondary),
    prevInspectionBlock: richerPrevBlock(primary, secondary),
    ownerRegistrationEvents: richerOwnerEvents(primary, secondary),
    rawUnprocessedData: secondaryRaw.length > primaryRaw.length ? secondary.rawUnprocessedData : primary.rawUnprocessedData,
  };
}

const CSDD_OWNER_EVIDENCE_RE =
  /īpašnieku\s+skaits|\d{1,2}\s*(?:ī|i)pa[sš]nieki\b|īpašnieka\s+maiņa|pirmā\s+reģistrācija\s+latvijā/i;
const CSDD_COUNTRY_EVIDENCE_RE = /iepriekšēj[āa]s?\s+reģistrācijas\s+valsts\s*[:\s]+\p{L}/iu;
const CSDD_TA_EVIDENCE_RE = /tehnisko\s+apska[šs]u\s+vēsture|apskates\s+datums/i;
const CSDD_INSPECTION_EVIDENCE_RE =
  /iepriekšēj[āa]s\s+apskates\s+dati|pēdēj[āa]\s+tehnisk[āa]\s+apskate|\bTA\s+datums/i;

/** Kritiskie lauki, kurus teksts sola, bet forma joprojām ir tukša. */
export function listCsddCriticalGaps(fields: CsddFormFields, raw: string): string[] {
  const text = normalizeCsddRawText(raw);
  const gaps: string[] = [];
  const ownersFilled =
    Boolean(fields.ownerCountLatvia.trim()) ||
    (fields.ownerRegistrationEvents ?? []).some((event) => event.date.trim() || event.label.trim());
  if (CSDD_OWNER_EVIDENCE_RE.test(text) && !ownersFilled) gaps.push("īpašnieku skaits");
  if (CSDD_COUNTRY_EVIDENCE_RE.test(text) && !fields.previousRegistrationCountry.trim()) {
    gaps.push("iepriekšējās reģistrācijas valsts");
  }
  const taFilled = (fields.technicalInspectionHistory ?? []).some((row) => row.date.trim());
  if (CSDD_TA_EVIDENCE_RE.test(text) && !taFilled) gaps.push("TA vēsture");
  const inspectionFilled =
    previousInspectionBlockHasData(fields.prevInspectionBlock) ||
    Boolean(fields.prevInspectionDate.trim() || fields.nextInspectionDate.trim());
  if (CSDD_INSPECTION_EVIDENCE_RE.test(text) && !inspectionFilled) gaps.push("apskates dati");
  return gaps;
}

/** Teksta slānis iedeva numuru vai nobraukumu, bet PDF solītos kritiskos laukus nenoņēma. Tad vajag AI. */
export function csddTextLayerNeedsAiFallback(fields: CsddFormFields, raw: string): boolean {
  return listCsddCriticalGaps(fields, raw).length > 0;
}

/** Ātra CSDD forma tikai no PDF teksta slāņa (bez AI). */
export function buildCsddPdfParseResultFromTextLayer(
  text: string,
  fileName: string,
): CsddPdfParseResult | null {
  if (!csddPdfTextLayerUsable(text)) return null;
  const { fields, rawUnprocessedData } = buildCsddFieldsFromPdfSources({
    textHint: text,
    aiRaw: "",
  });
  const hasData =
    Boolean(fields.previousRegistrationCountry.trim()) ||
    Boolean(fields.ownerCountLatvia.trim()) ||
    (fields.technicalInspectionHistory ?? []).some((r) => r.date.trim()) ||
    previousInspectionBlockHasData(fields.prevInspectionBlock) ||
    fields.mileageHistory.some((r) => r.odometer.trim());
  if (!hasData && rawUnprocessedData.length < 400) return null;
  return {
    rawUnprocessedData,
    fields,
    warnings: [`Datu avots: PDF teksta slānis (${fileName}) - lokālais parsers.`],
    meta: {
      charCount: rawUnprocessedData.length,
      engine: "local_parser",
      extractionMethod: "text_layer",
    },
  };
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asString(v: unknown, max = 500): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function parseAiDefectRow(raw: unknown): CsddInspectionDefectRow | null {
  const o = asRecord(raw);
  if (!o) return null;
  const code = asString(o.code, 32);
  const rating = asString(o.rating ?? o.level, 8);
  const description = asString(o.description, 500);
  if (!code && !description) return null;
  return { code, rating, description };
}

function parseAiPrevBlock(raw: unknown): CsddPreviousInspectionBlock | null {
  const o = asRecord(raw);
  if (!o) return null;
  const defects = (Array.isArray(o.defects) ? o.defects : [])
    .map(parseAiDefectRow)
    .filter((d): d is CsddInspectionDefectRow => d !== null);
  const ratingLevelRaw = o.ratingLevel;
  const ratingLevel =
    ratingLevelRaw === 1 || ratingLevelRaw === 2 || ratingLevelRaw === 3 ? ratingLevelRaw : null;
  const block: CsddPreviousInspectionBlock = {
    inspectionType: asString(o.inspectionType, 80),
    inspectionDateText: asString(o.inspectionDateText ?? o.inspectionDate, 32),
    nextInspectionDateText: asString(o.nextInspectionDateText, 32),
    odometer: asString(o.odometer, 32).replace(/\D/g, "") || asString(o.odometer, 32),
    ratingLabel: asString(o.ratingLabel, 120),
    ratingLevel,
    smokeCoefficient: asString(o.smokeCoefficient, 32),
    notes: asString(o.notes, 400),
    defects,
  };
  return previousInspectionBlockHasData(block) ? block : null;
}

function parseAiTaRow(raw: unknown): CsddTechnicalInspectionRow | null {
  const o = asRecord(raw);
  if (!o) return null;
  const date = asString(o.date, 32);
  if (!date) return null;
  const defects = (Array.isArray(o.defects) ? o.defects : [])
    .map(parseAiDefectRow)
    .filter((d): d is CsddInspectionDefectRow => d !== null);
  const ratingLevelRaw = o.ratingLevel;
  const ratingLevel =
    ratingLevelRaw === 1 || ratingLevelRaw === 2 || ratingLevelRaw === 3 ? ratingLevelRaw : null;
  const maxDefectRaw = o.maxDefectLevel;
  const maxDefectLevel =
    maxDefectRaw === 1 || maxDefectRaw === 2 || maxDefectRaw === 3 ? maxDefectRaw : null;
  return {
    date,
    inspectionType: asString(o.inspectionType, 80),
    ratingLabel: asString(o.ratingLabel, 120),
    ratingLevel,
    maxDefectLevel,
    smokeCoefficient: asString(o.smokeCoefficient, 32),
    notes: asString(o.notes, 400),
    defects,
  };
}

function parseAiOwnerEvent(raw: unknown): CsddOwnerChangeRow | null {
  const o = asRecord(raw);
  if (!o) return null;
  const date = asString(o.date, 32);
  const label = asString(o.label, 200);
  if (!date && !label) return null;
  return { date, label };
}

function overlayAiScalars(fields: CsddFormFields, payload: Record<string, unknown>): CsddFormFields {
  let next = fields;
  const scalarKeys: (keyof CsddFormFields)[] = [
    "makeModel",
    "registrationNumber",
    "firstRegistration",
    "nextInspectionDate",
    "prevInspectionDate",
    "engineDisplacementCm3",
    "enginePowerKw",
    "fuelType",
    "emissionStandard",
    "vehicleType",
    "grossMassKg",
    "curbMassKg",
    "seatCount",
    "roadTaxEur",
    "registrationStatus",
    "opacityCoefficient",
    "particulateMatter",
    "previousRegistrationCountry",
    "ownerCountLatvia",
  ];
  for (const key of scalarKeys) {
    const aiVal = asString(payload[key], key === "makeModel" ? 120 : 200);
    if (!aiVal) continue;
    const cur = String(next[key] ?? "").trim();
    if (!cur) next = { ...next, [key]: aiVal };
  }
  return next;
}

function overlayAiStructured(fields: CsddFormFields, payload: Record<string, unknown>): CsddFormFields {
  let next = fields;

  if (!next.previousRegistrationCountry.trim()) {
    const c = asString(payload.previousRegistrationCountry, 80);
    if (c) next = { ...next, previousRegistrationCountry: c };
  }

  if (!next.ownerCountLatvia.trim()) {
    const n = asString(payload.ownerCountLatvia, 8);
    if (n) next = { ...next, ownerCountLatvia: n };
  }

  const ownerEvents = (Array.isArray(payload.ownerRegistrationEvents)
    ? payload.ownerRegistrationEvents
    : []
  )
    .map(parseAiOwnerEvent)
    .filter((e): e is CsddOwnerChangeRow => e !== null);
  if (!(next.ownerRegistrationEvents ?? []).some((e) => e.date.trim()) && ownerEvents.length > 0) {
    next = { ...next, ownerRegistrationEvents: ownerEvents };
  }

  const aiPrev = parseAiPrevBlock(payload.prevInspectionBlock);
  if (!previousInspectionBlockHasData(next.prevInspectionBlock) && aiPrev) {
    next = { ...next, prevInspectionBlock: aiPrev };
  }

  const taRows = (Array.isArray(payload.technicalInspectionHistory)
    ? payload.technicalInspectionHistory
    : []
  )
    .map(parseAiTaRow)
    .filter((r): r is CsddTechnicalInspectionRow => r !== null);
  if (!(next.technicalInspectionHistory ?? []).some((r) => r.date.trim()) && taRows.length > 0) {
    next = { ...next, technicalInspectionHistory: taRows };
  } else if (
    taRows.length > 0 &&
    !(next.technicalInspectionHistory ?? []).some((r) => (r.defects?.length ?? 0) > 0) &&
    taRows.some((r) => (r.defects?.length ?? 0) > 0)
  ) {
    next = { ...next, technicalInspectionHistory: taRows };
  }

  return next;
}

/**
 * Pilna CSDD forma no apvienota PDF/AI teksta + opc. AI JSON laukiem.
 */
export function buildCsddFieldsFromPdfSources(opts: {
  textHint?: string;
  aiRaw?: string;
  aiPayload?: Record<string, unknown>;
}): { fields: CsddFormFields; rawUnprocessedData: string } {
  const combined = mergeCsddPdfRawSources(opts.textHint ?? "", opts.aiRaw ?? "");
  const parsed: CsddPasteParseResult = parseCsddPaste(combined);
  let fields = applyCsddPasteToForm(emptyCsddFields(), combined, parsed);
  if (opts.aiPayload) {
    fields = overlayAiScalars(fields, opts.aiPayload);
    fields = overlayAiStructured(fields, opts.aiPayload);
  }
  fields = backfillCsddExtendedFromRaw(fields);

  const resolvedPrev = resolvePrevInspectionBlockFromRaw(combined);
  if (previousInspectionBlockHasData(resolvedPrev)) {
    fields = { ...fields, prevInspectionBlock: resolvedPrev };
    if (resolvedPrev.smokeCoefficient.trim()) {
      const n = Number.parseFloat(resolvedPrev.smokeCoefficient.replace(",", ".").replace(/[^\d.]+/g, ""));
      if (Number.isFinite(n) && n > 0 && n < 50) {
        fields = { ...fields, opacityCoefficient: resolvedPrev.smokeCoefficient };
      }
    }
  }

  return { fields, rawUnprocessedData: combined };
}
