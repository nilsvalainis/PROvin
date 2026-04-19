/**
 * PROVIN SELECT stratēģiskās konsultācijas admin melnraksts (JSON uz disku, atsevišķi no audita).
 */

import type { PdfVisibilitySettings } from "@/lib/pdf-visibility";

export const CONSULTATION_SLOT_COUNT = 6;

export type ConsultationDraftOrderEdits = {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: string;
  internalComment?: string;
};

export type ConsultationSlotDraft = {
  listingUrl: string;
  salePrice: string;
  sourceBlocks: unknown;
  ieteikumiApskatei: string;
  cenasAtbilstiba: string;
  kopsavilkums: string;
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
