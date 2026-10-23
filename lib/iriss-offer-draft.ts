/**
 * Piedāvājuma formas melnraksts (OfferDraft) un tā pārvēršana uz / no IrissOfferRecord.
 * Viena vieta visām formām (Pasūtījumi, Loģistika, Autoparks, klienta kabinets).
 */

import type { IrissOfferBlock } from "@/lib/iriss-offer-blocks";
import { parsePriceLike } from "@/lib/iriss-price-format";
import type { IrissOfferAttachment, IrissOfferRecord } from "@/lib/iriss-pasutijumi-types";
import {
  defaultOfferValidUntilYmd,
  deriveOfferValidUntil,
  normalizeOfferValidUntil,
  normalizeOfferValidUntilAt,
} from "@/lib/iriss-offer-valid-until";

export type OfferDraft = {
  id: string;
  title: string;
  brandModel: string;
  vin: string;
  year: string;
  mileage: string;
  priceGermany: string;
  comment: string;
  firstRegistration: string;
  odometerReading: string;
  transmission: string;
  location: string;
  hasFullServiceHistory: boolean;
  hasFactoryPaint: boolean;
  hasNoRustBody: boolean;
  hasSecondWheelSet: boolean;
  specialNotes: string;
  visualAssessment: string;
  technicalAssessment: string;
  summary: string;
  carPrice: string;
  deliveryPrice: string;
  commissionFee: string;
  offerValidDays: string;
  validUntil: string;
  attachments: IrissOfferAttachment[];
  coverAttachmentId: string;
  createdAt: string;
  fuel: string;
  driveType: string;
  powerKw: string;
  engineDisplacement: string;
  color: string;
  bodyTypeOffer: string;
  doorCount: string;
  emissionClass: string;
  originCountry: string;
  auctionPlatform: string;
  auctionStockNumber: string;
  auctionEndAt: string;
  vatStatus: string;
  damageGrade: string;
  equipmentHighlights: string;
  estimatedTotalPrice: string;
  keyCount: string;
  blocks?: IrissOfferBlock[];
  /** Precīzs termiņš (UTC ISO). Tukšs vecajiem piedāvājumiem. */
  validUntilAt?: string;
};

export const OFFER_AUTO_FIELD_KEYS = [
  "brandModel",
  "vin",
  "firstRegistration",
  "odometerReading",
  "fuel",
  "transmission",
  "driveType",
  "powerKw",
  "bodyTypeOffer",
  "color",
  "originCountry",
  "location",
  "auctionPlatform",
  "auctionStockNumber",
  "auctionEndAt",
  "vatStatus",
  "carPrice",
  "estimatedTotalPrice",
] as const;

export function offerDraftVehicleExtras(): Pick<
  OfferDraft,
  | "fuel"
  | "driveType"
  | "powerKw"
  | "engineDisplacement"
  | "color"
  | "bodyTypeOffer"
  | "doorCount"
  | "emissionClass"
  | "originCountry"
  | "auctionPlatform"
  | "auctionStockNumber"
  | "auctionEndAt"
  | "vatStatus"
  | "damageGrade"
  | "equipmentHighlights"
  | "estimatedTotalPrice"
  | "keyCount"
> {
  return {
    fuel: "",
    driveType: "",
    powerKw: "",
    engineDisplacement: "",
    color: "",
    bodyTypeOffer: "",
    doorCount: "",
    emissionClass: "",
    originCountry: "",
    auctionPlatform: "",
    auctionStockNumber: "",
    auctionEndAt: "",
    vatStatus: "",
    damageGrade: "",
    equipmentHighlights: "",
    estimatedTotalPrice: "",
    keyCount: "",
  };
}

export function newOfferDraft(nextNumber: number, nowMs = Date.now()): OfferDraft {
  const now = new Date(nowMs).toISOString();
  return {
    id: crypto.randomUUID(),
    title: `Piedāvājums ${nextNumber}`,
    brandModel: "",
    vin: "",
    year: "",
    mileage: "",
    priceGermany: "",
    comment: "",
    firstRegistration: "",
    odometerReading: "",
    transmission: "",
    location: "",
    hasFullServiceHistory: false,
    hasFactoryPaint: false,
    hasNoRustBody: false,
    hasSecondWheelSet: false,
    specialNotes: "",
    visualAssessment: "",
    technicalAssessment: "",
    summary: "",
    carPrice: "",
    deliveryPrice: "",
    commissionFee: "",
    offerValidDays: "",
    validUntil: defaultOfferValidUntilYmd(Date.parse(now) || Date.now()),
    attachments: [],
    coverAttachmentId: "",
    createdAt: now,
    ...offerDraftVehicleExtras(),
  };
}

export function formatPriceLike(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  return value
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(".", ",");
}

/** Kopā = auto + piegāde + komisija (formas lauks "Kopā"). */
export function offerDraftTotalPrice(d: Pick<OfferDraft, "carPrice" | "deliveryPrice" | "commissionFee">): string {
  return formatPriceLike(parsePriceLike(d.carPrice) + parsePriceLike(d.deliveryPrice) + parsePriceLike(d.commissionFee));
}

export function offerDraftFromRecord(offer: IrissOfferRecord, nowIso = new Date().toISOString()): OfferDraft {
  return {
    id: offer.id,
    title: offer.title,
    brandModel: offer.brandModel,
    vin: offer.vin ?? "",
    year: offer.year,
    mileage: offer.mileage,
    priceGermany: offer.priceGermany,
    comment: offer.comment,
    firstRegistration: offer.firstRegistration ?? offer.year ?? "",
    odometerReading: offer.odometerReading ?? offer.mileage ?? "",
    transmission: offer.transmission ?? "",
    location: offer.location ?? "",
    hasFullServiceHistory: Boolean(offer.hasFullServiceHistory),
    hasFactoryPaint: Boolean(offer.hasFactoryPaint),
    hasNoRustBody: Boolean(offer.hasNoRustBody),
    hasSecondWheelSet: Boolean(offer.hasSecondWheelSet),
    specialNotes: offer.specialNotes ?? "",
    visualAssessment: offer.visualAssessment ?? "",
    technicalAssessment: offer.technicalAssessment ?? "",
    summary: offer.summary ?? "",
    carPrice: offer.carPrice ?? offer.priceGermany ?? "",
    deliveryPrice: offer.deliveryPrice ?? "",
    commissionFee: offer.commissionFee ?? "",
    offerValidDays: offer.offerValidDays ?? "",
    validUntil: deriveOfferValidUntil(offer),
    attachments: offer.attachments,
    coverAttachmentId: offer.coverAttachmentId ?? "",
    createdAt: offer.createdAt || nowIso,
    fuel: offer.fuel ?? "",
    driveType: offer.driveType ?? "",
    powerKw: offer.powerKw ?? "",
    engineDisplacement: offer.engineDisplacement ?? "",
    color: offer.color ?? "",
    bodyTypeOffer: offer.bodyTypeOffer ?? "",
    doorCount: offer.doorCount ?? "",
    emissionClass: offer.emissionClass ?? "",
    originCountry: offer.originCountry ?? "",
    auctionPlatform: offer.auctionPlatform ?? "",
    auctionStockNumber: offer.auctionStockNumber ?? "",
    auctionEndAt: offer.auctionEndAt ?? "",
    vatStatus: offer.vatStatus ?? "",
    damageGrade: offer.damageGrade ?? "",
    equipmentHighlights: offer.equipmentHighlights ?? "",
    estimatedTotalPrice: offer.estimatedTotalPrice ?? "",
    keyCount: offer.keyCount ?? "",
    ...(offer.blocks?.length ? { blocks: offer.blocks } : {}),
    ...(normalizeOfferValidUntilAt(offer.validUntilAt) ? { validUntilAt: normalizeOfferValidUntilAt(offer.validUntilAt) } : {}),
  };
}

export function offerRecordFromDraft(
  offerDraft: OfferDraft,
  opts: { title: string; nowIso: string },
): IrissOfferRecord {
  const cleanedTitle = opts.title;
  const now = opts.nowIso;
  return {
    id: offerDraft.id,
    title: cleanedTitle,
    brandModel: offerDraft.brandModel,
    vin: offerDraft.vin,
    year: offerDraft.firstRegistration || offerDraft.year,
    mileage: offerDraft.odometerReading || offerDraft.mileage,
    priceGermany: offerDraft.carPrice || offerDraft.priceGermany,
    comment:
      offerDraft.summary ||
      offerDraft.visualAssessment ||
      offerDraft.technicalAssessment ||
      offerDraft.specialNotes ||
      offerDraft.comment,
    firstRegistration: offerDraft.firstRegistration,
    odometerReading: offerDraft.odometerReading,
    transmission: offerDraft.transmission,
    location: offerDraft.location,
    fuel: offerDraft.fuel,
    driveType: offerDraft.driveType,
    powerKw: offerDraft.powerKw,
    engineDisplacement: offerDraft.engineDisplacement,
    color: offerDraft.color,
    bodyTypeOffer: offerDraft.bodyTypeOffer,
    doorCount: offerDraft.doorCount,
    emissionClass: offerDraft.emissionClass,
    originCountry: offerDraft.originCountry,
    auctionPlatform: offerDraft.auctionPlatform,
    auctionStockNumber: offerDraft.auctionStockNumber,
    auctionEndAt: offerDraft.auctionEndAt,
    vatStatus: offerDraft.vatStatus,
    damageGrade: offerDraft.damageGrade,
    equipmentHighlights: offerDraft.equipmentHighlights,
    estimatedTotalPrice: offerDraft.estimatedTotalPrice,
    keyCount: offerDraft.keyCount,
    hasFullServiceHistory: offerDraft.hasFullServiceHistory,
    hasFactoryPaint: offerDraft.hasFactoryPaint,
    hasNoRustBody: offerDraft.hasNoRustBody,
    hasSecondWheelSet: offerDraft.hasSecondWheelSet,
    specialNotes: offerDraft.specialNotes,
    visualAssessment: offerDraft.visualAssessment,
    technicalAssessment: offerDraft.technicalAssessment,
    summary: offerDraft.summary,
    carPrice: offerDraft.carPrice,
    deliveryPrice: offerDraft.deliveryPrice,
    commissionFee: offerDraft.commissionFee,
    offerValidDays: offerDraft.offerValidDays,
    validUntil: normalizeOfferValidUntil(offerDraft.validUntil),
    attachments: offerDraft.attachments,
    ...(offerDraft.coverAttachmentId ? { coverAttachmentId: offerDraft.coverAttachmentId } : {}),
    ...(offerDraft.blocks?.length ? { blocks: offerDraft.blocks } : {}),
    ...(normalizeOfferValidUntilAt(offerDraft.validUntilAt) ? { validUntilAt: normalizeOfferValidUntilAt(offerDraft.validUntilAt) } : {}),
    createdAt: offerDraft.createdAt || now,
    updatedAt: now,
  };
}

export function isOfferDraftSyncedWithRecord(draft: OfferDraft, offer: IrissOfferRecord | null): boolean {
  if (!offer) return false;
  if (draft.id !== offer.id) return false;
  if (draft.title !== offer.title) return false;
  if (draft.brandModel !== offer.brandModel) return false;
  if ((draft.vin ?? "") !== (offer.vin ?? "")) return false;
  if (draft.year !== offer.year) return false;
  if (draft.mileage !== offer.mileage) return false;
  if (draft.priceGermany !== offer.priceGermany) return false;
  if (draft.comment !== offer.comment) return false;
  if (draft.firstRegistration !== (offer.firstRegistration ?? "")) return false;
  if (draft.odometerReading !== (offer.odometerReading ?? "")) return false;
  if (draft.transmission !== (offer.transmission ?? "")) return false;
  if (draft.location !== (offer.location ?? "")) return false;
  if (draft.hasFullServiceHistory !== Boolean(offer.hasFullServiceHistory)) return false;
  if (draft.hasFactoryPaint !== Boolean(offer.hasFactoryPaint)) return false;
  if (draft.hasNoRustBody !== Boolean(offer.hasNoRustBody)) return false;
  if (draft.hasSecondWheelSet !== Boolean(offer.hasSecondWheelSet)) return false;
  if (draft.specialNotes !== (offer.specialNotes ?? "")) return false;
  if (draft.visualAssessment !== (offer.visualAssessment ?? "")) return false;
  if (draft.technicalAssessment !== (offer.technicalAssessment ?? "")) return false;
  if (draft.summary !== (offer.summary ?? "")) return false;
  if (draft.carPrice !== (offer.carPrice ?? "")) return false;
  if (draft.deliveryPrice !== (offer.deliveryPrice ?? "")) return false;
  if (draft.commissionFee !== (offer.commissionFee ?? "")) return false;
  if (draft.offerValidDays !== (offer.offerValidDays ?? "")) return false;
  // Krāsa, degviela, jauda, izsoles lauki u.c. - arī tie jāsaglabā (agrāk netika salīdzināti).
  for (const key of Object.keys(offerDraftVehicleExtras()) as (keyof ReturnType<typeof offerDraftVehicleExtras>)[]) {
    if (draft[key] !== (offer[key] ?? "")) return false;
  }
  if (deriveOfferValidUntil(draft) !== deriveOfferValidUntil(offer)) return false;
  if (normalizeOfferValidUntilAt(draft.validUntilAt) !== normalizeOfferValidUntilAt(offer.validUntilAt)) return false;
  if ((draft.coverAttachmentId || "") !== (offer.coverAttachmentId || "")) return false;
  if (JSON.stringify(draft.blocks ?? null) !== JSON.stringify(offer.blocks ?? null)) return false;
  if (draft.attachments.length !== offer.attachments.length) return false;
  for (let i = 0; i < draft.attachments.length; i += 1) {
    const a = draft.attachments[i];
    const b = offer.attachments[i];
    if (!b) return false;
    if (a.id !== b.id || a.name !== b.name || a.mimeType !== b.mimeType || a.size !== b.size || a.dataUrl !== b.dataUrl) {
      return false;
    }
  }
  return true;
}

