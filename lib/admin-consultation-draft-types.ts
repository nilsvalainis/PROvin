/**
 * PROVIN SELECT stratēģiskās konsultācijas admin melnraksts (JSON uz disku, atsevišķi no audita).
 */

import type { PdfVisibilitySettings } from "@/lib/pdf-visibility";

export const CONSULTATION_SLOT_COUNT = 6;

/** Maks. fotogrāfiju skaits vienā „Nr. N” slotā (serveris un UI). */
export const CONSULTATION_MAX_PHOTOS_PER_SLOT = 10;

export type ConsultationSlotPhotoMeta = {
  /** Servera ģenerēts id (`ph_` + hex); atbilst failam `{id}.jpg` attachments mapē. */
  id: string;
  comment: string;
};

/** Derīgs servera ģenerēts foto id (JSON + fs). */
export function isConsultationSlotPhotoId(id: string): boolean {
  return typeof id === "string" && /^ph_[a-f0-9]{24}$/.test(id);
}

export type ConsultationDraftOrderEdits = {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: string;
  internalComment?: string;
  /** PROVIN SELECT — admin stratēģijas anketa (klienta portfelis). */
  selectBrandModel?: string;
  selectProductionYearsDpf?: string;
  selectPlannedBudget?: string;
  selectEngineType?: string;
  selectTransmission?: string;
  selectMaxMileage?: string;
  selectExteriorColor?: string;
  selectInteriorMaterial?: string;
  selectRequiredEquipment?: string;
  selectDesiredEquipment?: string;
};

export type ConsultationSlotDraft = {
  listingUrl: string;
  salePrice: string;
  sourceBlocks: unknown;
  ieteikumiApskatei: string;
  cenasAtbilstiba: string;
  kopsavilkums: string;
  photos: ConsultationSlotPhotoMeta[];
};

export type ConsultationDraftWorkspaceBody = {
  slots: ConsultationSlotDraft[];
  irissApproved: string;
  previewConfirmed: boolean;
  pdfVisibility?: PdfVisibilitySettings;
};

export type ConsultationDraftState = {
  /** Sesijas id (atbilst Stripe `cs_*` vai demo). */
  sessionId: string;
  orderEdits: ConsultationDraftOrderEdits;
  workspace: ConsultationDraftWorkspaceBody | null;
  updatedAt: string;
};

export function emptyConsultationSlot(): ConsultationSlotDraft {
  return {
    listingUrl: "",
    salePrice: "",
    sourceBlocks: null,
    ieteikumiApskatei: "",
    cenasAtbilstiba: "",
    kopsavilkums: "",
    photos: [],
  };
}

export function defaultConsultationWorkspace(): ConsultationDraftWorkspaceBody {
  return {
    slots: Array.from({ length: CONSULTATION_SLOT_COUNT }, () => emptyConsultationSlot()),
    irissApproved: "",
    previewConfirmed: false,
  };
}

export function consultationDraftHasOrderEdits(e: ConsultationDraftOrderEdits | undefined): boolean {
  if (!e || typeof e !== "object") return false;
  return Object.keys(e).length > 0;
}
