/**
 * CSDD AI Structured Output — shēma un JSON → forma (bez server-only, testējams).
 */
import {
  CSDD_MILEAGE_COUNTRY_LV,
  emptyCsddFields,
  finalizeMileageHistory,
  type CsddFormFields,
  type CsddMileageRow,
} from "@/lib/admin-source-blocks";
import type { CsddPdfParseResult } from "@/lib/csdd-pdf-ingest";
import {
  emptyCsddPreviousInspectionBlock,
  lvDateToIsoFlexible,
  normalizeCsddRawText,
  previousInspectionBlockHasData,
  type CsddInspectionDefectRow,
  type CsddPreviousInspectionBlock,
  type CsddTechnicalInspectionRow,
} from "@/lib/csdd-extended-parse";
import { ADMIN_RAW_UNPROCESSED_MAX_LEN } from "@/lib/admin-raw-field-limits";

import { JsonType, type AiJsonSchema } from "@/lib/ai-json-schema";

export type { AiJsonSchema };

const DEFECT_BOILERPLATE_RE =
  /^nav\s+re[gģ]istr[eē]tu\s+tr[uū]kumu\s+vai\s+boj[aā]jumu/i;

/** AI Structured Output — CSDD e.csdd.lv transportlīdzekļa datu PDF. */
export const CSDD_AI_RESPONSE_SCHEMA: AiJsonSchema = {
  type: JsonType.OBJECT,
  properties: {
    pamataDati: {
      type: JsonType.OBJECT,
      properties: {
        markaModelis: { type: JsonType.STRING, description: "Marka un modelis, piem. MERCEDES BENZ E220" },
        registracijasNumurs: {
          type: JsonType.STRING,
          description: "Tikai numura zīme, piem. KG982 — bez vārdiem Statuss, Reģistrācijas",
        },
        pirmasRegistracijaLatvija: {
          type: JsonType.STRING,
          description: "Pirmā reģistrācija Latvijā DD.MM.YYYY no īpašnieku vēstures",
        },
        nakosasApskatesDatums: { type: JsonType.STRING, description: "Nākošā TA / Nākamās apskates datums DD.MM.YYYY" },
        ieprieksejasApskatesDatums: {
          type: JsonType.STRING,
          description: "Pēdējā TA datums vai TA datums DD.MM.YYYY",
        },
        degvielasVeids: { type: JsonType.STRING },
        pilnaMasaKg: { type: JsonType.INTEGER },
        pasmasaKg: { type: JsonType.INTEGER },
        ipasnickuSkaitsLatvija: { type: JsonType.INTEGER },
        ieprieksejasRegistracijasValsts: { type: JsonType.STRING },
        motoraTilpumsCm3: { type: JsonType.STRING },
        motoraJaudaKw: { type: JsonType.STRING },
        emisijuStandarts: { type: JsonType.STRING },
        registracijasStatuss: { type: JsonType.STRING },
        ekspluatacijasNodoklisEur: { type: JsonType.STRING },
      },
      required: ["markaModelis", "registracijasNumurs"],
    },
    nobraukumaVesture: {
      type: JsonType.ARRAY,
      description: "Visi Nobraukuma vēsture pāri: odometrs + datums",
      items: {
        type: JsonType.OBJECT,
        properties: {
          datums: { type: JsonType.STRING, description: "YYYY-MM-DD vai DD.MM.YYYY" },
          odometrs: { type: JsonType.INTEGER, description: "Kilometri, tikai cipari" },
          valsts: { type: JsonType.STRING, description: "LV vai valsts nosaukums" },
        },
        required: ["datums", "odometrs"],
      },
    },
    ieprieksejasApskatesDati: {
      type: JsonType.OBJECT,
      description:
        "Iepriekšējās apskates dati / Pēdējā tehniskā apskate + Detalizētais vērtējums — obligāti visi kodi",
      properties: {
        datums: { type: JsonType.STRING },
        parbaudesVeids: { type: JsonType.STRING },
        odometrs: { type: JsonType.INTEGER },
        vertesanasLimeklis: { type: JsonType.STRING },
        vertesanasSkaitlis: { type: JsonType.INTEGER },
        dumannibasKoeficients: { type: JsonType.STRING },
        piezimes: { type: JsonType.STRING },
        truukumi: {
          type: JsonType.ARRAY,
          items: {
            type: JsonType.OBJECT,
            properties: {
              kods: { type: JsonType.STRING },
              vertesanas: { type: JsonType.INTEGER },
              apraksts: { type: JsonType.STRING },
            },
            required: ["kods", "apraksts"],
          },
        },
      },
    },
    tehniskoApskasuVesture: {
      type: JsonType.ARRAY,
      description: "Katra apskate ar visiem defektu kodiem — NEģenerēt 'Nav reģistrētu trūkumu' ja ir kodi",
      items: {
        type: JsonType.OBJECT,
        properties: {
          datums: { type: JsonType.STRING },
          parbaudesVeids: { type: JsonType.STRING },
          vertesanasLimeklis: { type: JsonType.STRING, description: "Pilns teksts, piem. 2 - Ar mēneša laikā labojamiem" },
          vertesanasSkaitlis: { type: JsonType.INTEGER, description: "1, 2 vai 3" },
          odometrs: { type: JsonType.INTEGER },
          dumannibasKoeficients: { type: JsonType.STRING },
          piezimes: { type: JsonType.STRING },
          truukumi: {
            type: JsonType.ARRAY,
            items: {
              type: JsonType.OBJECT,
              properties: {
                kods: { type: JsonType.STRING },
                vertesanas: { type: JsonType.INTEGER, description: "Novērtējums 1, 2 vai 3" },
                apraksts: { type: JsonType.STRING },
              },
              required: ["kods", "apraksts"],
            },
          },
        },
        required: ["datums", "truukumi"],
      },
    },
    rawTekstaFragments: {
      type: JsonType.STRING,
      description: "Īss verbatim fragments no PDF (max 8000) — tikai atslēgu sadaļām",
    },
  },
  required: ["pamataDati", "nobraukumaVesture", "tehniskoApskasuVesture"],
};

export const CSDD_AI_STRUCTURED_SYSTEM = `You extract CSDD Latvia vehicle registry PDF (e.csdd.lv) into the JSON schema.
The attached PDF is the ONLY authoritative source. Read ALL pages including multi-page "Tehnisko apskašu vēsture".

CRITICAL RULES:
- registracijasNumurs: ONLY the license plate (e.g. KG982). Never append "Statuss", "Reģistrācijas", or other labels.
- nobraukumaVesture: EVERY row from "Nobraukuma vēsture" — format often "274516 - 16.12.2025" (km then date).
- ieprieksejasApskatesDati: section "Iepriekšējās apskates dati" OR current TA from "Pēdējā tehniskā apskate" + defect table under "Detalizētais vērtējums".
- tehniskoApskasuVesture: EVERY historical block starting with "Apskates datums" in "Tehnisko apskašu vēsture" (often pages 3–6). One JSON object per inspection date.
- For EACH inspection: copy EVERY row from columns Kods / Novērtējums / Trūkumi vai bojājumi into truukumi[] (codes like 5.3.4., 3.2., 503, 618).
- NEVER output "Nav reģistrētu trūkumu vai bojājumu" when the table lists concrete codes.
- Include inspection with rating 1 or 2 even when many defects — do not skip older years.
- Dates: DD.MM.YYYY. valsts for mileage: LV or Latvija.
- Newer diesels may show "Atgāzu cietās daļiņas (cm-3)" instead of "Dūmainības koeficients (m-1)" — copy the numeric value.
- TCPDF text layer often glues labels to values ("Apskates datums19.05.2026", "8.2.2.3.2Cieto") — still extract correctly.`;

/** Otrais izsaukums, ja pilnajā shēmā TA palika tukša (garš PDF). */
export const CSDD_TA_AI_RESPONSE_SCHEMA: AiJsonSchema = {
  type: JsonType.OBJECT,
  properties: {
    ieprieksejasApskatesDati: (CSDD_AI_RESPONSE_SCHEMA as { properties?: Record<string, unknown> })
      .properties?.ieprieksejasApskatesDati as AiJsonSchema,
    tehniskoApskasuVesture: (CSDD_AI_RESPONSE_SCHEMA as { properties?: Record<string, unknown> })
      .properties?.tehniskoApskasuVesture as AiJsonSchema,
  },
  required: ["tehniskoApskasuVesture"],
};

export const CSDD_TA_AI_STRUCTURED_SYSTEM = `You extract ONLY technical inspection (TA) data from a CSDD Latvia vehicle PDF.

MANDATORY:
1) ieprieksejasApskatesDati — from "Iepriekšējās apskates dati" OR "Detalizētais vērtējums" under current "Pēdējā tehniskā apskate".
2) tehniskoApskasuVesture — EVERY block in "Tehnisko apskašu vēsture" with header "Apskates datums DD.MM.YYYY".

For each inspection block extract: parbaudesVeids, vertesanasLimeklis, vertesanasSkaitlis, dumannibasKoeficients, piezimes, and ALL truukumi[] rows (kods, vertesanas 1-3, full apraksts text).

Codes may be dotted (5.3.4.) or plain (503, 618). Never skip defects. Never invent "Nav reģistrētu trūkumu" when codes exist.`;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asString(v: unknown, max = 400): string {
  if (typeof v === "string") return v.trim().slice(0, max);
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function asInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  const s = asString(v, 32).replace(/\D/g, "");
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

/** Izņem tikai LV numura zīmi — novērš "KG982Statuss". */
export function sanitizeCsddRegistrationNumber(raw: string): string {
  const compact = raw.replace(/\s+/g, "").replace(/[^A-Za-zĀāČčĒēĢģĪīĶķĻļŅņŠšŪūŽž0-9-]/g, "");
  const plate = compact.match(
    /([A-ZĀČĒĢĪĶĻŅŠŪŽ]{1,3}\d{1,4})/i,
  );
  if (plate?.[1]) return plate[1].toUpperCase();
  return compact
    .replace(/statuss|re[gģ]istr[aā]cijas|numurs|:/gi, "")
    .slice(0, 12)
    .toUpperCase();
}

function dateToLvDisplay(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  const lv = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (lv) {
    return `${lv[1].padStart(2, "0")}.${lv[2].padStart(2, "0")}.${lv[3]}`;
  }
  const flex = lvDateToIsoFlexible(t);
  if (flex) return dateToLvDisplay(flex);
  return t;
}

function dateToIsoInput(raw: string): string {
  const lv = dateToLvDisplay(raw);
  return lvDateToIsoFlexible(lv) || "";
}

function normalizeMileageCountry(valsts: string): string {
  const v = valsts.trim().toUpperCase();
  if (!v || v === "LV") return CSDD_MILEAGE_COUNTRY_LV;
  return valsts.trim();
}

function isRealDefect(kods: string, apraksts: string): boolean {
  const k = kods.trim();
  const a = apraksts.trim();
  if (k) return true;
  if (!a) return false;
  if (DEFECT_BOILERPLATE_RE.test(a)) return false;
  return a.length >= 4;
}

function mapDefectRow(raw: unknown): CsddInspectionDefectRow | null {
  const o = asRecord(raw);
  if (!o) return null;
  const code = asString(o.kods, 32);
  const rating = asString(o.vertējums ?? o.vertesanas, 8);
  const description = asString(o.apraksts, 600);
  if (!isRealDefect(code, description)) return null;
  return {
    code,
    rating: rating || (asInt(o.vertējums) != null ? String(asInt(o.vertējums)) : ""),
    description,
  };
}

function sortTechnicalInspectionRows(rows: CsddTechnicalInspectionRow[]): CsddTechnicalInspectionRow[] {
  return [...rows].sort((a, b) => {
    const ta = Date.parse(dateToIsoInput(b.date) || b.date);
    const tb = Date.parse(dateToIsoInput(a.date) || a.date);
    return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
  });
}

function mapTechnicalInspectionRows(raw: unknown): CsddTechnicalInspectionRow[] {
  if (!Array.isArray(raw)) return [];
  const out: CsddTechnicalInspectionRow[] = [];
  for (const item of raw) {
    const o = asRecord(item);
    if (!o) continue;
    const date = dateToLvDisplay(asString(o.datums, 32));
    if (!date) continue;
    const defects = (Array.isArray(o.truukumi) ? o.truukumi : [])
      .map(mapDefectRow)
      .filter((d): d is CsddInspectionDefectRow => d !== null);
    const ratingLevelRaw = asInt(o.vertesanasSkaitlis);
    const ratingLevel =
      ratingLevelRaw === 1 || ratingLevelRaw === 2 || ratingLevelRaw === 3 ? ratingLevelRaw : null;
    let maxDefectLevel: 1 | 2 | 3 | null = null;
    for (const d of defects) {
      const lvl = Number.parseInt(d.rating, 10);
      if (lvl >= 1 && lvl <= 3 && (maxDefectLevel == null || lvl > maxDefectLevel)) {
        maxDefectLevel = lvl as 1 | 2 | 3;
      }
    }
    void asInt(o.odometrs);
    out.push({
      date,
      inspectionType: asString(o.parbaudesVeids, 80),
      ratingLabel: asString(o.vertesanasLimeklis, 120),
      ratingLevel: ratingLevel ?? maxDefectLevel,
      maxDefectLevel,
      smokeCoefficient: asString(o.dumannibasKoeficients, 32),
      notes: asString(o.piezimes, 400),
      defects,
    });
  }
  return sortTechnicalInspectionRows(out.filter((r) => r.date.trim()));
}

/** Normalizē alternatīvus JSON atslēgas nosaukumus (reti no modeļa). */
export function normalizeStructuredAiPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...payload };
  if (!out.tehniskoApskasuVesture && Array.isArray(payload.technicalInspectionHistory)) {
    out.tehniskoApskasuVesture = payload.technicalInspectionHistory;
  }
  if (!out.ieprieksejasApskatesDati && payload.previousInspectionData) {
    out.ieprieksejasApskatesDati = payload.previousInspectionData;
  }
  if (!out.nobraukumaVesture && Array.isArray(payload.mileageHistory)) {
    out.nobraukumaVesture = payload.mileageHistory;
  }
  if (!out.pamataDati && payload.basicData) {
    out.pamataDati = payload.basicData;
  }
  return out;
}

/** Teksta hints — tikai TA sadaļas otrajam AI izsaukumam. */
export function extractTaSectionTextHint(raw: string): string {
  const text = normalizeCsddRawText(raw);
  const idx = text.search(
    /Tehnisko\s+apska[šs]u\s+vēsture|Iepriekšējās\s+apskates\s+dati|Detalizētais\s+vērtējums|Pēdējā\s+tehniskā\s+apskate/i,
  );
  if (idx < 0) return text.slice(0, 80_000);
  return text.slice(idx, idx + 100_000);
}

function mapMileageRows(raw: unknown): CsddMileageRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: CsddMileageRow[] = [];
  for (const item of raw) {
    const o = asRecord(item);
    if (!o) continue;
    const odometer = asInt(o.odometrs);
    if (odometer == null || odometer < 100) continue;
    const date = dateToLvDisplay(asString(o.datums, 32));
    if (!date) continue;
    rows.push({
      date,
      odometer: String(odometer),
      country: normalizeMileageCountry(asString(o.valsts, 40)),
    });
  }
  return finalizeMileageHistory(rows);
}

function mapPrevInspectionFromAi(raw: unknown): CsddPreviousInspectionBlock {
  const o = asRecord(raw);
  if (!o) return emptyCsddPreviousInspectionBlock();
  const defects = (Array.isArray(o.truukumi) ? o.truukumi : [])
    .map(mapDefectRow)
    .filter((d): d is CsddInspectionDefectRow => d !== null);
  const ratingLevelRaw = asInt(o.vertesanasSkaitlis);
  const ratingLevel =
    ratingLevelRaw === 1 || ratingLevelRaw === 2 || ratingLevelRaw === 3 ? ratingLevelRaw : null;
  const odometer = asInt(o.odometrs);
  return {
    inspectionType: asString(o.parbaudesVeids, 80),
    inspectionDateText: dateToLvDisplay(asString(o.datums, 32)),
    nextInspectionDateText: "",
    odometer: odometer != null ? String(odometer) : "",
    ratingLabel: asString(o.vertesanasLimeklis, 120),
    ratingLevel,
    smokeCoefficient: asString(o.dumannibasKoeficients, 32),
    notes: asString(o.piezimes, 400),
    defects,
  };
}

export function csddFieldsFromStructuredAiPayload(
  payload: Record<string, unknown>,
  combinedRaw: string,
): CsddFormFields {
  const normalized = normalizeStructuredAiPayload(payload);
  const pam = asRecord(normalized.pamataDati) ?? {};
  const ta = mapTechnicalInspectionRows(normalized.tehniskoApskasuVesture);
  const mileage = mapMileageRows(normalized.nobraukumaVesture);

  const nextInspectionIso = dateToIsoInput(asString(pam.nakosasApskatesDatums, 32));
  const prevInspectionIso = dateToIsoInput(asString(pam.ieprieksejasApskatesDatums, 32));
  const firstRegIso = dateToIsoInput(asString(pam.pirmasRegistracijaLatvija, 32));

  let prevInspectionBlock = mapPrevInspectionFromAi(normalized.ieprieksejasApskatesDati);
  if (!previousInspectionBlockHasData(prevInspectionBlock)) {
    const prevDate = dateToLvDisplay(asString(pam.ieprieksejasApskatesDatums, 32));
    const match =
      (prevDate ? ta.find((r) => r.date === prevDate) : undefined) ??
      ta.find((r) => (r.defects?.length ?? 0) > 0);
    if (match) {
      prevInspectionBlock = {
        inspectionType: match.inspectionType,
        inspectionDateText: match.date,
        nextInspectionDateText: "",
        odometer: "",
        ratingLabel: match.ratingLabel,
        ratingLevel: match.ratingLevel,
        smokeCoefficient: match.smokeCoefficient,
        notes: match.notes,
        defects: match.defects,
      };
    }
  }

  const gross = asInt(pam.pilnaMasaKg);
  const curb = asInt(pam.pasmasaKg);
  const owners = asInt(pam.ipasnickuSkaitsLatvija);

  return {
    ...emptyCsddFields(),
    rawUnprocessedData: combinedRaw.slice(0, ADMIN_RAW_UNPROCESSED_MAX_LEN),
    makeModel: asString(pam.markaModelis, 120),
    registrationNumber: sanitizeCsddRegistrationNumber(asString(pam.registracijasNumurs, 32)),
    firstRegistration: firstRegIso,
    nextInspectionDate: nextInspectionIso,
    prevInspectionDate: prevInspectionIso || (ta[0] ? dateToIsoInput(ta[0].date) : ""),
    fuelType: asString(pam.degvielasVeids, 80),
    grossMassKg: gross != null ? String(gross) : "",
    curbMassKg: curb != null ? String(curb) : "",
    ownerCountLatvia: owners != null ? String(owners) : "",
    previousRegistrationCountry:
      asString(pam.ieprieksejasRegistracijasValsts, 80) ||
      asString(payload.ieprieksejasRegistracijasValsts, 80),
    engineDisplacementCm3: asString(pam.motoraTilpumsCm3, 32),
    enginePowerKw: asString(pam.motoraJaudaKw, 16),
    emissionStandard: asString(pam.emisijuStandarts, 40),
    registrationStatus: asString(pam.registracijasStatuss, 80),
    roadTaxEur: asString(pam.ekspluatacijasNodoklisEur, 32),
    opacityCoefficient: ta[0]?.smokeCoefficient?.trim() || "",
    mileageHistory: mileage.length > 0 ? mileage : emptyCsddFields().mileageHistory,
    technicalInspectionHistory: ta,
    prevInspectionBlock,
  };
}

export function countTaDefects(rows: CsddTechnicalInspectionRow[]): number {
  return rows.reduce((n, r) => n + (r.defects?.length ?? 0), 0);
}

/** Vai vajadzīgs otrais AI izsaukums tikai TA datiem. */
export function csddTaExtractionLooksIncomplete(
  fields: CsddFormFields,
  textHint?: string,
): boolean {
  const defectCount = countTaDefects(fields.technicalInspectionHistory);
  const prevDefects = fields.prevInspectionBlock.defects?.length ?? 0;
  if (fields.technicalInspectionHistory.length === 0 && prevDefects === 0) return true;
  if (defectCount === 0 && prevDefects === 0) return true;

  const hint = (textHint ?? "").trim();
  if (!hint) return false;
  const inspectionDates = hint.match(/Apskates\s+datums/gi)?.length ?? 0;
  if (inspectionDates >= 3 && fields.technicalInspectionHistory.length < 2) return true;
  if (inspectionDates >= 5 && defectCount < 3) return true;
  return false;
}

/** Apvieno TA-only AI atbildi ar esošajiem laukiem (saglabā nobraukumu u.c.). */
export function mergeCsddTaAiIntoFields(
  fields: CsddFormFields,
  taPayload: Record<string, unknown>,
): CsddFormFields {
  const normalized = normalizeStructuredAiPayload(taPayload);
  const taRows = mapTechnicalInspectionRows(normalized.tehniskoApskasuVesture);
  const prevBlock = mapPrevInspectionFromAi(normalized.ieprieksejasApskatesDati);

  const existingDefects = countTaDefects(fields.technicalInspectionHistory);
  const newDefects = countTaDefects(taRows);
  const existingPrevDefects = fields.prevInspectionBlock.defects?.length ?? 0;
  const newPrevDefects = prevBlock.defects?.length ?? 0;

  let technicalInspectionHistory = fields.technicalInspectionHistory;
  if (
    taRows.length > technicalInspectionHistory.length ||
    newDefects > existingDefects
  ) {
    technicalInspectionHistory = taRows;
  }

  let prevInspectionBlock = fields.prevInspectionBlock;
  if (
    newPrevDefects > existingPrevDefects ||
    (previousInspectionBlockHasData(prevBlock) &&
      !previousInspectionBlockHasData(prevInspectionBlock))
  ) {
    prevInspectionBlock = prevBlock;
  }

  return {
    ...fields,
    technicalInspectionHistory,
    prevInspectionBlock,
    opacityCoefficient:
      fields.opacityCoefficient.trim() ||
      technicalInspectionHistory[0]?.smokeCoefficient?.trim() ||
      "",
  };
}

/**
 * CSDD PDF — tikai AI lauki; teksta slāni saglabā raw laukā (bez lokālā pārparsēšanas).
 * @deprecated Lokālais merge noņemts — izmanto finalizeCsddAiPdfResult.
 */
export function mergeCsddPdfParseResults(
  _local: CsddPdfParseResult | null,
  ai: CsddPdfParseResult,
  textHint: string,
): CsddPdfParseResult {
  return finalizeCsddAiPdfResult(ai, textHint);
}

/** AI structured rezultāts — forma 100 % no modeļa, raw = PDF teksta hints. */
export function finalizeCsddAiPdfResult(
  ai: CsddPdfParseResult,
  textHint: string,
): CsddPdfParseResult {
  const hint = textHint.trim();
  const raw = hint.length > 0 ? hint.slice(0, ADMIN_RAW_UNPROCESSED_MAX_LEN) : ai.rawUnprocessedData;
  return {
    ...ai,
    rawUnprocessedData: raw,
    fields: {
      ...ai.fields,
      rawUnprocessedData: raw.slice(0, ADMIN_RAW_UNPROCESSED_MAX_LEN),
    },
    warnings: ai.warnings.filter((w) => !/lokāl|teksta slāni|apvienot/i.test(w)),
    meta: {
      ...ai.meta,
      engine: "ai_primary",
      extractionMethod: "ai",
    },
  };
}
