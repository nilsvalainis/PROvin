/**
 * Admin RAW / paste lauku maksimālie garumi (PDF ielīmēšana).
 * 2026-08-10: +50% pret iepriekšējiem 4× limitiem — lielākas AutoDNA/CarVertical atskaites.
 */

/** CSDD / Auto Records / Citi avoti `rawUnprocessedData` (bija 2_000_000). */
export const ADMIN_RAW_UNPROCESSED_MAX_LEN = 3_000_000;

/** AutoDNA / carVertical mileage paste + Gemini context raw (bija 100_000). */
export const ADMIN_MILEAGE_PASTE_RAW_MAX_LEN = 150_000;

/** Sludinājuma paste RAW (bija 200_000). */
export const ADMIN_LISTING_PASTE_RAW_MAX_LEN = 300_000;

/** PDF importa / lokālās ekstrakcijas raw snippets (bija 500_000). */
export const ADMIN_PDF_IMPORT_RAW_MAX_LEN = 750_000;

/**
 * `deepSanitizeDraftStrings` noklusējums — jābūt ≥ lielākajam RAW laukam,
 * citādi saglabājot ielīmētais teksts tiek nogriezts.
 */
export const ADMIN_DRAFT_STRING_MAX_LEN = ADMIN_RAW_UNPROCESSED_MAX_LEN;
