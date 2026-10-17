/**
 * Tehnisko risku v2: kompakts AVOTU FAKTU brīfs teksta solim (nevis viss pasūtījuma konteksts).
 * Teksta solis raksta no kartes; šie fakti ļauj pārbaudīt km, datumus un avotu secinājumus
 * bez ~70k tokenu konteksta atkārtošanas (cena ~1/5).
 */
import { SOURCE_BLOCK_KEYS, SOURCE_BLOCK_LABELS, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";

export const TECH_RISK_SOURCE_FACTS_PER_BLOCK = 1_500;
export const TECH_RISK_SOURCE_FACTS_TOTAL = 14_000;

function clip(t: string, n: number): string {
  const s = t.replace(/\s+\n/g, "\n").trim();
  return s.length > n ? `${s.slice(0, n).trimEnd()} …` : s;
}

export function buildTechRiskSourceFactsBrief(input: {
  vin?: string | null;
  notes?: string | null;
  mileageComment?: string | null;
  internalComment?: string | null;
  identificationBrief?: string;
  sourceBlocks: WorkspaceSourceBlocks;
}): string {
  const lines: string[] = ["AVOTU FAKTI (operatora apstiprinātie avotu komentāri; tikai pārbaudei, jaunus riskus no tiem neizdomā):"];
  if (input.vin?.trim()) lines.push(`VIN: ${input.vin.trim()}`);
  if (input.identificationBrief?.trim()) lines.push(clip(input.identificationBrief, 1_200));
  if (input.mileageComment?.trim()) lines.push(`Nobraukums: ${clip(input.mileageComment, 800)}`);
  if (input.internalComment?.trim()) lines.push(`Iekšējā piezīme: ${clip(input.internalComment, 600)}`);
  if (input.notes?.trim()) lines.push(`Klienta piezīmes: ${clip(input.notes, 400)}`);
  let total = lines.join("\n").length;
  const blocks = input.sourceBlocks as unknown as Record<string, { comments?: unknown } | undefined>;
  for (const key of SOURCE_BLOCK_KEYS) {
    const raw = blocks[key]?.comments;
    if (typeof raw !== "string" || !raw.trim()) continue;
    const line = `${SOURCE_BLOCK_LABELS[key]}: ${clip(raw, TECH_RISK_SOURCE_FACTS_PER_BLOCK)}`;
    if (total + line.length > TECH_RISK_SOURCE_FACTS_TOTAL) break;
    lines.push(line);
    total += line.length + 1;
  }
  return lines.length > 1 ? lines.join("\n") : "";
}
