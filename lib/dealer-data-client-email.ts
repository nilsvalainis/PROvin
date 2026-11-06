/**
 * Dīlera klienta e-pasta un WA šablonu melnraksti (rediģējami adminā).
 * Tīri stringi - der arī klienta komponentei, bez server-only.
 */

import { isB2bInternationalClientReport } from "@/lib/b2b-pdf-brand";
import {
  B2B_WALLET_DEFAULT_REPORT_LANG,
  isB2bWalletProductId,
  isB2bWalletReportLang,
  resolveB2bWalletPurchaseReportLang,
  type B2bWalletReportLang,
} from "@/lib/b2b-wallet";
import { b2bClientMessageSignOff, clientMessageSignOff } from "@/lib/email/report-ready-copy";
import { resolveMessageSync } from "@/lib/messages/resolve-message";
import { buildDealerNoDataVars, reportReadyVinVar } from "@/lib/messages/template-vars";
import { provinEmailSubject } from "@/lib/email/email-subject";
import type { MessageTemplatesDoc } from "@/lib/messages/types";

import { DEALER_NO_DATA_AUDIT_CTA_URL } from "@/lib/messages/shared-blocks";

export { DEALER_NO_DATA_AUDIT_CTA_URL };

function amountLine(amountEur?: string | null): string {
  const a = (amountEur ?? "").trim();
  return a || "24,99 €";
}

export type DealerClientEmailKind = "no_data" | "cancelled" | "ready";

export type DealerClientEmailDraft = {
  kind: DealerClientEmailKind;
  subject: string;
  text: string;
};

/** Soft CTA bloks (pirms auto iegādes → PROVIN AUDITS). */
export function dealerNoDataAuditCtaBlock(): string {
  return [
    "Ja auto vēl tikai plānojat pirkt, iesakām PROVIN AUDITS: padziļinātu vēstures pārbaudi ar nobraukuma, negadījumu un risku analīzi.",
    "",
    `Pasūtīt: ${DEALER_NO_DATA_AUDIT_CTA_URL}`,
  ].join("\n");
}

/**
 * E-pasts: OEM / dīlera datos nav ieraksta (ar vai bez jau veiktas atmaksas).
 * Noklusējums pēc atmaksas: A + soft CTA.
 */
export function buildDealerNoDataEmailDraft(
  opts: {
    vin?: string | null;
    amountEur?: string | null;
    /** true = teksts piemin, ka atmaksa jau veikta. */
    refunded?: boolean;
  },
  templatesDoc?: MessageTemplatesDoc | null,
): DealerClientEmailDraft {
  const refunded = opts.refunded === true;
  const id = "email.dealer.no_data";
  const vars = buildDealerNoDataVars({ vin: opts.vin, amountEur: opts.amountEur, refunded });
  const rendered = resolveMessageSync(id, vars, { doc: templatesDoc });
  if (rendered?.subject && rendered.text) {
    return { kind: "no_data", subject: rendered.subject, text: rendered.text };
  }

  const varsFallback = buildDealerNoDataVars({ vin: opts.vin, amountEur: opts.amountEur, refunded });
  const subject = varsFallback.temats ?? provinEmailSubject("Dīlera dati nav pieejami", { vin: opts.vin });
  const text = [
    "Labdien!",
    "",
    `Diemžēl oficiālā dīlera dati šim auto${varsFallback.vin ? ` (VIN ${varsFallback.vin})` : ""} nav pieejami.`,
    "",
    varsFallback.atmaksa_rinda,
    "",
    dealerNoDataAuditCtaBlock(),
    "",
    "Ja rodas jautājumi, rakstiet uz info@provin.lv.",
    "",
    clientMessageSignOff(),
  ].join("\n");
  return { kind: "no_data", subject, text };
}

export function buildDealerCancelledEmailDraft(
  opts: { vin?: string | null; amountEur?: string | null },
  templatesDoc?: MessageTemplatesDoc | null,
): DealerClientEmailDraft {
  const id = "email.dealer.cancelled";
  const vars = { summa: amountLine(opts.amountEur), vin: reportReadyVinVar(opts.vin) };
  const rendered = resolveMessageSync(id, vars, { doc: templatesDoc });
  if (rendered?.subject && rendered.text) {
    return { kind: "cancelled", subject: rendered.subject, text: rendered.text };
  }
  const amount = amountLine(opts.amountEur);
  return {
    kind: "cancelled",
    subject: provinEmailSubject("Pasūtījums atcelts, nauda atgriezta", { vin: opts.vin }),
    text: [
      "Labdien!",
      "",
      `Atcēlām Jūsu oficiālā dīlera datu pasūtījumu un atmaksājām ${amount} pilnā apmērā uz karti, ar kuru maksājāt.`,
      "",
      "Atkarībā no bankas nauda kontā parasti parādās 5 līdz 10 darba dienu laikā.",
      "",
      "Ja vēlaties pasūtīt atkārtoti, atbildiet uz šo e-pastu.",
      "",
      clientMessageSignOff(),
    ].join("\n"),
  };
}

/** Tēmas notikums + produkts katrā valodā; pilno tēmu veido provinEmailSubject (PROVIN · … · VIN). */
const DEALER_READY_SUBJECT_PARTS: Record<B2bWalletReportLang, { event: string; product: string }> = {
  lv: { event: "Atskaite gatava", product: "Oficiālie dīlera dati" },
  en: { event: "Report ready", product: "Official dealer data" },
  de: { event: "Bericht fertig", product: "Offizielle Händlerdaten" },
  ru: { event: "Отчёт готов", product: "Официальные данные дилера" },
};

export function dealerReadySubject(lang: B2bWalletReportLang, vin?: string | null): string {
  const p = DEALER_READY_SUBJECT_PARTS[lang];
  return provinEmailSubject(p.event, { product: p.product, vin });
}

export const B2B_DEALER_READY_SUBJECT: Record<B2bWalletReportLang, string> = {
  lv: dealerReadySubject("lv"),
  en: dealerReadySubject("en"),
  de: dealerReadySubject("de"),
  ru: dealerReadySubject("ru"),
};

const B2B_DEALER_READY_BODY: Record<B2bWalletReportLang, readonly string[]> = {
  lv: [
    "Labdien!",
    "",
    "Nosūtam oficiālā dīlera servisa vēsturi Jūsu pasūtījumam. Dokuments pievienots PDF pielikumā.",
    "",
    "Ja rodas jautājumi, atbildiet uz šo e-pastu.",
  ],
  en: [
    "Hello!",
    "",
    "We are sending the official dealer service history for your order. The document is attached as a PDF.",
    "",
    "If you have any questions, please reply to this email.",
  ],
  de: [
    "Guten Tag!",
    "",
    "Wir senden Ihnen die offizielle Händlerservicehistorie zu Ihrer Bestellung. Das Dokument ist als PDF angehängt.",
    "",
    "Bei Fragen antworten Sie bitte auf diese E-Mail.",
  ],
  ru: [
    "Здравствуйте!",
    "",
    "Направляем официальную сервисную историю дилера по вашему заказу. Документ приложен в формате PDF.",
    "",
    "Если возникнут вопросы, ответьте на это письмо.",
  ],
};

/** Mazumtirdzniecības klientam (.LV zīmols) - lietots, kad klients izvēlējies EN/RU/DE. */
export const DEALER_READY_SUBJECT: Record<B2bWalletReportLang, string> = B2B_DEALER_READY_SUBJECT;

const DEALER_READY_BODY: Record<B2bWalletReportLang, readonly string[]> = {
  lv: [
    "Labdien!",
    "",
    "Pielikumā nosūtām Jūsu pasūtītos oficiālā dīlera datus (PDF).",
    "",
    "Ja rodas jautājumi, atbildiet uz šo e-pastu (info@provin.lv).",
  ],
  en: [
    "Hello!",
    "",
    "Please find attached the official dealer data you ordered (PDF).",
    "",
    "If you have any questions, please reply to this email (info@provin.lv).",
  ],
  de: [
    "Guten Tag!",
    "",
    "Im Anhang finden Sie die von Ihnen bestellten offiziellen Händlerdaten (PDF).",
    "",
    "Bei Fragen antworten Sie bitte auf diese E-Mail (info@provin.lv).",
  ],
  ru: [
    "Здравствуйте!",
    "",
    "Во вложении направляем заказанные вами официальные данные дилера (PDF).",
    "",
    "Если возникнут вопросы, ответьте на это письмо (info@provin.lv).",
  ],
};

/**
 * B2B dīlera PDF e-pasta valoda: tā pati maka loģika kā #323, pēc tam LV.
 * dealer_raw / tukša dealer_pro izvēle → lv.
 */
export function resolveB2bDealerReadyEmailLang(args: {
  reportLang?: string | null;
  walletProduct?: string | null;
}): B2bWalletReportLang {
  const raw = (args.reportLang ?? "").trim().toLowerCase();
  const lang = isB2bWalletReportLang(raw) ? raw : null;
  const product = (args.walletProduct ?? "").trim().toLowerCase();
  if (isB2bWalletProductId(product)) {
    return resolveB2bWalletPurchaseReportLang(product, lang) ?? B2B_WALLET_DEFAULT_REPORT_LANG;
  }
  return lang ?? B2B_WALLET_DEFAULT_REPORT_LANG;
}

/** Tas pats B2B partnera tests kā Atskaite gatava (#323). */
export function isB2bDealerReadyEmailOrder(args: {
  notes?: string | null;
  partnerId?: string | null;
  partnerCompanyName?: string | null;
}): boolean {
  return isB2bInternationalClientReport(args);
}

function buildDealerReadyEmailDraftForLang(
  lang: B2bWalletReportLang,
  b2bClient: boolean,
  vin?: string | null,
): DealerClientEmailDraft {
  if (b2bClient) {
    return {
      kind: "ready",
      subject: dealerReadySubject(lang, vin),
      text: [...B2B_DEALER_READY_BODY[lang], "", b2bClientMessageSignOff(lang)].join("\n"),
    };
  }
  return {
    kind: "ready",
    subject: dealerReadySubject(lang, vin),
    text: [...DEALER_READY_BODY[lang], "", clientMessageSignOff(lang)].join("\n"),
  };
}

/** E-pasts ar dīlera PDF pielikumu - operators rediģē pirms sūtīšanas. */
export function buildDealerReadyEmailDraft(
  opts: { vin?: string | null; b2bClient?: boolean; lang?: string | null; walletProduct?: string | null },
  templatesDoc?: MessageTemplatesDoc | null,
): DealerClientEmailDraft {
  const b2bClient = opts.b2bClient === true;
  const lang = resolveB2bDealerReadyEmailLang({
    reportLang: opts.lang,
    walletProduct: opts.walletProduct,
  });
  /** Editējamais LV šablons der tikai, kad nav nedz B2B zīmola, nedz cita valoda. */
  if (b2bClient || lang !== B2B_WALLET_DEFAULT_REPORT_LANG) {
    return buildDealerReadyEmailDraftForLang(lang, b2bClient, opts.vin);
  }
  const id = "email.dealer.ready_pdf";
  const rendered = resolveMessageSync(id, { vin: reportReadyVinVar(opts.vin) }, { doc: templatesDoc });
  if (rendered?.subject && rendered.text) {
    return { kind: "ready", subject: rendered.subject, text: rendered.text };
  }
  return {
    kind: "ready",
    subject: dealerReadySubject("lv", opts.vin),
    text: [
      `Labdien!`,
      "",
      "Pielikumā nosūtām Jūsu pasūtītos oficiālā dīlera datus (PDF).",
      "",
      "Ja rodas jautājumi, atbildiet uz šo e-pastu (info@provin.lv).",
      "",
      clientMessageSignOff(),
    ].join("\n"),
  };
}

/** Plain text → vienkāršs HTML rindkopām (operatora rediģētais teksts). */
export function plainTextToEmailHtmlParagraphs(text: string): string {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks
    .map((block) => {
      const esc = block
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/\n/g, "<br/>");
      return `<p style="margin:0 0 12px;font-size:15px;color:#1d1d1f;line-height:1.6;">${esc}</p>`;
    })
    .join("\n");
}
