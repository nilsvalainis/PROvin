/**
 * C11 - AI komentāru likumi pirms PDF (PRO audits 06.11, 19 atskaišu katalogs).
 * Opus pieslīpēšana pēc ģenerēšanas neievēro garuma/struktūras noteikumus, tāpēc
 * pārbaude ir deterministiska un notiek uz gala teksta, ko redzēs klients.
 * Katram laukam ne vairāk kā viens karodziņš par struktūru (bez trokšņa).
 */
import { ADMIN_SUMMARY_SECTION_RISK_HEADING, ADMIN_SUMMARY_SECTION_SUMMARY_HEADING } from "@/lib/admin-workspace-field-labels";
import { LENGTH_RULES_V2_SUMMARY, LENGTH_RULES_V2_TECHNICAL_RISKS, NEXT_100K_HEADING_RE } from "@/lib/ai-length-rules-v2";
import type { ClientPrintedTextField } from "@/lib/pre-pdf-internal-note-check";
import type { FactCheckFlag } from "@/lib/unit-facts/types";

export type AiLintContext = {
  /** Avotu datos ir pilnīgs zaudējums / norakstīšana (strukturēts trāpījums). */
  totalLossFound: boolean;
  /** Elektroauto - „Nākamajos 100 000 km” nav obligāts. */
  isBev?: boolean;
};

const ENGLISH_STAMP_RE = /\b(?:inspected|approved|checked|verified)\s+by\s+iriss\b/i;
const MILES_RE = /\d[\d\s.,]*\s?(?:mi|miles?|jūdz\p{L}*)(?![\p{L}\p{N}])/iu;
const USD_RE = /(?:\$\s?\d|\d[\d\s.,]*\s?(?:USD|\$))/u;
const EURO_PREFIX_RE = /€\s?\d/u;
const TOTAL_LOSS_MENTION_RE =
  /noraksti?t\p{L}*|norakstīšan\p{L}*|pilnīg\p{L}*\s+zaudējum\p{L}*|total\s+loss|bojāej\p{L}*|ekonomiski\s+neizdevīg\p{L}*/iu;

function lintFlag(id: string, message: string, label: string, quote: string): FactCheckFlag {
  return { id, kind: "contradiction", level: "E", message, sentence: `${label}: ${quote}` };
}

function firstMatchQuote(text: string, re: RegExp): string {
  const m = re.exec(text);
  if (!m) return "";
  const start = Math.max(0, m.index - 25);
  const end = Math.min(text.length, m.index + m[0].length + 25);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${end < text.length ? "…" : ""}`;
}

export function checkAiCommentLint(
  fields: readonly ClientPrintedTextField[] | null | undefined,
  ctx: AiLintContext,
): FactCheckFlag[] {
  const flags: FactCheckFlag[] = [];
  for (const f of fields ?? []) {
    const text = (f.text ?? "").trim();
    if (!text) continue;

    // Mērvienības un valūta - katrā klienta laukā.
    const unitIssues: string[] = [];
    if (MILES_RE.test(text)) unitIssues.push(`jūdzes („${firstMatchQuote(text, MILES_RE)}”) - pārrēķini km`);
    if (USD_RE.test(text)) unitIssues.push(`USD („${firstMatchQuote(text, USD_RE)}”) - norādi eiro`);
    if (EURO_PREFIX_RE.test(text)) unitIssues.push(`„€” pirms skaitļa („${firstMatchQuote(text, EURO_PREFIX_RE)}”) - raksti „8 390 €”`);
    if (unitIssues.length > 0) {
      flags.push(
        lintFlag("c11_units", `Laukā „${f.label}” mērvienības: ${unitIssues.join("; ")}.`, f.label, unitIssues[0]!),
      );
    }
    if (ENGLISH_STAMP_RE.test(text)) {
      const q = firstMatchQuote(text, ENGLISH_STAMP_RE);
      flags.push(lintFlag("c11_english_stamp", `Laukā „${f.label}” netulkots angļu teksts („${q}”).`, f.label, q));
    }

    if (f.label === ADMIN_SUMMARY_SECTION_SUMMARY_HEADING) {
      const issues: string[] = [];
      if (text.length > LENGTH_RULES_V2_SUMMARY.targetMax) {
        issues.push(`${text.length} rakstzīmes (limits ${LENGTH_RULES_V2_SUMMARY.targetMax})`);
      }
      if (!/mūsu\s+ieteikums/i.test(text)) issues.push("nav bloka „Mūsu ieteikums”");
      if (issues.length > 0) {
        flags.push(lintFlag("c11_summary_structure", `Kopsavilkums: ${issues.join("; ")}.`, f.label, issues[0]!));
      }
      if (ctx.totalLossFound && !TOTAL_LOSS_MENTION_RE.test(text)) {
        flags.push(
          lintFlag(
            "c11_summary_missing_total_loss",
            "Avotos ir norakstīšana / pilnīgs zaudējums, bet kopsavilkumā tas nav minēts - galvenajam karogam jābūt kopsavilkumā.",
            f.label,
            "norakstīšana nav minēta",
          ),
        );
      }
    }

    if (f.label === ADMIN_SUMMARY_SECTION_RISK_HEADING) {
      const issues: string[] = [];
      if (text.length > LENGTH_RULES_V2_TECHNICAL_RISKS.regenMax) {
        issues.push(
          `${text.length} rakstzīmes (mērķis ${LENGTH_RULES_V2_TECHNICAL_RISKS.targetMin}-${LENGTH_RULES_V2_TECHNICAL_RISKS.targetMax})`,
        );
      }
      if (!ctx.isBev && !NEXT_100K_HEADING_RE.test(text)) issues.push("nav sadaļas „Nākamajos 100 000 km”");
      if (issues.length > 0) {
        flags.push(lintFlag("c11_risks_structure", `Tehniskie riski: ${issues.join("; ")}.`, f.label, issues[0]!));
      }
    }
  }
  return flags;
}
