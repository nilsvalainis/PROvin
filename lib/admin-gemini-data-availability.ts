/**
 * Pasūtījuma datu pieejamība Gemini ģenerēšanai — koplietojams UI un serverī.
 */
import {
  ltabRowHasData,
  mergeSourceBlocksWithDefaults,
  toPdfLtabManualBlock,
  toPdfManualVendorBlocks,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { collectUnifiedIncidentRows } from "@/lib/unified-incidents";
import { collectUnifiedMileageRows } from "@/lib/unified-mileage";

function hasAnyIncidentTableRows(blocks: WorkspaceSourceBlocks): boolean {
  for (const key of ["autodna", "carvertical"] as const) {
    if (blocks[key].incidents.some(ltabRowHasData)) return true;
  }
  if (blocks.citi_avoti.sections.some((s) => s.incidents.some(ltabRowHasData))) return true;
  return blocks.ltab.rows.some(ltabRowHasData);
}

/** Vai pasūtījumā ir negadījumu dati Gemini ģenerēšanai. */
export function orderHasIncidentDataForGemini(sourceBlocks: WorkspaceSourceBlocks): boolean {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  if (
    collectUnifiedIncidentRows({
      manualVendorBlocks: toPdfManualVendorBlocks(blocks),
      manualLtabBlock: toPdfLtabManualBlock(blocks.ltab),
    }).length > 0
  ) {
    return true;
  }
  return hasAnyIncidentTableRows(blocks);
}

/** Vai pasūtījumā ir nobraukuma dati Gemini ģenerēšanai. */
export function orderHasMileageDataForGemini(sourceBlocks: WorkspaceSourceBlocks): boolean {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  return (
    collectUnifiedMileageRows({
      csddForm: blocks.csdd,
      autoRecordsBlock: blocks.auto_records,
      manualVendorBlocks: toPdfManualVendorBlocks(blocks),
      citiAvotiBlock: blocks.citi_avoti,
    }).length > 0
  );
}
