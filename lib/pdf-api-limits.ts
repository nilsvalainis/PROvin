/** Kopīgi limiti admin PDF API maršrutiem (ai-extract, parse-pdf). */

/** Vienam PDF failam. */
export const PDF_MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Kopā visiem failiem vienā pieprasījumā. */
export const PDF_MAX_TOTAL_BYTES = 48 * 1024 * 1024;

export const PDF_MAX_FILES = 8;

/**
 * Inline PDF vienam failam Claude pieprasījumā. Anthropic Messages API limits ir
 * 32 MB uz VISU pieprasījumu, un base64 palielina apjomu ~33 % - tāpēc neapstrādāto
 * baitu budžets ir ~23 MB, no kura vēl jāatņem sistēmas prompts un konteksts.
 * Atsevišķi pastāv 100 lappušu limits vienam pieprasījumam (zem 1M konteksta loga).
 */
export const PDF_AI_INLINE_MAX_BYTES = 12 * 1024 * 1024;

/** Inline PDF kopā vienā Claude pieprasījumā (pirms base64) - ar rezervi zem 32 MB. */
export const PDF_AI_INLINE_MAX_TOTAL_BYTES = 20 * 1024 * 1024;

/** Copilot fotogrāfijas: Anthropic pieņem JPEG / PNG / GIF / WebP attēlu blokus. */
export const COPILOT_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

export const COPILOT_IMAGE_MAX_FILE_BYTES = 8 * 1024 * 1024;
export const COPILOT_IMAGE_MAX_TOTAL_BYTES = 16 * 1024 * 1024;
export const COPILOT_IMAGE_MAX_FILES = 6;

export function isCopilotImageMimeType(mime: string): boolean {
  return (COPILOT_IMAGE_MIME_TYPES as readonly string[]).includes(mime.toLowerCase().trim());
}
