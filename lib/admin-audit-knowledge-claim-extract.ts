/**
 * Mācību teikumi v2: viens apgalvojums (agregāts + mezgls + km josla), bez EUR.
 * Lētais modelis ir opcija; noklusējums ir deterministiska ekstrakcija (backfill bez LLM).
 */
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { dropEurSentences, redactLearningText, sentenceHasEur } from "@/lib/admin-audit-learning-extract";
import { sanitizeOtherAuditSnippet } from "@/lib/admin-ai-other-audit-style";
import type { KnowledgeHorizon, KnowledgeItem } from "@/lib/admin-audit-knowledge-items-types";
import { newKnowledgeItemId } from "@/lib/admin-audit-knowledge-items-types";

const NODE_HINT_RE =
  /ķēd|zobsiksn|kārba|turbo|EGR|DPF|mehatron|injektor|iesmidzin|hidrotransform|sūkn|termostat|sadales|piekar|rūs|AdBlue|elektroplāksn|divmasu|spararat|reduktor|sajūg|bloka|dzesēt|šāl|klaņ|gultn/i;
const NEXT_100K_RE = /nākamaj|nākamie|100\s*000\s*km|turpmāk/i;

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 24);
}

export function parseKmBand(text: string): [number, number] | undefined {
  const range = text.match(/(\d{2,3})\s*000\s*[-\u2013\u2014]\s*(\d{2,3})\s*000/);
  if (range) {
    const a = Number.parseInt(range[1]!, 10) * 1000;
    const b = Number.parseInt(range[2]!, 10) * 1000;
    if (a > 0 && b > a) return [a, b];
  }
  const over = text.match(/(?:virs|pārsniedz|pie)\s*~?\s*(\d{2,3}(?:\s*\d{3})?|\d{4,6})\s*km/i);
  if (over) {
    const n = Number.parseInt(over[1]!.replace(/\s/g, ""), 10);
    if (n >= 10_000) return [n, n + 100_000];
  }
  return undefined;
}

export function inferHorizon(text: string): KnowledgeHorizon {
  return NEXT_100K_RE.test(text) ? "next100k" : "now";
}

export type ExtractedClaim = {
  claim: string;
  kmBand?: [number, number];
  horizon: KnowledgeHorizon;
};

export function extractClaimsFromPlain(plain: string, aggregate: string): ExtractedClaim[] {
  const cleaned = sanitizeOtherAuditSnippet(redactLearningText(dropEurSentences(plain)));
  if (cleaned.length < 70) return [];
  const paras = plain
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 50 && !sentenceHasEur(p));
  const pool = paras.length > 0 ? paras : splitSentences(cleaned);
  const out: ExtractedClaim[] = [];
  const seen = new Set<string>();
  for (const raw of pool) {
    const noEur = dropEurSentences(raw);
    if (noEur.length < 40) continue;
    if (!NODE_HINT_RE.test(noEur) && paras.length > 0) continue;
    const sentences = splitSentences(noEur);
    const pick = (sentences[0] ?? noEur).trim();
    if (pick.length < 40 || sentenceHasEur(pick)) continue;
    const claim = sanitizeOtherAuditSnippet(
      redactLearningText(`${aggregate}: ${pick.replace(/^\[.*?\]\s*/, "")}`),
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 320);
    const key = claim.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      claim,
      kmBand: parseKmBand(pick),
      horizon: inferHorizon(`${raw} ${pick}`),
    });
    if (out.length >= 8) break;
  }
  return out;
}

export function distillLessonWithoutEur(plain: string, tag: string, max = 360): string | null {
  const cleaned = dropEurSentences(plain.replace(/\s+/g, " ").trim());
  if (cleaned.length < 70) return null;
  if (tag === "Tehnika") {
    const paras = plain
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter((p) => p.length > 80 && !sentenceHasEur(p));
    const scored = paras.filter((p) =>
      /risks|ķēd|kārba|turbo|EGR|DPF|piekar|zobsiksn|elektroplāksn|dzesētāj|iesmidzin|hidrotransform|722\.|OM\d|N47|N57|M57|EA888|šāl|klaņ/i.test(
        p,
      ),
    );
    const pick = (scored.length > 0 ? scored : paras).slice(0, 3).join(" ");
    if (pick.length < 70) return null;
    const body = sanitizeOtherAuditSnippet(redactLearningText(`[${tag}] ${pick}`)).slice(0, max);
    return body.length >= 70 ? body : null;
  }
  const sentences = splitSentences(cleaned).slice(0, 2).join(" ");
  const body = sanitizeOtherAuditSnippet(redactLearningText(`[${tag}] ${sentences || cleaned}`)).slice(0, max);
  return body.length >= 70 ? body : null;
}

export function claimsToCandidateItems(input: {
  aggregate: string;
  claims: ExtractedClaim[];
  sessionId: string;
  now?: string;
}): KnowledgeItem[] {
  const now = input.now ?? new Date().toISOString();
  return input.claims.map((c) => ({
    id: newKnowledgeItemId(),
    aggregate: input.aggregate,
    claim: c.claim,
    ...(c.kmBand ? { kmBand: c.kmBand } : {}),
    horizon: c.horizon,
    status: "candidate" as const,
    sources: [{ type: "report" as const, ref: input.sessionId }],
    fromOrders: [input.sessionId],
    seenCount: 1,
    createdAt: now,
    updatedAt: now,
    history: [{ at: now, action: "create" as const, claim: c.claim }],
  }));
}

export function plainFromHtml(html: string | undefined): string {
  return adminRichHtmlToPlainText(html ?? "").trim();
}

const STOP = new Set([
  "un",
  "ir",
  "ar",
  "no",
  "uz",
  "kas",
  "šis",
  "šim",
  "var",
  "pie",
  "ja",
  "ka",
  "to",
  "tas",
  "nav",
  "tad",
  "vai",
]);

export function claimTokenSet(claim: string): Set<string> {
  return new Set(
    claim
      .toLowerCase()
      .replace(/[^a-zāčēģīķļņšūž0-9]+/gi, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 4 && !STOP.has(t)),
  );
}

export function claimsConflict(a: string, b: string): boolean {
  const ta = claimTokenSet(a);
  const tb = claimTokenSet(b);
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap += 1;
  if (overlap < 3) return false;
  const negA = /\bnav\b/i.test(a);
  const negB = /\bnav\b/i.test(b);
  return negA !== negB;
}

export function findConflictClaim(candidate: string, approved: string[]): string | null {
  for (const a of approved) {
    if (claimsConflict(candidate, a)) return a;
  }
  return null;
}
