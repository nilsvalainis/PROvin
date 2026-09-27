import { isValidHttpUrl, isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { getClientReportLegalFooterBlocks } from "@/lib/report-pdf-standards";
import { GOOGLE_REVIEW_URL, type ReportReadyProductKind } from "@/lib/email/report-ready-copy";

/** Minimālistisks HTML: balts, daudz tukšuma, PROVIN zils CTA (kā vietne). */
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

function clientReportLegalFooterEmailHtml(origin: string): string {
  const b = getClientReportLegalFooterBlocks();
  const base = origin.replace(/\/$/, "");
  const termsUrl = `${base}/lietosanas-noteikumi`;
  const privacyUrl = `${base}/privatuma-politika`;
  const year = new Date().getFullYear();
  const border = "#e5e7eb";

  return `<div style="margin:28px 0 0;padding:20px 0 0;border-top:1px solid ${border};">
<p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED};">${esc(b.importantTitle)}</p>
<p style="margin:0 0 12px;font-size:11px;line-height:1.55;color:${MUTED};">${esc(b.disclaimer)}</p>
<p style="margin:0 0 16px;font-size:11px;line-height:1.55;color:${MUTED};"><strong>${esc(b.confidentiality)}</strong></p>
<p style="margin:0 0 8px;font-size:11px;font-weight:600;color:${MUTED};">PROVIN.LV</p>
<p style="margin:0 0 14px;font-size:11px;line-height:1.55;color:${MUTED};">${esc(b.valueBody)}</p>
<p style="margin:0 0 4px;font-size:10px;color:${MUTED};">© ${year} PROVIN.LV</p>
<p style="margin:0 0 4px;font-size:10px;color:${MUTED};"><a href="${esc(termsUrl)}" style="color:${BRAND};text-decoration:none;">Lietošanas noteikumi</a> · <a href="${esc(privacyUrl)}" style="color:${BRAND};text-decoration:none;">Privātuma politika</a></p>
<p style="margin:0;font-size:10px;line-height:1.45;color:${MUTED};">${esc(b.gdprLine)}</p>
</div>`;
}

export function paymentConfirmationHtml(opts: {
  invoiceUrl: string;
  amountLine: string;
  vin: string;
}): string {
  const inner = `
<p style="margin:0 0 12px;font-size:22px;font-weight:600;letter-spacing:-0.02em;">Paldies par pasūtījumu</p>
<p style="margin:0 0 20px;color:${MUTED};font-size:15px;">Maksājums ir saņemts. Jūsu pasūtījums tiek apstrādāts.</p>
<p style="margin:0 0 6px;font-size:14px;"><strong>Summa:</strong> ${esc(opts.amountLine)}</p>
<p style="margin:0 0 24px;font-size:14px;"><strong>VIN:</strong> ${esc(opts.vin)}</p>
<p style="margin:0 0 24px;font-size:14px;">Rēķins PDF ir pievienots šim e-pastam. To var arī lejupielādēt šeit.</p>
${ctaButton(opts.invoiceUrl, "Lejupielādēt rēķinu (PDF)")}
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

export function adminNewPartnerHtml(opts: {
  lines: { label: string; value: string }[];
  adminUrl?: string;
}): string {
  const rows = opts.lines
    .map(
      (l) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #ececec;font-size:14px;color:${MUTED};width:38%;">${esc(l.label)}</td><td style="padding:8px 0;border-bottom:1px solid #ececec;font-size:14px;">${esc(l.value)}</td></tr>`,
    )
    .join("");
  const cta = opts.adminUrl ? ctaButton(opts.adminUrl, "Atvērt partneri adminā") : "";
  const inner = `
<p style="margin:0 0 8px;font-size:20px;font-weight:600;">Jauns B2B partneris</p>
<p style="margin:0 0 24px;color:${MUTED};font-size:14px;">Partneris reģistrējies ar ielūguma saiti.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>
${cta}
`;
  return shell(inner);
}

/** Bezmaksas īss sludinājuma komentārs + CTA uz PROVIN AUDITS (e-pasta klientiem drošs HTML). */
export function listingPeekCustomerCommentHtml(opts: {
  comment: string;
  auditsUrl: string;
  listingUrl?: string | null;
  /** CID vērtības (`peek-photo-…@provin.lv`) inline attēliem. */
  photoCids?: string[];
}): string {
  const paragraphs = opts.comment
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const bodyHtml = (
    paragraphs.length
      ? paragraphs
      : opts.comment.trim()
        ? [opts.comment.trim()]
        : ["-"]
  )
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${INK};">${esc(p).replace(/\n/g, "<br/>")}</p>`,
    )
    .join("");

  const listingRaw = (opts.listingUrl ?? "").trim();
  const listingHref = isValidHttpUrl(listingRaw) ? listingRaw : "";
  const listingBlock = listingHref
    ? `<p style="margin:0 0 18px;font-size:13px;line-height:1.5;color:${MUTED};">Sludinājums<br/>
<a href="${esc(listingHref)}" target="_blank" style="color:${BRAND};text-decoration:underline;word-break:break-all;">${esc(listingHref)}</a></p>`
    : "";

  const photoCids = (opts.photoCids ?? []).map((cid) => cid.trim()).filter(Boolean);
  const photoBlock =
    photoCids.length > 0
      ? `<p style="margin:4px 0 10px;font-size:13px;line-height:1.45;color:${MUTED};">Fotogrāfijas</p>
${photoCids
  .map(
    (cid) =>
      `<img src="cid:${esc(cid)}" alt="" width="520" style="display:block;width:100%;max-width:520px;height:auto;margin:0 0 12px;border:0;border-radius:12px;" />`,
  )
  .join("")}`
      : "";

  const auditsHref = esc(opts.auditsUrl);
  const cta = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 10px;">
<tr><td align="left" bgcolor="${BRAND}" style="border-radius:9999px;background-color:${BRAND};">
<a href="${auditsHref}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:700;line-height:1.25;color:#ffffff !important;text-decoration:none;border-radius:9999px;">Pasūtīt</a>
</td></tr>
</table>
<p style="margin:0 0 18px;font-size:12px;line-height:1.45;color:${MUTED};">Ja poga neatveras: <a href="${auditsHref}" style="color:${BRAND};text-decoration:underline;">${auditsHref}</a></p>`;

  const inner = `
<p style="margin:0 0 8px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${MUTED};font-weight:600;">PROVIN.LV · Bezmaksas komentārs</p>
<p style="margin:0 0 12px;font-size:22px;font-weight:600;letter-spacing:-0.02em;color:${INK};">Īss skatījums uz tavu sludinājumu</p>
${listingBlock}
${bodyHtml}
${photoBlock}
<p style="margin:20px 0 6px;font-size:16px;font-weight:600;color:${INK};">Noskaidro visu par savu topošo auto.</p>
<p style="margin:0 0 4px;font-size:14px;line-height:1.55;color:${MUTED};">PROVIN AUDITS: visaptveroša auto vēstures un risku izpēte.</p>
${cta}
<p style="margin:8px 0 0;font-size:15px;line-height:1.6;color:${INK};">Ar cieņu,<br/><span style="color:${MUTED};font-weight:600;">PROVIN.LV</span></p>
`;
  return shell(inner, { omitBrandRibbon: true });
}

function reportReadyVinHtml(vinRaw: string): string {
  const hasVin = isValidVin(vinRaw);
  if (!hasVin) return "";
  return ` transportlīdzeklim ar VIN <strong>${esc(normalizeVin(vinRaw))}</strong>`;
}

function clientSignOffHtml(): string {
  return `<p style="margin:0;font-size:15px;color:${INK};line-height:1.6;">Ar cieņu,<br/>Nils / IRISS<br/>PROVIN.LV</p>`;
}

function googleReviewHtml(): string {
  const href = esc(GOOGLE_REVIEW_URL);
  return `<p style="margin:0 0 20px;font-size:15px;color:${INK};line-height:1.6;">Būšu ļoti pateicīgs, ja atvēlēsiet īsu brīdi, lai atstātu atsauksmi par šo projektu Google: <a href="${href}" style="color:${BRAND};text-decoration:none;font-weight:500;word-break:break-all;">${href}</a></p>`;
}

function reportReadyCloseHtml(questionsInner: string, includeGoogleReview?: boolean): string {
  const qMargin = includeGoogleReview ? "12px" : "20px";
  return `<p style="margin:0 0 ${qMargin};font-size:15px;color:${MUTED};line-height:1.55;">${questionsInner}</p>
${includeGoogleReview ? googleReviewHtml() : ""}
${clientSignOffHtml()}`;
}

/** Klienta „atskaite gatava” e-pasts pēc produkta (dīleris / MINI / AUDITS). */
export function auditCompletedEmailHtml(opts: {
  carVin: string;
  attachmentLines: string[];
  siteOrigin?: string;
  productKind?: ReportReadyProductKind;
  includeGoogleReview?: boolean;
}): string {
  const kind = opts.productKind ?? "audits";
  const vinHtml = reportReadyVinHtml(opts.carVin);
  const files = opts.attachmentLines.map((l) => l.trim()).filter(Boolean);
  const fileList =
    files.length > 0
      ? `<ul style="margin:4px 0 16px;padding-left:22px;color:${INK};font-size:15px;line-height:1.45;">${files
          .map((l) => `<li style="margin:4px 0;">${esc(l)}</li>`)
          .join("")}</ul>`
      : "";
  const mailLink = `<a href="mailto:info@provin.lv" style="color:${BRAND};text-decoration:none;font-weight:500;">info@provin.lv</a>`;

  let body = "";
  if (kind === "dealer") {
    body = `
<p style="margin:0 0 14px;font-size:15px;color:${INK};line-height:1.6;">Labdien!</p>
<p style="margin:0 0 12px;font-size:15px;color:${INK};line-height:1.6;">Jūsu pieprasītie oficiālā dīlera servisa vēstures dati${vinHtml} ir sagatavoti.</p>
<p style="margin:0 0 4px;font-size:15px;color:${INK};line-height:1.6;">Pielikumā atradīsiet šādus dokumentus:</p>
${fileList}
${reportReadyCloseHtml(`Ja Jums rodas papildu jautājumi, droši rakstiet mums uz ${mailLink}.`, opts.includeGoogleReview)}`;
  } else if (kind === "mini") {
    body = `
<p style="margin:0 0 14px;font-size:15px;color:${INK};line-height:1.6;">Labdien!</p>
<p style="margin:0 0 12px;font-size:15px;color:${INK};line-height:1.6;">Jūsu pasūtītā PROVIN MINI atskaite${vinHtml} ir sagatavota un pievienota šī e-pasta pielikumā.</p>
${reportReadyCloseHtml(`Ja Jums rodas kādi jautājumi, droši rakstiet mums uz ${mailLink}, labprāt palīdzēsim!`, opts.includeGoogleReview)}`;
  } else {
    body = `
<p style="margin:0 0 14px;font-size:15px;color:${INK};line-height:1.6;">Labdien!</p>
<p style="margin:0 0 12px;font-size:15px;color:${INK};line-height:1.6;">Jūsu pasūtītā PROVIN AUDITS atskaite${vinHtml} ir sagatavota.</p>
<p style="margin:0 0 4px;font-size:15px;color:${INK};line-height:1.6;">E-pasta pielikumā atradīsiet:</p>
<ul style="margin:4px 0 16px;padding-left:22px;color:${INK};font-size:15px;line-height:1.45;">
<li style="margin:4px 0;">Kopsavilkuma PDF atskaiti</li>
<li style="margin:4px 0;">Papildu materiālus un pielikumus</li>
</ul>
${reportReadyCloseHtml(`Ja Jums rodas kādi jautājumi vai nepieciešama papildu konsultācija, droši rakstiet mums uz ${mailLink}, labprāt palīdzēsim!`, opts.includeGoogleReview)}`;
  }

  return shell(body, { omitBrandRibbon: true });
}

type PartnerMailLocale = "lv" | "en" | "de" | "ru";

function partnerMailLocale(locale?: string): PartnerMailLocale {
  if (locale === "en" || locale === "de" || locale === "ru") return locale;
  return "lv";
}

const PARTNER_VERIFY_COPY: Record<
  PartnerMailLocale,
  { title: string; titleChange: string; lead: string; leadChange: string; cta: string; hint: string }
> = {
  lv: {
    title: "Apstipriniet e-pastu",
    titleChange: "Apstipriniet jauno e-pastu",
    lead: "Apstipriniet šo adresi, lai pabeigtu PROVIN.LV partnera konta atvēršanu.",
    leadChange: "Apstipriniet šo adresi, lai pabeigtu PROVIN.LV partnera konta e-pasta maiņu.",
    cta: "Apstiprināt e-pastu",
    hint: "Saite ir derīga 24 stundas un izmantojama vienu reizi. Ja jūs to neprasījāt, ignorējiet šo vēstuli.",
  },
  en: {
    title: "Confirm your email",
    titleChange: "Confirm your new email",
    lead: "Confirm this address to finish opening your PROVIN.LV partner account.",
    leadChange: "Confirm this address to finish updating your PROVIN.LV partner account.",
    cta: "Confirm email",
    hint: "The link is valid for 24 hours and can be used once. If you did not request this, ignore the message.",
  },
  de: {
    title: "Bestätigen Sie Ihre E-Mail",
    titleChange: "Bestätigen Sie die neue E-Mail",
    lead: "Bestätigen Sie diese Adresse, um Ihr PROVIN.LV-Partnerkonto einzurichten.",
    leadChange: "Bestätigen Sie diese Adresse, um die E-Mail Ihres PROVIN.LV-Partnerkontos zu ändern.",
    cta: "E-Mail bestätigen",
    hint: "Der Link ist 24 Stunden gültig und nur einmal verwendbar. Wenn Sie das nicht angefordert haben, ignorieren Sie die Nachricht.",
  },
  ru: {
    title: "Подтвердите адрес почты",
    titleChange: "Подтвердите новый адрес почты",
    lead: "Подтвердите этот адрес, чтобы открыть партнёрский аккаунт PROVIN.LV.",
    leadChange: "Подтвердите этот адрес, чтобы сменить адрес почты партнёрского аккаунта PROVIN.LV.",
    cta: "Подтвердить адрес",
    hint: "Ссылка действует 24 часа и срабатывает только один раз. Если вы этого не запрашивали, просто проигнорируйте письмо.",
  },
};

export function partnerVerifyEmailHtml(opts: {
  verifyUrl: string;
  locale?: string;
  purpose?: "signup" | "email_change";
}): string {
  const copy = PARTNER_VERIFY_COPY[partnerMailLocale(opts.locale)];
  const change = opts.purpose === "email_change";
  const title = change ? copy.titleChange : copy.title;
  const lead = change ? copy.leadChange : copy.lead;
  const cta = copy.cta;
  const hint = copy.hint;
  const inner = `
<p style="margin:0 0 12px;font-size:22px;font-weight:600;letter-spacing:-0.02em;">${esc(title)}</p>
<p style="margin:0 0 20px;color:${MUTED};font-size:15px;">${esc(lead)}</p>
${ctaButton(opts.verifyUrl, cta)}
<p style="margin:20px 0 0;font-size:13px;line-height:1.55;color:${MUTED};">${esc(hint)}</p>
`;
  return shell(inner);
}

const PARTNER_RESET_COPY: Record<
  PartnerMailLocale,
  { title: string; lead: string; cta: string; hint: string }
> = {
  lv: {
    title: "Atjaunojiet paroli",
    lead: "Ar šo saiti varat iestatīt jaunu paroli savam PROVIN.LV partnera kontam.",
    cta: "Iestatīt jaunu paroli",
    hint: "Saite ir derīga 24 stundas un izmantojama vienu reizi. Ja jūs to neprasījāt, ignorējiet šo vēstuli.",
  },
  en: {
    title: "Reset your password",
    lead: "Use this link to set a new password for your PROVIN.LV partner account.",
    cta: "Set a new password",
    hint: "The link is valid for 24 hours and can be used once. If you did not request this, ignore the message.",
  },
  de: {
    title: "Setzen Sie Ihr Passwort zurück",
    lead: "Mit diesem Link legen Sie ein neues Passwort für Ihr PROVIN.LV-Partnerkonto fest.",
    cta: "Neues Passwort festlegen",
    hint: "Der Link ist 24 Stunden gültig und nur einmal verwendbar. Wenn Sie das nicht angefordert haben, ignorieren Sie die Nachricht.",
  },
  ru: {
    title: "Восстановление пароля",
    lead: "По этой ссылке можно задать новый пароль партнёрского аккаунта PROVIN.LV.",
    cta: "Задать новый пароль",
    hint: "Ссылка действует 24 часа и срабатывает только один раз. Если вы этого не запрашивали, просто проигнорируйте письмо.",
  },
};

export function partnerPasswordResetEmailHtml(opts: {
  resetUrl: string;
  locale?: string;
}): string {
  const copy = PARTNER_RESET_COPY[partnerMailLocale(opts.locale)];
  const title = copy.title;
  const lead = copy.lead;
  const cta = copy.cta;
  const hint = copy.hint;
  const inner = `
<p style="margin:0 0 12px;font-size:22px;font-weight:600;letter-spacing:-0.02em;">${esc(title)}</p>
<p style="margin:0 0 20px;color:${MUTED};font-size:15px;">${esc(lead)}</p>
${ctaButton(opts.resetUrl, cta)}
<p style="margin:20px 0 0;font-size:13px;line-height:1.55;color:${MUTED};">${esc(hint)}</p>
`;
  return shell(inner);
}

/**
 * Operatora rediģēts dīlera e-pasts (plain text → rindkopas).
 * Rinda `Pasūtīt: https://…` kļūst par CTA pogu.
 */
export function dealerDataOperatorMessageEmailHtml(opts: { title?: string | null; text: string }): string {
  const title = (opts.title ?? "").trim();
  const orderCta = /^(Pasūtīt|Apmaksāt):\s*(https?:\/\/\S+)\s*$/i;
  const paragraphs = opts.text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  const body = paragraphs
    .map((block) => {
      const m = orderCta.exec(block);
      if (m?.[2] && isValidHttpUrl(m[2])) {
        const label = /^apmaksāt$/i.test(m[1] ?? "") ? "Apmaksāt" : "Pasūtīt PROVIN AUDITS";
        return ctaButton(m[2], label);
      }
      const html = esc(block).replace(/\n/g, "<br/>");
      return `<p style="margin:0 0 12px;font-size:15px;color:${INK};line-height:1.6;">${html}</p>`;
    })
    .join("\n");
  const titleBlock = title
    ? `<p style="margin:0 0 12px;font-size:22px;font-weight:600;letter-spacing:-0.02em;">${esc(title)}</p>`
    : "";
  return shell(`${titleBlock}${body}`, { omitBrandRibbon: true });
}

/**
 * E-pasts: oficiālā dīlera dati par šo VIN nav pieejami, maksājums atgriezts.
 * Noklusējums: A + soft CTA.
 */
export function dealerDataNoDataRefundEmailHtml(opts: {
  vin?: string | null;
  amountEur?: string | null;
  /** Atcelts pēc klienta lūguma, nevis datu trūkuma dēļ. */
  cancelled?: boolean;
}): string {
  const vinRaw = (opts.vin ?? "").trim();
  const vinEsc = isValidVin(vinRaw) ? esc(normalizeVin(vinRaw)) : "";
  const amount = (opts.amountEur ?? "").trim() || "24,99 €";
  const title = opts.cancelled ? "Pasūtījums atcelts un maksājums atgriezts" : "Dīlera dati nav pieejami";

  if (opts.cancelled) {
    const inner = `
<p style="margin:0 0 12px;font-size:22px;font-weight:600;letter-spacing:-0.02em;">${esc(title)}</p>
<p style="margin:0 0 12px;font-size:15px;color:${INK};line-height:1.6;">Jūsu pasūtījums par oficiālā dīlera servisa vēsturi ir atcelts${
      vinEsc ? ` (VIN <strong>${vinEsc}</strong>)` : ""
    }.</p>
<p style="margin:0 0 18px;font-size:15px;color:${INK};line-height:1.6;">Atmaksa ${esc(
      amount,
    )} veikta pilnā apmērā uz to pašu karti. Nauda kontā parasti ir 5 līdz 10 darba dienu laikā, atkarībā no bankas.</p>
<p style="margin:0 0 20px;font-size:15px;color:${MUTED};line-height:1.55;">Ja rodas jautājumi, atbildiet uz šo e-pastu (<a href="mailto:info@provin.lv" style="color:${BRAND};text-decoration:none;font-weight:500;">info@provin.lv</a>).</p>
${clientSignOffHtml()}
`;
    return shell(inner, { omitBrandRibbon: true });
  }

  const vinPart = vinEsc ? ` (VIN <strong>${vinEsc}</strong>)` : "";
  const inner = `
<p style="margin:0 0 12px;font-size:22px;font-weight:600;letter-spacing:-0.02em;">${esc(title)}</p>
<p style="margin:0 0 12px;font-size:15px;color:${INK};line-height:1.6;">Labdien!</p>
<p style="margin:0 0 12px;font-size:15px;color:${INK};line-height:1.6;">Esam pārbaudījuši oficiālā dīlera servisa vēsturi Jūsu pasūtījumam${vinPart}. Diemžēl dati par šo automašīnu mūsu sistēmā nav pieejami.</p>
<p style="margin:0 0 6px;font-size:15px;color:${INK};line-height:1.6;"><strong>Informācija par naudas atmaksu:</strong><br/>Summa: ${esc(
    amount,
  )} (veikta pilnā apmērā uz to pašu maksājumu karti).</p>
<p style="margin:0 0 12px;font-size:15px;color:${INK};line-height:1.6;">Piezīme: bankas izrakstā atmaksa var neparādīties kā jauns ienākošais maksājums, bet gan kā atcelta rezervētā summa.</p>
<p style="margin:0 0 12px;font-size:15px;color:${INK};line-height:1.6;">Ja šo pārbaudi veicāt pirms auto iegādes, rekomendējam izmantot PROVIN AUDITS: padziļinātu auto vēstures pārbaudi, odometra atbilstības, negadījumu un risku analīzi.</p>
${ctaButton("https://provin.lv", "Pasūtīt PROVIN AUDITS")}
<p style="margin:16px 0 20px;font-size:15px;color:${MUTED};line-height:1.55;">Ja Jums rodas papildu jautājumi, droši rakstiet mums uz <a href="mailto:info@provin.lv" style="color:${BRAND};text-decoration:none;font-weight:500;">info@provin.lv</a>.</p>
${clientSignOffHtml()}
`;
  return shell(inner, { omitBrandRibbon: true });
}
