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
  source: { targetChars: "350-800", targetParas: "2-4", maxChars: 1400 },
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
    `- Avota komentārs: mērķis ${COMMENT_LENGTH_BUDGET.source.targetChars} rakstzīmes (${COMMENT_LENGTH_BUDGET.source.targetParas} rindkopas), griesti ${COMMENT_LENGTH_BUDGET.source.maxChars}.`,
    `- Nobraukums: mērķis ${COMMENT_LENGTH_BUDGET.mileage.targetParas} rindkopas, griesti ${COMMENT_LENGTH_BUDGET.mileage.maxChars}.`,
    `- Negadījumi: mērķis ${COMMENT_LENGTH_BUDGET.incidents.targetParas} rindkopas, griesti ${COMMENT_LENGTH_BUDGET.incidents.maxChars}.`,
    `- 1. Tehnisko risku analīze: flagship, griesti ${COMMENT_LENGTH_BUDGET.technical_risks.maxChars} (NEĪSINĀT līdz avota komentāra garumam).`,
    `- 2. Ieteikumi: flagship, griesti ${COMMENT_LENGTH_BUDGET.inspection.maxChars}.`,
    `- 3. Kopsavilkums: mērķis ${COMMENT_LENGTH_BUDGET.summary.targetParas} rindkopas, griesti ${COMMENT_LENGTH_BUDGET.summary.maxChars}.`,
    `- Eļļas maiņas intervāli: pilna matemātika, ja dati ir; griesti ${COMMENT_LENGTH_BUDGET.oil.maxChars}.`,
    "- Tukši vai trūcīgi dati ≠ garāka eseja par to, ka datu nav. OPERATORA KOMANDAS pārspēj šo budžetu.",
  ];
  if (d.density === "low") {
    lines.push(
      "- Šajā pasūtījumā datu ir MAZ: avota/nobraukuma/kopsavilkuma lauki 1-2 īsas rindkopas. Neraksti vispārīgu modeli vai tukšuma eseju.",
    );
  }
  return lines.join("\n");
}
