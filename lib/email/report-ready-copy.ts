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
  if (kind === "dealer") return "PROVIN: oficiālā dīlera dati ir gatavi";
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
      "Jūsu pasūtītie oficiālā dīlera dati ir gatavi.",
      "",
      "Pielikumā atradīsiet:",
    ];
    if (files.length > 0) {
      parts.push("", ...files.map((n) => `- ${n}`));
    }
    parts.push(
      "",
      "Ja rodas jautājumi, rakstiet uz info@provin.lv. Labprāt palīdzēsim.",
      "",
      ...closing,
    );
    return parts.join("\n");
  }

  if (opts.kind === "mini") {
    return [
      "Labdien!",
      "",
      "Jūsu PROVIN MINI atskaite ir gatava. Tā pievienota šī e-pasta pielikumā.",
      "",
      "Ja rodas jautājumi, rakstiet uz info@provin.lv. Labprāt palīdzēsim.",
      "",
      ...closing,
    ].join("\n");
  }

  return [
    "Labdien!",
    "",
    "Jūsu PROVIN AUDITS atskaite ir gatava.",
    "",
    "Pielikumā atradīsiet:",
    "",
    "- Kopsavilkuma PDF atskaiti",
    "- Papildu materiālus un pielikumus",
    "",
    "Ja rodas jautājumi vai vajadzīga papildu konsultācija, rakstiet uz info@provin.lv. Labprāt palīdzēsim.",
    "",
    ...closing,
  ].join("\n");
}
