/**
 * Piedāvājumu parsēšana no admin API ķermeņa (iznests no app/api/admin/iriss-pasutijumi/[id]/route.ts bez izmaiņām),
 * lai to pašu izmanto arī POST /api/admin/iriss-pasutijumi/[id]/offers.
 */

import { parseIrissCriteriaV1 } from "@/lib/iriss-criteria-types";
import { normalizeGeneratedDocuments } from "@/lib/iriss-generated-documents";
import { parseIrissPasutijumsListingLinks } from "@/lib/iriss-listing-link-lists";
import { normalizeIrissOfferBlocks } from "@/lib/iriss-offer-blocks";
import { parseIrissDealWorkflowStatus } from "@/lib/iriss-order-overview-view";
import { pickIrissPasutijumsAuditFields } from "@/lib/iriss-pasutijumi-audit-fields";
import { parseExpectedIrissRevision } from "@/lib/iriss-pasutijumi-save-safety";
import { isSafeDropboxFileId } from "@/lib/iriss-stock-photos";
import {
  IRISS_MAX_OFFER_ATTACHMENTS,
  normalizeIrissDzintarzemeTameDraft,
  parseIrissPasutijumsListStatus,
  type IrissOfferAttachment,
  type IrissOfferRecord,
  type IrissPasutijumsRecord,
} from "@/lib/iriss-pasutijumi-types";

export function parseIrissOfferAttachmentsFromBody(raw: unknown): IrissOfferAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id : "";
      const name = typeof o.name === "string" ? o.name : "";
      const mimeType = typeof o.mimeType === "string" ? o.mimeType : "";
      const dataUrl = typeof o.dataUrl === "string" ? o.dataUrl : "";
      const blobPath = typeof o.blobPath === "string" ? o.blobPath : "";
      const blobUrl = typeof o.blobUrl === "string" ? o.blobUrl : "";
      const thumbDataUrl = typeof o.thumbDataUrl === "string" ? o.thumbDataUrl : "";
      const thumbBlobPath = typeof o.thumbBlobPath === "string" ? o.thumbBlobPath : "";
      const thumbUrl = typeof o.thumbUrl === "string" ? o.thumbUrl : "";
      const sizeRaw = typeof o.size === "number" ? o.size : Number.parseInt(String(o.size ?? "0"), 10);
      const size = Number.isFinite(sizeRaw) ? sizeRaw : 0;
      const dropboxId = isSafeDropboxFileId(o.dropboxId) ? o.dropboxId : "";
      if (!id || !name) return null;
      if (!dataUrl && !blobPath && !blobUrl && !dropboxId) return null;
      return {
        id,
        name,
        mimeType,
        dataUrl,
        size,
        ...(dropboxId ? { dropboxId } : {}),
        ...(blobPath ? { blobPath } : {}),
        ...(blobUrl ? { blobUrl } : {}),
        ...(thumbDataUrl ? { thumbDataUrl } : {}),
        ...(thumbBlobPath ? { thumbBlobPath } : {}),
        ...(thumbUrl ? { thumbUrl } : {}),
      };
    })
    .filter((x): x is IrissOfferAttachment => x !== null)
    .slice(0, IRISS_MAX_OFFER_ATTACHMENTS);
}

/** Viens piedāvājums no klienta JSON (PATCH un POST .../offers). null - nederīgs. */
export function parseIrissOfferFromBody(item: unknown, idx: number): IrissOfferRecord | null {
  if (!item || typeof item !== "object") return null;
  const r = item as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  if (!id) return null;
  return {
    id,
    title: typeof r.title === "string" ? r.title : `Piedāvājums ${idx + 1}`,
    brandModel: typeof r.brandModel === "string" ? r.brandModel : "",
    vin: typeof r.vin === "string" ? r.vin : "",
    year: typeof r.year === "string" ? r.year : "",
    mileage: typeof r.mileage === "string" ? r.mileage : "",
    priceGermany: typeof r.priceGermany === "string" ? r.priceGermany : "",
    comment: typeof r.comment === "string" ? r.comment : "",
    firstRegistration: typeof r.firstRegistration === "string" ? r.firstRegistration : "",
    odometerReading: typeof r.odometerReading === "string" ? r.odometerReading : "",
    transmission: typeof r.transmission === "string" ? r.transmission : "",
    location: typeof r.location === "string" ? r.location : "",
    fuel: typeof r.fuel === "string" ? r.fuel : "",
    driveType: typeof r.driveType === "string" ? r.driveType : "",
    powerKw: typeof r.powerKw === "string" ? r.powerKw : "",
    engineDisplacement: typeof r.engineDisplacement === "string" ? r.engineDisplacement : "",
    color: typeof r.color === "string" ? r.color : "",
    bodyTypeOffer: typeof r.bodyTypeOffer === "string" ? r.bodyTypeOffer : "",
    doorCount: typeof r.doorCount === "string" ? r.doorCount : "",
    emissionClass: typeof r.emissionClass === "string" ? r.emissionClass : "",
    originCountry: typeof r.originCountry === "string" ? r.originCountry : "",
    auctionPlatform: typeof r.auctionPlatform === "string" ? r.auctionPlatform : "",
    auctionStockNumber: typeof r.auctionStockNumber === "string" ? r.auctionStockNumber : "",
    auctionEndAt: typeof r.auctionEndAt === "string" ? r.auctionEndAt : "",
    vatStatus: typeof r.vatStatus === "string" ? r.vatStatus : "",
    damageGrade: typeof r.damageGrade === "string" ? r.damageGrade : "",
    equipmentHighlights: typeof r.equipmentHighlights === "string" ? r.equipmentHighlights : "",
    estimatedTotalPrice: typeof r.estimatedTotalPrice === "string" ? r.estimatedTotalPrice : "",
    keyCount: typeof r.keyCount === "string" ? r.keyCount : "",
    hasFullServiceHistory: Boolean(r.hasFullServiceHistory),
    hasFactoryPaint: Boolean(r.hasFactoryPaint),
    hasNoRustBody: Boolean(r.hasNoRustBody),
    hasSecondWheelSet: Boolean(r.hasSecondWheelSet),
    specialNotes: typeof r.specialNotes === "string" ? r.specialNotes : "",
    visualAssessment: typeof r.visualAssessment === "string" ? r.visualAssessment : "",
    technicalAssessment: typeof r.technicalAssessment === "string" ? r.technicalAssessment : "",
    summary: typeof r.summary === "string" ? r.summary : "",
    carPrice: typeof r.carPrice === "string" ? r.carPrice : "",
    deliveryPrice: typeof r.deliveryPrice === "string" ? r.deliveryPrice : "",
    commissionFee: typeof r.commissionFee === "string" ? r.commissionFee : "",
    offerValidDays: typeof r.offerValidDays === "string" ? r.offerValidDays : "",
    validUntil: typeof r.validUntil === "string" ? r.validUntil : "",
    ...(typeof r.validUntilAt === "string" && r.validUntilAt.trim() ? { validUntilAt: r.validUntilAt } : {}),
    ...(typeof r.sourceRef === "string" && r.sourceRef.trim() ? { sourceRef: r.sourceRef } : {}),
    attachments: parseIrissOfferAttachmentsFromBody(r.attachments),
    ...(typeof r.coverAttachmentId === "string" && r.coverAttachmentId.trim()
      ? { coverAttachmentId: r.coverAttachmentId }
      : {}),
    ...(() => {
      const blocks = normalizeIrissOfferBlocks(r.blocks);
      return blocks ? { blocks } : {};
    })(),
    createdAt: typeof r.createdAt === "string" ? r.createdAt : "",
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : "",
  };
}

/** Visi piedāvājumi no pasūtījuma PATCH ķermeņa. */
export function parseIrissOffersFromBody(o: Record<string, unknown>): IrissOfferRecord[] {
  const v = o.offers;
  if (!Array.isArray(v)) return [];
  return v
    .map((item, idx) => parseIrissOfferFromBody(item, idx))
    .filter((x): x is IrissOfferRecord => x !== null)
    .slice(0, 30);
}

function criteriaFromBody(raw: unknown): Pick<IrissPasutijumsRecord, "criteria"> {
  const criteria = parseIrissCriteriaV1(raw);
  return criteria ? { criteria } : {};
}

/**
 * PATCH ķermenis -> ieraksts. Iznests no app/api/admin/iriss-pasutijumi/[id]/route.ts.
 * `criteria` (strukturētie diapazoni, t.sk. Tilpums/Jauda) tiek pieņemts; bez tā tie pazuda pēc Saglabāt.
 */
export function parseIrissPasutijumsPatchBody(id: string, body: unknown): IrissPasutijumsRecord | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === "string" ? o[k] : "");
  const bool = (k: string) => Boolean(o[k]);
  return {
    id,
    createdAt: str("createdAt"),
    updatedAt: str("updatedAt"),
    pinnedAt: str("pinnedAt"),
    workspaceRevision: parseExpectedIrissRevision(o.workspaceRevision) ?? 0,
    listStatus: parseIrissPasutijumsListStatus(o.listStatus),
    clientFirstName: str("clientFirstName"),
    clientLastName: str("clientLastName"),
    phone: str("phone"),
    email: str("email"),
    orderDate: str("orderDate"),
    brandModel: str("brandModel"),
    modelExtension: str("modelExtension"),
    vin: str("vin"),
    productionYears: str("productionYears"),
    totalBudget: str("totalBudget"),
    engineType: str("engineType"),
    transmission: str("transmission"),
    bodyType: str("bodyType"),
    driveType: str("driveType"),
    seatCount: str("seatCount"),
    maxMileage: str("maxMileage"),
    preferredColors: str("preferredColors"),
    nonPreferredColors: str("nonPreferredColors"),
    interiorFinish: str("interiorFinish"),
    powerKw: str("powerKw"),
    damageTolerance: str("damageTolerance"),
    preferredCountries: str("preferredCountries"),
    clientFinancingPercent: (() => {
      const raw = o.clientFinancingPercent;
      const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
      return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 0;
    })(),
    dealLeasingOrCredit: bool("dealLeasingOrCredit"),
    dealClientFinancing100: bool("dealClientFinancing100"),
    dealClientFinancing20: bool("dealClientFinancing20"),
    dealVat21Required: bool("dealVat21Required"),
    dealServiceStartDeposit: bool("dealServiceStartDeposit"),
    dealEkki: bool("dealEkki"),
    ...(parseIrissDealWorkflowStatus(o.dealWorkflowStatus)
      ? { dealWorkflowStatus: parseIrissDealWorkflowStatus(o.dealWorkflowStatus) }
      : {}),
    equipmentRequired: str("equipmentRequired"),
    equipmentDesired: str("equipmentDesired"),
    agentNotes: str("agentNotes"),
    notes: str("notes"),
    internalNotes: str("internalNotes"),
    ...parseIrissPasutijumsListingLinks(o),
    ...(o.ecarstradeLinksManual === true ? { ecarstradeLinksManual: true } : {}),
    dzintarzemeTameDraft: normalizeIrissDzintarzemeTameDraft(o.dzintarzemeTameDraft),
    offers: parseIrissOffersFromBody(o),
    generatedDocuments: normalizeGeneratedDocuments(o.generatedDocuments),
    ...pickIrissPasutijumsAuditFields(o),
    ...criteriaFromBody(o.criteria),
  };
}
