/**
 * Admin RAW / paste lauku maksimālie garumi (PDF ielīmēšana).
 * Aptuveni 4× iepriekšējie limiti — 3× + rezerve.
 */

/** CSDD / Auto Records / Citi avoti `rawUnprocessedData` (bija 500_000). */
export const ADMIN_RAW_UNPROCESSED_MAX_LEN = 2_000_000;

/** AutoDNA / carVertical mileage paste + AI context raw (bija 24_000). */
export const ADMIN_MILEAGE_PASTE_RAW_MAX_LEN = 100_000;

/** Sludinājuma paste RAW (bija 50_000). */
export const ADMIN_LISTING_PASTE_RAW_MAX_LEN = 200_000;

/** PDF importa / lokālās ekstrakcijas raw snippets (bija 120_000). */
export const ADMIN_PDF_IMPORT_RAW_MAX_LEN = 500_000;

/**
 * `deepSanitizeDraftStrings` noklusējums — jābūt ≥ lielākajam RAW laukam,
 * citādi saglabājot ielīmētais teksts tiek nogriezts (bija 120_000).
 */
export const ADMIN_DRAFT_STRING_MAX_LEN = ADMIN_RAW_UNPROCESSED_MAX_LEN;
