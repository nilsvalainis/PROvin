/**
 * Pirms-publicēšanas faktu pārbaude AI komentāriem (deterministiska, bez maksas).
 * NEKAD nemaina tekstu: atgriež karodziņus adminam (E = pretruna ar verificētu faktu,
 * W = neavotots konkrēts apgalvojums vai strīdīgs fakts).
 */
import { UNIT_FACTS } from "@/lib/unit-facts/facts";
import type {
  FactCheckFlag,
  FactCheckInput,
  FactCheckResult,
  UnitFact,
} from "@/lib/unit-facts/types";

const reCache = new Map<string, RegExp>();
/** `\\b` JS regex ir ASCII: „DETA” sakristu ar „detaļu”. Aizstāj ar Unicode vārda robežu. */
const UNICODE_WORD_BOUNDARY = "(?:(?<![\\p{L}\\p{N}_])(?=[\\p{L}\\p{N}_])|(?<=[\\p{L}\\p{N}_])(?![\\p{L}\\p{N}_]))";
function re(src: string): RegExp {
  let r = reCache.get(src);
  if (!r) {
    r = new RegExp(src.split("\\b").join(UNICODE_WORD_BOUNDARY), "iu");
    reCache.set(src, r);
  }
  return r;
}
const anyMatch = (srcs: readonly string[] | undefined, text: string): boolean =>
  !!srcs && srcs.some((s) => re(s).test(text));

/** Teikumi: punkts/!/? + atstarpe vai jauna rinda. „724.0” un „A12/00346/20” netiek dalīti. */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/(?<=[.!?])\s+(?=[A-ZĀČĒĢĪĶĻŅŠŪŽ0-9„"(])|\n+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function yearFrom(input: FactCheckInput): number | null {
  if (typeof input.year === "number" && input.year > 1980) return input.year;
  const m = (input.vehicleLabel ?? "").match(/\b(19[89]\d|20[0-4]\d)\b/);
  return m ? Number(m[1]) : null;
}

export function factAppliesToVehicle(fact: UnitFact, vehicleText: string, year: number | null): boolean {
  const a = fact.appliesTo;
  if (!anyMatch(a.anyOf, vehicleText)) return false;
  if (a.andAnyOf && !anyMatch(a.andAnyOf, vehicleText)) return false;
  if (a.noneOf && anyMatch(a.noneOf, vehicleText)) return false;
  if (a.years && year != null && (year < a.years[0] || year > a.years[1])) return false;
  return true;
}

// ── Atsaukumu / kampaņu kodi ─────────────────────────────────────────────────────────
const CAMPAIGN_WORD_RE = /kampaņ|atsauk|recall|rückruf|aktion|campaign|tilbagekald|servisa\s+akcij|safety\s+gate/iu;
const CAMPAIGN_CODE_RES: RegExp[] = [
  /\bA12\/\d{5}\/\d{2}\b/g, // EU Safety Gate
  /\b\d{2}V-?\d{3}\b/g, // NHTSA
  /\b(?=[0-9A-Z]{4}\b)(?=[0-9A-Z]*\d)(?=[0-9A-Z]*[A-Z])\d{2}[0-9A-Z]{2}\b/g, // VW/Audi/Škoda 48VS, 23R7, 93P7
  /\b\d{7}\b/g, // MB kampaņas kods (9190204)
];

/** Kodi, kas tekstā stāv ≤80 rakstzīmju attālumā no kampaņas/atsaukuma vārda. */
export function extractCampaignCodes(text: string): string[] {
  const out = new Set<string>();
  for (const r of CAMPAIGN_CODE_RES) {
    r.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = r.exec(text))) {
      const win = text.slice(Math.max(0, m.index - 80), m.index + m[0].length + 80);
      if (CAMPAIGN_WORD_RE.test(win)) out.add(m[0].toUpperCase());
    }
  }
  return [...out];
}

const RECALL_SUBJECT_RE = /atsaukum|kampaņ|recall/iu;
const RECALL_DENIAL_RE =
  /\bnav\s+(atrast|fiksēt|reģistrēt|zinām)\w*|\bnetika\s+atrast|\bnav\s+(neviena|neviens)|\b(atsaukum|kampaņ)\w*\s+nav\b|\bnav\s+(aktīvu\s+)?(atsaukum|kampaņ)|\bnav\s*[.!]?$/iu;
const RECALL_DENIAL_EXCEPT_RE = /izpild|status|pēc\s+VIN|jāpārbauda|jānoskaidro|dīler/iu;

// ── Skaitļi ──────────────────────────────────────────────────────────────────────────
const KW_RE = /\b(\d{2,3})\s*kW\b/giu;
function kwValues(text: string): number[] {
  const out: number[] = [];
  KW_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = KW_RE.exec(text))) out.push(Number(m[1]));
  return out;
}

const INTERVAL_CTX_RE = /intervāl|ik\s+pēc|\bik\s+~?\d|\bkatr\w*\s+\d|maiņ\w*\s+ik/iu;
/** Teikumi, kas apraksta pasūtījuma datus (nevis apgalvo intervālu). */
const INTERVAL_DATA_RE = /fiksēt|dīlera\s+datos|pārsniegum|pēdēj\w*\s+(maiņ|apkop)|neparedz/iu;
const KM_NUM_RE = /\b(\d{1,3})(?:[\s\u00a0](\d{3})|\.(\d{3}))?\s*(km|tūkst)/giu;
function kmNumbers(sentence: string): number[] {
  const out: number[] = [];
  KM_NUM_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = KM_NUM_RE.exec(sentence))) {
    const head = Number(m[1]);
    const tail = m[2] ?? m[3];
    const n = tail ? head * 1000 + Number(tail) : m[4].toLowerCase().startsWith("tūkst") ? head * 1000 : head;
    if (n >= 5000) out.push(n);
  }
  return out;
}
function normalizedNumbers(text: string): Set<number> {
  const set = new Set<number>();
  for (const n of kmNumbers(text)) set.add(n);
  return set;
}

function flagKey(f: FactCheckFlag): string {
  return `${f.id}|${f.factId ?? ""}|${f.sentence}`;
}

export function checkAiCommentFacts(
  input: FactCheckInput,
  facts: readonly UnitFact[] = UNIT_FACTS,
  now: Date = new Date(),
): FactCheckResult {
  const text = input.text ?? "";
  const contextText = input.contextText ?? "";
  const vehicleText = `${input.vehicleLabel ?? ""}\n${contextText}`;
  const year = yearFrom(input);
  const sentences = splitSentences(text);
  const flags: FactCheckFlag[] = [];
  const seen = new Set<string>();
  const push = (f: FactCheckFlag) => {
    const k = flagKey(f);
    if (seen.has(k)) return;
    seen.add(k);
    flags.push(f);
  };

  const applied = facts.filter((f) => factAppliesToVehicle(f, vehicleText, year));
  const enforced = applied.filter((f) => f.status === "verified");
  const disputed = applied.filter((f) => f.status === "disputed");

  // 1) Pretrunas ar verificētiem faktiem.
  for (const fact of enforced) {
    for (const c of fact.contradictions ?? []) {
      for (const s of sentences) {
        if (!anyMatch(c.subject, s)) continue;
        if (!anyMatch(c.contradicts, s)) continue;
        if (c.unless && anyMatch(c.unless, s)) continue;
        push({
          id: `fact:${fact.id}`,
          level: c.level ?? "E",
          kind: "contradiction",
          message: `${c.message} Fakts: ${fact.statementLv}`,
          sentence: s,
          factId: fact.id,
          sources: fact.sources,
        });
      }
    }
  }

  // 2) Strīdīgi fakti: tikai brīdinājums.
  for (const fact of disputed) {
    for (const s of sentences) {
      if (!anyMatch(fact.touches, s)) continue;
      push({
        id: `disputed:${fact.id}`,
        level: "W",
        kind: "disputed",
        message: `Strīdīgs fakts faktu bāzē, pārbaudi manuāli: ${fact.statementLv}`,
        sentence: s,
        factId: fact.id,
        sources: fact.sources,
      });
    }
  }

  // 3) „Atsaukumu nav”, lai gan pasūtījuma datos ir kampaņas kods.
  const contextCodes = extractCampaignCodes(contextText);
  const textUpper = text.toUpperCase();
  const mentionedContextCode = contextCodes.some((c) => textUpper.includes(c));
  if (contextCodes.length > 0 && !mentionedContextCode) {
    for (const s of sentences) {
      if (!RECALL_SUBJECT_RE.test(s) || !RECALL_DENIAL_RE.test(s) || RECALL_DENIAL_EXCEPT_RE.test(s)) continue;
      push({
        id: "recall_denied",
        level: "E",
        kind: "recall_denied",
        message: `Teksts saka, ka atsaukumu/kampaņu nav, bet pasūtījuma datos ir: ${contextCodes.join(", ")}.`,
        sentence: s,
      });
    }
  }

  // 4) Kampaņu kodi tekstā, kuru nav ne datos, ne faktu bāzē.
  const knownCodes = new Set<string>(contextCodes);
  for (const f of facts) for (const c of f.codes) knownCodes.add(c.toUpperCase());
  for (const code of extractCampaignCodes(text)) {
    if (knownCodes.has(code) || contextText.toUpperCase().includes(code)) continue;
    const s = sentences.find((x) => x.toUpperCase().includes(code)) ?? code;
    push({
      id: "unsourced_campaign_code",
      level: "W",
      kind: "unsourced",
      message: `Kampaņas/atsaukuma kods ${code} nav atrasts pasūtījuma datos vai faktu bāzē — pārbaudi avotu.`,
      sentence: s,
    });
  }

  // 5) Jauda kW, kas neatbilst pasūtījuma datiem (CSDD/dīleris/sludinājums).
  const ctxKw = kwValues(contextText);
  const factKw = applied.flatMap((f) => kwValues(f.statementLv));
  if (ctxKw.length > 0) {
    for (const s of sentences) {
      for (const kw of kwValues(s)) {
        const ok = [...ctxKw, ...factKw].some((v) => Math.abs(v - kw) <= 1);
        if (ok) continue;
        push({
          id: "unsourced_power_kw",
          level: "W",
          kind: "unsourced",
          message: `Jauda ${kw} kW nav pasūtījuma datos (tur: ${[...new Set(ctxKw)].join(", ")} kW). Pārbaudi, vai runa ir par šo auto.`,
          sentence: s,
        });
      }
    }
  }

  // 6) Konkrēti apkopes intervāli bez avota (nav datos un nav faktu bāzē).
  const ctxNums = normalizedNumbers(contextText);
  const factNums = new Set<number>(applied.flatMap((f) => kmNumbers(f.statementLv)));
  for (const s of sentences) {
    if (!INTERVAL_CTX_RE.test(s) || INTERVAL_DATA_RE.test(s)) continue;
    const nums = kmNumbers(s);
    const unknown = nums.filter((n) => !ctxNums.has(n) && !factNums.has(n));
    if (unknown.length === 0) continue;
    push({
      id: "unsourced_interval",
      level: "W",
      kind: "unsourced",
      message: `Intervāls ${unknown.map((n) => n.toLocaleString("lv-LV")).join(", ")} km nav ne pasūtījuma datos, ne faktu bāzē — vajag avotu.`,
      sentence: s,
    });
  }

  flags.sort((a, b) => (a.level === b.level ? 0 : a.level === "E" ? -1 : 1));
  return {
    flags,
    appliedFactIds: applied.map((f) => f.id),
    checkedAt: now.toISOString(),
  };
}

/** Verificētie fakti, kas attiecas uz auto — ievadei ģenerēšanas promptā (novēršana, ne tikai pārbaude). */
export function formatApplicableUnitFactsForPrompt(
  input: Pick<FactCheckInput, "contextText" | "vehicleLabel" | "year">,
  facts: readonly UnitFact[] = UNIT_FACTS,
): string {
  const vehicleText = `${input.vehicleLabel ?? ""}\n${input.contextText ?? ""}`;
  const year = yearFrom({ text: "", ...input });
  const hits = facts.filter((f) => f.status === "verified" && factAppliesToVehicle(f, vehicleText, year));
  if (hits.length === 0) return "";
  const lines = hits.map((f) => `- ${f.statementLv}`);
  return `PROVIN AGREGĀTU FAKTI (verificēti, ar avotiem; nedrīkst būt pretrunā):\n${lines.join("\n")}`;
}
