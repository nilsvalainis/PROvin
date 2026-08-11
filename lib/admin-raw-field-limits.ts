/**
 * Admin RAW / paste lauku maksimālie garumi (PDF ielīmēšana).
 * Copilot iemet pilnu PDF tekstu — limiti pietiekami lielām AutoDNA/CarVertical atskaitēm.
 */

/** CSDD / Auto Records / Citi avoti `rawUnprocessedData`. */
export const ADMIN_RAW_UNPROCESSED_MAX_LEN = 3_000_000;

/** AutoDNA / carVertical mileage paste + Gemini context raw (pilns PDF dump). */
export const ADMIN_MILEAGE_PASTE_RAW_MAX_LEN = 1_500_000;

/** Sludinājuma paste RAW. */
export const ADMIN_LISTING_PASTE_RAW_MAX_LEN = 300_000;

/** PDF importa / lokālās ekstrakcijas raw snippets. */
export const ADMIN_PDF_IMPORT_RAW_MAX_LEN = 1_500_000;

/**
 * `deepSanitizeDraftStrings` noklusējums — jābūt ≥ lielākajam RAW laukam,
 * citādi saglabājot ielīmētais teksts tiek nogriezts.
 */
export const ADMIN_DRAFT_STRING_MAX_LEN = ADMIN_RAW_UNPROCESSED_MAX_LEN;
