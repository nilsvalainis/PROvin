/**
 * Pasūtījuma datu pieejamība AI ģenerēšanai — koplietojams UI un serverī.
 */
import {
  autoRecordsBlockHasContent,
  citiAvotiHasContent,
  csddFormHasContent,
  ltabBlockHasContent,
  ltabRowHasData,
  listingAnalysisHasContent,
  mergeSourceBlocksWithDefaults,
  oneautoBlockHasContent,
  tirgusFormHasContent,
  toPdfLtabManualBlock,
  toPdfManualVendorBlocks,
  vendorAvotuBlockHasContent,
  vinRegistryBlockHasContent,
  vinRegistryIncidentRowHasData,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { ccVinBlockHasContent } from "@/lib/cc-vin-report";
import { collectUnifiedIncidentRows } from "@/lib/unified-incidents";
import { collectUnifiedMileageRows } from "@/lib/unified-mileage";

function hasAnyIncidentTableRows(blocks: WorkspaceSourceBlocks): boolean {
  for (const key of ["autodna", "carvertical"] as const) {
    const incidents = blocks[key]?.incidents;
    if (Array.isArray(incidents) && incidents.some(ltabRowHasData)) return true;
  }
  for (const key of ["tjekbil", "mnt_ee", "lkf_ee", "carinfo"] as const) {
    const incidents = blocks[key]?.incidents;
    if (Array.isArray(incidents) && incidents.some(vinRegistryIncidentRowHasData)) return true;
  }
  const sections = blocks.citi_avoti?.sections;
  if (Array.isArray(sections) && sections.some((s) => (s?.incidents ?? []).some(ltabRowHasData))) return true;
  const rows = blocks.ltab?.rows;
  return Array.isArray(rows) && rows.some(ltabRowHasData);
}

/** Vai pasūtījumā ir negadījumu dati AI ģenerēšanai. */
export function orderHasIncidentDataForAi(sourceBlocks: WorkspaceSourceBlocks): boolean {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  if (
    collectUnifiedIncidentRows({
      manualVendorBlocks: toPdfManualVendorBlocks(blocks),
      manualLtabBlock: toPdfLtabManualBlock(blocks.ltab),
      ccVinBlock: blocks.cc_vin,
    }).length > 0
  ) {
    return true;
  }
  return hasAnyIncidentTableRows(blocks);
}

/** Vai pasūtījumā ir avotu dati AI avotu salīdzinājumam. */
export function orderHasSourceDataForAi(sourceBlocks: WorkspaceSourceBlocks): boolean {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  return [
    csddFormHasContent(blocks.csdd),
    vendorAvotuBlockHasContent(blocks.autodna),
    vendorAvotuBlockHasContent(blocks.carvertical),
    autoRecordsBlockHasContent(blocks.auto_records),
    oneautoBlockHasContent(blocks.oneauto),
    ccVinBlockHasContent(blocks.cc_vin),
    vinRegistryBlockHasContent(blocks.tjekbil),
    vinRegistryBlockHasContent(blocks.mnt_ee),
    vinRegistryBlockHasContent(blocks.lkf_ee),
    vinRegistryBlockHasContent(blocks.carinfo),
    ltabBlockHasContent(blocks.ltab),
    tirgusFormHasContent(blocks.tirgus),
    citiAvotiHasContent(blocks.citi_avoti),
    listingAnalysisHasContent(blocks.listing_analysis),
  ].some(Boolean);
}

/** Vai pasūtījumā ir nobraukuma dati AI ģenerēšanai. */
export function orderHasMileageDataForAi(sourceBlocks: WorkspaceSourceBlocks): boolean {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  return (
    collectUnifiedMileageRows({
      csddForm: blocks.csdd,
      autoRecordsBlock: blocks.auto_records,
      ccVinBlock: blocks.cc_vin,
      manualVendorBlocks: toPdfManualVendorBlocks(blocks),
      citiAvotiBlock: blocks.citi_avoti,
      tirgusForm: blocks.tirgus,
    }).length > 0
  );
}
