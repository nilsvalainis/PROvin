/**
 * Garuma un formulējumu v2 (Kopsavilkums + Tehniskie riski).
 * Aktīvs tikai ja LENGTH_RULES_V2=1. Neaiztiet citu aģentu tehnisko risku validatorus.
 */
import { isLengthRulesV2Enabled } from "@/lib/feature-flags-v2";

export type LengthRuleIssue = { code: string; message: string };

export const LENGTH_RULES_V2_TECHNICAL_RISKS = {
  targetMin: 1200,
  targetMax: 2500,
  warnMin: 1000,
  regenMax: 3200,
  sectionsMin: 4,
  sectionsMax: 7,
} as const;

export const LENGTH_RULES_V2_SUMMARY = {
  targetMin: 500,
  targetMax: 900,
  regenMax: 900,
} as const;

export const AI_LENGTH_WORDING_RULES_V2 = `GARUMS UN FORMULĒJUMI (LENGTH_RULES_V2)
GARUMS
- Tehniskie riski: 1 200-2 500 rakstzīmes, 4-7 sadaļas. Katra sadaļa: virsraksts + 2-3 teikumi. Ja kāds mezgls neattiecas uz šo km posmu, to neraksti.
- Kopsavilkums: 500-900 rakstzīmes, divi bloki: "Fakti" (3-5 teikumi) un "Mūsu ieteikums" (2-3 teikumi).
- Cilvēki nelasa memuārus: katrs teikums dod jaunu faktu vai darbību.

SATURS (tehniskie riski)
1. Visas galvenās problēmas PAŠREIZĒJĀ nobraukumā: mezgli, kuru tipiskā km josla jau ir sasniegta vai pārsniegta un darbs datos nav fiksēts.
2. Nākamie ~100 000 km: 2-3 tipiskākās šī dzinēja/kārbas problēmas, kas parasti parādās šajā km logā (no KB next_100k_focus). Viena sadaļa "Nākamajos 100 000 km".
3. Ja darbs jau fiksēts servisā, to pasaki vienā teikumā, neliec kā risku.
4. Atsaukumi: viena rinda, ja atrasti vai "nav atrasti publiskajos avotos".

FORMULĒJUMI (konsultatīvi, mēs auto neesam redzējuši)
- Lieto: "iesakām", "ir vērts pārbaudīt", "pēc datiem", "šim dzinējam raksturīga", "var norādīt", "pirms darījuma ieteicams".
- Nelieto: "obligāti", "noteikti", "kritiski", "jāmaina", "netiek rekomendēts", "auto ir bojāts", "garantēti", "ļoti bīstams".
- Verdikts kopsavilkumā: "Pēc pieejamajiem datiem mūsu ieteikums būtu …", nevis "iegāde netiek rekomendēta".
- Nekad nerakstīt kā PROVIN būtu auto redzējis, braucis vai diagnosticējis.`;

export const G4_IMPERATIVE_RE =
  /\b(obligāt[aāiīeēm]?|noteikti|kritisk[aāiīs]?|netiek rekomendēt[aāuūs]?|jāmaina)\b/gi;

export const NEXT_100K_HEADING_RE = /nākamajos\s+100\s*000\s*km/i;

const BEV_FUEL_RE =
  /\b(BEV|elektroauto|elektrisk(?:ā|ais)?\s+piedziņ|battery electric|tīri elektrisk)\b/i;
const ICE_FUEL_RE =
  /\b(dīzeļ|diesel|benzīn|petrol|gasoline|ICE|iekšdedzes|TDI|TFSI|TSI|dci|HDI)\b/i;

export function isIceVehicleFromPrompt(prompt: string | undefined | null): boolean {
  const p = prompt ?? "";
  if (BEV_FUEL_RE.test(p) && !ICE_FUEL_RE.test(p)) return false;
  return true;
}

export function countExpertSections(text: string): number {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 20);
  if (blocks.length >= 2) return blocks.length;
  const headingLines = text.split("\n").filter((line) => {
    const t = line.trim();
    return t.length > 0 && t.length <= 80 && !/[.!?…]$/.test(t) && /[A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž]/.test(t);
  });
  return Math.max(blocks.length, headingLines.length);
}

export function hasFaktiUnIeteikums(text: string): boolean {
  return /fakti/i.test(text) && /mūsu ieteikums/i.test(text);
}

export function evaluateLengthRulesV2(
  text: string,
  field: string,
  opts?: { sourcePrompt?: string | null },
): LengthRuleIssue[] {
  if (!isLengthRulesV2Enabled()) return [];
  const t = (text ?? "").trim();
  if (!t) return [];
  const issues: LengthRuleIssue[] = [];

  if (field === "technical_risks") {
    if (t.length > LENGTH_RULES_V2_TECHNICAL_RISKS.regenMax) {
      issues.push({
        code: "g1_tr_length_regen",
        message: `G1: tehniskie riski ir ${t.length} rakstzīmes (> ${LENGTH_RULES_V2_TECHNICAL_RISKS.regenMax}). Uzraksti īsāk, 1200-2500 rakstzīmes, 4-7 sadaļas.`,
      });
    } else if (
      t.length > LENGTH_RULES_V2_TECHNICAL_RISKS.targetMax ||
      t.length < LENGTH_RULES_V2_TECHNICAL_RISKS.warnMin
    ) {
      issues.push({
        code: "g1_tr_length_warn",
        message: `G1: tehniskie riski ir ${t.length} rakstzīmes (mērķis 1200-2500).`,
      });
    }
    if (isIceVehicleFromPrompt(opts?.sourcePrompt) && !NEXT_100K_HEADING_RE.test(t)) {
      issues.push({
        code: "g3_missing_next_100k",
        message: "G3: ICE tehniskajiem riskiem vajag sadaļu „Nākamajos 100 000 km”.",
      });
    }
  }

  if (field === "summary") {
    if (t.length > LENGTH_RULES_V2_SUMMARY.regenMax) {
      issues.push({
        code: "g2_summary_length_regen",
        message: `G2: kopsavilkums ir ${t.length} rakstzīmes (> ${LENGTH_RULES_V2_SUMMARY.regenMax}). Saīsini līdz 500-900 un izmanto blokus „Fakti” un „Mūsu ieteikums”.`,
      });
    }
  }

  G4_IMPERATIVE_RE.lastIndex = 0;
  const g4 = t.match(G4_IMPERATIVE_RE);
  if (g4 && g4.length > 0 && (field === "technical_risks" || field === "summary" || field === "inspection")) {
    const uniq = [...new Set(g4.map((w) => w.toLowerCase()))].slice(0, 4);
    issues.push({
      code: "g4_imperative_wording",
      message: `G4: aizstāj „${uniq.join(", ")}” ar konsultatīvu formu (iesakām, ir vērts pārbaudīt, pēc datiem).`,
    });
  }

  return issues;
}

export function appendLengthRulesV2ToSystem(
  systemInstruction: string,
  field: string | undefined,
): string {
  if (!isLengthRulesV2Enabled()) return systemInstruction;
  if (field !== "technical_risks" && field !== "summary") return systemInstruction;
  if (systemInstruction.includes("LENGTH_RULES_V2")) return systemInstruction;
  return `${systemInstruction}\n\n${AI_LENGTH_WORDING_RULES_V2}`;
}

export const LENGTH_RULES_V2_RETRY_CODES = new Set([
  "g1_tr_length_regen",
  "g2_summary_length_regen",
  "g3_missing_next_100k",
  "g4_imperative_wording",
]);

export const LENGTH_RULES_V2_CHEAP_RETRY_CODES = new Set([
  "g1_tr_length_regen",
  "g2_summary_length_regen",
  "g4_imperative_wording",
]);

export const LENGTH_RULES_V2_CRITICAL_RETRY_CODES = new Set(["g3_missing_next_100k"]);
