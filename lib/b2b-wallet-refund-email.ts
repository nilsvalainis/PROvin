/**
 * B2B maka atmaksas e-pasta teksts.
 * Vietturņi: {{vin}} {{summa}} {{atlikums}} {{produkts}}.
 * Zīmols: PROVIN, bez .LV.
 */

export const B2B_WALLET_REFUND_EMAIL_PRODUCT: Record<"business" | "dealer_raw" | "dealer_pro", string> = {
  business: "Business",
  dealer_raw: "Dīlera dati RAW",
  dealer_pro: "Dīlera dati PRO",
};

export const B2B_WALLET_REFUND_EMAIL = {
  subject: "PROVIN: dati VIN {{vin}} nav pieejami, {{summa}} atgriezti kontā",
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

export function renderB2bWalletRefundEmail(vars: B2bWalletRefundEmailVars): { subject: string; text: string } {
  return {
    subject: fillB2bWalletRefundEmailTemplate(B2B_WALLET_REFUND_EMAIL.subject, vars),
    text: fillB2bWalletRefundEmailTemplate(B2B_WALLET_REFUND_EMAIL.body, vars),
  };
}
