import "server-only";

import type { AutoparksCar } from "@/lib/iriss-autoparks";
import { readAutoparksFileBytes, readAutoparksState } from "@/lib/iriss-autoparks-store";
import { carV2Of, V2_VAT_MODE_LV, type AutoparksCarV2, type V2VatMode } from "@/lib/iriss-autoparks-v2";
import { autoparksV2Cost, type AutoparksV2Cost } from "@/lib/iriss-autoparks-v2-cost";
import { iegadeFileList, purchaseDateFromDocs, type V2IegadeFile } from "@/lib/iriss-autoparks-v2-iegade-files";
import type { AutoparksV2Perms } from "@/lib/iriss-autoparks-v2-perms";
import { sniffContentType } from "@/lib/iriss-autoparks-v2-sniff";
import { readAutoparksV2State } from "@/lib/iriss-autoparks-v2-store";
import { listLiveCabinetDocuments, readCabinetDocumentBytes } from "@/lib/iriss-logistics-cabinet-store";
import { getLogisticsOrder } from "@/lib/iriss-logistics-store";

export type V2IegadeView = {
  auction: string;
  auctionNo: string;
  purchaseDate: string;
  vatMode: V2VatMode;
  vatLabel: string;
  files: V2IegadeFile[];
  /** Tikai ar Summām. */
  purchasePriceEur: number | null;
  transportEur: number | null;
  /** Tikai ar Iegāde + Summas. */
  cost: AutoparksV2Cost | null;
  canSums: boolean;
};

async function context(carId: string) {
  const [v1, v2state] = await Promise.all([readAutoparksState(), readAutoparksV2State()]);
  const car = v1.cars.find((c) => c.id === carId);
  if (!car) return null;
  const v2 = carV2Of(v2state, carId);
  const [order, docs] = car.orderId
    ? await Promise.all([getLogisticsOrder(car.orderId).catch(() => null), listLiveCabinetDocuments(car.orderId).catch(() => [])])
    : [null, []];
  const files = iegadeFileList({ cabinetDocs: docs, v1Files: v1.files.filter((f) => f.carId === carId), numberCheckFileId: v2.numberCheck.fileId });
  return { car, v2, order, docs, files };
}

export function v2PurchasePrice(car: AutoparksCar, v2: AutoparksCarV2, orderPrice: number | null): number | null {
  return v2.purchase.purchasePriceEur ?? car.purchasePriceEur ?? orderPrice ?? null;
}

export async function autoparksV2IegadeView(carId: string, perms: AutoparksV2Perms): Promise<V2IegadeView | null> {
  const ctx = await context(carId);
  if (!ctx) return null;
  const { car, v2, order, docs, files } = ctx;
  const p = v2.purchase;
  const purchase = v2PurchasePrice(car, v2, order?.priceEur ?? null);
  return {
    auction: p.auction || (order?.auction && order.auction !== "cits" ? order.auction : ""),
    auctionNo: p.auctionNo || order?.stockNo || "",
    purchaseDate: p.purchaseDate || purchaseDateFromDocs(docs),
    vatMode: p.vat.mode,
    vatLabel: V2_VAT_MODE_LV[p.vat.mode],
    files,
    purchasePriceEur: perms.summas ? purchase : null,
    transportEur: perms.summas ? p.transportEur : null,
    cost: perms.pasizmaksa
      ? autoparksV2Cost({ purchaseEur: purchase, transportEur: p.transportEur, invoices: v2.service.invoices, expenses: v2.expenses })
      : null,
    canSums: perms.summas,
  };
}

/** Faila saturs tikai, ja fails pieder ŠĪ auto Iegādes sarakstam (cits id -> null -> 404/403). */
export async function readAutoparksV2IegadeFile(carId: string, fileId: string): Promise<{ bytes: Buffer; contentType: string; name: string } | null> {
  const ctx = await context(carId);
  if (!ctx) return null;
  const f = ctx.files.find((x) => x.id === fileId);
  if (!f) return null;
  if (fileId.startsWith("c:")) {
    const got = await readCabinetDocumentBytes(fileId.slice(2));
    return got ? { bytes: got.bytes, contentType: sniffContentType(got.bytes, got.contentType), name: f.title } : null;
  }
  const got = await readAutoparksFileBytes(fileId.slice(2));
  return got ? { bytes: got.bytes, contentType: sniffContentType(got.bytes, got.contentType), name: f.title } : null;
}
