/**
 * Pasūtījuma datu pieejamība Gemini ģenerēšanai — koplietojams UI un serverī.
 */
import {
  autoRecordsBlockHasContent,
  citiAvotiHasContent,
  csddFormHasContent,
  ltabBlockHasContent,
  ltabRowHasData,
  listingAnalysisHasContent,
  mergeSourceBlocksWithDefaults,
  tirgusFormHasContent,
  toPdfLtabManualBlock,
  toPdfManualVendorBlocks,
  vendorAvotuBlockHasContent,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { collectUnifiedIncidentRows } from "@/lib/unified-incidents";
import { collectUnifiedMileageRows } from "@/lib/unified-mileage";

function hasAnyIncidentTableRows(blocks: WorkspaceSourceBlocks): boolean {
  for (const key of ["autodna", "carvertical"] as const) {
    const incidents = blocks[key]?.incidents;
    if (Array.isArray(incidents) && incidents.some(ltabRowHasData)) return true;
  }
  const sections = blocks.citi_avoti?.sections;
  if (Array.isArray(sections) && sections.some((s) => (s?.incidents ?? []).some(ltabRowHasData))) return true;
  const rows = blocks.ltab?.rows;
  return Array.isArray(rows) && rows.some(ltabRowHasData);
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

/** Vai pasūtījumā ir avotu dati Gemini avotu salīdzinājumam. */
export function orderHasSourceDataForGemini(sourceBlocks: WorkspaceSourceBlocks): boolean {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  return [
    csddFormHasContent(blocks.csdd),
    vendorAvotuBlockHasContent(blocks.autodna),
    vendorAvotuBlockHasContent(blocks.carvertical),
    autoRecordsBlockHasContent(blocks.auto_records),
    ltabBlockHasContent(blocks.ltab),
    tirgusFormHasContent(blocks.tirgus),
    citiAvotiHasContent(blocks.citi_avoti),
    listingAnalysisHasContent(blocks.listing_analysis),
  ].some(Boolean);
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
