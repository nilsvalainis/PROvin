/**
 * A/B harness: vecais vs v2 teksts. Nelasa un neraksta pasūtījumu melnrakstus,
 * ja vien CLI nav devis sessionId (tad tikai lasa).
 */
import { lintTechnicalRiskText } from "@/lib/admin-ai-technical-risk-lint";
import type { TechnicalRiskMap } from "@/lib/admin-ai-technical-risk-map-types";
import {
  checkMapAgainstDealerFacts,
  findTextContradictionsWithDealer,
  textMentionsDealerCampaigns,
  type DealerFacts,
} from "@/lib/admin-ai-dealer-facts";

export type TechRiskAbSlot = {
  slot: number;
  id: string;
  label: string;
  old?: string;
  new?: string;
  map?: TechnicalRiskMap | null;
  /** OneAuto dīlera fakti šim pasūtījumam (dealer-consistency metrika). */
  dealerFacts?: DealerFacts | null;
};

export type TechRiskAbDealerConsistency = {
  dealerRows: number;
  contradictionsOld: number;
  contradictionsNew: number;
  mapIssuesNew: number;
  campaignsMentionedNew: boolean;
};

export type TechRiskAbSectionScore = {
  heading: string;
  editDistance: number;
  correctionsNeeded: number;
};

export type TechRiskAbPairScore = {
  slot: number;
  id: string;
  label: string;
  lintErrorsOld: number;
  lintErrorsNew: number;
  lintWarningsNew: number;
  editDistance: number;
  correctionsNeeded: number;
  sections: TechRiskAbSectionScore[];
  dealer: TechRiskAbDealerConsistency;
  blinded: { left: string; right: string; newIs: "left" | "right" };
  iriss: { techAccuracy: null; latvian: null };
};

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const max = 8_000;
  const s = a.length > max ? a.slice(0, max) : a;
  const t = b.length > max ? b.slice(0, max) : b;
  const m = s.length;
  const n = t.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const si = s.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = si === t.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min((prev[j] ?? 0) + 1, (curr[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[n] ?? 0;
}

export function splitTechRiskSections(text: string): Array<{ heading: string; body: string }> {
  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks.map((block) => {
    const nl = block.indexOf("\n");
    if (nl < 0) return { heading: block.slice(0, 80), body: block };
    return { heading: block.slice(0, nl).trim() || block.slice(0, 80), body: block };
  });
}

function seedFromLabel(label: string, slot: number): number {
  let h = slot + 1;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return h;
}

export function scoreTechRiskAbPair(slot: TechRiskAbSlot): TechRiskAbPairScore {
  const oldText = slot.old ?? "";
  const newText = slot.new ?? "";
  const facts = slot.dealerFacts ?? null;
  const oldLint = lintTechnicalRiskText({ text: oldText, map: slot.map ?? null, dealerFacts: facts });
  const newLint = lintTechnicalRiskText({ text: newText, map: slot.map ?? null, dealerFacts: facts });
  const dealer: TechRiskAbDealerConsistency = {
    dealerRows: facts?.rows.length ?? 0,
    contradictionsOld: facts ? findTextContradictionsWithDealer(oldText, facts).length : 0,
    contradictionsNew: facts ? findTextContradictionsWithDealer(newText, facts).length : 0,
    mapIssuesNew: facts ? checkMapAgainstDealerFacts(slot.map ?? null, facts).length : 0,
    campaignsMentionedNew: facts ? textMentionsDealerCampaigns(newText, facts) : true,
  };
  const oldSecs = splitTechRiskSections(oldText);
  const newSecs = splitTechRiskSections(newText);
  const max = Math.max(oldSecs.length, newSecs.length);
  const sections: TechRiskAbSectionScore[] = [];
  let sectionCorrections = 0;
  for (let i = 0; i < max; i++) {
    const a = oldSecs[i]?.body ?? "";
    const b = newSecs[i]?.body ?? "";
    const d = levenshtein(a, b);
    const heading = newSecs[i]?.heading || oldSecs[i]?.heading || `sadaļa ${i + 1}`;
    const correctionsNeeded = a && b && d > Math.max(12, Math.floor(a.length * 0.08)) ? 1 : a && !b ? 1 : 0;
    sectionCorrections += correctionsNeeded;
    sections.push({ heading, editDistance: d, correctionsNeeded });
  }
  const newIs: "left" | "right" = seedFromLabel(slot.label, slot.slot) % 2 === 0 ? "left" : "right";
  return {
    slot: slot.slot,
    id: slot.id,
    label: slot.label,
    lintErrorsOld: oldLint.errors.length,
    lintErrorsNew: newLint.errors.length,
    lintWarningsNew: newLint.warnings.length,
    editDistance: levenshtein(oldText, newText),
    correctionsNeeded: newLint.errors.length + newLint.warnings.length + sectionCorrections,
    sections,
    dealer,
    blinded: {
      left: newIs === "left" ? newText : oldText,
      right: newIs === "right" ? newText : oldText,
      newIs,
    },
    iriss: { techAccuracy: null, latvian: null },
  };
}

export function scoreTechRiskAbHarness(slots: TechRiskAbSlot[]): {
  pairs: TechRiskAbPairScore[];
  summary: {
    slots: number;
    withBothTexts: number;
    meanEditDistance: number;
    meanCorrectionsNeeded: number;
    lintErrorsNew: number;
    slotsWithDealerData: number;
    dealerContradictionsOld: number;
    dealerContradictionsNew: number;
  };
} {
  const pairs = slots.map(scoreTechRiskAbPair);
  const both = pairs.filter((_, i) => (slots[i]?.old || slots[i]?.new) && slots[i]?.old && slots[i]?.new);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return {
    pairs,
    summary: {
      slots: slots.length,
      withBothTexts: both.length,
      meanEditDistance: Math.round(mean(both.map((p) => p.editDistance))),
      meanCorrectionsNeeded: Number(mean(both.map((p) => p.correctionsNeeded)).toFixed(2)),
      lintErrorsNew: pairs.reduce((n, p) => n + p.lintErrorsNew, 0),
      slotsWithDealerData: pairs.filter((p) => p.dealer.dealerRows > 0).length,
      dealerContradictionsOld: pairs.reduce((n, p) => n + p.dealer.contradictionsOld, 0),
      dealerContradictionsNew: pairs.reduce((n, p) => n + p.dealer.contradictionsNew, 0),
    },
  };
}
