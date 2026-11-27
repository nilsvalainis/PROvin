/**
 * AUDITS / BUSINESS «Sūtīt atskaiti» forma (Nila makets 27.11): ziņas teksts no šablonu reģistra,
 * B2B diskrētā režīma noteikšana, valodas un kontrolsaraksta (13.11 LAW) loģika.
 * Tīra loģika - der klienta komponentei, serverim un testiem.
 */
import { CLIENT_REPORT_LANGS, type ClientReportLang } from "@/lib/client-report-i18n";
import { isB2bInternationalClientReport } from "@/lib/b2b-pdf-brand";
import { auditsSendTemplateIdFor, type AuditsSendTemplateKey } from "@/lib/messages/audits-send-template-defs";
import { applyB2bSignature } from "@/lib/messages/localized-templates";
import { renderTemplateById } from "@/lib/messages/render-template-id";
import { reportReadyVinVar } from "@/lib/messages/template-vars";
import type { MessageTemplatesDoc } from "@/lib/messages/types";

export type AuditSendChannel = "email" | "whatsapp";
export type AuditSendSituation = "ready" | "fixed";

export const AUDIT_SEND_SITUATION_LV: Record<AuditSendSituation, string> = {
  ready: "Gatava",
  fixed: "Labota versija",
};

export function isAuditSendSituation(v: unknown): v is AuditSendSituation {
  return v === "ready" || v === "fixed";
}

/**
 * B2B diskrētais režīms: partnera pasūtījums (`isB2bInternationalClientReport`), PROVIN paraugs (isDemo)
 * vai saņēmējs ir B2B partneris. Tad e-pastā tikai «PROVIN», bez mārketinga, bez partnera nosaukuma.
 */
export function isAuditSendB2b(args: {
  notes?: string | null;
  partnerId?: string | null;
  partnerCompanyName?: string | null;
  isDemo?: boolean | null;
  recipientRole?: "client" | "partner" | null;
}): boolean {
  return (
    isB2bInternationalClientReport({ notes: args.notes, partnerId: args.partnerId, partnerCompanyName: args.partnerCompanyName }) ||
    args.isDemo === true ||
    args.recipientRole === "partner"
  );
}

/** Valodas: B2B - LV/EN/RU/DE; privātam AUDITS klientam - LV/EN/RU (kā līdz šim, Nils 19.11). */
export function auditSendLangOptions(b2b: boolean): ClientReportLang[] {
  return b2b ? [...CLIENT_REPORT_LANGS] : ["lv", "en", "ru"];
}

/** Sākuma valoda: partnera fiksētā (ja nav atbloķēta) -> pasūtījuma klienta valoda -> LV, ja nav atļauta. */
export function auditSendInitialLang(args: {
  b2b: boolean;
  orderLang: ClientReportLang;
  lockedLang?: ClientReportLang | null;
}): ClientReportLang {
  const opts = auditSendLangOptions(args.b2b);
  if (args.lockedLang && opts.includes(args.lockedLang)) return args.lockedLang;
  return opts.includes(args.orderLang) ? args.orderLang : "lv";
}

export function auditSendTemplateId(channel: AuditSendChannel, situation: AuditSendSituation, b2b: boolean): string {
  const key = `${b2b ? "b2b_" : ""}${situation}` as AuditsSendTemplateKey;
  return auditsSendTemplateIdFor(channel, key);
}

export type AuditSendMessageInput = {
  channel: AuditSendChannel;
  situation: AuditSendSituation;
  b2b: boolean;
  vin?: string | null;
  /** «Audi A6 Avant 3.0 TDI»; B2B tekstā auto nosaukumu neliek. */
  car?: string | null;
  lang?: ClientReportLang | null;
  doc?: MessageTemplatesDoc | null;
};

function tidy(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildAuditSendMessage(input: AuditSendMessageInput): { subject?: string; text: string } {
  const id = auditSendTemplateId(input.channel, input.situation, input.b2b);
  const vars: Record<string, string> = {
    vin: reportReadyVinVar(input.vin),
    auto: input.b2b ? "" : (input.car ?? "").trim(),
    zimols: input.b2b ? "PROVIN" : "PROVIN.LV",
  };
  const rendered = renderTemplateById(id, vars, input.doc, { lang: input.lang });
  const raw = tidy(rendered?.text ?? "");
  // B2B paraksts tikai «PROVIN» (Nils 25.11) - arī, ja admina pārrakstā palicis «Nils» vai «PROVIN.LV».
  const text = input.b2b ? applyB2bSignature(raw) : raw;
  const subjectRaw = input.channel === "email" ? rendered?.subject?.trim() : undefined;
  const subject = subjectRaw && input.b2b ? applyB2bSignature(subjectRaw) : subjectRaw;
  return subject ? { subject, text } : { text };
}

/** Kontrolsaraksts pirms sūtīšanas (13.11 LAW, 4 punkti) - katrs atzīmējams ar roku. */
export const AUDIT_SEND_CHECKS = ["Jaunākais fails", "Lauki aizpildīti", "Pamatdati pareizi", "Nav pretrunu"] as const;
export type AuditSendChecks = readonly [boolean, boolean, boolean, boolean];
export const AUDIT_SEND_CHECKS_EMPTY: AuditSendChecks = [false, false, false, false];

export function auditSendChecksDone(checks: readonly boolean[]): number {
  return checks.filter(Boolean).length;
}

/**
 * «Sūtīt» aktīva tikai, kad visi 4 punkti atzīmēti, nekas nenotiek, ir teksts (un e-pastam - temats + saņēmējs).
 * Atgriež `null` (drīkst) vai iemeslu latviski.
 */
export function auditSendBlockedReason(args: {
  checks: readonly boolean[];
  busy: boolean;
  channel: AuditSendChannel;
  email: string;
  subject: string;
  text: string;
}): string | null {
  if (args.busy) return "Notiek darbība.";
  const done = auditSendChecksDone(args.checks);
  if (args.checks.length !== AUDIT_SEND_CHECKS.length || done < AUDIT_SEND_CHECKS.length) {
    return `Pārbaude ${done} / ${AUDIT_SEND_CHECKS.length}`;
  }
  if (!args.text.trim()) return "Teksts ir tukšs.";
  if (args.channel === "email") {
    if (!args.email.trim()) return "Nav klienta e-pasta (sadaļa «Klienta dati»).";
    if (!args.subject.trim()) return "Temats ir tukšs.";
  }
  return null;
}

/** Pārbaudes punkts «Jaunākais fails» jāatzīmē no jauna, ja PDF mainās (valoda, situācija, «Atjaunot»). */
export function auditSendChecksAfterPdfChange(checks: AuditSendChecks): AuditSendChecks {
  return [false, checks[1], checks[2], checks[3]];
}
