/**
 * Admin OFICIĀLĀ DĪLERA DATI: oriģināls pret LV, D-ID, DF/L brīdinājumi.
 * Tīra loģika, lai dīlera bloks paliktu neatkarīgs no audita UI ceļiem.
 */
import {
  checkMapAgainstDealerFacts,
  dealerComponentLv,
  extractDealerFactsFromServiceWorks,
  findTextContradictionsWithDealer,
  originalDealerWorksForRow,
  textMentionsDealerCampaigns,
  type DealerFact,
} from "@/lib/admin-ai-dealer-facts";
import type { TechnicalRiskMap } from "@/lib/admin-ai-technical-risk-map-types";
import type { AutoRecordsServiceWorkRow } from "@/lib/auto-records-service-works";
import { oneautoWorksNeedLvTranslation } from "@/lib/oneauto-dealer";

export { originalDealerWorksForRow };

function digits(raw: string): string {
  return (raw ?? "").replace(/\D/g, "");
}

export function dealerWorkRowNeedsLvTranslation(works: string): boolean {
  return oneautoWorksNeedLvTranslation(works);
}

/** Vai pirms šīs PDF ģenerācijas jātulko serviceWorks latviski. OEM / ASV - nē. */
export function shouldTranslateDealerWorksBeforePdf(opts: {
  oem?: boolean;
  dealerOnly?: boolean;
  asvOnly?: boolean;
  lang?: string | null;
}): boolean {
  if (opts.oem || opts.asvOnly) return false;
  if (opts.dealerOnly) {
    const lang = (opts.lang ?? "lv").trim().toLowerCase();
    return lang === "lv" || lang === "";
  }
  return true;
}

export function countUntranslatedDealerWorkRows(
  rows: readonly AutoRecordsServiceWorkRow[],
): number {
  return rows.filter((row) => dealerWorkRowNeedsLvTranslation(row.works ?? "")).length;
}

export function dealerFactForWorkRow(
  row: AutoRecordsServiceWorkRow,
  facts: { rows: DealerFact[] },
): DealerFact | null {
  const date = row.date.trim();
  const km = Number(digits(row.odometer));
  const hit = facts.rows.find((f) => {
    if (date && f.date !== date) return false;
    if (Number.isFinite(km) && km > 0 && f.odometerKm != null && f.odometerKm !== km) return false;
    return true;
  });
  return hit ?? null;
}

export type DealerAdminWarning = {
  id: string;
  message: string;
};

/**
 * DF1/DF2 no kartes un L14/L15 no tehnisko risku teksta.
 * Bez kartes / teksta dīlera bloks paliek tukšs: nav atkarības no audita.
 */
export function collectDealerAdminWarnings(args: {
  serviceWorks: readonly AutoRecordsServiceWorkRow[];
  techRiskText?: string | null;
  techRiskMap?: TechnicalRiskMap | null;
}): DealerAdminWarning[] {
  const facts = extractDealerFactsFromServiceWorks(args.serviceWorks);
  if (facts.rows.length === 0) return [];
  const out: DealerAdminWarning[] = [];
  for (const issue of checkMapAgainstDealerFacts(args.techRiskMap, facts)) {
    out.push({ id: issue.id, message: issue.message });
  }
  const text = (args.techRiskText ?? "").trim();
  if (text) {
    for (const hit of findTextContradictionsWithDealer(text, facts)) {
      out.push({
        id: "L14",
        message: `Pretruna ar oficiālā dīlera datiem: teksts prasa „${dealerComponentLv(hit.component)}” darbu, bet ${hit.fact.id} (${hit.fact.date}) tas jau fiksēts: „${hit.sentence.slice(0, 160)}”.`,
      });
    }
    if (!textMentionsDealerCampaigns(text, facts)) {
      out.push({
        id: "L15",
        message: "Dīlera datos ir kampaņa / servisa akcija, bet tekstā tā nav minēta (ID vai datums).",
      });
    }
  }
  return out;
}

export function dealerFactComponentLabels(fact: DealerFact | null): string[] {
  if (!fact) return [];
  return fact.components.map(dealerComponentLv);
}
