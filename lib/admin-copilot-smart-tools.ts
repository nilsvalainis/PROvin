/**
 * Copilot «Gudrais režīms» - rīku definīcijas un tīrā (bez tīkla) rīku loģika.
 *
 * Drošība:
 * - Neviens rīks neraksta datus. `propose_write` / `generate_comment` tikai sagatavo
 *   priekšlikumus; tabulās un laukos tie nonāk tikai pēc operatora pogas.
 * - Maksas avotu (AutoDNA / CarVertical pirkums, CSDD SMS izziņa, OneAuto u.c.) rīku nav.
 * - «Servisa vēsture» (`serviceHistoryNotes`) netiek aiztikta.
 */
import type Anthropic from "@anthropic-ai/sdk";

import { checkAiCommentLint } from "@/lib/pre-pdf-ai-lint";
import { checkInternalNoteLeaks, type ClientPrintedTextField } from "@/lib/pre-pdf-internal-note-check";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { csddFieldIsApiLocked } from "@/lib/csdd-field-lock";
import {
  SOURCE_BLOCK_KEYS,
  type SourceBlockKey,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import {
  COPILOT_AUDIT_FIELD_KEYS,
  COPILOT_AUDIT_FIELD_LABELS,
  isCopilotAuditFieldKey,
  type CopilotAction,
  type CopilotAuditFieldKey,
  type CopilotFieldProposal,
} from "@/lib/admin-copilot-types";

export const COPILOT_GENERATE_SECTIONS = [
  "summary",
  "technical_risks",
  "inspection",
  "price",
  "incidents",
  "mileage",
  "sources_comparison",
] as const;
export type CopilotGenerateSection = (typeof COPILOT_GENERATE_SECTIONS)[number];

/** Kurā audita laukā nonāk katras sadaļas ✨ teksts. */
export const COPILOT_SECTION_FIELD: Record<CopilotGenerateSection, CopilotAuditFieldKey> = {
  summary: "iriss",
  technical_risks: "tehniskoRiskuAnalize",
  inspection: "apskatesPlāns",
  price: "cenasAtbilstiba",
  incidents: "internalComment",
  mileage: "mileageComment",
  sources_comparison: "sourcesComparisonComment",
};

/** Klienta PDF drukātie audita lauki (iekšējie: negadījumu kopsavilkums, avotu salīdzinājums). */
export const COPILOT_CLIENT_AUDIT_FIELDS: readonly CopilotAuditFieldKey[] = [
  "iriss",
  "apskatesPlāns",
  "tehniskoRiskuAnalize",
  "cenasAtbilstiba",
  "mileageComment",
];

/** Lauki, ko gudrais režīms nekad neraksta. */
export const COPILOT_SMART_FORBIDDEN_FIELDS = new Set(["serviceHistoryNotes"]);

const SOURCE_KEYS_WRITABLE = SOURCE_BLOCK_KEYS.filter((k) => k !== "listing_analysis");

export type CopilotAuditValues = Record<CopilotAuditFieldKey, string>;

export function emptyCopilotAuditValues(): CopilotAuditValues {
  return Object.fromEntries(COPILOT_AUDIT_FIELD_KEYS.map((k) => [k, ""])) as CopilotAuditValues;
}

/** Audita lauku vērtības no klienta `auditContext` (tās pašas atslēgas kā ✨ maršrutiem). */
export function copilotAuditValuesFromRaw(raw: unknown): CopilotAuditValues {
  const parsed =
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw) as unknown;
          } catch {
            return null;
          }
        })()
      : raw;
  const o = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const out = emptyCopilotAuditValues();
  for (const k of COPILOT_AUDIT_FIELD_KEYS) {
    if (typeof o[k] === "string") out[k] = o[k] as string;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Rīku shēmas                                                         */
/* ------------------------------------------------------------------ */

const EMPTY_SCHEMA = { type: "object" as const, properties: {}, additionalProperties: false };

export const COPILOT_SMART_TOOLS: Anthropic.Tool[] = [
  {
    name: "read_source",
    description:
      "Read one full source block of this order as JSON (all fields and rows). Use it when CURRENT TABLES are not detailed enough. Free, read-only.",
    input_schema: {
      type: "object",
      properties: { key: { type: "string", enum: [...SOURCE_BLOCK_KEYS] } },
      required: ["key"],
      additionalProperties: false,
    },
  },
  {
    name: "list_missing_fields",
    description:
      "List empty important fields: CSDD fields, source comments for sources that have data, audit text fields, VIN. Free, read-only. Use for «kas trūkst?».",
    input_schema: EMPTY_SCHEMA,
  },
  {
    name: "propose_write",
    description: [
      "Propose changes. NOTHING is written: the operator sees a preview and confirms with a button.",
      "kind=copilot_action: `action` is one Copilot action object exactly as in the system prompt (upsert_incident, upsert_mileage, upsert_vehicle_history_timeline_row, upsert_service_work, set_dealer_vehicle_info, append_raw, set_registry_fields, delete_incident, delete_mileage, delete_service_work, clear_field). To fix a row: delete_* the wrong row + upsert_* the corrected row. Deletions only when the operator asked for them.",
      "kind=source_field: set one top-level text field of any source block (`source` = block key such as csdd, tirgus, oneauto, autodna; `field` = field name exactly as read_source shows it; `value` = new text). Comments fields are client text - write plain Latvian.",
      "kind=audit_field: set an audit text field (`field` one of iriss=summary, apskatesPlāns=inspection plan, tehniskoRiskuAnalize=technical risks, cenasAtbilstiba=price fit, internalComment=incidents summary, mileageComment=mileage comment, sourcesComparisonComment=sources comparison; `value` = plain Latvian text).",
      "Never «Servisa vēsture» (serviceHistoryNotes / set_service_history).",
    ].join("\n"),
    input_schema: {
      type: "object",
      properties: {
        writes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["copilot_action", "source_field", "audit_field"] },
              action: { type: "object" },
              source: { type: "string" },
              field: { type: "string" },
              value: { type: "string" },
            },
            required: ["kind"],
          },
        },
      },
      required: ["writes"],
    },
  },
  {
    name: "run_vin_scan",
    description:
      "Start the FREE VIN SCAN for this order's VIN (no paid sources). Results arrive in the VIN SCAN block in about a minute; this message will not see them.",
    input_schema: EMPTY_SCHEMA,
  },
  {
    name: "run_dealer_ingest",
    description:
      "Re-parse the already paid dealer data (stored RAW) for this order. Free. Never buys a new dealer report.",
    input_schema: EMPTY_SCHEMA,
  },
  {
    name: "generate_comment",
    description:
      "Generate one audit text with the same ✨ generator the admin buttons use, then it is proposed (preview only). Sections: summary, technical_risks, inspection, price, incidents, mileage, sources_comparison. Costs money - only when the operator asked for (re)generation.",
    input_schema: {
      type: "object",
      properties: {
        section: { type: "string", enum: [...COPILOT_GENERATE_SECTIONS] },
        operatorNotes: { type: "string", description: "Operator wishes for the text, in Latvian." },
      },
      required: ["section"],
      additionalProperties: false,
    },
  },
  {
    name: "check_pdf_before_send",
    description:
      "Check the client texts before the PDF goes to the client: empty fields, internal notes, units, «pirkt/nepirkt», «eksperts», long dashes, data vendor names, repair EUR amounts, oil interval note. Free, read-only. Includes proposals made in this message.",
    input_schema: EMPTY_SCHEMA,
  },
];

/* ------------------------------------------------------------------ */
/* read_source / list_missing_fields                                   */
/* ------------------------------------------------------------------ */

const READ_SOURCE_MAX_CHARS = 40_000;

export function readSourceForTool(blocks: WorkspaceSourceBlocks, key: string): { ok: boolean; text: string } {
  if (!(SOURCE_BLOCK_KEYS as readonly string[]).includes(key)) {
    return { ok: false, text: `Nezināms avots „${key}”.` };
  }
  const block = (blocks as Record<string, unknown>)[key];
  const json = JSON.stringify(block ?? null, null, 1);
  return {
    ok: true,
    text: json.length > READ_SOURCE_MAX_CHARS ? `${json.slice(0, READ_SOURCE_MAX_CHARS)}… (nogriezts)` : json,
  };
}

function blockHasData(block: unknown): boolean {
  if (!block || typeof block !== "object") return false;
  for (const [k, v] of Object.entries(block as Record<string, unknown>)) {
    if (k === "comments") continue;
    if (typeof v === "string" && v.trim()) return true;
    if (Array.isArray(v) && v.length > 0) return true;
  }
  return false;
}

export function listMissingFieldsForTool(opts: {
  blocks: WorkspaceSourceBlocks;
  audit: CopilotAuditValues;
  vin: string | null;
}): string {
  const lines: string[] = [];
  if (!opts.vin?.trim()) lines.push("VIN: nav");
  const csdd = (opts.blocks as Record<string, unknown>).csdd as Record<string, unknown> | undefined;
  if (csdd) {
    const empty = Object.entries(csdd)
      .filter(([, v]) => typeof v === "string" && !v.trim())
      .map(([k]) => k);
    if (empty.length) lines.push(`CSDD tukši lauki: ${empty.slice(0, 40).join(", ")}`);
  }
  const noComment: string[] = [];
  for (const key of SOURCE_BLOCK_KEYS) {
    const block = (opts.blocks as Record<string, unknown>)[key] as Record<string, unknown> | undefined;
    if (!block || typeof block.comments !== "string") continue;
    if (blockHasData(block) && !adminRichHtmlToPlainText(block.comments).trim()) noComment.push(key);
  }
  if (noComment.length) lines.push(`Avoti ar datiem, bet bez komentāra: ${noComment.join(", ")}`);
  const emptyAudit = COPILOT_AUDIT_FIELD_KEYS.filter((k) => !adminRichHtmlToPlainText(opts.audit[k]).trim()).map(
    (k) => `${COPILOT_AUDIT_FIELD_LABELS[k]} (${k})`,
  );
  if (emptyAudit.length) lines.push(`Tukši audita lauki: ${emptyAudit.join(", ")}`);
  return lines.length ? lines.join("\n") : "Nekas būtisks netrūkst.";
}

/* ------------------------------------------------------------------ */
/* propose_write validācija                                            */
/* ------------------------------------------------------------------ */

const FIELD_VALUE_MAX = 20_000;

export type FieldProposalResult = { ok: true; proposal: CopilotFieldProposal } | { ok: false; error: string };

export function validateFieldProposal(
  raw: Record<string, unknown>,
  ctx: { blocks: WorkspaceSourceBlocks; audit: CopilotAuditValues },
): FieldProposalResult {
  const kind = raw.kind;
  const field = typeof raw.field === "string" ? raw.field.trim() : "";
  const value = typeof raw.value === "string" ? raw.value.slice(0, FIELD_VALUE_MAX) : "";
  if (!field) return { ok: false, error: "Nav norādīts lauks." };
  if (COPILOT_SMART_FORBIDDEN_FIELDS.has(field)) {
    return { ok: false, error: "«Servisa vēsture» netiek mainīta." };
  }
  if (kind === "audit_field") {
    if (!isCopilotAuditFieldKey(field)) return { ok: false, error: `Nezināms audita lauks „${field}”.` };
    if (!value.trim()) return { ok: false, error: "Tukšu tekstu nepiedāvā - lauka iztīrīšanu dara operators." };
    return {
      ok: true,
      proposal: {
        kind: "audit_field",
        field,
        value,
        previous: ctx.audit[field] ?? "",
        label: COPILOT_AUDIT_FIELD_LABELS[field],
      },
    };
  }
  if (kind === "source_field") {
    const source = typeof raw.source === "string" ? raw.source.trim() : "";
    if (!(SOURCE_KEYS_WRITABLE as readonly string[]).includes(source)) {
      return { ok: false, error: `Avota bloku „${source}” šādi nemaina.` };
    }
    const block = (ctx.blocks as Record<string, unknown>)[source] as Record<string, unknown> | undefined;
    if (!block || typeof block[field] !== "string") {
      return { ok: false, error: `Blokā „${source}” nav teksta lauka „${field}” (skaties read_source).` };
    }
    if (source === "csdd" && csddFieldIsApiLocked(block as never, field)) {
      return { ok: false, error: `CSDD lauks „${field}” ir no CSDD API - to nemaina.` };
    }
    return {
      ok: true,
      proposal: {
        kind: "source_field",
        source: source as SourceBlockKey,
        field,
        value,
        previous: block[field] as string,
        label: `${source} · ${field}`,
      },
    };
  }
  return { ok: false, error: `Nezināms veids „${String(kind)}”.` };
}

/** Avota teksta lauki, kas ir klienta komentārs (pulē un pārveido par rich HTML). */
export function isClientCommentSourceField(field: string): boolean {
  return /^comments?$|Comment$/i.test(field);
}

/** Gudrais režīms nekad neaiztiek «Servisa vēsture». */
export function isSmartForbiddenAction(action: CopilotAction): boolean {
  if (action.type === "set_service_history") return true;
  if (action.type === "clear_field" && COPILOT_SMART_FORBIDDEN_FIELDS.has(action.field)) return true;
  return false;
}

/* ------------------------------------------------------------------ */
/* check_pdf_before_send                                               */
/* ------------------------------------------------------------------ */

const VENDOR_RE = /\b(AutoDNA|carVertical|CARFAX|OneAuto|Outvin|CheckCar|auto-records|LTAB|Autobid|Openlane)\b/i;
const VERDICT_RE = /\b(ne)?pirkt\b|\biesak\p{L}*\s+(ne)?pirkt|\bneiesak\p{L}*\s+pirkt/iu;
const EXPERT_RE = /\bekspert\p{L}*/iu;
const LONG_DASH_RE = /[—–]/u;
const EUR_RE = /\d[\d\s.,]*\s?(?:€|EUR\b|eiro)/iu;
const OIL_INTERVAL_RE = /eļļ\p{L}*[^.]{0,120}(intervāl|pārsniegt|nav main)/iu;
const OIL_NOTE_RE = /nenozīmē,?\s+ka\s+(eļļas\s+)?maiņa\s+nav\s+veikta/iu;

export function checkClientTextsBeforeSend(audit: CopilotAuditValues): string {
  const issues: string[] = [];
  const fields: ClientPrintedTextField[] = [];
  for (const key of COPILOT_CLIENT_AUDIT_FIELDS) {
    const text = adminRichHtmlToPlainText(audit[key]).trim();
    const label = COPILOT_AUDIT_FIELD_LABELS[key];
    if (!text) {
      issues.push(`${label}: tukšs`);
      continue;
    }
    fields.push({ label, text });
    if (VERDICT_RE.test(text)) issues.push(`${label}: «pirkt/nepirkt» slēdziens - PROVIN dod ieteikumus, klients lemj`);
    if (EXPERT_RE.test(text)) issues.push(`${label}: vārds «eksperts»`);
    if (LONG_DASH_RE.test(text)) issues.push(`${label}: garā domuzīme - lieto «-»`);
    const vendor = VENDOR_RE.exec(text);
    if (vendor) issues.push(`${label}: datu avota nosaukums «${vendor[0]}» klienta tekstā`);
    if ((key === "tehniskoRiskuAnalize" || key === "apskatesPlāns") && EUR_RE.test(text)) {
      issues.push(`${label}: EUR summa - remontu/detaļu summas atskaitē neraksta (pārbaudi)`);
    }
    if (OIL_INTERVAL_RE.test(text) && !OIL_NOTE_RE.test(text)) {
      issues.push(`${label}: eļļas intervāls bez piebildes «tas nenozīmē, ka maiņa nav veikta»`);
    }
  }
  for (const f of [...checkInternalNoteLeaks(fields), ...checkAiCommentLint(fields, { totalLossFound: false })]) {
    issues.push(f.message);
  }
  return issues.length
    ? `Atrasts (${issues.length}):\n${issues.map((i) => `- ${i}`).join("\n")}\nKartīšu un pretrunu pārbaude notiek PDF priekšskatījumā.`
    : "Teksta pārbaude: problēmu nav. Kartīšu un pretrunu pārbaude notiek PDF priekšskatījumā.";
}
