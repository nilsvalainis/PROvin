/**
 * VW Golf GTE regresijas fikstūra (j26). Sintētiska un anonimizēta - prod pasūtījuma
 * datiem piekļuves nav. Tikai testiem; saglabātos pasūtījumus neaiztiek.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createDefaultSourceBlocks,
  toPdfLtabManualBlock,
  toPdfManualVendorBlocks,
  type VinRegistryMileageRow,
  type VinRegistryTimelineRow,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import type { AutoRecordsServiceWorkRow } from "@/lib/auto-records-service-works";
import type { CcVinDamageRow } from "@/lib/cc-vin-report";
import { buildPdfReportSummaryTiles } from "@/lib/pdf-report-summary";
import { applyTraficomReportToBlock } from "@/lib/traficom-report-parse";

export type GolfFixtureComment = { id: string; field: string; text: string };

export type GolfFixture = {
  id: string;
  vin: string;
  makeModel: string;
  carinfo: { mileage: VinRegistryMileageRow[]; timeline: VinRegistryTimelineRow[] };
  traficomMileage: VinRegistryMileageRow[];
  ccVinDamages: CcVinDamageRow[];
  dealerWorks: AutoRecordsServiceWorkRow[];
  comments: GolfFixtureComment[];
};

const DIR = join(dirname(fileURLToPath(import.meta.url)), "../__fixtures__/golf-gte");

export const golfFixture = JSON.parse(readFileSync(join(DIR, "golf-gte-regression.json"), "utf8")) as GolfFixture;
export const golfTraficomText = readFileSync(join(DIR, "traficom-golf.txt"), "utf8");

export function golfComment(id: string): GolfFixtureComment {
  const c = golfFixture.comments.find((x) => x.id === id);
  if (!c) throw new Error(`golf comment ${id} missing`);
  return c;
}

export function golfBlocks(): WorkspaceSourceBlocks {
  const fx = golfFixture;
  const b = createDefaultSourceBlocks();
  b.csdd = { ...b.csdd, makeModel: fx.makeModel };
  b.carinfo = { ...b.carinfo, mileage: fx.carinfo.mileage, timeline: fx.carinfo.timeline };
  const traficom = applyTraficomReportToBlock(b.traficom_fi, golfTraficomText);
  if (!traficom) throw new Error("traficom fixture not parsed");
  b.traficom_fi = { ...traficom.block, mileage: fx.traficomMileage };
  b.cc_vin = { ...b.cc_vin, damages: fx.ccVinDamages };
  b.auto_records = { ...b.auto_records, serviceWorks: fx.dealerWorks };
  return b;
}

/** PDF kopsavilkuma kartīte „Negadījumi un bojājumi”. */
export function golfIncidentsTile(b: WorkspaceSourceBlocks) {
  return buildPdfReportSummaryTiles({
    csddForm: b.csdd,
    autoRecordsBlock: b.auto_records,
    ccVinBlock: b.cc_vin,
    asvBlock: b.asv,
    manualVendorBlocks: toPdfManualVendorBlocks(b),
    manualLtabBlock: toPdfLtabManualBlock(b.ltab),
    tirgusForm: b.tirgus,
  }).find((t) => t.id === "incidents");
}
