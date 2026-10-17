/** Shared optical sizes for OEM marks on light backgrounds (no plates or borders). */

export const BRAND_LOGO_ADMIN_SQUARE_PX = 34;
export const BRAND_LOGO_ADMIN_WIDE_H_PX = 34;
export const BRAND_LOGO_ADMIN_WIDE_MAX_W_PX = 92;

export const BRAND_LOGO_PDF_SECTION_PX = 22;
export const BRAND_LOGO_PDF_LIFE_PX = 20;

export const BRAND_LOGO_OEM_SQUARE_PX = 36;
export const BRAND_LOGO_OEM_WIDE_W_PX = 96;
export const BRAND_LOGO_OEM_WIDE_H_PX = 24;

export type PdfBrandLogoSlot = "section" | "life";

export function pdfBrandLogoSlotPx(slot: PdfBrandLogoSlot): number {
  return slot === "life" ? BRAND_LOGO_PDF_LIFE_PX : BRAND_LOGO_PDF_SECTION_PX;
}
