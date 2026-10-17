/**
 * Tehnisko risku v2: kompakts AVOTU FAKTU brīfs teksta solim (nevis viss pasūtījuma konteksts).
 * Teksta solis raksta no kartes; šie fakti ļauj pārbaudīt km, datumus un avotu secinājumus
 * bez ~70k tokenu konteksta atkārtošanas (cena ~1/5).
 *
 * Dīlera rindas šeit tikai latviski (worksLv / redigēti komentāri). Oriģināls paliek OEM PDF.
 */
import {
  buildDealerFactsLvSourceLines,
  extractDealerFacts,
  sanitizeDealerLanguageForSourceFacts,
  type DealerFacts,
} from "@/lib/admin-ai-dealer-facts";
import { SOURCE_BLOCK_KEYS, SOURCE_BLOCK_LABELS, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { stripUnauthorizedEuroAmounts } from "@/lib/source-summary-comment-format";

export const TECH_RISK_SOURCE_FACTS_PER_BLOCK = 1_500;
export const TECH_RISK_SOURCE_FACTS_TOTAL = 14_000;

function clip(t: string, n: number): string {
  const s = t.replace(/\s+\n/g, "\n").trim();
  return s.length > n ? `${s.slice(0, n).trimEnd()} …` : s;
}

function dealerFactsFromBlocks(sourceBlocks: WorkspaceSourceBlocks): DealerFacts {
  return extractDealerFacts({
    oneauto: sourceBlocks.oneauto,
    autoRecords: sourceBlocks.auto_records,
  });
}

function autoRecordsFactsLine(args: {
  comments: string;
  facts: DealerFacts;
}): string {
  const comments = sanitizeDealerLanguageForSourceFacts(args.comments, args.facts).trim();
  const rows = buildDealerFactsLvSourceLines(args.facts).trim();
  const parts = [comments, rows ? `Dīlera darbi (latviski):\n${rows}` : ""].filter(Boolean);
  return parts.join("\n");
}

export function buildTechRiskSourceFactsBrief(input: {
  vin?: string | null;
  notes?: string | null;
  mileageComment?: string | null;
  internalComment?: string | null;
  identificationBrief?: string;
  sourceBlocks: WorkspaceSourceBlocks;
  dealerFacts?: DealerFacts;
}): string {
  const facts = input.dealerFacts ?? dealerFactsFromBlocks(input.sourceBlocks);
  const lines: string[] = [
    "AVOTU FAKTI (operatora apstiprinātie avotu komentāri; tikai pārbaudei, jaunus riskus no tiem neizdomā):",
  ];
  if (input.vin?.trim()) lines.push(`VIN: ${input.vin.trim()}`);
  if (input.identificationBrief?.trim()) lines.push(clip(input.identificationBrief, 1_200));
  if (input.mileageComment?.trim()) lines.push(`Nobraukums: ${clip(input.mileageComment, 800)}`);
  if (input.internalComment?.trim()) {
    lines.push(
      `Iekšējā piezīme: ${clip(sanitizeDealerLanguageForSourceFacts(input.internalComment, facts), 600)}`,
    );
  }
  if (input.notes?.trim()) lines.push(`Klienta piezīmes: ${clip(input.notes, 400)}`);
  let total = lines.join("\n").length;
  const blocks = input.sourceBlocks as unknown as Record<string, { comments?: unknown } | undefined>;
  for (const key of SOURCE_BLOCK_KEYS) {
    const raw = typeof blocks[key]?.comments === "string" ? String(blocks[key]?.comments) : "";
    const body =
      key === "auto_records"
        ? autoRecordsFactsLine({ comments: raw, facts })
        : sanitizeDealerLanguageForSourceFacts(raw, facts);
    if (!body.trim()) continue;
    const line = `${SOURCE_BLOCK_LABELS[key]}: ${clip(body, TECH_RISK_SOURCE_FACTS_PER_BLOCK)}`;
    if (total + line.length > TECH_RISK_SOURCE_FACTS_TOTAL) break;
    lines.push(line);
    total += line.length + 1;
  }
  const brief = lines.length > 1 ? lines.join("\n") : "";
  return brief ? stripUnauthorizedEuroAmounts(brief) : "";
}
