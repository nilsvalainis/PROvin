import "server-only";

import {
  GEMINI_MODEL_FLASH,
  geminiGenerateJsonText,
  type GeminiUserPart,
} from "@/lib/admin-gemini";
import type { SourcePdfChecklist } from "@/lib/admin-source-blocks";
import {
  autoRecordsRowHasData,
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  sortAutoRecordsDescending,
  type AutoRecordsServiceRow,
} from "@/lib/auto-records-paste-parse";
import type { AutoRecordsPdfParseResult } from "@/lib/auto-records-pdf-parse";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";
import type { LtabIncidentRow } from "@/lib/admin-source-blocks";
import { ltabRowHasData } from "@/lib/admin-source-blocks";
import {
  parseHistoryVendorPdfText,
  type HistoryVendorPdfParseResult,
  type HistoryVendorPdfTarget,
} from "@/lib/history-vendor-pdf-import";
import { PDF_GEMINI_INLINE_MAX_BYTES } from "@/lib/pdf-api-limits";
import {
  normalizeSourcePdfComment,
  SOURCE_PDF_COMMENT_GEMINI_RULES,
} from "@/lib/source-summary-comment-format";
import type { OutvinVehicleInfo } from "@/lib/outvin-dealer-types";

export type SourcePdfExtractTarget = HistoryVendorPdfTarget | "auto_records";

const LOG_PREFIX = "[source-pdf-gemini]";
const MAX_RAW = 120_000;

function bufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asString(v: unknown, max = 120_000): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function normalizeServiceRow(raw: unknown): AutoRecordsServiceRow | null {
  const o = asRecord(raw);
  if (!o) return null;
  const date = formatAutoRecordsDateForOutput(asString(o.date, 32));
  const odometer = normalizeAutoRecordsOdometer(asString(o.odometer, 32));
  const country = normalizeCountryNameLv(asString(o.country, 80));
  const row: AutoRecordsServiceRow = { date, odometer, country };
  return autoRecordsRowHasData(row) ? row : null;
}

function normalizeIncidentRow(raw: unknown): LtabIncidentRow | null {
  const o = asRecord(raw);
  if (!o) return null;
  const row: LtabIncidentRow = {
    csngDate: formatAutoRecordsDateForOutput(asString(o.csngDate ?? o.date, 32)),
    lossAmount: asString(o.lossAmount ?? o.amount, 64),
    incidentNo: normalizeCountryNameLv(asString(o.incidentNo ?? o.country, 80)),
  };
  return ltabRowHasData(row) ? row : null;
}

function normalizeChecklist(raw: unknown): Partial<SourcePdfChecklist> {
  const o = asRecord(raw);
  if (!o) return {};
  return {
    ...(o.incidents === true ? { incidents: true } : {}),
    ...(o.mileageHistory === true ? { mileageHistory: true } : {}),
    ...(o.mileageLine === true ? { mileageLine: true } : {}),
  };
}

function dedupeServiceRows(rows: AutoRecordsServiceRow[]): AutoRecordsServiceRow[] {
  const seen = new Set<string>();
  const out: AutoRecordsServiceRow[] = [];
  for (const r of rows) {
    if (!autoRecordsRowHasData(r)) continue;
    const key = `${r.date}|${r.odometer}|${r.country}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return sortAutoRecordsDescending(out);
}

function dedupeIncidents(rows: LtabIncidentRow[]): LtabIncidentRow[] {
  const seen = new Set<string>();
  const out: LtabIncidentRow[] = [];
  for (const r of rows) {
    if (!ltabRowHasData(r)) continue;
    const key = `${r.csngDate}|${r.lossAmount}|${r.incidentNo}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

const VENDOR_SYSTEM = `You are PROVIN.LV admin PDF data extractor. Read the attached vehicle history PDF (and optional text extract) for ONE vendor report.
Return ONLY valid JSON — no markdown.

Map every table and timeline you can find into structured fields. Dates as DD.MM.YYYY when possible. Odometer as digits only (no "km"). Country names in Latvian when known (e.g. Latvija, Vācija).

JSON schema:
{
  "mileagePasteRaw": "string — verbatim odometra / vehicle history section text for admin paste field",
  "rawTextSnippet": "string — short representative excerpt (max 8000 chars)",
  "serviceHistory": [{"date":"DD.MM.YYYY","odometer":"digits","country":"string"}],
  "incidents": [{"csngDate":"DD.MM.YYYY","lossAmount":"e.g. 2930.00 €","incidentNo":"country name or ISO"}],
  "pdfChecklist": {"incidents": boolean, "mileageHistory": boolean, "mileageLine": boolean},
  "comments": "string — see COMMENTS rules below"
}

${SOURCE_PDF_COMMENT_GEMINI_RULES}

Rules:
- serviceHistory: ALL chronological odometer readings (newest-first order in array is OK).
- incidents: ALL damage/claim/accident rows with date + amount + country.
- pdfChecklist.incidents true if any accident/claim/damage mentioned; mileageHistory true if odometer history exists; mileageLine true if chart/curve looks consistent.
- comments: factual context (damage zone text, dealer milestones, registration) AND anomalies per COMMENTS rules — never output only "no issues" when descriptive history exists.
- Never invent VIN or plate; use only PDF content.`;

const TARGET_USER: Record<HistoryVendorPdfTarget, string> = {
  autodna: `TARGET: AutoDNA report.
Extract: TRANSPORTLĪDZEKĻA VĒSTURE mileage rows (date, odometer km, country), registration/first-registration dates, computed average mileage, Status Center notes, damage/claim rows into incidents.
In comments: list objective facts (e.g. first registration, dealer service at X km, body damage descriptions) and prefix true conflicts with ANOMĀLIJA:.`,
  carvertical: `TARGET: CarVertical report.
Extract: full Odometer / mileage log into serviceHistory, claim events into incidents, damage count.
In comments: include body damage zone descriptions (Virsbūves bojājums, affected sides), key mileage milestones, market hints if shown — not only problems.`,
  ltab: `TARGET: LTAB / OCTA Latvia insurance report.
Extract ONLY insurance accidents: each row needs csngDate, lossAmount (EUR), incidentNo as country. Put policy period / negadījumu skaits / reģ. nr. in comments as facts. serviceHistory may be empty array.`,
};

const AUTO_RECORDS_SYSTEM = `You are PROVIN.LV admin PDF extractor for auto-records.com dealer reports.
Return ONLY valid JSON:
{
  "rawUnprocessedData": "string — key sections: ODOMETER CHECK, service events (max 120000 chars)",
  "serviceHistory": [{"date":"DD.MM.YYYY","odometer":"digits","country":"string"}],
  "pdfChecklist": {"incidents": boolean, "mileageHistory": boolean, "mileageLine": boolean},
  "vehicleInfo": {
    "vinCode": "string",
    "model": "string",
    "series": "string",
    "generation": "string",
    "typeCode": "string",
    "engineCode": "string",
    "steeringSide": "string",
    "color": "string",
    "interior": "string",
    "transmission": "string"
  },
  "comments": "string — see COMMENTS rules",
  "warnings": ["string"]
}
${SOURCE_PDF_COMMENT_GEMINI_RULES}
Extract every service/odometer row from tables (dates YYYY-MM-DD or DD.MM.YYYY; odometer even if glued to "km" or "ServiceVisit"). checklist.incidents if damage/accident mentioned.
In comments: factual service timeline (e.g. dealer visit at km) and damage notes from text; use ANOMĀLIJA: only for clear conflicts.

Also extract VEHICLE INFORMATION fields into vehicleInfo (VIN Code, Model, Series, Generation, Type code, Engine code, Steering side, Color, Interior, Transmission). If value is missing or shown as "-" then use empty string for that field.`;

function vendorResultFromGemini(
  target: HistoryVendorPdfTarget,
  payload: Record<string, unknown>,
  fileName: string,
): HistoryVendorPdfParseResult {
  const serviceHistory = dedupeServiceRows(
    (Array.isArray(payload.serviceHistory) ? payload.serviceHistory : [])
      .map(normalizeServiceRow)
      .filter((r): r is AutoRecordsServiceRow => r !== null),
  );
  const incidents = dedupeIncidents(
    (Array.isArray(payload.incidents) ? payload.incidents : [])
      .map(normalizeIncidentRow)
      .filter((r): r is LtabIncidentRow => r !== null),
  );
  const mileagePasteRaw = asString(payload.mileagePasteRaw, 24_000);
  const rawText = asString(payload.rawTextSnippet ?? payload.rawText, MAX_RAW);
  const comments = normalizeSourcePdfComment(asString(payload.comments, 800));
  const suggestedPdfChecklist = normalizeChecklist(payload.pdfChecklist);

  const base = parseHistoryVendorPdfText(target, rawText || mileagePasteRaw);
  const warnings = [...base.warnings];
  if (serviceHistory.length === 0 && incidents.length === 0) {
    warnings.push("Gemini neatrada strukturētas rindas — pārbaudi PDF manuāli.");
  } else {
    warnings.push(`Datu avots: Gemini PDF (${fileName}).`);
  }

  return {
    rawText: rawText || mileagePasteRaw || base.rawText,
    serviceHistory: serviceHistory.length > 0 ? serviceHistory : base.serviceHistory,
    incidents: incidents.length > 0 ? incidents : base.incidents,
    suggestedPdfChecklist: { ...base.suggestedPdfChecklist, ...suggestedPdfChecklist },
    suggestedComments: comments,
    warnings,
    meta: {
      charCount: (rawText || mileagePasteRaw).length,
      mileageRowCount: serviceHistory.length || base.meta.mileageRowCount,
      incidentRowCount: incidents.length || base.meta.incidentRowCount,
      engine: "gemini_fallback",
      extractionMethod: "gemini",
    },
  };
}

function autoRecordsResultFromGemini(
  payload: Record<string, unknown>,
  fileName: string,
): AutoRecordsPdfParseResult {
  const serviceHistory = dedupeServiceRows(
    (Array.isArray(payload.serviceHistory) ? payload.serviceHistory : [])
      .map(normalizeServiceRow)
      .filter((r): r is AutoRecordsServiceRow => r !== null),
  );
  const rawUnprocessedData = asString(payload.rawUnprocessedData, MAX_RAW);
  const suggestedPdfChecklist = normalizeChecklist(payload.pdfChecklist);
  const suggestedComments = normalizeSourcePdfComment(asString(payload.comments, 800));
  const vehiclePayload = asRecord(payload.vehicleInfo);
  const normalizeVehicleField = (v: unknown) => {
    if (typeof v !== "string") return "";
    const t = v.trim();
    if (!t) return "";
    if (/^(\-+|—|–)$/i.test(t)) return "";
    return t;
  };
  const suggestedOutvinVehicleInfo: Partial<OutvinVehicleInfo> | undefined = (() => {
    if (!vehiclePayload) return undefined;
    const keys: (keyof OutvinVehicleInfo)[] = [
      "vinCode",
      "model",
      "series",
      "generation",
      "typeCode",
      "engineCode",
      "steeringSide",
      "color",
      "interior",
      "transmission",
    ];
    const out: Partial<OutvinVehicleInfo> = {};
    for (const k of keys) {
      const v = normalizeVehicleField(vehiclePayload[k]);
      if (v) out[k] = v;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  })();
  const warnings = (Array.isArray(payload.warnings) ? payload.warnings : [])
    .filter((w): w is string => typeof w === "string")
    .slice(0, 8);
  if (serviceHistory.length > 0) {
    warnings.unshift(`Datu avots: Gemini PDF (${fileName}).`);
  } else {
    warnings.push("Gemini neatrada nobraukuma rindas — pārbaudi PDF.");
  }

  return {
    serviceHistory,
    rawUnprocessedData,
    suggestedPdfChecklist,
    suggestedComments,
    suggestedOutvinVehicleInfo,
    warnings,
    meta: {
      charCount: rawUnprocessedData.length,
      rowCount: serviceHistory.length,
      usedOdometerSection: serviceHistory.length > 0,
      engine: "gemini_fallback",
      extractionMethod: "gemini",
    },
  };
}

export function vendorParseHasData(r: HistoryVendorPdfParseResult): boolean {
  if (r.serviceHistory.some(autoRecordsRowHasData)) return true;
  if (r.incidents.some(ltabRowHasData)) return true;
  if ((r.vehicleHistoryTimeline ?? []).some((row) => row.date.trim() || row.description.trim())) return true;
  if ((r.damageDetails ?? []).some((row) => row.date.trim() || row.lossAmount.trim())) return true;
  return r.rawText.length > 80;
}

export function autoRecordsParseHasData(r: AutoRecordsPdfParseResult): boolean {
  return r.serviceHistory.some(autoRecordsRowHasData) || r.rawUnprocessedData.length > 80;
}

export async function extractSourcePdfWithGemini(opts: {
  target: SourcePdfExtractTarget;
  buffer: ArrayBuffer;
  fileName: string;
  textHint?: string;
}): Promise<HistoryVendorPdfParseResult | AutoRecordsPdfParseResult> {
  const { target, buffer, fileName, textHint } = opts;
  if (buffer.byteLength > PDF_GEMINI_INLINE_MAX_BYTES) {
    throw new Error("pdf_too_large_for_gemini");
  }

  const extraParts: GeminiUserPart[] = [
    {
      inlineData: {
        mimeType: "application/pdf",
        data: bufferToBase64(buffer),
      },
    },
    { text: `[PDF document: ${fileName}]` },
  ];

  const textSection =
    textHint && textHint.trim().length > 0
      ? `\n\nPartial text layer extract (may be incomplete):\n${textHint.trim().slice(0, 60_000)}`
      : "\n\nNo usable text layer — read the PDF binary attachment.";

  if (target === "auto_records") {
    const raw = await geminiGenerateJsonText({
      model: GEMINI_MODEL_FLASH,
      systemInstruction: AUTO_RECORDS_SYSTEM,
      extraParts,
      userPrompt: `Extract AUTO RECORDS fields from this PDF.${textSection}`,
      temperature: 0.1,
    });
    let payload: Record<string, unknown> | null;
    try {
      payload = asRecord(JSON.parse(raw));
    } catch {
      throw new Error("gemini_invalid_json");
    }
    if (!payload) throw new Error("gemini_invalid_json");
    console.info(`${LOG_PREFIX} auto_records_ok`, { fileName, rows: payload.serviceHistory });
    return autoRecordsResultFromGemini(payload, fileName);
  }

  const vendorTarget = target as HistoryVendorPdfTarget;
  const raw = await geminiGenerateJsonText({
    model: GEMINI_MODEL_FLASH,
    systemInstruction: VENDOR_SYSTEM,
    extraParts,
    userPrompt: `${TARGET_USER[vendorTarget]}\n\nExtract all fields.${textSection}`,
    temperature: 0.1,
  });
  let payload: Record<string, unknown> | null;
  try {
    payload = asRecord(JSON.parse(raw));
  } catch {
    throw new Error("gemini_invalid_json");
  }
  if (!payload) throw new Error("gemini_invalid_json");
  console.info(`${LOG_PREFIX} vendor_ok`, {
    fileName,
    target: vendorTarget,
    mileage: Array.isArray(payload.serviceHistory) ? payload.serviceHistory.length : 0,
    incidents: Array.isArray(payload.incidents) ? payload.incidents.length : 0,
  });
  return vendorResultFromGemini(vendorTarget, payload, fileName);
}
