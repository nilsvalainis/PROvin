/**
 * Neapmaksātā pasūtījuma atgādinājuma teksts (apstiprinātais v3).
 * Personīga vēstule, bez zīmola HTML šablona.
 */

export const UNPAID_REMINDER_TEMPLATE_ID = "email.unpaid_reminder";

export const UNPAID_REMINDER_SUBJECT_TEMPLATE = "Par Jūsu auto pārbaudi (VIN {{vin}})";

export const UNPAID_REMINDER_BODY_TEMPLATE = [
  "Labdien!",
  "",
  "Redzēju, ka nesen sākāt pasūtīt auto vēstures pārbaudi, bet pasūtījums palika nepabeigts. Ja kaut kas nav skaidrs vai vēlaties vispirms konsultēties, droši zvaniet man: +371 29 502 039. Varat arī atbildēt uz šo e-pastu.",
  "",
  "Ja pārbaude joprojām ir aktuāla, apmaksu varat pabeigt šeit:",
  "{{maksājuma_saite}}",
  "",
  "Paldies, ka izvēlējāties PROVIN.LV, un veiksmi auto izvēlē!",
  "",
  "Ar cieņu,",
  "Nils V. (IRISS)",
  "PROVIN.LV",
].join("\n");

const PAYMENT_URL_PLACEHOLDERS = ["{{maksājuma_saite}}", "{{maksajuma_saite}}"] as const;

export function unpaidReminderTemplateVars(opts: {
  vin: string;
  paymentUrl: string;
}): Record<string, string> {
  const vin = opts.vin.trim() || "-";
  const url = opts.paymentUrl.trim();
  return {
    vin,
    maksajuma_saite: url,
    "maksājuma_saite": url,
  };
}

export function injectUnpaidReminderPaymentUrl(text: string, paymentUrl: string): string {
  const url = paymentUrl.trim();
  let out = text;
  for (const ph of PAYMENT_URL_PLACEHOLDERS) {
    if (out.includes(ph)) out = out.split(ph).join(url);
  }
  if (url && !out.includes(url)) {
    out = `${out.trimEnd()}\n\n${url}`;
  }
  return out;
}

export function unpaidReminderFallbackCopy(opts: { vin: string; paymentUrl: string }): {
  subject: string;
  text: string;
} {
  const vars = unpaidReminderTemplateVars(opts);
  const subject = UNPAID_REMINDER_SUBJECT_TEMPLATE.replaceAll("{{vin}}", vars.vin);
  const text = injectUnpaidReminderPaymentUrl(UNPAID_REMINDER_BODY_TEMPLATE, vars.maksajuma_saite);
  return { subject, text };
}

/** Vienkāršs HTML no plain teksta - bez PROVIN zīmola veidnes. */
export function unpaidReminderEmailHtml(text: string): string {
  const esc = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br/>");
  return `<!DOCTYPE html><html lang="lv"><body style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.5;color:#111;">${esc}</body></html>`;
}
