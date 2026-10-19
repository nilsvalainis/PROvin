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
import { buildDealerNoDataVars } from "@/lib/messages/template-vars";
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
  const subject = varsFallback.temats ?? "PROVIN.LV: dīlera dati nav pieejami";
  const text = [
    "Labdien!",
    "",
    "Diemžēl oficiālā dīlera dati šim auto nav pieejami.",
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
  const vars = { summa: amountLine(opts.amountEur) };
  const rendered = resolveMessageSync(id, vars, { doc: templatesDoc });
  if (rendered?.subject && rendered.text) {
    return { kind: "cancelled", subject: rendered.subject, text: rendered.text };
  }
  const amount = amountLine(opts.amountEur);
  return {
    kind: "cancelled",
    subject: "PROVIN.LV: pasūtījums atcelts un maksājums atgriezts",
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

export const B2B_DEALER_READY_SUBJECT: Record<B2bWalletReportLang, string> = {
  lv: "PROVIN: oficiālā dīlera dati pielikumā",
  en: "PROVIN: official dealer data attached",
  de: "PROVIN: offizielle Händlerdaten im Anhang",
  ru: "PROVIN: данные официального дилера во вложении",
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

function buildB2bDealerReadyEmailDraft(lang: B2bWalletReportLang): DealerClientEmailDraft {
  return {
    kind: "ready",
    subject: B2B_DEALER_READY_SUBJECT[lang],
    text: [...B2B_DEALER_READY_BODY[lang], "", b2bClientMessageSignOff()].join("\n"),
  };
}

/** E-pasts ar dīlera PDF pielikumu - operators rediģē pirms sūtīšanas. */
export function buildDealerReadyEmailDraft(
  opts: { vin?: string | null; b2bClient?: boolean; lang?: string | null; walletProduct?: string | null },
  templatesDoc?: MessageTemplatesDoc | null,
): DealerClientEmailDraft {
  if (opts.b2bClient === true) {
    const lang = resolveB2bDealerReadyEmailLang({
      reportLang: opts.lang,
      walletProduct: opts.walletProduct,
    });
    return buildB2bDealerReadyEmailDraft(lang);
  }
  const id = "email.dealer.ready_pdf";
  const rendered = resolveMessageSync(id, {}, { doc: templatesDoc });
  if (rendered?.subject && rendered.text) {
    return { kind: "ready", subject: rendered.subject, text: rendered.text };
  }
  return {
    kind: "ready",
    subject: "PROVIN.LV: oficiālā dīlera dati pielikumā",
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
