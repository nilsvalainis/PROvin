/**
 * /api/admin/notify-report-ready — kopējais pielikumu apjoms (servera validācija + admin UI brīdinājums).
 * Vercel serverless ietvaros uzturēt zem ~4.5 MB pieprasījuma ķermeņa limita.
 */
export const NOTIFY_REPORT_MAX_ATTACHMENTS_BYTES = 4 * 1024 * 1024;
