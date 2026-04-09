/**
 * Admin pasūtījuma melnraksts (kopīgi tipi — klients + serveris).
 * Portfeļa binārie faili paliek IndexedDB; serverī — tikai JSON (lauki + darba zona).
 */

export type OrderDraftOrderEdits = {
  vin?: string;
  listingUrl?: string;
  notes?: string;
};

/** Tīrs JSON — `sourceBlocks` validē serverī ar `hydrateWorkspaceFromStorage`. */
export type OrderDraftWorkspaceBody = {
  sourceBlocks: unknown;
  iriss: string;
  apskatesPlāns: string;
  cenasAtbilstiba: string;
  previewConfirmed: boolean;
  pdfVisibility?: import("@/lib/pdf-visibility").PdfVisibilitySettings;
};

export type OrderDraftState = {
  orderEdits: OrderDraftOrderEdits;
  workspace: OrderDraftWorkspaceBody | null;
  updatedAt: string;
  /** Relatīva saite uz saglabātu PDF rēķinu (pēc pirmās ģenerēšanas), piem. `/api/admin/invoice/cs_…/pdf` */
  invoicePdfUrl?: string;
  invoicePdfGeneratedAt?: string;
};

export function orderDraftHasOrderEdits(e: OrderDraftOrderEdits | undefined): boolean {
  if (!e || typeof e !== "object") return false;
  return Object.keys(e).length > 0;
}
