import { parsePartnerIdFromNotes } from "@/lib/b2b-partner-orders";

/**
 * "Sūtīt atskaiti" adresāta aizsardzība (incidents 17.11: klienta PDF aizgāja uz testa partnera e-pastu).
 * Tīras funkcijas: serveris (`/api/admin/notify-report-ready`) un admin UI lieto vienu loģiku.
 */

export const REPORT_RECIPIENT_BLOCKLIST_ENV = "REPORT_RECIPIENT_BLOCKLIST";

export function normalizeRecipient(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/** "klients@example.com" -> "kl***@example.com" (domēns redzams, lai admins atpazīst adresi). */
export function maskEmail(email: string | null | undefined): string {
  const e = (email ?? "").trim();
  const at = e.lastIndexOf("@");
  if (at <= 0) return e ? "***" : "";
  const local = e.slice(0, at);
  const keep = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${keep}***${e.slice(at)}`;
}

/** Komatiem atdalītas adreses vai domēni ("@example.com" vai "example.com"). */
export function parseRecipientBlocklist(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(/[,;\s]+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .map((x) => (x.includes("@") ? x : `@${x}`));
}

export function isRecipientBlocked(email: string, blocklist: readonly string[]): boolean {
  const e = normalizeRecipient(email);
  if (!e) return false;
  return blocklist.some((b) => (b.startsWith("@") ? e.endsWith(b) : e === b));
}

/** Vai pasūtījums pieder šim B2B partnerim (Stripe/manuālā `partnerId` vai servera atzīme `partner_id=` piezīmēs). */
export function orderBelongsToPartner(
  order: { partnerId?: string | null; notes?: string | null },
  partnerId: string,
): boolean {
  const id = partnerId.trim().toLowerCase();
  if (!id) return false;
  if ((order.partnerId ?? "").trim().toLowerCase() === id) return true;
  return parsePartnerIdFromNotes(order.notes) === id;
}

export type ReportRecipientDecision =
  | { ok: true; to: string; recipientOverride: boolean; previousRecipientMasked?: string }
  | {
      ok: false;
      status: 400 | 409;
      error:
        | "no_customer_email"
        | "invalid_customer_email"
        | "recipient_blocked"
        | "partner_email_on_client_order"
        | "recipient_mismatch";
      message: string;
      stored?: string;
      requested?: string;
    };

/**
 * Nosaka adresātu un pārbauda:
 * 1) pieprasījuma e-pasts sakrīt ar saglabāto (melnraksts vai Stripe/manuālais pasūtījums), citādi 409, ja nav apstiprināts;
 * 2) adrese nav bloķēto sarakstā (`REPORT_RECIPIENT_BLOCKLIST`);
 * 3) B2B partnera e-pasts nedrīkst saņemt cita (klienta) pasūtījuma atskaiti.
 */
export function evaluateReportRecipient(input: {
  requested: string;
  stored: string;
  confirmOverride: boolean;
  isValidEmail: (e: string) => boolean;
  blocklist: readonly string[];
  /** Reģistrēts B2B partneris ar šādu e-pastu (ja ir). */
  partnerWithRecipientEmail: { id: string } | null;
  order: { partnerId?: string | null; notes?: string | null };
}): ReportRecipientDecision {
  const requested = input.requested.trim();
  const stored = input.isValidEmail(input.stored.trim()) ? input.stored.trim() : "";
  if (requested && !input.isValidEmail(requested)) {
    return { ok: false, status: 400, error: "invalid_customer_email", message: "Nederīgs saņēmēja e-pasts." };
  }
  const to = requested || stored;
  if (!to) {
    return { ok: false, status: 400, error: "no_customer_email", message: "Pasūtījumam nav saņēmēja e-pasta." };
  }
  if (isRecipientBlocked(to, input.blocklist)) {
    return {
      ok: false,
      status: 409,
      error: "recipient_blocked",
      message: `Adrese ${maskEmail(to)} ir bloķēto saņēmēju sarakstā - atskaiti uz to nesūta.`,
      requested: maskEmail(to),
    };
  }
  const partner = input.partnerWithRecipientEmail;
  if (partner && !orderBelongsToPartner(input.order, partner.id)) {
    return {
      ok: false,
      status: 409,
      error: "partner_email_on_client_order",
      message: `${maskEmail(to)} ir B2B partnera e-pasts, bet pasūtījums nav šī partnera. Pārbaudi «Klienta dati».`,
      requested: maskEmail(to),
    };
  }
  const differs = Boolean(requested && stored && normalizeRecipient(requested) !== normalizeRecipient(stored));
  if (differs && !input.confirmOverride) {
    return {
      ok: false,
      status: 409,
      error: "recipient_mismatch",
      message: `Saņēmējs atšķiras no pasūtījumā saglabātā: ${maskEmail(stored)} / ${maskEmail(requested)}.`,
      stored: maskEmail(stored),
      requested: maskEmail(requested),
    };
  }
  return differs
    ? { ok: true, to, recipientOverride: true, previousRecipientMasked: maskEmail(stored) }
    : { ok: true, to, recipientOverride: false };
}

/** UI: "Sūtīt" poga aktīva tikai ar gatavu PDF, e-pastu un atzīmētu «Saņēmējs pārbaudīts». */
export function canSubmitSendReport(args: {
  prepared: boolean;
  email: string;
  busy: boolean;
  recipientChecked: boolean;
}): boolean {
  return args.prepared && !args.busy && Boolean(args.email.trim()) && args.recipientChecked;
}

/** Klienta puse: 409 recipient_mismatch, lai dialogs var piedāvāt «Sūtīt tomēr uz šo adresi». */
export class ReportRecipientMismatchError extends Error {
  readonly stored: string;
  readonly requested: string;
  constructor(message: string, stored: string, requested: string) {
    super(message);
    this.name = "ReportRecipientMismatchError";
    this.stored = stored;
    this.requested = requested;
  }
}
