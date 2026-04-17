import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

/** Minimālistisks HTML — balts, daudz tukšuma, PROVIN zils CTA (kā vietne). */
const BRAND = "#0061D2";
const INK = "#1d1d1f";
const MUTED = "#6b7280";
const BG = "#f4f4f5";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(inner: string, opts?: { omitBrandRibbon?: boolean }): string {
  const brandRibbon = opts?.omitBrandRibbon
    ? ""
    : `<p style="margin:0 0 28px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${MUTED};font-weight:600;">PROVIN.LV</p>`;
  return `<!DOCTYPE html>
<html lang="lv">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>PROVIN</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;line-height:1.55;color:${INK};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};">
<tr><td align="center" style="padding:48px 20px;">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:14px;padding:44px 40px 48px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
<tr><td>
${brandRibbon}${inner}
</td></tr></table>
<p style="margin:28px 0 0;font-size:12px;color:${MUTED};text-align:center;">Šis e-pasts nosūtīts automātiski.</p>
</td></tr></table>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
<tr><td>
<a href="${esc(href)}" style="display:inline-block;padding:14px 28px;background:${BRAND};color:#ffffff;text-decoration:none;border-radius:9999px;font-weight:600;font-size:14px;letter-spacing:0.02em;">${esc(label)}</a>
</td></tr></table>`;
}

export function paymentConfirmationHtml(opts: {
  invoiceUrl: string;
  thanksUrl: string;
  amountLine: string;
  vin: string;
}): string {
  const inner = `
<p style="margin:0 0 12px;font-size:22px;font-weight:600;letter-spacing:-0.02em;">Paldies par pasūtījumu</p>
<p style="margin:0 0 20px;color:${MUTED};font-size:15px;">Maksājums ir saņemts. Jūsu pasūtījums tiek apstrādāts.</p>
<p style="margin:0 0 6px;font-size:14px;"><strong>Summa:</strong> ${esc(opts.amountLine)}</p>
<p style="margin:0 0 24px;font-size:14px;"><strong>VIN:</strong> ${esc(opts.vin)}</p>
${ctaButton(opts.invoiceUrl, "Lejupielādēt rēķinu (PDF)")}
<p style="margin:16px 0 0;font-size:13px;color:${MUTED};">Varat arī vēlāk lejupielādēt rēķinu no pateicības lapas pēc apmaksas.</p>
<p style="margin:20px 0 0;font-size:13px;"><a href="${esc(opts.thanksUrl)}" style="color:${BRAND};text-decoration:none;font-weight:500;">Atvērt pateicības lapu →</a></p>
`;
  return shell(inner);
}

export function adminNewOrderHtml(lines: { label: string; value: string }[]): string {
  const rows = lines
    .map(
      (l) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #ececec;font-size:14px;color:${MUTED};width:38%;">${esc(l.label)}</td><td style="padding:8px 0;border-bottom:1px solid #ececec;font-size:14px;">${esc(l.value)}</td></tr>`,
    )
    .join("");
  const inner = `
<p style="margin:0 0 8px;font-size:20px;font-weight:600;">Jauns apmaksāts pasūtījums</p>
<p style="margin:0 0 24px;color:${MUTED};font-size:14px;">Stripe: checkout.session.completed</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>
`;
  return shell(inner);
}

/** E-pasts: „audits pabeigts” ar pielikumu sarakstu (faktiskie faili — nodemailer). */
export function auditCompletedEmailHtml(opts: { carVin: string; attachmentLines: string[] }): string {
  const vinRaw = opts.carVin.trim();
  const hasVin = isValidVin(vinRaw);
  const vinEsc = hasVin ? esc(normalizeVin(vinRaw)) : "";
  const hasList = opts.attachmentLines.length > 0;
  const listHtml = hasList
    ? `<ul style="margin:10px 0 18px;padding-left:22px;color:${INK};font-size:15px;line-height:1.45;">${opts.attachmentLines
        .map((l) => `<li style="margin:4px 0;">${esc(l)}</li>`)
        .join("")}</ul>`
    : "";

  const resultsBlock = hasList
    ? `<p style="margin:0 0 8px;font-size:15px;color:${INK};line-height:1.55;"><strong>Kā saņemt rezultātus:</strong></p>
<p style="margin:0 0 4px;font-size:15px;color:${INK};line-height:1.55;">PDF atskaite un papildu materiāli ir pievienoti šī e-pasta pielikumā.</p>
${listHtml}`
    : `<p style="margin:0 0 16px;font-size:15px;color:${MUTED};line-height:1.55;">Pielikumi nav pievienoti — sazinieties ar mums, ja nepieciešams.</p>`;

  const inner = `
<p style="margin:0 0 14px;font-size:15px;color:${INK};line-height:1.6;">Labdien!</p>
<p style="margin:0 0 12px;font-size:15px;color:${INK};line-height:1.6;">${
    hasVin
      ? `Jūsu pasūtītais audits ir pabeigts!<br/>Atskaite transportlīdzeklim ar VIN <strong>${vinEsc}</strong> ir sagatavota.`
      : `Jūsu pasūtītais audits ir pabeigts!<br/>Atskaite ir sagatavota un pievienota šī e-pasta <strong>pielikumā</strong> (PDF).`
  }</p>
${resultsBlock}
<p style="margin:0 0 6px;font-size:15px;color:${INK};line-height:1.55;"><strong>Saziņa un jautājumi:</strong></p>
<p style="margin:0 0 20px;font-size:15px;color:${MUTED};line-height:1.55;">Ja rodas kādi papildu jautājumi, droši sazinieties ar mums, atbildot uz šo e-pastu (<a href="mailto:info@provin.lv" style="color:${BRAND};text-decoration:none;font-weight:500;">info@provin.lv</a>).</p>
<p style="margin:0;font-size:15px;color:${INK};line-height:1.6;">Ar cieņu,<br/><span style="color:${MUTED};font-weight:600;">PROVIN.LV</span></p>
`;
  return shell(inner, { omitBrandRibbon: true });
}
