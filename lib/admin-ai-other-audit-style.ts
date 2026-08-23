/**
 * Citu PROVIN auditu atmiņa: tikai stils / vārdu krājums / agregāta pieredze.
 * Šī auto fakti nāk tikai no aktīvā pasūtījuma.
 */

/** Instance facts that belong to the OTHER car — drop the whole sentence. */
const OTHER_CAR_INSTANCE_FACT_RE =
  /aplīm|aizsargplēv|\bppf\b|plēv|vinila|[A-HJ-NPR-Z0-9]{17}|\b\d{1,3}(?:[\s.]\d{3})+\s*km\b|\b\d{4,7}\s*km\b|\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b|\b(?:€|EUR)\b|numura zīm[eē]\s+[A-Z]{2}|īpašniek[uā].{0,12}\d|zaudējumu apjom/i;

const OTHER_AUDIT_SECTION_HEADING_RE =
  /^### (?:Vēsturiskie PROVIN auditi|Citu PROVIN auditu stils|Mācījumi no iepriekšējām)/;

export const OTHER_AUDIT_STYLE_HEADING =
  "### Citu PROVIN auditu stils (NE šī auto fakti)";

export function isOtherAuditMemoryHeading(line: string): boolean {
  return OTHER_AUDIT_SECTION_HEADING_RE.test(line.trim());
}

export function dropOtherCarInstanceSentences(text: string): string {
  return (text ?? "")
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !OTHER_CAR_INSTANCE_FACT_RE.test(s))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeOtherAuditSnippet(text: string): string {
  const redacted = (text ?? "")
    .replace(/\b[A-HJ-NPR-Z0-9]{17}\b/gi, "[VIN]")
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "[e-pasts]")
    .replace(/(\+371\s?)?2[\d\s-]{6,12}/g, "[tālrunis]")
    .replace(/\bcs_[a-zA-Z0-9]+\b/g, "[pasūtījums]");
  return dropOtherCarInstanceSentences(redacted);
}

function normalizeWords(text: string): string[] {
  return (text ?? "")
    .toLowerCase()
    .replace(/[“”„"«»]/g, "")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

function ngrams(words: string[], n: number): Set<string> {
  const out = new Set<string>();
  if (words.length < n) return out;
  for (let i = 0; i <= words.length - n; i += 1) {
    out.add(words.slice(i, i + n).join(" "));
  }
  return out;
}

/** Citu auto / mācību bloki no user prompta — ne stila korpuss (tur ir tikai valoda). */
export function extractOtherAuditMemoryFromPrompt(prompt: string): string {
  return (prompt ?? "")
    .split(/(?=^### )/m)
    .filter((block) => isOtherAuditMemoryHeading(block))
    .join("\n");
}

const COPY_NGRAM = 8;

/**
 * 8 vārdu virknes, kas ir citu auditu atmiņā un izejā, bet nav šī pasūtījuma datos.
 */
export function findCopiedOtherAuditPhrases(
  generated: string,
  sourcePrompt: string,
  orderFactsText: string,
): string[] {
  const memory = extractOtherAuditMemoryFromPrompt(sourcePrompt);
  if (!memory.trim()) return [];
  const gen = ngrams(normalizeWords(generated), COPY_NGRAM);
  const mem = ngrams(normalizeWords(memory), COPY_NGRAM);
  const facts = ngrams(normalizeWords(orderFactsText), COPY_NGRAM);
  const leaks: string[] = [];
  for (const g of gen) {
    if (mem.has(g) && !facts.has(g)) leaks.push(g);
    if (leaks.length >= 4) break;
  }
  return leaks;
}
