/**
 * Klienta „atskaite gatava” e-pasti: dīleris / MINI / AUDITS.
 * Tīri stringi - der HTML veidnei un testiem.
 */
import {
  isDealerHighlightAdminOrder,
  isMiniHighlightAdminOrder,
} from "@/lib/admin-customer-identity";
import { isDealerDataAutoFetchOrder } from "@/lib/dealer-data-job-types";
import {
  CLIENT_MESSAGE_SIGN_OFF_LINES,
  GOOGLE_REVIEW_URL,
  defaultGoogleReviewBlock,
  defaultSignOffBlock,
} from "@/lib/messages/shared-blocks";
import { getMessageTemplateDef } from "@/lib/messages/registry";
import { renderTemplateString } from "@/lib/messages/render-template";
import { buildReportReadyEmailVars, reportReadyTemplateId } from "@/lib/messages/template-vars";
import type { MessageTemplatesDoc } from "@/lib/messages/types";

export { GOOGLE_REVIEW_URL, CLIENT_MESSAGE_SIGN_OFF_LINES };

export function googleReviewPlainBlock(): string {
  return defaultGoogleReviewBlock();
}

export function clientMessageSignOff(): string {
  return defaultSignOffBlock();
}

export type ReportReadyProductKind = "dealer" | "mini" | "audits";

export function resolveReportReadyProductKind(args: {
  checkoutLine?: string | null;
  amountTotalCents?: number | null;
}): ReportReadyProductKind {
  if (isDealerDataAutoFetchOrder(args) || isDealerHighlightAdminOrder(args)) return "dealer";
  if (isMiniHighlightAdminOrder(args)) return "mini";
  return "audits";
}

function vinPhrase(vin: string): string {
  return vin ? ` transportlīdzeklim ar VIN ${vin}` : "";
}

export function buildReportReadySubject(kind: ReportReadyProductKind, vin: string): string {
  if (kind === "dealer") {
    return vin ? `PROVIN servisa vēstures atskaite (${vin})` : "PROVIN servisa vēstures atskaite";
  }
  if (kind === "mini") {
    return vin ? `PROVIN MINI atskaite (${vin})` : "PROVIN MINI atskaite";
  }
  return vin ? `PROVIN AUDITS atskaite (${vin})` : "PROVIN AUDITS atskaite";
}

function reportReadyClosingLines(includeGoogleReview?: boolean): string[] {
  const lines: string[] = [];
  if (includeGoogleReview) {
    lines.push(googleReviewPlainBlock(), "");
  }
  lines.push(...CLIENT_MESSAGE_SIGN_OFF_LINES);
  return lines;
}

export function buildReportReadyPlainText(
  opts: {
    kind: ReportReadyProductKind;
    vin: string;
    attachmentLines: string[];
    includeGoogleReview?: boolean;
  },
  templatesDoc?: MessageTemplatesDoc | null,
): string {
  const vars = buildReportReadyEmailVars(opts);
  const def = getMessageTemplateDef(reportReadyTemplateId(opts.kind));
  const override = templatesDoc?.overrides[reportReadyTemplateId(opts.kind)];
  const bodyTpl = override?.body ?? def?.body;
  if (bodyTpl) {
    const withSign = { ...vars, paraksts: vars.paraksts || clientMessageSignOff() };
    return renderTemplateString(bodyTpl, withSign);
  }

  const vin = opts.vin.trim();
  const files = opts.attachmentLines.filter((n) => n.trim());
  const closing = reportReadyClosingLines(opts.includeGoogleReview);

  if (opts.kind === "dealer") {
    const parts = [
      "Labdien!",
      "",
      `Jūsu pieprasītie oficiālā dīlera servisa vēstures dati${vinPhrase(vin)} ir sagatavoti.`,
      "",
      "Pielikumā atradīsiet šādus dokumentus:",
    ];
    if (files.length > 0) {
      parts.push("", ...files.map((n) => `- ${n}`));
    }
    parts.push(
      "",
      "Ja Jums rodas papildu jautājumi, droši rakstiet mums uz info@provin.lv.",
      "",
      ...closing,
    );
    return parts.join("\n");
  }

  if (opts.kind === "mini") {
    return [
      "Labdien!",
      "",
      `Jūsu pasūtītā PROVIN MINI atskaite${vinPhrase(vin)} ir sagatavota un pievienota šī e-pasta pielikumā.`,
      "",
      "Ja Jums rodas kādi jautājumi, droši rakstiet mums uz info@provin.lv, labprāt palīdzēsim!",
      "",
      ...closing,
    ].join("\n");
  }

  return [
    "Labdien!",
    "",
    `Jūsu pasūtītā PROVIN AUDITS atskaite${vinPhrase(vin)} ir sagatavota.`,
    "",
    "E-pasta pielikumā atradīsiet:",
    "",
    "- Kopsavilkuma PDF atskaiti",
    "- Papildu materiālus un pielikumus",
    "",
    "Ja Jums rodas kādi jautājumi vai nepieciešama papildu konsultācija, droši rakstiet mums uz info@provin.lv, labprāt palīdzēsim!",
    "",
    ...closing,
  ].join("\n");
}
