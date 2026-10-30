import "server-only";

import type { AutoparksCar } from "@/lib/iriss-autoparks";
import { readAutoparksFileBytes, readAutoparksState } from "@/lib/iriss-autoparks-store";
import { carV2Of, V2_VAT_MODE_LV, type AutoparksCarV2, type V2VatMode } from "@/lib/iriss-autoparks-v2";
import { autoparksV2Cost, type AutoparksV2Cost } from "@/lib/iriss-autoparks-v2-cost";
import { auto1MissingDocLabels, iegadeFileList, isAuto1Car, purchaseDateFromDocs, type V2IegadeFile } from "@/lib/iriss-autoparks-v2-iegade-files";
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
  /** Auto1 autiem trūkstošo obligāto dokumentu etiķetes (J30 F4); tukšs = nav brīdinājuma. */
  missingAuto1Docs: string[];
};

async function context(carId: string) {
  const [v1, v2state] = await Promise.all([readAutoparksState(), readAutoparksV2State()]);
  const car = v1.cars.find((c) => c.id === carId);
  if (!car) return null;
  const v2 = carV2Of(v2state, carId);
  // Ar roku "+ Auto" pievienotiem ierakstiem (nav orderId) kabineta dokumenti ir glabāti zem
  // auto id - sk. iegades faili maršrutu. `getLogisticsOrder` tam vienkārši atgriež null.
  const cabinetCarId = car.orderId || car.id;
  const [order, docs] = await Promise.all([
    car.orderId ? getLogisticsOrder(car.orderId).catch(() => null) : Promise.resolve(null),
    listLiveCabinetDocuments(cabinetCarId).catch(() => []),
  ]);
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
  const auction = p.auction || (order?.auction && order.auction !== "cits" ? order.auction : "");
  return {
    auction,
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
    missingAuto1Docs: auto1MissingDocLabels({ isAuto1: isAuto1Car({ auction, cabinetDocs: docs }), cabinetDocs: docs, files }),
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

const VAT_RECHECK_MS = 24 * 60 * 60 * 1000;

/**
 * F5b: PVN režīms automātiski no izsoles rēķina PDF teksta (tikai, ja nav izvēlēts ar roku; ne biežāk kā 1x dienā).
 * Skenētam PDF bez teksta slāņa režīms paliek tukšs.
 */
export async function refreshAutoparksV2Vat(carId: string, actor: { id: string; name: string }): Promise<void> {
  const ctx = await context(carId);
  if (!ctx) return;
  const vat = ctx.v2.purchase.vat;
  if (vat.mode) return;
  const at = Date.parse(vat.at);
  if (Number.isFinite(at) && Date.now() - at < VAT_RECHECK_MS) return;
  const invoices = ctx.docs.filter((d) => !d.deletedAt && d.blobPath && (d.type === "auction_invoice" || d.type === "car_invoice" || d.type === "purchase_confirm"));
  if (invoices.length === 0) return;
  const [{ extractPdfTextOnServer }, { vatModeFromInvoiceText }, { updateCarV2 }] = await Promise.all([
    import("@/lib/pdf-text-extract-server"),
    import("@/lib/iriss-autoparks-v2-vat"),
    import("@/lib/iriss-autoparks-v2-store"),
  ]);
  let mode: V2VatMode = "";
  for (const d of invoices.slice(0, 3)) {
    const got = await readCabinetDocumentBytes(d.id).catch(() => null);
    if (!got || sniffContentType(got.bytes, got.contentType) !== "application/pdf") continue;
    const text = await extractPdfTextOnServer(got.bytes.buffer.slice(got.bytes.byteOffset, got.bytes.byteOffset + got.bytes.byteLength) as ArrayBuffer).catch(() => "");
    mode = vatModeFromInvoiceText(text);
    if (mode) break;
  }
  await updateCarV2(
    carId,
    (c) => {
      if (c.purchase.vat.mode) return { result: null };
      c.purchase.vat = { mode, source: "invoice", at: new Date().toISOString() };
      if (mode) c.sources["purchase.vat"] = "invoice";
      return { result: null, history: mode ? [{ field: "purchase.vat", from: "", to: mode }] : [], write: true };
    },
    { id: actor.id, name: `${actor.name} (rēķins)` },
  );
}
