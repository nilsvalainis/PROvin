/**
 * B2B maka atmaksas e-pasta teksts.
 * Vietturņi: {{vin}} {{summa}} {{atlikums}} {{produkts}}.
 * Zīmols: PROVIN, bez .LV.
 */

export type B2bWalletRefundEmailLang = "lv" | "en" | "ru" | "de";
type WalletProduct = "business" | "dealer_raw" | "dealer_pro";

export const B2B_WALLET_REFUND_EMAIL_PRODUCT: Record<WalletProduct, string> = {
  business: "Business",
  dealer_raw: "Dīlera dati RAW",
  dealer_pro: "Dīlera dati PRO",
};

const PRODUCT_I18N: Record<Exclude<B2bWalletRefundEmailLang, "lv">, Record<WalletProduct, string>> = {
  en: { business: "Business", dealer_raw: "Dealer data RAW", dealer_pro: "Dealer data PRO" },
  ru: { business: "Business", dealer_raw: "Данные дилера RAW", dealer_pro: "Данные дилера PRO" },
  de: { business: "Business", dealer_raw: "Händlerdaten RAW", dealer_pro: "Händlerdaten PRO" },
};

/** Produkta nosaukums e-pastā partnera valodā. */
export function b2bWalletRefundEmailProduct(product: WalletProduct, lang?: B2bWalletRefundEmailLang | null): string {
  return lang && lang !== "lv" ? PRODUCT_I18N[lang][product] : B2B_WALLET_REFUND_EMAIL_PRODUCT[product];
}

export const B2B_WALLET_REFUND_EMAIL = {
  subject: "PROVIN · Dati nav pieejami, {{summa}} atgriezti kontā · {{vin}}",
  body: [
    "Sveiki!",
    "",
    "Dīlera dati VIN {{vin}} ({{produkts}}) šobrīd nav pieejami.",
    "Summa {{summa}} ir atgriezta jūsu konta atlikumā.",
    "Jaunais atlikums: {{atlikums}}.",
    "",
    "Ar cieņu,",
    "PROVIN",
  ].join("\n"),
} as const;

/** Tas pats e-pasts EN / RU / DE (valoda - partnera izvēlētā atskaites valoda pirkumā). */
const B2B_WALLET_REFUND_EMAIL_I18N: Record<Exclude<B2bWalletRefundEmailLang, "lv">, { subject: string; body: string }> = {
  en: {
    subject: "PROVIN · Data not available, {{summa}} returned to your account · {{vin}}",
    body: [
      "Hello,",
      "",
      "Dealer data for VIN {{vin}} ({{produkts}}) is currently not available.",
      "The amount of {{summa}} has been returned to your account balance.",
      "New balance: {{atlikums}}.",
      "",
      "Best regards,",
      "PROVIN",
    ].join("\n"),
  },
  ru: {
    subject: "PROVIN · Данные недоступны, {{summa}} возвращены на счёт · {{vin}}",
    body: [
      "Здравствуйте!",
      "",
      "Данные дилера по VIN {{vin}} ({{produkts}}) сейчас недоступны.",
      "Сумма {{summa}} возвращена на баланс Вашего счёта.",
      "Новый баланс: {{atlikums}}.",
      "",
      "С уважением,",
      "PROVIN",
    ].join("\n"),
  },
  de: {
    subject: "PROVIN · Daten nicht verfügbar, {{summa}} Ihrem Konto gutgeschrieben · {{vin}}",
    body: [
      "Guten Tag,",
      "",
      "Die Händlerdaten zur FIN {{vin}} ({{produkts}}) sind derzeit nicht verfügbar.",
      "Der Betrag von {{summa}} wurde Ihrem Kontoguthaben gutgeschrieben.",
      "Neues Guthaben: {{atlikums}}.",
      "",
      "Mit freundlichen Grüßen",
      "PROVIN",
    ].join("\n"),
  },
};

export type B2bWalletRefundEmailVars = {
  vin: string;
  summa: string;
  atlikums: string;
  produkts: string;
};

export function fillB2bWalletRefundEmailTemplate(template: string, vars: B2bWalletRefundEmailVars): string {
  return template
    .replaceAll("{{vin}}", vars.vin)
    .replaceAll("{{summa}}", vars.summa)
    .replaceAll("{{atlikums}}", vars.atlikums)
    .replaceAll("{{produkts}}", vars.produkts);
}

export function renderB2bWalletRefundEmail(
  vars: B2bWalletRefundEmailVars,
  lang?: B2bWalletRefundEmailLang | null,
): { subject: string; text: string } {
  const tpl = lang && lang !== "lv" ? B2B_WALLET_REFUND_EMAIL_I18N[lang] : B2B_WALLET_REFUND_EMAIL;
  return {
    subject: fillB2bWalletRefundEmailTemplate(tpl.subject, vars),
    text: fillB2bWalletRefundEmailTemplate(tpl.body, vars),
  };
}
