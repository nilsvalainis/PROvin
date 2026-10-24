/**
 * Klienta „atskaite gatava” e-pasti: dīleris / MINI / AUDITS.
 * Tīri stringi - der HTML veidnei un testiem.
 */
import {
  isDealerHighlightAdminOrder,
  isMiniHighlightAdminOrder,
} from "@/lib/admin-customer-identity";
import type { ClientReportLang } from "@/lib/client-report-i18n";
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

/** "Ar cieņu," tulkojumi - vārds "Nils" un "PROVIN" / "PROVIN.LV" paliek nemainīgi. */
const SIGN_OFF_GREETING: Record<ClientReportLang, string> = {
  lv: "Ar cieņu,",
  en: "Best regards,",
  ru: "С уважением,",
  de: "Mit freundlichen Grüßen,",
};

const GOOGLE_REVIEW_INTRO: Record<ClientReportLang, string> = {
  lv: "Ja mūsu darbs Jums noderēja, būšu pateicīgs par īsu atsauksmi Google:",
  en: "If our work was useful to you, I would be grateful for a short Google review:",
  ru: "Если наша работа была вам полезна, буду благодарен за короткий отзыв в Google:",
  de: "Wenn Ihnen unsere Arbeit geholfen hat, würde ich mich über eine kurze Google-Bewertung freuen:",
};

export function googleReviewPlainBlock(lang: ClientReportLang = "lv"): string {
  if (lang === "lv") return defaultGoogleReviewBlock();
  return `${GOOGLE_REVIEW_INTRO[lang]} ${GOOGLE_REVIEW_URL}`;
}

export function clientMessageSignOff(lang: ClientReportLang = "lv"): string {
  if (lang === "lv") return defaultSignOffBlock();
  return [SIGN_OFF_GREETING[lang], "Nils", "PROVIN.LV"].join("\n");
}

export const B2B_CLIENT_MESSAGE_SIGN_OFF_LINES = ["Ar cieņu,", "PROVIN"] as const;

export function b2bClientMessageSignOff(lang: ClientReportLang = "lv"): string {
  if (lang === "lv") return B2B_CLIENT_MESSAGE_SIGN_OFF_LINES.join("\n");
  return [SIGN_OFF_GREETING[lang], "PROVIN"].join("\n");
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

const REPORT_READY_SUBJECT: Record<ReportReadyProductKind, Record<ClientReportLang, string>> = {
  dealer: {
    lv: "PROVIN: oficiālā dīlera dati ir gatavi",
    en: "PROVIN: your official dealer data is ready",
    ru: "PROVIN: официальные данные дилера готовы",
    de: "PROVIN: Ihre offiziellen Händlerdaten sind fertig",
  },
  mini: {
    lv: "PROVIN MINI atskaite ir gatava",
    en: "Your PROVIN MINI report is ready",
    ru: "Ваш отчёт PROVIN MINI готов",
    de: "Ihr PROVIN MINI Bericht ist fertig",
  },
  audits: {
    lv: "PROVIN AUDITS atskaite ir gatava",
    en: "Your PROVIN AUDITS report is ready",
    ru: "Ваш отчёт PROVIN AUDITS готов",
    de: "Ihr PROVIN AUDITS Bericht ist fertig",
  },
};

export function buildReportReadySubject(
  kind: ReportReadyProductKind,
  _vin?: string,
  lang: ClientReportLang = "lv",
): string {
  return REPORT_READY_SUBJECT[kind][lang];
}

const REPORT_READY_GREETING: Record<ClientReportLang, string> = {
  lv: "Labdien!",
  en: "Hello!",
  ru: "Здравствуйте!",
  de: "Guten Tag!",
};

const REPORT_READY_ATTACHMENTS_INTRO: Record<ClientReportLang, string> = {
  lv: "Pielikumā atradīsiet:",
  en: "You will find attached:",
  ru: "Во вложении вы найдёте:",
  de: "Im Anhang finden Sie:",
};

const REPORT_READY_MAIN_LINE: Record<ReportReadyProductKind, Record<ClientReportLang, string>> = {
  dealer: {
    lv: "Jūsu pasūtītie oficiālā dīlera dati ir gatavi.",
    en: "The official dealer data you ordered is ready.",
    ru: "Заказанные вами официальные данные дилера готовы.",
    de: "Die von Ihnen bestellten offiziellen Händlerdaten sind fertig.",
  },
  mini: {
    lv: "Jūsu PROVIN MINI atskaite ir gatava. Tā pievienota šī e-pasta pielikumā.",
    en: "Your PROVIN MINI report is ready. It is attached to this email.",
    ru: "Ваш отчёт PROVIN MINI готов. Он приложен к этому письму.",
    de: "Ihr PROVIN MINI Bericht ist fertig. Er ist diesem E-Mail beigefügt.",
  },
  audits: {
    lv: "Jūsu PROVIN AUDITS atskaite ir gatava.",
    en: "Your PROVIN AUDITS report is ready.",
    ru: "Ваш отчёт PROVIN AUDITS готов.",
    de: "Ihr PROVIN AUDITS Bericht ist fertig.",
  },
};

const REPORT_READY_QUESTION_LINE: Record<ReportReadyProductKind, Record<ClientReportLang, string>> = {
  dealer: {
    lv: "Ja rodas jautājumi, rakstiet uz info@provin.lv. Labprāt palīdzēsim.",
    en: "If you have any questions, please write to info@provin.lv. We're happy to help.",
    ru: "Если у вас есть вопросы, напишите на info@provin.lv. Будем рады помочь.",
    de: "Bei Fragen schreiben Sie bitte an info@provin.lv. Wir helfen gerne weiter.",
  },
  mini: {
    lv: "Ja rodas jautājumi, rakstiet uz info@provin.lv. Labprāt palīdzēsim.",
    en: "If you have any questions, please write to info@provin.lv. We're happy to help.",
    ru: "Если у вас есть вопросы, напишите на info@provin.lv. Будем рады помочь.",
    de: "Bei Fragen schreiben Sie bitte an info@provin.lv. Wir helfen gerne weiter.",
  },
  audits: {
    lv: "Ja rodas jautājumi vai vajadzīga papildu konsultācija, rakstiet uz info@provin.lv. Labprāt palīdzēsim.",
    en: "If you have any questions or need additional consultation, please write to info@provin.lv. We're happy to help.",
    ru: "Если у вас есть вопросы или нужна дополнительная консультация, напишите на info@provin.lv. Будем рады помочь.",
    de: "Bei Fragen oder wenn Sie eine weitere Beratung benötigen, schreiben Sie bitte an info@provin.lv. Wir helfen gerne weiter.",
  },
};

const REPORT_READY_AUDITS_BULLETS: Record<ClientReportLang, readonly [string, string]> = {
  lv: ["Kopsavilkuma PDF atskaiti", "Papildu materiālus un pielikumus"],
  en: ["Summary PDF report", "Additional materials and attachments"],
  ru: ["Сводный PDF-отчёт", "Дополнительные материалы и приложения"],
  de: ["Zusammenfassenden PDF-Bericht", "Zusätzliche Materialien und Anhänge"],
};

function reportReadyClosingLines(
  includeGoogleReview?: boolean,
  b2bClient?: boolean,
  lang: ClientReportLang = "lv",
): string[] {
  const lines: string[] = [];
  if (includeGoogleReview && !b2bClient) {
    lines.push(googleReviewPlainBlock(lang), "");
  }
  lines.push(
    ...(b2bClient
      ? b2bClientMessageSignOff(lang).split("\n")
      : clientMessageSignOff(lang).split("\n")),
  );
  return lines;
}

export function buildReportReadyPlainText(
  opts: {
    kind: ReportReadyProductKind;
    vin: string;
    attachmentLines: string[];
    includeGoogleReview?: boolean;
    b2bClient?: boolean;
    lang?: ClientReportLang;
  },
  templatesDoc?: MessageTemplatesDoc | null,
): string {
  const b2bClient = opts.b2bClient === true;
  const lang = opts.lang ?? "lv";
  if (!b2bClient && lang === "lv") {
    const vars = buildReportReadyEmailVars(opts);
    const rendered = resolveMessageSync(reportReadyTemplateId(opts.kind), vars, { doc: templatesDoc });
    if (rendered?.text) return rendered.text;
  }

  const files = opts.attachmentLines.filter((n) => n.trim());
  const closing = reportReadyClosingLines(opts.includeGoogleReview, b2bClient, lang);
  const greeting = REPORT_READY_GREETING[lang];
  const mainLine = REPORT_READY_MAIN_LINE[opts.kind][lang];
  const questionLine = REPORT_READY_QUESTION_LINE[opts.kind][lang];

  if (opts.kind === "dealer") {
    const parts = [greeting, "", mainLine, "", REPORT_READY_ATTACHMENTS_INTRO[lang]];
    if (files.length > 0) {
      parts.push("", ...files.map((n) => `- ${n}`));
    }
    parts.push("", questionLine, "", ...closing);
    return parts.join("\n");
  }

  if (opts.kind === "mini") {
    return [greeting, "", mainLine, "", questionLine, "", ...closing].join("\n");
  }

  const bullets = REPORT_READY_AUDITS_BULLETS[lang];
  return [
    greeting,
    "",
    mainLine,
    "",
    REPORT_READY_ATTACHMENTS_INTRO[lang],
    "",
    `- ${bullets[0]}`,
    `- ${bullets[1]}`,
    "",
    questionLine,
    "",
    ...closing,
  ].join("\n");
}
