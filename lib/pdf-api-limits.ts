/** Kopīgi limiti admin PDF API maršrutiem (ai-extract, parse-pdf). */

/** Vienam PDF failam. */
export const PDF_MAX_FILE_BYTES = 15 * 1024 * 1024;

/** Kopā visiem failiem vienā pieprasījumā. */
export const PDF_MAX_TOTAL_BYTES = 48 * 1024 * 1024;

export const PDF_MAX_FILES = 8;

/** Gemini inline PDF — praktisks limits (base64 palielina ~33%). */
export const PDF_GEMINI_INLINE_MAX_BYTES = 18 * 1024 * 1024;
