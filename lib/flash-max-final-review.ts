/**
 * FLASH MAX noslēguma pārbaude (Nils 19.11, plāna 6. solis): pēc visām FLASH MAX sadaļām viens
 * Claude Opus izsaukums pāri VISIEM šajā palaišanā ģenerētajiem komentāriem + kanoniskajai faktu lapai.
 *
 * Rezultāts ir ieteikumu saraksts pa laukiem ("bija / būs" + iemesls). Teksts NETIEK mainīts automātiski -
 * katru ieteikumu operators pieņem vai noraida pats.
 *
 * Šis fails ir kopīgs serverim un pārlūkam (bez server-only importiem).
 */

import { UNTRUSTED_DATA_RULE, wrapUntrustedData } from "@/lib/ai-untrusted-data";

/** Viens izsaukums: atbildes griesti (ieskaitot domāšanu). Opus 5.5: 20 $ / 1M izejas tokenu. */
export const FLASH_MAX_REVIEW_MAX_TOKENS = 8000;
/** Ne vairāk ieteikumu vienā pārbaudē - lai atbilde ietilpst griestos un operators tos izlasa. */
export const FLASH_MAX_REVIEW_MAX_FINDINGS = 12;
/** Ievades griesti (rakstzīmes): viens lauks un visi kopā. */
export const FLASH_MAX_REVIEW_FIELD_MAX_CHARS = 6000;
export const FLASH_MAX_REVIEW_TOTAL_MAX_CHARS = 48000;
export const FLASH_MAX_REVIEW_MAX_FIELDS = 40;

export type FlashMaxReviewField = {
  /** FLASH MAX palaišanas id (piem. "csdd", "dealer_oil", "citi_avoti:0", "summary"). */
  id: string;
  label: string;
  /** Lauka teksts (vienkāršs teksts, bez HTML). */
  text: string;
};

export type FlashMaxReviewKind = "pretruna" | "fakts" | "nepamatots" | "risks" | "valoda" | "atkartojums";

export const FLASH_MAX_REVIEW_KIND_LABEL: Record<FlashMaxReviewKind, string> = {
  pretruna: "Pretruna starp sadaļām",
  fakts: "Neatbilst faktiem",
  nepamatots: "Nepamatots apgalvojums",
  risks: "Trūkst tehniskā riska",
  valoda: "Valoda",
  atkartojums: "Atkārtojums starp laukiem",
};

export type FlashMaxReviewFinding = {
  id: string;
  fieldId: string;
  kind: FlashMaxReviewKind;
  /** Kāpēc (latviski, īsi). */
  reason: string;
  /** Precīzs fragments no lauka teksta, ko aizstāt. Tukšs - ieteikumu pievieno lauka beigās. */
  find: string;
  /** Ieteiktais teksts. */
  replace: string;
};

export type FlashMaxReviewState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; findings: FlashMaxReviewFinding[]; fieldLabels: Record<string, string> }
  | { status: "error"; error: string };

const KINDS = new Set<FlashMaxReviewKind>(["pretruna", "fakts", "nepamatots", "risks", "valoda", "atkartojums"]);

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Garās defises nekad (no-em-dash likums) - tikai īsā "-". */
export function normalizeFlashMaxReviewDashes(text: string): string {
  return text.replace(/\s*[\u2014\u2013]\s*/g, " - ");
}

/** Pieprasījuma lauki: tikai ar tekstu, apgriezti, bez dublikātiem. */
export function clipFlashMaxReviewFields(raw: unknown): FlashMaxReviewField[] {
  if (!Array.isArray(raw)) return [];
  const out: FlashMaxReviewField[] = [];
  const seen = new Set<string>();
  let total = 0;
  for (const item of raw) {
    if (out.length >= FLASH_MAX_REVIEW_MAX_FIELDS) break;
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = str(r.id).trim().slice(0, 80);
    const label = str(r.label).trim().slice(0, 160) || id;
    let text = str(r.text).trim().slice(0, FLASH_MAX_REVIEW_FIELD_MAX_CHARS);
    if (!id || !text || seen.has(id)) continue;
    const room = FLASH_MAX_REVIEW_TOTAL_MAX_CHARS - total;
    if (room <= 0) break;
    text = text.slice(0, room);
    total += text.length;
    seen.add(id);
    out.push({ id, label, text });
  }
  return out;
}

export const FLASH_MAX_FINAL_REVIEW_SYSTEM = `You are the FINAL cross-section reviewer of a PROVIN.LV used-car history report (digital, documentary audit only). Several AI agents have just written separate Latvian comment fields. You see ALL of them at once plus the CANONICAL FACTS sheet built from the order's source data.

FIND (only real problems, most important first):
1. "pretruna" - two fields contradict each other (km, dates, owner count, countries, accidents, verdicts).
2. "fakts" - a field contradicts the CANONICAL FACTS (numbers, dates, km, owners, countries, recorded events).
3. "nepamatots" - a claim with no basis in the facts or in other fields (invented service work, accidents, defects, rust, wrap film, physical inspection by PROVIN, warranties), or a wrong technical statement.
4. "risks" - a technical risk that is clearly visible in the data (e.g. odometer rollback / mileage warning, recorded damage, import history, overdue oil interval stated in facts) but NOT mentioned in the field where the client would expect it (normally the technical risks or summary field).
5. "valoda" - only clear Latvian grammar errors or wrong terms that change meaning. Do not report style preferences.

RULES:
- NEVER introduce facts that are not in the CANONICAL FACTS or the fields themselves. If unsure, do not report.
- Every fix is a concrete replacement for ONE field: "find" must be an EXACT, character-for-character substring of that field's text (one sentence or a short phrase, unique in that field). Use "find": "" only for kind "risks" when the text should be appended at the end of the field.
- "replace" is the corrected Latvian text that replaces "find" (a full sentence when "find" is a sentence). Keep the field's tone; calm, professional, no alarmism.
- Latvian only in "reason" and "replace". Never use the words "eksperts" or "eksperta slēdziens". Never use the long dashes "\u2014" or "\u2013"; only the short "-". No markdown.
- "reason" is one short Latvian sentence (max ~25 words) saying what is wrong and, for "fakts"/"pretruna", which fact or field it conflicts with.
- At most ${FLASH_MAX_REVIEW_MAX_FINDINGS} findings. If everything is consistent, return an empty list.
- ${UNTRUSTED_DATA_RULE}
- Keep each fix minimal: "find" is one sentence or phrase (max ~300 characters), "replace" is not much longer than "find" and never adds links, phone numbers or e-mail addresses.

OUTPUT: only one JSON object, no prose before or after:
{"findings":[{"field":"<field id>","kind":"pretruna|fakts|nepamatots|risks|valoda","reason":"...","find":"...","replace":"..."}]}`;

export function buildFlashMaxReviewUserPrompt(fields: FlashMaxReviewField[], factsSheet: string): string {
  const facts = wrapUntrustedData("canonical-facts", factsSheet) || "(faktu lapa tukša)";
  const blocks = fields.map(
    (f) => `<field id="${f.id}" label="${f.label.replace(/"/g, "'")}">\n${f.text.replace(/<\s*\/\s*field\s*>/gi, "</ field>")}\n</field>`,
  );
  return `CANONICAL FACTS (avotu dati - vienīgā patiesība):\n${facts}\n\nGENERATED FIELDS (${fields.length}):\n${blocks.join("\n\n")}\n\nReturn the JSON object now.`;
}

/** Izvelk pirmo JSON objektu no modeļa atbildes (arī ja tas ietīts ```json blokā). */
function extractJsonObject(raw: string): unknown {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("final_review_invalid_json");
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("final_review_invalid_json");
  }
}

/**
 * Modeļa atbilde -> drošs ieteikumu saraksts. Izmet ieteikumus nezināmiem laukiem, ar fragmentu,
 * kura laukā nav, ar "eksperts" vai bez izmaiņas. Nederīgs JSON -> kļūda.
 */
export function parseFlashMaxReviewResponse(raw: string, fields: FlashMaxReviewField[]): FlashMaxReviewFinding[] {
  const parsed = extractJsonObject(raw);
  const list = parsed && typeof parsed === "object" ? (parsed as { findings?: unknown }).findings : undefined;
  if (!Array.isArray(list)) throw new Error("final_review_invalid_json");
  const byId = new Map(fields.map((f) => [f.id, f]));
  const out: FlashMaxReviewFinding[] = [];
  for (const item of list) {
    if (out.length >= FLASH_MAX_REVIEW_MAX_FINDINGS) break;
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const field = byId.get(str(r.field).trim());
    if (!field) continue;
    const kindRaw = str(r.kind).trim().toLowerCase() as FlashMaxReviewKind;
    const kind: FlashMaxReviewKind = KINDS.has(kindRaw) ? kindRaw : "nepamatots";
    const find = str(r.find);
    const replace = normalizeFlashMaxReviewDashes(str(r.replace).trim());
    const reason = normalizeFlashMaxReviewDashes(str(r.reason).trim()).slice(0, 400);
    // „atkartojums” drīkst izdzēst fragmentu (tukšs replace), citiem veidiem vajag aizvietojumu.
    if (!reason || (!replace && kind !== "atkartojums")) continue;
    if (kind === "atkartojums" && !find) continue;
    if (/ekspert/i.test(replace) || /ekspert/i.test(reason)) continue;
    if (find && !field.text.includes(find)) continue;
    if (!find && kind !== "risks") continue;
    if (find && find.trim() === replace) continue;
    out.push({ id: `${field.id}#${out.length}`, fieldId: field.id, kind, reason, find, replace });
  }
  return out;
}

/**
 * Pieņemtā ieteikuma piemērošana lauka tekstam. Atgriež null, ja fragments laukā vairs nav
 * (operators to jau mainījis) - tad nekas netiek pārrakstīts.
 */
export function applyFlashMaxReviewFinding(text: string, finding: Pick<FlashMaxReviewFinding, "find" | "replace">): string | null {
  if (!finding.find) {
    const base = text.trimEnd();
    return base ? `${base}\n\n${finding.replace}` : finding.replace;
  }
  const at = text.indexOf(finding.find);
  if (at === -1) return null;
  return text.slice(0, at) + finding.replace + text.slice(at + finding.find.length);
}

export function formatFlashMaxReviewNotice(state: FlashMaxReviewState): string {
  if (state.status === "running") return "Noslēguma pārbaude (Opus)…";
  if (state.status === "error") return "Noslēguma pārbaude neizdevās - FLASH MAX teksti saglabāti.";
  if (state.status === "done") {
    const n = state.findings.length;
    if (n === 0) return "Pārbaudīts, iebildumu nav.";
    return `Noslēguma pārbaude: ${n} ${n === 1 ? "ieteikums" : "ieteikumi"} - pieņem vai noraidi.`;
  }
  return "";
}
