/**
 * Komentāru garuma budžets kā dati, ne kā proza promptā.
 * comment-quality lasa griestus; order-context ieliek tabulu ✨ promptā.
 */
import {
  AI_SOURCE_COMMENT_BLOCK_KEYS,
  sourceBlockHasDataExcludingComments,
} from "@/lib/admin-source-comment-blocks";
import {
  mergeSourceBlocksWithDefaults,
  toPdfManualVendorBlocks,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { collectUnifiedMileageRows } from "@/lib/unified-mileage";

export type CommentLengthBudgetField =
  | "source"
  | "source_dealer"
  | "incidents"
  | "mileage"
  | "generic"
  | "technical_risks"
  | "inspection"
  | "summary"
  | "seller"
  | "oil";

export type CommentLengthBudget = {
  /** Mērķa josla operatoram / promptam (rakstzīmes). */
  targetChars: string;
  /** Mērķa rindkopas. */
  targetParas: string;
  maxChars: number;
  minChars?: number;
  minParas?: number;
  /** Flagship lauki paliek gari arī pie zema datu blīvuma. */
  flagship?: boolean;
};

export const COMMENT_LENGTH_BUDGET: Record<CommentLengthBudgetField, CommentLengthBudget> = {
  source: { targetChars: "seko faktiem", targetParas: "1, ja pietiek; vairākas, ja dati to prasa", maxChars: 4000 },
  /** OFICIĀLĀ DĪLERA DATI „Komentārs”: bez fiksētiem griestiem, tikai tehniskais drošības maksimums. */
  source_dealer: { targetChars: "600-plašs, bez fiksētiem griestiem", targetParas: "tik lomu, cik dati satur", maxChars: 6000 },
  incidents: { targetChars: "500-1200", targetParas: "2-4", maxChars: 1800 },
  mileage: { targetChars: "800-1800", targetParas: "3-5", maxChars: 2400 },
  generic: { targetChars: "350-800", targetParas: "2-4", maxChars: 1800 },
  technical_risks: {
    targetChars: "800-16000",
    targetParas: "3+",
    maxChars: 16_000,
    minChars: 800,
    minParas: 3,
    flagship: true,
  },
  inspection: {
    targetChars: "400-14000",
    targetParas: "3+",
    maxChars: 14_000,
    minChars: 400,
    minParas: 3,
    flagship: true,
  },
  summary: { targetChars: "400-1200", targetParas: "1-2", maxChars: 1800 },
  seller: { targetChars: "350-800", targetParas: "2-3", maxChars: 1400 },
  oil: { targetChars: "500-2000", targetParas: "pilna matemātika", maxChars: 4000, flagship: true },
};

export type CommentDataDensity = "low" | "medium" | "high";

export type CommentDataDensityAnalysis = {
  density: CommentDataDensity;
  sourceCount: number;
  mileageRowCount: number;
};

export function analyzeCommentDataDensity(sourceBlocks: WorkspaceSourceBlocks): CommentDataDensityAnalysis {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  const sourceCount = AI_SOURCE_COMMENT_BLOCK_KEYS.filter((key) =>
    sourceBlockHasDataExcludingComments(key, blocks),
  ).length;
  const mileageRowCount = collectUnifiedMileageRows({
    csddForm: blocks.csdd,
    autoRecordsBlock: blocks.auto_records,
    oneautoBlock: blocks.oneauto,
    ccVinBlock: blocks.cc_vin,
    asvBlock: blocks.asv,
    manualVendorBlocks: toPdfManualVendorBlocks(blocks),
    citiAvotiBlock: blocks.citi_avoti,
    tirgusForm: blocks.tirgus,
  }).length;

  let density: CommentDataDensity = "medium";
  if (sourceCount <= 1 && mileageRowCount < 4) density = "low";
  else if (sourceCount >= 4 || mileageRowCount >= 12) density = "high";

  return { density, sourceCount, mileageRowCount };
}

const DENSITY_LV: Record<CommentDataDensity, string> = {
  low: "ZEMS",
  medium: "VIDĒJS",
  high: "AUGSTS",
};

/** Kompakts prompta bloks visiem ✨ laukiem. */
export function buildCommentLengthBudgetBrief(sourceBlocks: WorkspaceSourceBlocks): string {
  const d = analyzeCommentDataDensity(sourceBlocks);
  const lines = [
    "### Komentāru garuma budžets (deterministisks)",
    `- Datu blīvums: ${DENSITY_LV[d.density]} (${d.sourceCount} avoti ar datiem, ${d.mileageRowCount} nobraukuma rindas)`,
    `- Avota komentārs: garums seko faktiem. 1 rindkopa, ja pietiek; ja šis avots dod daudz faktu - vairākas rindkopas. Tehniskais griests ${COMMENT_LENGTH_BUDGET.source.maxChars} rakstzīmes (runaway, ne kvota). Nesaīsini bagātīgu avotu līdz 1 rindkopai. IZŅĒMUMS: OFICIĀLĀ DĪLERA DATI „Komentārs” - bez fiksēta griesta, izskaidro visus iegūtos datus.`,
    `- Nobraukums: mērķis ${COMMENT_LENGTH_BUDGET.mileage.targetParas} rindkopas, griesti ${COMMENT_LENGTH_BUDGET.mileage.maxChars}.`,
    `- Negadījumi: mērķis ${COMMENT_LENGTH_BUDGET.incidents.targetParas} rindkopas, griesti ${COMMENT_LENGTH_BUDGET.incidents.maxChars}.`,
    `- 1. Tehnisko risku analīze: flagship, griesti ${COMMENT_LENGTH_BUDGET.technical_risks.maxChars} (NEĪSINĀT līdz avota komentāra garumam).`,
    `- 2. Ieteikumi: flagship, griesti ${COMMENT_LENGTH_BUDGET.inspection.maxChars}.`,
    `- 3. Kopsavilkums: mērķis ${COMMENT_LENGTH_BUDGET.summary.targetParas} rindkopas, griesti ${COMMENT_LENGTH_BUDGET.summary.maxChars}.`,
    `- Eļļas maiņas intervāli: pilna matemātika, ja dati ir; griesti ${COMMENT_LENGTH_BUDGET.oil.maxChars}.`,
    "- Tukši vai trūcīgi dati ≠ garāka eseja par to, ka datu nav.",
    "- Garums seko informācijai: ja datu ir MAZ, raksti ĪSI. Ja datu ir DAUDZ, raksti GARĀK un VAIRĀKĀS rindkopās. Neiespiest bagātīgu vēsturi 1-2 rindkopās tikai tāpēc, ka šeit ir rakstzīmju griesti.",
    "- OPERATORA IELĪMĒTAIS TEKSTS / Esošais melnraksts, ja tas ir garš: šie griesti NEATTIECAS. Pārkārto PROVIN stilā; NEDRĪKSTI būtiski saīsināt un izmest faktus, ko operators gribēja klientam pateikt.",
  ];
  if (d.density === "low") {
    lines.push(
      "- Šajā pasūtījumā datu ir MAZ: avota/nobraukuma/kopsavilkuma lauki 1-2 īsas rindkopas. Neraksti vispārīgu modeli vai tukšuma eseju.",
    );
  }
  if (d.density === "high") {
    lines.push(
      "- Šajā pasūtījumā datu ir DAUDZ: atļauts garāks teksts un vairākas rindkopas. Nesaīsini līdz avota 1 rindkopas kvotai.",
    );
  }
  return lines.join("\n");
}

/** No šī garuma operators ir iedevis pilnu komentāru, ne īsu norādi. */
export const OPERATOR_SUPPLIED_LENGTH_OVERRIDE_MIN = 400;

const OPERATOR_PASTE_RE =
  /===\s*OPERATORA IELĪMĒTAIS TEKSTS[^\n]*===\s*\n([\s\S]*?)\n===\s*BEIGAS OPERATORA IELĪMĒTAJAM TEKSTAM/i;
const EXISTING_DRAFT_RE =
  /===\s*Esošais melnraksts[^\n]*===\s*\n([\s\S]*?)\n===\s*BEIGAS ESOŠAJAM MELNRAKSTAM/i;

export function extractOperatorPasteBody(prompt: string): string {
  return (prompt.match(OPERATOR_PASTE_RE)?.[1] ?? "").trim();
}

export function extractExistingDraftBody(prompt: string): string {
  return (prompt.match(EXISTING_DRAFT_RE)?.[1] ?? "").trim();
}

export function measureOperatorSuppliedChars(prompt: string): number {
  if (!prompt) return 0;
  return Math.max(extractOperatorPasteBody(prompt).length, extractExistingDraftBody(prompt).length);
}

/** Garš operatora ielīmējums vai jau uzrakstīts lauka teksts - rakstzīmju griesti izslēgti. */
export function commentLengthLimitsWaived(prompt: string | undefined | null): boolean {
  return measureOperatorSuppliedChars(prompt ?? "") >= OPERATOR_SUPPLIED_LENGTH_OVERRIDE_MIN;
}

/**
 * `too_long` griesti. `null` = pārbaudi nelieto (operators iedeva garu tekstu).
 * AUGSTS datu blīvums paceļ griestus, lai bagātīgu vēsturi nesaisinātu Flash.
 */
export function commentQualityMaxChars(
  field: string,
  prompt?: string | null,
): number | null {
  if (commentLengthLimitsWaived(prompt)) return null;
  const key = field as CommentLengthBudgetField;
  const base = COMMENT_LENGTH_BUDGET[key]?.maxChars ?? COMMENT_LENGTH_BUDGET.generic.maxChars;
  if (prompt && /Datu blīvums:\s*AUGSTS/i.test(prompt)) {
    return Math.max(base, Math.min(12_000, Math.ceil(base * 3)));
  }
  return base;
}
