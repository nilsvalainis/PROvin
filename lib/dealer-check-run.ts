import "server-only";

import { randomUUID } from "node:crypto";
import { fetchOneautoProducts } from "@/lib/oneauto-api";
import { translateOneautoWorksOnIngest } from "@/lib/admin-ai-oneauto-translate";
import { generateSourceCommentWithAi } from "@/lib/admin-ai-source-comment";
import {
  emptyAutoRecordsBlock,
  createDefaultSourceBlocks,
  type AutoRecordsBlockState,
} from "@/lib/admin-source-blocks";
import { emptyOneautoBlock } from "@/lib/oneauto-block";
import {
  applyOneautoToAutoRecords,
  emptyOneautoIngest,
} from "@/lib/oneauto-to-auto-records";
import { fetchCsddTechDataCounted } from "@/lib/csdd-tech-data-counted";
import { readAutoparksState } from "@/lib/iriss-autoparks-store";
import { readAutoparksV2State } from "@/lib/iriss-autoparks-v2-store";
import { autoparksV2Basics, carV2Of } from "@/lib/iriss-autoparks-v2";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { parseOneautoProductIds, type OneautoProductId } from "@/lib/oneauto-catalog";
import { rigaYearMonthKey } from "@/lib/admin-riga-calendar";
import { buildOemDealerDocumentHtml } from "@/lib/pdf-dealer-oem";
import {
  compareDealerCheckCsdd,
  dealerCheckChargedCents,
  dealerCheckHttp206Comments,
  dealerCheckMileageRowsFromDisplay,
  dealerCheckSelection,
  dealerCheckServiceHistoryHttp206,
  dealerCheckServiceRowsFromDisplay,
  dealerCheckVehicleFromDisplay,
  findAutoparksCarByVin,
  formatDealerCheckDateLv,
  lastDealerCheckOdometerKm,
  normalizeDealerCheckPlate,
  parseDealerCheckTemplateId,
  sanitizeDealerCheckComment,
  type DealerCheckAutoparksLink,
  type DealerCheckComments,
  type DealerCheckRecord,
  type DealerCheckTemplateId,
} from "@/lib/dealer-check";

export function newDealerCheckId(): string {
  return `dc-${randomUUID()}`;
}

async function resolveVinFromPlate(plate: string): Promise<string> {
  if (!plate) return "";
  try {
    const res = await fetchCsddTechDataCounted(plate, "admin");
    if (res.found && isValidVin(res.data.vin)) return normalizeVin(res.data.vin);
  } catch {
    /* CSDD nav bloķējošs */
  }
  return "";
}

async function lookupAutoparksLink(vin: string): Promise<DealerCheckAutoparksLink | null> {
  try {
    const [v1, v2] = await Promise.all([readAutoparksState(), readAutoparksV2State()]);
    const car = findAutoparksCarByVin(v1.cars, vin);
    if (!car) return null;
    const basics = autoparksV2Basics(car, carV2Of(v2, car.id));
    return {
      carId: car.id,
      title: basics.title,
      stockPath: car.dropboxFolderPath ?? "",
      dropboxFolderId: car.dropboxFolderId ?? "",
    };
  } catch {
    return null;
  }
}

async function lookupCsdd(vin: string, plate: string, dealerLastKm: number | null, http206: boolean) {
  const query = plate || vin;
  if (!query) return null;
  try {
    const res = await fetchCsddTechDataCounted(query, "admin");
    if (!res.found) {
      return compareDealerCheckCsdd({ dealerLastKm, csddKm: null, http206 });
    }
    let csddKm: number | null = null;
    try {
      const [v1, v2] = await Promise.all([readAutoparksState(), readAutoparksV2State()]);
      const car = findAutoparksCarByVin(v1.cars, vin);
      if (car) {
        const basics = autoparksV2Basics(car, carV2Of(v2, car.id));
        if (basics.mileageKm.value != null && basics.mileageKm.value > 0) {
          csddKm = basics.mileageKm.value;
        }
      }
      if (csddKm == null && car?.registry?.odometerKm) csddKm = car.registry.odometerKm;
    } catch {
      /* Autoparks nav obligāts CSDD salīdzinājumam */
    }
    return compareDealerCheckCsdd({
      dealerLastKm,
      csddKm,
      http206,
      firstRegLv: formatDealerCheckDateLv(res.data.firstRegistrationIso),
      inspectionUntil: formatDealerCheckDateLv(res.data.inspectionValidUntilIso),
    });
  } catch {
    return compareDealerCheckCsdd({ dealerLastKm, csddKm: null, http206 });
  }
}

function autoRecordsFromCheck(record: DealerCheckRecord): AutoRecordsBlockState {
  const ingest = {
    ...emptyOneautoIngest(),
    lastFetchedVin: record.vin,
    fetchedAt: record.fetchedAt,
    selectedProducts: record.selectedProducts,
    lastCostEur: (record.chargedCents / 100).toFixed(2),
    results: record.results,
    serviceTimelineOriginal: record.displayOriginal.serviceTimeline,
  };
  return applyOneautoToAutoRecords(emptyAutoRecordsBlock(), {
    display: record.display,
    ingest,
    notes: {
      serviceHistoryNotes: record.comments.serviceHistory,
      oilChangeIntervalNotes: record.comments.oilIntervals,
      comments: record.comments.serviceHistory,
    },
    vehicleOverride: true,
  });
}

export function dealerCheckToOemHtml(record: DealerCheckRecord): string {
  const oneauto = {
    ...emptyOneautoBlock(),
    lastFetchedVin: record.vin,
    fetchedAt: record.fetchedAt,
    selectedProducts: record.selectedProducts,
    results: record.results,
    display: record.displayOriginal,
  };
  return buildOemDealerDocumentHtml({
    vin: record.vin,
    makeModel: [record.vehicle.make, record.vehicle.model].filter(Boolean).join(" "),
    autoRecords: autoRecordsFromCheck({ ...record, display: record.displayOriginal }),
    oneauto,
    includeEquipment: true,
  });
}

export async function generateDealerCheckComments(record: DealerCheckRecord): Promise<DealerCheckComments> {
  if (dealerCheckServiceHistoryHttp206(record.results)) {
    return dealerCheckHttp206Comments(record.vehicle.make);
  }
  const blocks = createDefaultSourceBlocks();
  blocks.auto_records = autoRecordsFromCheck(record);
  blocks.oneauto = {
    ...emptyOneautoBlock(),
    lastFetchedVin: record.vin,
    fetchedAt: record.fetchedAt,
    selectedProducts: record.selectedProducts,
    results: record.results,
    display: record.display,
  };
  const common = {
    sessionId: record.id.replace(/-/g, "").slice(0, 40),
    vin: record.vin,
    sourceBlocks: blocks,
    isolateDealerComments: true as const,
    includeOilIntervalSummary: true as const,
    checkoutLine: "dealer" as const,
    modelTier: "gemini-flash" as const,
    outputLang: "lv" as const,
  };
  let serviceHistory = "";
  let oilIntervals = "";
  try {
    serviceHistory = (
      await generateSourceCommentWithAi({
        ...common,
        blockKey: "auto_records",
        targetField: "serviceHistoryNotes",
      })
    ).trim();
  } catch (e) {
    console.warn("[dealer-check] Gemini servisa komentārs neizdevās", e);
  }
  try {
    oilIntervals = (
      await generateSourceCommentWithAi({
        ...common,
        blockKey: "auto_records",
        targetField: "oilChangeIntervalNotes",
      })
    ).trim();
  } catch (e) {
    console.warn("[dealer-check] Gemini eļļas komentārs neizdevās", e);
  }
  return {
    serviceHistory: sanitizeDealerCheckComment(serviceHistory, false),
    oilIntervals: sanitizeDealerCheckComment(oilIntervals, false),
  };
}

export async function runDealerCheck(args: {
  vin?: string;
  plate?: string;
  template?: unknown;
  products?: unknown;
}): Promise<{ record: DealerCheckRecord } | { error: string; status: number }> {
  const template: DealerCheckTemplateId = parseDealerCheckTemplateId(args.template);
  const products = parseOneautoProductIds(args.products);
  if (!dealerCheckSelection(products).canLoad) {
    return { error: "no_products_selected", status: 400 };
  }
  let vin = normalizeVin(args.vin ?? "");
  const plate = normalizeDealerCheckPlate(args.plate ?? "");
  if (!isValidVin(vin) && plate) {
    vin = await resolveVinFromPlate(plate);
  }
  if (!isValidVin(vin)) {
    return { error: "invalid_vin", status: 400 };
  }

  const fetched = await fetchOneautoProducts({ vin, products: products as OneautoProductId[] });
  const displayOriginal = fetched.display;
  const display = await translateOneautoWorksOnIngest(fetched.display);
  const chargedCents = dealerCheckChargedCents(products, fetched.results);
  const quotedCents = dealerCheckSelection(products).cents;
  const vehicle = dealerCheckVehicleFromDisplay(display, vin);
  const mileageRows = dealerCheckMileageRowsFromDisplay(display);
  const serviceRows = dealerCheckServiceRowsFromDisplay(display);
  const http206 = dealerCheckServiceHistoryHttp206(fetched.results);
  const now = new Date().toISOString();
  const monthKey = rigaYearMonthKey(Date.now());
  const [csdd, autoparks] = await Promise.all([
    lookupCsdd(vin, plate, lastDealerCheckOdometerKm(mileageRows), http206),
    lookupAutoparksLink(vin),
  ]);

  const draft: DealerCheckRecord = {
    id: newDealerCheckId(),
    vin,
    plate,
    template,
    selectedProducts: products,
    results: fetched.results,
    display,
    displayOriginal,
    vehicle,
    mileageRows,
    serviceRows,
    comments: http206 ? dealerCheckHttp206Comments(vehicle.make) : { serviceHistory: "", oilIntervals: "" },
    csdd,
    chargedCents,
    quotedCents,
    fetchedAt: now,
    monthKey,
    autoparks,
    saved: false,
    createdAt: now,
    updatedAt: now,
  };

  if (!http206) {
    draft.comments = await generateDealerCheckComments(draft);
  }

  return { record: draft };
}
