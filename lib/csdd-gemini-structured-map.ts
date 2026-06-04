/**
 * CSDD Gemini Structured Output — shēma un JSON → forma (bez server-only, testējams).
 */
import {
  CSDD_MILEAGE_COUNTRY_LV,
  emptyCsddFields,
  finalizeMileageHistory,
  type CsddFormFields,
  type CsddMileageRow,
} from "@/lib/admin-source-blocks";
import {
  buildCsddFieldsFromPdfSources,
  pickRicherCsddFields,
  type CsddPdfParseResult,
} from "@/lib/csdd-pdf-ingest";
import {
  lvDateToIsoFlexible,
  previousInspectionBlockHasData,
  resolvePrevInspectionBlockFromRaw,
  type CsddInspectionDefectRow,
  type CsddTechnicalInspectionRow,
} from "@/lib/csdd-extended-parse";
import { mergeCsddPdfRawSources } from "@/lib/csdd-pdf-raw-merge";

import { SchemaType, type Schema } from "@google/generative-ai";

export type GeminiJsonSchema = Schema;

const DEFECT_BOILERPLATE_RE =
  /^nav\s+re[gģ]istr[eē]tu\s+tr[uū]kumu\s+vai\s+boj[aā]jumu/i;

/** Gemini Structured Output — CSDD e.csdd.lv transportlīdzekļa datu PDF. */
export const CSDD_GEMINI_RESPONSE_SCHEMA: GeminiJsonSchema = {
  type: SchemaType.OBJECT,
  properties: {
    pamataDati: {
      type: SchemaType.OBJECT,
      properties: {
        markaModelis: { type: SchemaType.STRING, description: "Marka un modelis, piem. MERCEDES BENZ E220" },
        registracijasNumurs: {
          type: SchemaType.STRING,
          description: "Tikai numura zīme, piem. KG982 — bez vārdiem Statuss, Reģistrācijas",
        },
        pirmasRegistracijaLatvija: {
          type: SchemaType.STRING,
          description: "Pirmā reģistrācija Latvijā DD.MM.YYYY no īpašnieku vēstures",
        },
        nakosasApskatesDatums: { type: SchemaType.STRING, description: "Nākošā TA / Nākamās apskates datums DD.MM.YYYY" },
        ieprieksejasApskatesDatums: {
          type: SchemaType.STRING,
          description: "Pēdējā TA datums vai TA datums DD.MM.YYYY",
        },
        degvielasVeids: { type: SchemaType.STRING },
        pilnaMasaKg: { type: SchemaType.INTEGER },
        pasmasaKg: { type: SchemaType.INTEGER },
        ipasnickuSkaitsLatvija: { type: SchemaType.INTEGER },
        ieprieksejasRegistracijasValsts: { type: SchemaType.STRING },
        motoraTilpumsCm3: { type: SchemaType.STRING },
        motoraJaudaKw: { type: SchemaType.STRING },
        emisijuStandarts: { type: SchemaType.STRING },
        registracijasStatuss: { type: SchemaType.STRING },
        ekspluatacijasNodoklisEur: { type: SchemaType.STRING },
      },
      required: ["markaModelis", "registracijasNumurs"],
    },
    nobraukumaVesture: {
      type: SchemaType.ARRAY,
      description: "Visi Nobraukuma vēsture pāri: odometrs + datums",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          datums: { type: SchemaType.STRING, description: "YYYY-MM-DD vai DD.MM.YYYY" },
          odometrs: { type: SchemaType.INTEGER, description: "Kilometri, tikai cipari" },
          valsts: { type: SchemaType.STRING, description: "LV vai valsts nosaukums" },
        },
        required: ["datums", "odometrs"],
      },
    },
    tehniskoApskasuVesture: {
      type: SchemaType.ARRAY,
      description: "Katra apskate ar visiem defektu kodiem — NEģenerēt 'Nav reģistrētu trūkumu' ja ir kodi",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          datums: { type: SchemaType.STRING },
          parbaudesVeids: { type: SchemaType.STRING },
          vertesanasLimeklis: { type: SchemaType.STRING, description: "Pilns teksts, piem. 2 - Ar mēneša laikā labojamiem" },
          vertesanasSkaitlis: { type: SchemaType.INTEGER, description: "1, 2 vai 3" },
          odometrs: { type: SchemaType.INTEGER },
          dumannibasKoeficients: { type: SchemaType.STRING },
          piezimes: { type: SchemaType.STRING },
          truukumi: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                kods: { type: SchemaType.STRING },
                vertesanas: { type: SchemaType.INTEGER, description: "Novērtējums 1, 2 vai 3" },
                apraksts: { type: SchemaType.STRING },
              },
              required: ["kods", "apraksts"],
            },
          },
        },
        required: ["datums", "truukumi"],
      },
    },
    rawTekstaFragments: {
      type: SchemaType.STRING,
      description: "Īss verbatim fragments no PDF (max 8000) — tikai atslēgu sadaļām",
    },
  },
  required: ["pamataDati", "nobraukumaVesture", "tehniskoApskasuVesture"],
};

export const CSDD_GEMINI_STRUCTURED_SYSTEM = `You extract CSDD Latvia vehicle registry PDF (e.csdd.lv) into the JSON schema.

CRITICAL RULES:
- registracijasNumurs: ONLY the license plate (e.g. KG982). Never append "Statuss", "Reģistrācijas", or other labels.
- nobraukumaVesture: EVERY row from "Nobraukuma vēsture" — format often "274516 - 16.12.2025" (km then date). Never leave empty if the section exists.
- ieprieksejasApskatesDatums / truukumi: from "Iepriekšējās apskates dati" OR "Detalizētais vērtējums" under "Pēdējā tehniskā apskate" — all Kods rows.
- tehniskoApskasuVesture: Group EVERY defect code under the correct inspection date. Copy full apraksts text next to each kods.
- NEVER invent the phrase "Nav reģistrētu trūkumu vai bojājumu" unless that is the ONLY text in the PDF for that inspection with zero kods rows.
- If defect table has rows like 5.3.4. / 3.2. — you MUST output them in truukumi[].
- Dates: prefer DD.MM.YYYY in output strings; ISO also accepted.
- valsts: use "LV" or "Latvija" for Latvia mileage rows.`;

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
  return out.filter((r) => r.date.trim());
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

export function csddFieldsFromStructuredGeminiPayload(
  payload: Record<string, unknown>,
  combinedRaw: string,
): CsddFormFields {
  const pam = asRecord(payload.pamataDati) ?? {};
  const ta = mapTechnicalInspectionRows(payload.tehniskoApskasuVesture);
  const mileage = mapMileageRows(payload.nobraukumaVesture);

  const nextInspectionIso = dateToIsoInput(asString(pam.nakosasApskatesDatums, 32));
  const prevInspectionIso = dateToIsoInput(asString(pam.ieprieksejasApskatesDatums, 32));
  const firstRegIso = dateToIsoInput(asString(pam.pirmasRegistracijaLatvija, 32));

  let prevInspectionBlock = resolvePrevInspectionBlockFromRaw(combinedRaw);
  const taWithDefects = ta.find((r) => (r.defects?.length ?? 0) > 0);
  if (taWithDefects && !previousInspectionBlockHasData(prevInspectionBlock)) {
    prevInspectionBlock = {
      inspectionType: taWithDefects.inspectionType,
      inspectionDateText: taWithDefects.date,
      nextInspectionDateText: "",
      odometer: "",
      ratingLabel: taWithDefects.ratingLabel,
      ratingLevel: taWithDefects.ratingLevel,
      smokeCoefficient: taWithDefects.smokeCoefficient,
      notes: taWithDefects.notes,
      defects: taWithDefects.defects,
    };
  }

  const gross = asInt(pam.pilnaMasaKg);
  const curb = asInt(pam.pasmasaKg);
  const owners = asInt(pam.ipasnickuSkaitsLatvija);

  return {
    ...emptyCsddFields(),
    rawUnprocessedData: combinedRaw.slice(0, 500_000),
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

/** Apvieno lokālo parseri un Gemini structured — prioritāte pilnākajiem datiem. */
export function mergeCsddPdfParseResults(
  local: CsddPdfParseResult | null,
  gemini: CsddPdfParseResult,
  textHint: string,
): CsddPdfParseResult {
  const combinedRaw = mergeCsddPdfRawSources(
    textHint,
    gemini.rawUnprocessedData || asString(gemini.fields.rawUnprocessedData, 120_000),
  );
  const { fields: reparsed } = buildCsddFieldsFromPdfSources({ textHint: combinedRaw });
  let merged = reparsed;
  if (local?.fields) merged = pickRicherCsddFields(merged, local.fields);
  merged = pickRicherCsddFields(merged, gemini.fields);
  const reg = sanitizeCsddRegistrationNumber(
    gemini.fields.registrationNumber.trim() || merged.registrationNumber,
  );

  return {
    rawUnprocessedData: combinedRaw,
    fields: {
      ...merged,
      registrationNumber: reg,
      rawUnprocessedData: combinedRaw.slice(0, 500_000),
    },
    warnings: [...gemini.warnings, ...(local?.warnings ?? [])].slice(0, 8),
    meta: {
      charCount: combinedRaw.length,
      engine: "gemini_primary",
      extractionMethod: "gemini",
    },
  };
}
