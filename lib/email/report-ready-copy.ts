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
import { resolveMessageSync } from "@/lib/messages/resolve-message";
import { buildReportReadyEmailVars, reportReadyTemplateId } from "@/lib/messages/template-vars";
import type { MessageTemplatesDoc } from "@/lib/messages/types";

export { GOOGLE_REVIEW_URL, CLIENT_MESSAGE_SIGN_OFF_LINES };

export function googleReviewPlainBlock(): string {
  return defaultGoogleReviewBlock();
}

export function clientMessageSignOff(): string {
  return defaultSignOffBlock();
}

export const B2B_CLIENT_MESSAGE_SIGN_OFF_LINES = ["Ar cieņu,", "PROVIN"] as const;

export function b2bClientMessageSignOff(): string {
  return B2B_CLIENT_MESSAGE_SIGN_OFF_LINES.join("\n");
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

export function buildReportReadySubject(kind: ReportReadyProductKind, _vin?: string): string {
  if (kind === "dealer") return "PROVIN servisa vēstures atskaite ir gatava";
  if (kind === "mini") return "PROVIN MINI atskaite ir gatava";
  return "PROVIN AUDITS atskaite ir gatava";
}

function reportReadyClosingLines(includeGoogleReview?: boolean, b2bClient?: boolean): string[] {
  const lines: string[] = [];
  if (includeGoogleReview && !b2bClient) {
    lines.push(googleReviewPlainBlock(), "");
  }
  lines.push(...(b2bClient ? B2B_CLIENT_MESSAGE_SIGN_OFF_LINES : CLIENT_MESSAGE_SIGN_OFF_LINES));
  return lines;
}

export function buildReportReadyPlainText(
  opts: {
    kind: ReportReadyProductKind;
    vin: string;
    attachmentLines: string[];
    includeGoogleReview?: boolean;
    b2bClient?: boolean;
  },
  templatesDoc?: MessageTemplatesDoc | null,
): string {
  const b2bClient = opts.b2bClient === true;
  if (!b2bClient) {
    const vars = buildReportReadyEmailVars(opts);
    const rendered = resolveMessageSync(reportReadyTemplateId(opts.kind), vars, { doc: templatesDoc });
    if (rendered?.text) return rendered.text;
  }

  const files = opts.attachmentLines.filter((n) => n.trim());
  const closing = reportReadyClosingLines(opts.includeGoogleReview, b2bClient);

  if (opts.kind === "dealer") {
    const parts = [
      "Labdien!",
      "",
      "Jūsu pieprasītie oficiālā dīlera servisa vēstures dati ir sagatavoti.",
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
      "Jūsu pasūtītā PROVIN MINI atskaite ir sagatavota un pievienota šī e-pasta pielikumā.",
      "",
      "Ja Jums rodas kādi jautājumi, droši rakstiet mums uz info@provin.lv, labprāt palīdzēsim!",
      "",
      ...closing,
    ].join("\n");
  }

  return [
    "Labdien!",
    "",
    "Jūsu pasūtītā PROVIN AUDITS atskaite ir sagatavota.",
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
