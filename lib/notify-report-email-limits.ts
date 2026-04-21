/**
 * /api/admin/notify-report-ready — kopējais pielikumu apjoms (servera validācija + admin UI brīdinājums).
 * Praktisks limits lielākiem portfeļiem; ja hostinga platforma ierobežo request body zemāk,
 * jāizmanto tiešāka failu plūsma (objektu glabātuve / tieša SMTP straume).
 */
export const NOTIFY_REPORT_MAX_ATTACHMENTS_BYTES = 20 * 1024 * 1024;
