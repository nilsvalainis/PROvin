import { provinEmailSubject } from "@/lib/email/email-subject";
import { CLIENT_EMAIL_QUESTION_LINE } from "@/lib/email/client-email-contact";
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
  defaultSignOffBlock,
} from "@/lib/messages/shared-blocks";
import { resolveMessageSync } from "@/lib/messages/resolve-message";
import { buildReportReadyEmailVars, reportReadyTemplateId, reportReadyVinVar } from "@/lib/messages/template-vars";
import type { MessageTemplatesDoc } from "@/lib/messages/types";

export { GOOGLE_REVIEW_URL, CLIENT_MESSAGE_SIGN_OFF_LINES };

/** "Ar cieņu," tulkojumi - "PROVIN" / "PROVIN.LV" paliek nemainīgi; vārda parakstā nav (Nils 26.11). */
const SIGN_OFF_GREETING: Record<ClientReportLang, string> = {
  lv: "Ar cieņu,",
  en: "Best regards,",
  ru: "С уважением,",
  de: "Mit freundlichen Grüßen,",
};

export function clientMessageSignOff(lang: ClientReportLang = "lv"): string {
  if (lang === "lv") return defaultSignOffBlock();
  return [SIGN_OFF_GREETING[lang], "PROVIN.LV"].join("\n");
}

export const B2B_CLIENT_MESSAGE_SIGN_OFF_LINES = ["Ar cieņu,", "PROVIN"] as const;

export function b2bClientMessageSignOff(lang: ClientReportLang = "lv"): string {
  if (lang === "lv") return B2B_CLIENT_MESSAGE_SIGN_OFF_LINES.join("\n");
  return [SIGN_OFF_GREETING[lang], "PROVIN"].join("\n");
}

export type ReportReadyProductKind = "dealer" | "mini" | "audits";

/**
 * B2B diskrētais režīms (AUDITS forma, Nils 27.11): partnerim e-pastā nav «PROVIN AUDITS» / «PROVIN.LV» -
 * statusa kartē un tematā «Transportlīdzekļa pārbaude».
 */
export const B2B_DISCREET_PRODUCT: Record<ClientReportLang, string> = {
  lv: "Transportlīdzekļa pārbaude",
  en: "Vehicle check",
  ru: "Проверка транспортного средства",
  de: "Fahrzeugprüfung",
};

/** «Labota versija» statusa kartē (AUDITS forma). */
export const REPORT_CORRECTED_TITLE: Record<ClientReportLang, string> = {
  lv: "Labota versija",
  en: "Corrected version",
  ru: "Исправленная версия",
  de: "Korrigierte Fassung",
};

export function resolveReportReadyProductKind(args: {
  checkoutLine?: string | null;
  amountTotalCents?: number | null;
}): ReportReadyProductKind {
  if (isDealerDataAutoFetchOrder(args) || isDealerHighlightAdminOrder(args)) return "dealer";
  if (isMiniHighlightAdminOrder(args)) return "mini";
  return "audits";
}

const REPORT_READY_EVENT: Record<ClientReportLang, string> = {
  lv: "Atskaite gatava",
  en: "Report ready",
  ru: "Отчёт готов",
  de: "Bericht fertig",
};

const REPORT_READY_PRODUCT: Record<ReportReadyProductKind, Record<ClientReportLang, string>> = {
  dealer: { lv: "Oficiālā dīlera dati", en: "Official dealer data", ru: "Официальные данные дилера", de: "Offizielle Händlerdaten" },
  mini: { lv: "PROVIN MINI", en: "PROVIN MINI", ru: "PROVIN MINI", de: "PROVIN MINI" },
  audits: { lv: "PROVIN AUDITS", en: "PROVIN AUDITS", ru: "PROVIN AUDITS", de: "PROVIN AUDITS" },
};

export function buildReportReadySubject(
  kind: ReportReadyProductKind,
  vin?: string,
  lang: ClientReportLang = "lv",
): string {
  return provinEmailSubject(REPORT_READY_EVENT[lang], { product: REPORT_READY_PRODUCT[kind][lang], vin });
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


const REPORT_READY_AUDITS_BULLETS: Record<ClientReportLang, readonly [string, string]> = {
  lv: ["Kopsavilkuma PDF atskaiti", "Papildu materiālus un pielikumus"],
  en: ["Summary PDF report", "Additional materials and attachments"],
  ru: ["Сводный PDF-отчёт", "Дополнительные материалы и приложения"],
  de: ["Zusammenfassenden PDF-Bericht", "Zusätzliche Materialien und Anhänge"],
};

/** Atskaites e-pasta beigas: tikai paraksts. Atsauksmes lūgums ir atsevišķs e-pasts nākamajā darba dienā (Nils 26.11, `lib/review-ask.ts`). */
function reportReadyClosingLines(b2bClient?: boolean, lang: ClientReportLang = "lv"): string[] {
  const lines: string[] = [];
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
    /** Novecojis (26.11): atskaites e-pastā atsauksmes lūguma vairs nav; vērtība tiek ignorēta. */
    includeGoogleReview?: boolean;
    b2bClient?: boolean;
    lang?: ClientReportLang;
  },
  templatesDoc?: MessageTemplatesDoc | null,
): string {
  const b2bClient = opts.b2bClient === true;
  const lang = opts.lang ?? "lv";
  if (!b2bClient && lang === "lv") {
    const vars = buildReportReadyEmailVars({ ...opts, includeGoogleReview: false });
    const rendered = resolveMessageSync(reportReadyTemplateId(opts.kind), vars, { doc: templatesDoc });
    if (rendered?.text) return rendered.text;
  }

  const files = opts.attachmentLines.filter((n) => n.trim());
  const closing = reportReadyClosingLines(b2bClient, lang);
  const greeting = REPORT_READY_GREETING[lang];
  const mainLine = REPORT_READY_MAIN_LINE[opts.kind][lang];
  const questionLine = CLIENT_EMAIL_QUESTION_LINE[lang];

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
  const lines = files.length > 0 ? files.map((n) => `- ${n}`) : [`- ${bullets[0]}`, `- ${bullets[1]}`];
  return [
    greeting,
    "",
    mainLine,
    "",
    REPORT_READY_ATTACHMENTS_INTRO[lang],
    "",
    ...lines,
    "",
    questionLine,
    "",
    ...closing,
  ].join("\n");
}
