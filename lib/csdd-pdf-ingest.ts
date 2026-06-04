/**
 * CSDD PDF → forma: apvieno PDF teksta slāni ar Gemini izvilkumu un lokālo parseri.
 */
import { emptyCsddFields, type CsddFormFields } from "@/lib/admin-source-blocks";
import {
  normalizeCsddRawText,
  previousInspectionBlockHasData,
  resolvePrevInspectionBlockFromRaw,
  type CsddInspectionDefectRow,
  type CsddOwnerChangeRow,
  type CsddPreviousInspectionBlock,
  type CsddTechnicalInspectionRow,
} from "@/lib/csdd-extended-parse";
import {
  applyCsddPasteToForm,
  backfillCsddExtendedFromRaw,
  parseCsddPaste,
  type CsddPasteParseResult,
} from "@/lib/csdd-paste-parse";

const CSDD_SECTION_MARKERS = [
  "Iepriekšējās reģistrācijas valsts",
  "Transportlīdzekļa reģistrācija",
  "Tehniskie dati",
  "Detalizētais vērtējums",
  "Iepriekšējās apskates dati",
  "Nobraukuma vēsture",
  "Nobraukums ārvalst",
  "Tehnisko apskašu vēsture",
  "Pēdējā tehniskā apskate",
] as const;

/** Apvieno PDF teksta slāni un Gemini transkriptu — maksimāls saturs lokālajam parserim. */
export function mergeCsddPdfRawSources(textHint: string, geminiRaw: string): string {
  const a = normalizeCsddRawText(textHint).trim();
  const b = normalizeCsddRawText(geminiRaw).trim();
  if (!a) return b;
  if (!b) return a;
  if (b.length > 0 && a.includes(b)) return a;
  if (a.length > 0 && b.includes(a)) return b;

  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  const missingChunks: string[] = [];
  for (const marker of CSDD_SECTION_MARKERS) {
    if (shorter.includes(marker) && !longer.includes(marker)) {
      const idx = shorter.indexOf(marker);
      missingChunks.push(shorter.slice(idx, idx + 12_000));
    }
  }
  if (missingChunks.length === 0) return longer;
  return `${longer}\n\n${missingChunks.join("\n\n")}`.slice(0, 500_000);
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asString(v: unknown, max = 500): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function parseGeminiDefectRow(raw: unknown): CsddInspectionDefectRow | null {
  const o = asRecord(raw);
  if (!o) return null;
  const code = asString(o.code, 32);
  const rating = asString(o.rating ?? o.level, 8);
  const description = asString(o.description, 500);
  if (!code && !description) return null;
  return { code, rating, description };
}

function parseGeminiPrevBlock(raw: unknown): CsddPreviousInspectionBlock | null {
  const o = asRecord(raw);
  if (!o) return null;
  const defects = (Array.isArray(o.defects) ? o.defects : [])
    .map(parseGeminiDefectRow)
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

function parseGeminiTaRow(raw: unknown): CsddTechnicalInspectionRow | null {
  const o = asRecord(raw);
  if (!o) return null;
  const date = asString(o.date, 32);
  if (!date) return null;
  const defects = (Array.isArray(o.defects) ? o.defects : [])
    .map(parseGeminiDefectRow)
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

function parseGeminiOwnerEvent(raw: unknown): CsddOwnerChangeRow | null {
  const o = asRecord(raw);
  if (!o) return null;
  const date = asString(o.date, 32);
  const label = asString(o.label, 200);
  if (!date && !label) return null;
  return { date, label };
}

function overlayGeminiScalars(fields: CsddFormFields, payload: Record<string, unknown>): CsddFormFields {
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
    "grossMassKg",
    "curbMassKg",
    "roadTaxEur",
    "registrationStatus",
    "opacityCoefficient",
    "particulateMatter",
    "previousRegistrationCountry",
    "ownerCountLatvia",
  ];
  for (const key of scalarKeys) {
    const geminiVal = asString(payload[key], key === "makeModel" ? 120 : 200);
    if (!geminiVal) continue;
    const cur = String(next[key] ?? "").trim();
    if (!cur) next = { ...next, [key]: geminiVal };
  }
  return next;
}

function overlayGeminiStructured(fields: CsddFormFields, payload: Record<string, unknown>): CsddFormFields {
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
    .map(parseGeminiOwnerEvent)
    .filter((e): e is CsddOwnerChangeRow => e !== null);
  if (!(next.ownerRegistrationEvents ?? []).some((e) => e.date.trim()) && ownerEvents.length > 0) {
    next = { ...next, ownerRegistrationEvents: ownerEvents };
  }

  const geminiPrev = parseGeminiPrevBlock(payload.prevInspectionBlock);
  if (!previousInspectionBlockHasData(next.prevInspectionBlock) && geminiPrev) {
    next = { ...next, prevInspectionBlock: geminiPrev };
  }

  const taRows = (Array.isArray(payload.technicalInspectionHistory)
    ? payload.technicalInspectionHistory
    : []
  )
    .map(parseGeminiTaRow)
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
 * Pilna CSDD forma no apvienota PDF/Gemini teksta + opc. Gemini JSON laukiem.
 */
export function buildCsddFieldsFromPdfSources(opts: {
  textHint?: string;
  geminiRaw?: string;
  geminiPayload?: Record<string, unknown>;
}): { fields: CsddFormFields; rawUnprocessedData: string } {
  const combined = mergeCsddPdfRawSources(opts.textHint ?? "", opts.geminiRaw ?? "");
  const parsed: CsddPasteParseResult = parseCsddPaste(combined);
  let fields = applyCsddPasteToForm(emptyCsddFields(), combined, parsed);
  if (opts.geminiPayload) {
    fields = overlayGeminiScalars(fields, opts.geminiPayload);
    fields = overlayGeminiStructured(fields, opts.geminiPayload);
  }
  fields = backfillCsddExtendedFromRaw(fields);

  const resolvedPrev = resolvePrevInspectionBlockFromRaw(combined);
  if (previousInspectionBlockHasData(resolvedPrev)) {
    fields = { ...fields, prevInspectionBlock: resolvedPrev };
    if (resolvedPrev.smokeCoefficient.trim()) {
      fields = { ...fields, opacityCoefficient: resolvedPrev.smokeCoefficient };
    }
  }

  return { fields, rawUnprocessedData: combined };
}
