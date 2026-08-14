/**
 * Lēta (bez LLM) promocijas kandidātu ģenerēšana no mācījumu indeksa.
 * Dārgais aģents lasa tikai šo kompaktu MD — nevis pilnus pasūtījumus.
 */
import type { AuditAggregateLearningEntry } from "@/lib/admin-audit-learnings-types";

export type KnowledgePromotionCandidate = {
  key: string;
  label: string;
  snippetCount: number;
  /** Max 3 — tokenu budžets Claude pārskatam. */
  topSnippets: string[];
};

const STOP = new Set(
  "un ar no ka kas par pie pēc nav ir vai kā to šis šī kā arī bet ja tad no uz līdz kamēr".split(" "),
);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .split(/[^a-zāčēģīķļņōŗšūž0-9.]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !STOP.has(t));
}

/** Atkārtojošies termini starp snippetiem — signāls jaunam case-pack punktam. */
export function extractRecurringTerms(snippets: string[], minHits = 2): string[] {
  const counts = new Map<string, number>();
  for (const sn of snippets) {
    const seen = new Set(tokenize(sn));
    for (const t of seen) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= minHits)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "lv"))
    .slice(0, 12)
    .map(([t]) => t);
}

export function buildPromotionCandidates(
  entries: AuditAggregateLearningEntry[],
  opts?: { minSnippets?: number; maxCandidates?: number },
): KnowledgePromotionCandidate[] {
  const minSnippets = opts?.minSnippets ?? 3;
  const maxCandidates = opts?.maxCandidates ?? 24;
  return entries
    .filter((e) => e.snippets.length >= minSnippets)
    .sort((a, b) => b.snippets.length - a.snippets.length || a.key.localeCompare(b.key))
    .slice(0, maxCandidates)
    .map((e) => ({
      key: e.key,
      label: e.label,
      snippetCount: e.snippets.length,
      topSnippets: e.snippets.slice(-3),
    }));
}

/** Kompakts MD Claude / cilvēkam — tipiski < 8–12k rakstzīmes. */
export function formatPromotionCandidatesMarkdown(
  candidates: KnowledgePromotionCandidate[],
  meta?: { generatedAt?: string; sourceEntryCount?: number },
): string {
  const generatedAt = meta?.generatedAt ?? new Date().toISOString();
  const lines: string[] = [
    "# PROVIN audit knowledge — promotion candidates",
    "",
    `Generated: ${generatedAt}`,
    `Source keys with enough snippets: ${meta?.sourceEntryCount ?? candidates.length}`,
    "",
    "Token rule: review **only this file**. Do not dump full order drafts into Claude.",
    "Promote durable patterns into `provin-admin-prompt-engineering/reference.md` + `lib/provin-aggregate-case-rules.ts`, then sync `lib/admin-ai-prompts.ts`.",
    "Never copy VIN, km, dates, EUR, client IDs from snippets into skills.",
    "",
  ];

  if (candidates.length === 0) {
    lines.push("_No candidates yet — run backfill after rich audits exist._");
    return `${lines.join("\n")}\n`;
  }

  for (const c of candidates) {
    const terms = extractRecurringTerms(c.topSnippets, 2);
    lines.push(`## ${c.label}`);
    lines.push(`- key: \`${c.key}\``);
    lines.push(`- snippets: ${c.snippetCount}`);
    if (terms.length) lines.push(`- recurring terms: ${terms.join(", ")}`);
    lines.push("- distill:");
    for (const s of c.topSnippets) {
      lines.push(`  - ${s}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

/** Cieta robeža — ja MD pārāk garš, saīsina kandidātus. */
export function clipPromotionMarkdown(md: string, maxChars = 12_000): string {
  if (md.length <= maxChars) return md;
  return `${md.slice(0, maxChars - 40).trim()}\n\n…[truncated for token budget]\n`;
}
