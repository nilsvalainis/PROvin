/** Shared optical sizes for OEM marks on light backgrounds (no plates or borders). */

/** IRISS list / order header: fixed column; marks tuned for SVG inner padding. */
export const BRAND_LOGO_ADMIN_LIST_SLOT_W_PX = 76;
export const BRAND_LOGO_ADMIN_LIST_SLOT_H_PX = 40;
export const BRAND_LOGO_ADMIN_ROUND_VISIBLE_H_PX = 30;
export const BRAND_LOGO_ADMIN_WIDE_VISIBLE_W_PX = 64;
/** Boost round marks so ~18–20px artwork reads ~28–30px tall. */
export const BRAND_LOGO_ADMIN_ROUND_SCALE = 1.45;

export const BRAND_LOGO_PDF_SECTION_PX = 28;
export const BRAND_LOGO_PDF_LIFE_PX = 25;
export const BRAND_LOGO_PDF_SECTION_SLOT_PX = 34;

export const BRAND_LOGO_OEM_SQUARE_PX = 45;
export const BRAND_LOGO_OEM_WIDE_W_PX = 120;
export const BRAND_LOGO_OEM_WIDE_H_PX = 30;

export type PdfBrandLogoSlot = "section" | "life";

export function pdfBrandLogoSlotPx(slot: PdfBrandLogoSlot): number {
  return slot === "life" ? BRAND_LOGO_PDF_LIFE_PX : BRAND_LOGO_PDF_SECTION_PX;
}
