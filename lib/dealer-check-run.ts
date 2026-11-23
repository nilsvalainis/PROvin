import "server-only";

import { effectiveAutoparksCars } from "@/lib/iriss-autoparks-effective";
import { randomUUID } from "node:crypto";
import { fetchOneautoProducts } from "@/lib/oneauto-api";
import { translateOneautoWorksOnIngest } from "@/lib/admin-ai-oneauto-translate";
import { generateSourceCommentWithAi } from "@/lib/admin-ai-source-comment";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { emptyOneautoBlock } from "@/lib/oneauto-block";
import { fetchCsddTechDataCounted } from "@/lib/csdd-tech-data-counted";
import { readAutoparksState } from "@/lib/iriss-autoparks-store";
import { readAutoparksV2State } from "@/lib/iriss-autoparks-v2-store";
import { autoparksV2Basics, carV2Of } from "@/lib/iriss-autoparks-v2";
import { dealerCheckVinFromCsdd } from "@/lib/dealer-check-csdd";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { parseOneautoProductIds, type OneautoProductId } from "@/lib/oneauto-catalog";
import { rigaYearMonthKey } from "@/lib/admin-riga-calendar";
import { buildOemDealerDocumentHtml } from "@/lib/pdf-dealer-oem";
import { dealerCheckAutoRecords } from "@/lib/dealer-check-delivery";
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
    return dealerCheckVinFromCsdd(res);
  } catch {
    /* CSDD nav bloķējošs */
  }
  return "";
}

async function lookupAutoparksLink(vin: string): Promise<DealerCheckAutoparksLink | null> {
  try {
    const [v1, v2] = await Promise.all([readAutoparksState(), readAutoparksV2State()]);
    const car = findAutoparksCarByVin(effectiveAutoparksCars(v1.cars, v2), vin);
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

async function lookupCsdd(
  vin: string,
  plate: string,
  dealerLastKm: number | null,
  http206: boolean,
): Promise<{ compare: DealerCheckRecord["csdd"]; snapshot: DealerCheckRecord["csddSnapshot"] }> {
  const query = plate || vin;
  if (!query) return { compare: null, snapshot: null };
  try {
    const res = await fetchCsddTechDataCounted(query, "admin");
    if (!res.found) {
      return { compare: compareDealerCheckCsdd({ dealerLastKm, csddKm: null, http206 }), snapshot: null };
    }
    let csddKm: number | null = null;
    try {
      const [v1, v2] = await Promise.all([readAutoparksState(), readAutoparksV2State()]);
      const car = findAutoparksCarByVin(effectiveAutoparksCars(v1.cars, v2), vin);
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
    return {
      compare: compareDealerCheckCsdd({
        dealerLastKm,
        csddKm,
        http206,
        firstRegLv: formatDealerCheckDateLv(res.data.firstRegistrationIso),
        inspectionUntil: formatDealerCheckDateLv(res.data.inspectionValidUntilIso),
      }),
      snapshot: res.data,
    };
  } catch {
    return { compare: compareDealerCheckCsdd({ dealerLastKm, csddKm: null, http206 }), snapshot: null };
  }
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
    autoRecords: dealerCheckAutoRecords({ ...record, display: record.displayOriginal }),
    oneauto,
    includeEquipment: true,
  });
}

export async function generateDealerCheckComments(record: DealerCheckRecord): Promise<DealerCheckComments> {
  if (dealerCheckServiceHistoryHttp206(record.results)) {
    return dealerCheckHttp206Comments(record.vehicle.make);
  }
  const blocks = createDefaultSourceBlocks();
  blocks.auto_records = dealerCheckAutoRecords(record);
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
    console.warn("[dealer-check] Gemini servisa komentārs neizdevās", e instanceof Error ? e.message.slice(0, 200) : "unknown");
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
    console.warn("[dealer-check] Gemini eļļas komentārs neizdevās", e instanceof Error ? e.message.slice(0, 200) : "unknown");
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

  const fetched = await fetchOneautoProducts({ vin, products: products as OneautoProductId[], manual: true });
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
  const [csddLookup, autoparks] = await Promise.all([
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
    csdd: csddLookup.compare,
    csddSnapshot: csddLookup.snapshot,
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
