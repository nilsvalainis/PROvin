import type { ClientReportLang } from "@/lib/client-report-i18n";
import { isValidHttpUrl, isValidVin, normalizeVin } from "@/lib/order-field-validation";
import {
  B2B_DISCREET_PRODUCT,
  GOOGLE_REVIEW_URL,
  REPORT_CORRECTED_TITLE,
  type ReportReadyProductKind,
} from "@/lib/email/report-ready-copy";
import { CLIENT_EMAIL_QUESTION_LINE } from "@/lib/email/client-email-contact";
import {
  emailAttachmentsRow,
  emailBorderedBox,
  emailButton,
  emailDocument,
  emailFactsRow,
  emailLink,
  emailOfferRow,
  emailParagraph,
  emailReviewStars,
  emailRow,
  emailSmall,
  emailSpacer,
  emailStatusCardRow,
  escHtml,
  formatEmailDate,
  formatEmailDateIso,
  formatEmailFileSize,
  type EmailAttachmentCard,
  type EmailFact,
} from "@/lib/email/email-layout";

export type { EmailFact } from "@/lib/email/email-layout";

/**
 * Klientu e-pastu HTML. Rāmis - `email-layout.ts` (Nila apstiprinātais makets, variants A, 22.11.2026).
 * Teksti (LV/EN/DE/RU) - esošie; temati šeit netiek veidoti.
 */
const BRAND = "#0061D2";
const INK = "#16181d";
const MUTED = "#646b76";

function esc(s: string): string {
  return escHtml(s);
}

/**
 * Vienkāršs satura rāmis vecajām veidnēm (admin paziņojumi u.c.).
 * `client: true` - klientam (tumšais režīms + kontakti kājenē); citādi iekšējs (tikai gaišs, bez kontaktiem).
 */
function shell(
  inner: string,
  opts?: { client?: boolean; b2bClient?: boolean; lang?: ClientReportLang },
): string {
  const client = opts?.client === true || opts?.b2bClient === true;
  return emailDocument({
    rows: `<tr><td class="m-pad c-gen" style="padding:22px 36px 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.55;color:${INK};">${inner}</td></tr>`,
    lang: opts?.lang ?? "lv",
    b2b: opts?.b2bClient === true,
    omitContacts: !client,
    darkMode: client,
  });
}

function ctaButton(href: string, label: string): string {
  return `${emailSpacer(20)}${emailButton(href, esc(label))}${emailSpacer(8)}`;
}

/** Virsraksta rinda kartītē (bez statusa kartes). */
function titleRow(title: string): string {
  return emailRow(
    `<p class="c-ink" style="margin:0;font-size:22px;line-height:28px;font-weight:700;letter-spacing:-0.4px;color:${INK};">${esc(title)}</p>`,
    "22px 36px 0",
  );
}


/* ---------- statusa kartes teksti ---------- */

const STATUS_REPORT_READY: Record<ClientReportLang, string> = {
  lv: "Atskaite gatava",
  en: "Report ready",
  ru: "Отчёт готов",
  de: "Bericht fertig",
};

/** Operatora e-pasta produkts: atskaites veidi + «Izsoļu arhīvs» (atsevišķs pakalpojums, 23.11, tikai LV). */
export type OperatorEmailProductKind = ReportReadyProductKind | "auction_archive";

const STATUS_PRODUCT_EYEBROW: Record<OperatorEmailProductKind, Record<ClientReportLang, string>> = {
  auction_archive: { lv: "Izsoļu arhīvs", en: "Auction archive", ru: "Архив аукционов", de: "Auktionsarchiv" },
  dealer: {
    lv: "Oficiālā dīlera dati",
    en: "Official dealer data",
    ru: "Официальные данные дилера",
    de: "Offizielle Händlerdaten",
  },
  mini: { lv: "PROVIN MINI", en: "PROVIN MINI", ru: "PROVIN MINI", de: "PROVIN MINI" },
  audits: { lv: "PROVIN AUDITS", en: "PROVIN AUDITS", ru: "PROVIN AUDITS", de: "PROVIN AUDITS" },
};

const STATUS_NO_DATA: Record<ClientReportLang, string> = {
  lv: "Dati nav pieejami",
  en: "Data not available",
  ru: "Данные недоступны",
  de: "Daten nicht verfügbar",
};

const STATUS_CANCELLED: Record<ClientReportLang, string> = {
  lv: "Pasūtījums atcelts",
  en: "Order cancelled",
  ru: "Заказ отменён",
  de: "Bestellung storniert",
};

const STATUS_PAYMENT_EYEBROW: Record<ClientReportLang, string> = {
  lv: "Maksājums saņemts",
  en: "Payment received",
  ru: "Платёж получен",
  de: "Zahlung erhalten",
};

function vinForCard(vinRaw: string | null | undefined): string {
  const v = String(vinRaw ?? "").trim();
  return isValidVin(v) ? normalizeVin(v) : "";
}

const MORE_ATTACHMENTS: Record<ClientReportLang, (n: number) => string> = {
  lv: (n) => `Vēl ${n} ${n % 10 === 1 && n % 100 !== 11 ? "pielikums" : "pielikumi"}`,
  en: (n) => `${n} more ${n === 1 ? "attachment" : "attachments"}`,
  ru: (n) => `Ещё вложений: ${n}`,
  de: (n) => `${n} weitere ${n === 1 ? "Anlage" : "Anlagen"}`,
};

function attachmentCards(
  files: readonly { filename: string; bytes?: number | null }[],
  lang: ClientReportLang = "lv",
): EmailAttachmentCard[] {
  const list = files.map((f) => ({ name: f.filename.trim(), bytes: f.bytes })).filter((f) => f.name);
  const card = (f: { name: string; bytes?: number | null }): EmailAttachmentCard => {
    const size = formatEmailFileSize(f.bytes);
    const isPdf = /\.pdf$/i.test(f.name);
    return { name: f.name, meta: [isPdf ? "PDF" : "", size].filter(Boolean).join(" · ") || null };
  };
  if (list.length <= 4) return list.map(card);
  return [...list.slice(0, 3).map(card), { name: MORE_ATTACHMENTS[lang](list.length - 3), meta: null }];
}

/* ---------- maksājuma apstiprinājums ---------- */

export function paymentConfirmationHtml(opts: {
  invoiceUrl: string;
  amountLine: string;
  vin: string;
  /** C4: EN/RU/DE teksti; bez - latviski. */
  copy?: { title: string; lead: string; amountLabel: string; invoiceLine: string; cta: string };
  lang?: ClientReportLang;
  /** Datums statusa kartē (testiem); noklusējums - šodien (Rīga). */
  date?: string | null;
}): string {
  const lang = opts.lang ?? "lv";
  const c = opts.copy ?? {
    title: "Paldies par pasūtījumu",
    lead: "Maksājums ir saņemts. Jūsu pasūtījums tiek apstrādāts.",
    amountLabel: "Summa",
    invoiceLine: "Rēķins PDF formātā ir pievienots šim e-pastam. To var lejupielādēt arī šeit.",
    cta: "Lejupielādēt rēķinu (PDF)",
  };
  const vin = vinForCard(opts.vin);
  const rows = [
    emailStatusCardRow({
      icon: "check",
      eyebrow: STATUS_PAYMENT_EYEBROW[lang],
      title: c.title,
      vin: vin || null,
      date: opts.date ?? formatEmailDate(),
    }),
    emailFactsRow([{ value: opts.amountLine, label: c.amountLabel }]),
    emailRow(emailParagraph(esc(c.lead)) + emailParagraph(esc(c.invoiceLine), "margin:0 0 18px;") + emailButton(opts.invoiceUrl, esc(c.cta)), "20px 36px 0"),
  ].join("\n");
  return emailDocument({ rows, lang, preheader: `${c.title} · ${opts.amountLine}` });
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
  title?: string;
  lead?: string;
  ctaLabel?: string;
}): string {
  const rows = opts.lines
    .map(
      (l) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #ececec;font-size:14px;color:${MUTED};width:38%;">${esc(l.label)}</td><td style="padding:8px 0;border-bottom:1px solid #ececec;font-size:14px;">${esc(l.value)}</td></tr>`,
    )
    .join("");
  const cta = opts.adminUrl ? ctaButton(opts.adminUrl, opts.ctaLabel ?? "Atvērt partneri adminā") : "";
  const inner = `
<p style="margin:0 0 8px;font-size:20px;font-weight:600;">${esc(opts.title ?? "Jauns B2B partneris")}</p>
<p style="margin:0 0 24px;color:${MUTED};font-size:14px;">${esc(opts.lead ?? "Partneris reģistrējies ar ielūguma saiti.")}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>
${cta}
`;
  return shell(inner);
}

export function adminAuditSlaWarningHtml(opts: {
  lines: { label: string; value: string }[];
  adminUrl?: string;
}): string {
  const rows = opts.lines
    .map(
      (l) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #ececec;font-size:14px;color:${MUTED};width:38%;">${esc(l.label)}</td><td style="padding:8px 0;border-bottom:1px solid #ececec;font-size:14px;">${esc(l.value)}</td></tr>`,
    )
    .join("");
  const cta = opts.adminUrl ? ctaButton(opts.adminUrl, "Atvērt admin paneli") : "";
  const inner = `
<p style="margin:0 0 8px;font-size:20px;font-weight:600;">Līdz audita termiņam atlikušas 3 h vai mazāk</p>
<p style="margin:0 0 24px;color:${MUTED};font-size:14px;">Pabeidz auditu, lai iekļautos termiņā.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>
${cta}
`;
  return shell(inner);
}

/** PROVIN Business pogas dienas kopsavilkums (info@provin.lv). */
export function businessPogaDigestHtml(opts: {
  title: string;
  alerts: string[];
  lines: { label: string; value: string }[];
  adminUrl: string;
}): string {
  const rows = opts.lines
    .map(
      (l) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #ececec;font-size:14px;color:${MUTED};width:42%;">${esc(l.label)}</td><td style="padding:8px 0;border-bottom:1px solid #ececec;font-size:14px;">${esc(l.value)}</td></tr>`,
    )
    .join("");
  const alerts = opts.alerts
    .map((a) => `<p style="margin:0 0 8px;padding:10px 12px;border-radius:8px;background:#fef2f2;color:#b91c1c;font-size:14px;">${esc(a)}</p>`)
    .join("");
  const inner = `
<p style="margin:0 0 16px;font-size:20px;font-weight:600;">${esc(opts.title)}</p>
${alerts}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>
${ctaButton(opts.adminUrl, "Atvērt statistiku")}
`;
  return shell(inner);
}

/** Nilam: klienta lēmums par IRISS piedāvājumu (tikai admin adrese). */
export function irissOfferDecisionHtml(opts: {
  title: string;
  approved: boolean;
  lines: { label: string; value: string }[];
  adminUrl: string;
  ctaLabel?: string;
}): string {
  const rows = opts.lines
    .map((l, i) => {
      const color = i === 0 ? (opts.approved ? "#047857" : "#b91c1c") : "inherit";
      const weight = i === 0 ? "600" : "400";
      return `<tr><td style="padding:8px 0;border-bottom:1px solid #ececec;font-size:14px;color:${MUTED};width:38%;">${esc(l.label)}</td><td style="padding:8px 0;border-bottom:1px solid #ececec;font-size:14px;color:${color};font-weight:${weight};">${esc(l.value)}</td></tr>`;
    })
    .join("");
  const inner = `
<p style="margin:0 0 20px;font-size:20px;font-weight:600;">${esc(opts.title)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>
${ctaButton(opts.adminUrl, opts.ctaLabel || "Atvērt pasūtījumu")}
`;
  return shell(inner);
}

/** Nilam: klients uzdevis jautājumu publiskajā piedāvājuma saitē (tikai admin adrese). */
export function irissOfferQuestionHtml(opts: {
  title: string;
  question: string;
  lines: { label: string; value: string }[];
  adminUrl: string;
  ctaLabel?: string;
}): string {
  const rows = opts.lines
    .map(
      (l) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #ececec;font-size:14px;color:${MUTED};width:38%;">${esc(l.label)}</td><td style="padding:8px 0;border-bottom:1px solid #ececec;font-size:14px;color:inherit;">${esc(l.value)}</td></tr>`,
    )
    .join("");
  const inner = `
<p style="margin:0 0 20px;font-size:20px;font-weight:600;">${esc(opts.title)}</p>
<p style="margin:0 0 16px;padding:12px 14px;border-radius:8px;background:#f4f4f5;font-size:15px;line-height:1.5;white-space:pre-wrap;">${esc(opts.question)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>
${ctaButton(opts.adminUrl, opts.ctaLabel || "Atvērt pasūtījumu")}
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
<p style="margin:0 0 12px;font-size:22px;font-weight:600;letter-spacing:-0.02em;color:${INK};">Īss komentārs par sludinājumu</p>
${listingBlock}
${bodyHtml}
${photoBlock}
<p style="margin:20px 0 6px;font-size:16px;font-weight:600;color:${INK};">Pirms pirkuma pārbaudiet pilnu auto vēsturi ar PROVIN AUDITU.</p>
<p style="margin:0 0 4px;font-size:14px;line-height:1.55;color:${MUTED};">PROVIN AUDITS: visaptveroša auto vēstures un risku izpēte.</p>
${cta}
<p style="margin:8px 0 0;font-size:15px;line-height:1.6;color:${INK};">Ar cieņu,<br/><span style="color:${MUTED};font-weight:600;">PROVIN.LV</span></p>
`;
  return shell(inner, { client: true });
}

/* ---------- «Atskaite gatava» (dīleris / MINI / AUDITS) ---------- */

const REPORT_READY_HTML_GREETING: Record<ClientReportLang, string> = {
  lv: "Labdien!",
  en: "Hello!",
  ru: "Здравствуйте!",
  de: "Guten Tag!",
};


const REPORT_READY_HTML_ATTACHMENTS_INTRO: Record<ClientReportLang, string> = {
  lv: "Pielikumā atradīsiet:",
  en: "You will find attached:",
  ru: "Во вложении вы найдёте:",
  de: "Im Anhang finden Sie:",
};

const REPORT_READY_HTML_MAIN_LINE: Record<ReportReadyProductKind, Record<ClientReportLang, string>> = {
  dealer: {
    lv: "Jūsu pasūtītie oficiālā dīlera dati{vin} ir gatavi.",
    en: "The official dealer data you ordered{vin} is ready.",
    ru: "Заказанные вами официальные данные дилера{vin} готовы.",
    de: "Die von Ihnen bestellten offiziellen Händlerdaten{vin} sind fertig.",
  },
  mini: {
    lv: "Jūsu PROVIN MINI atskaite{vin} ir gatava. Tā pievienota šī e-pasta pielikumā.",
    en: "Your PROVIN MINI report{vin} is ready. It is attached to this email.",
    ru: "Ваш отчёт PROVIN MINI{vin} готов. Он приложен к этому письму.",
    de: "Ihr PROVIN MINI Bericht{vin} ist fertig. Er ist diesem E-Mail beigefügt.",
  },
  audits: {
    lv: "Jūsu PROVIN AUDITS atskaite{vin} ir gatava.",
    en: "Your PROVIN AUDITS report{vin} is ready.",
    ru: "Ваш отчёт PROVIN AUDITS{vin} готов.",
    de: "Ihr PROVIN AUDITS Bericht{vin} ist fertig.",
  },
};

const REPORT_READY_HTML_AUDITS_BULLETS: Record<ClientReportLang, readonly [string, string]> = {
  lv: ["Kopsavilkuma PDF atskaiti", "Papildu materiālus un pielikumus"],
  en: ["Summary PDF report", "Additional materials and attachments"],
  ru: ["Сводный PDF-отчёт", "Дополнительные материалы и приложения"],
  de: ["Zusammenfassenden PDF-Bericht", "Zusätzliche Materialien und Anhänge"],
};

const CONSULT_TITLE: Record<ClientReportLang, string> = {
  lv: "Vajag konsultāciju par šo auto?",
  en: "Need advice on this car?",
  ru: "Нужна консультация по этому автомобилю?",
  de: "Beratung zu diesem Fahrzeug?",
};

const CONSULT_BUTTON: Record<ClientReportLang, string> = {
  lv: "Uzdot jautājumu",
  en: "Ask a question",
  ru: "Задать вопрос",
  de: "Frage stellen",
};

const CONSULT_MAIL_SUBJECT: Record<ClientReportLang, string> = {
  lv: "Jautājums par atskaiti",
  en: "Question about the report",
  ru: "Вопрос по отчёту",
  de: "Frage zum Bericht",
};

const SIGN_OFF_GREETING_HTML: Record<ClientReportLang, string> = {
  lv: "Ar cieņu,",
  en: "Best regards,",
  ru: "С уважением,",
  de: "Mit freundlichen Grüßen,",
};

const GOOGLE_REVIEW_INTRO_HTML: Record<ClientReportLang, string> = {
  lv: "Ja mūsu darbs Jums noderēja, būsim pateicīgi par īsu atsauksmi Google:",
  en: "If our work was useful to you, we would be grateful for a short Google review:",
  ru: "Если наша работа была вам полезна, будем благодарны за короткий отзыв в Google:",
  de: "Wenn Ihnen unsere Arbeit geholfen hat, wären wir für eine kurze Google-Bewertung dankbar:",
};

function clientSignOffHtml(b2bClient?: boolean, lang: ClientReportLang = "lv"): string {
  const greeting = esc(SIGN_OFF_GREETING_HTML[lang]);
  if (b2bClient) {
    return emailParagraph(`${greeting}<br/><span style="color:${BRAND};font-weight:600;">PROVIN</span>`, "margin:0;");
  }
  return emailParagraph(`${greeting}<br/>PROVIN.LV`, "margin:0;");
}

/** Google atsauksmes bloks: teksts + 5 zvaigznes + saite (tikai, ja operators to ieslēdza). */
function googleReviewBlockHtml(introText: string, href: string = GOOGLE_REVIEW_URL): string {
  return `${emailSmall(esc(introText), "margin:0 0 8px;")}${emailReviewStars(href)}${emailSmall(
    emailLink(href, esc(href), "font-weight:400;font-size:12px;word-break:break-all;"),
    "margin:6px 0 0;font-size:12px;",
  )}`;
}

/**
 * Atsevišķs Google atsauksmes lūgums (Nila makets 26.11, variants A): 2 teikumi, viena liela poga
 * «Novērtēt Google», jautājumu rinda, paraksts PROVIN.LV. Atgādinājumam tas pats izkārtojums.
 */
export function reviewAskEmailHtml(opts: {
  greeting: string;
  body: string;
  button: string;
  href: string;
  questions: string;
  preheader?: string;
  lang?: ClientReportLang;
}): string {
  const lang = opts.lang ?? "lv";
  const rows = [
    emailRow(
      emailParagraph(esc(opts.greeting)) + emailParagraph(esc(opts.body), "margin:0;"),
      "22px 36px 0",
    ),
    emailRow(`${emailButton(opts.href, esc(opts.button))}`, "22px 36px 0"),
    emailRow(emailSmall(esc(opts.questions)), "18px 36px 0"),
    emailRow(clientSignOffHtml(false, lang), "22px 36px 0"),
  ].join("\n");
  return emailDocument({ rows, lang, preheader: opts.preheader ?? null });
}

/** «Vajag konsultāciju par šo auto?» ietvars ar pogu «Uzdot jautājumu» (tikai B2C AUDITS). */
function consultBoxRow(lang: ClientReportLang, vin: string): string {
  const subject = `${CONSULT_MAIL_SUBJECT[lang]}${vin ? ` ${vin}` : ""}`;
  return emailRow(
    emailBorderedBox(
      emailParagraph(esc(CONSULT_TITLE[lang]), "margin:0 0 4px;font-weight:600;") +
        emailSmall(esc(CLIENT_EMAIL_QUESTION_LINE[lang]), "margin:0 0 14px;") +
        emailButton(`mailto:info@provin.lv?subject=${encodeURIComponent(subject)}`, esc(CONSULT_BUTTON[lang]), "ghost"),
    ),
    "22px 36px 0",
  );
}

const SIGN_OFF_START_RE = /^(Ar cieņu|Best regards|С уважением|Mit freundlichen Grüßen),/;
const QUESTION_LINES = new Set<string>(Object.values(CLIENT_EMAIL_QUESTION_LINE));

/** Klienta „atskaite gatava” e-pasts pēc produkta (dīleris / MINI / AUDITS). */
export function auditCompletedEmailHtml(opts: {
  carVin: string;
  attachmentLines: string[];
  /** Pielikumu izmēri (ja zināmi) - kartītēs «PDF · 1,4 MB». */
  attachments?: readonly { filename: string; bytes?: number | null }[];
  siteOrigin?: string;
  productKind?: ReportReadyProductKind;
  includeGoogleReview?: boolean;
  b2bClient?: boolean;
  lang?: ClientReportLang;
  /** Kopsavilkuma fakti (2-3) - tikai, ja sūtīšanas brīdī ir dati. */
  facts?: readonly EmailFact[];
  car?: string | null;
  /** Datums statusa kartē; noklusējums - šodien (Rīga). */
  date?: string | null;
}): string {
  const kind = opts.productKind ?? "audits";
  const b2bClient = opts.b2bClient === true;
  const lang = opts.lang ?? "lv";
  const vin = vinForCard(opts.carVin);
  const greeting = esc(REPORT_READY_HTML_GREETING[lang]);
  // VIN jau ir statusa kartē - teikumā to neatkārto.
  const mainLineHtml = esc(REPORT_READY_HTML_MAIN_LINE[kind][lang].replace("{vin}", ""));
  const questionHtml = esc(CLIENT_EMAIL_QUESTION_LINE[lang]);

  const sized = opts.attachments?.length
    ? opts.attachments
    : opts.attachmentLines.map((l) => ({ filename: l.trim(), bytes: null }));
  let cards = attachmentCards(sized, lang);
  if (cards.length === 0 && kind === "audits") {
    const bullets = REPORT_READY_HTML_AUDITS_BULLETS[lang];
    cards = [{ name: bullets[0] }, { name: bullets[1] }];
  }

  const rows: string[] = [
    emailStatusCardRow({
      icon: "check",
      eyebrow: STATUS_PRODUCT_EYEBROW[kind][lang],
      title: STATUS_REPORT_READY[lang],
      car: opts.car,
      vin: vin || null,
      date: opts.date ?? formatEmailDate(),
    }),
    emailFactsRow(opts.facts ?? []),
    emailRow(
      emailParagraph(greeting, "margin:0 0 6px;") +
        emailParagraph(mainLineHtml, "margin:0;") +
        (cards.length && kind !== "mini"
          ? emailParagraph(esc(REPORT_READY_HTML_ATTACHMENTS_INTRO[lang]), "margin:6px 0 0;")
          : ""),
      "20px 36px 0",
    ),
    emailAttachmentsRow(cards),
  ];

  if (kind === "audits") {
    rows.push(consultBoxRow(lang, vin));
  } else {
    rows.push(emailRow(emailSmall(questionHtml), "18px 36px 0"));
  }

  // 26.11 (Nils): atsauksmes lūgums atskaites e-pastā vairs netiek likts - atsevišķs e-pasts nākamajā darba dienā.
  rows.push(emailRow(clientSignOffHtml(b2bClient, lang), "22px 36px 0"));

  return emailDocument({
    rows: rows.filter(Boolean).join("\n"),
    lang,
    b2b: b2bClient,
    preheader: `${STATUS_REPORT_READY[lang]} · ${STATUS_PRODUCT_EYEBROW[kind][lang]}`,
  });
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

/** Vienkāršs klienta e-pasts: virsraksts + teksts + poga + piezīme. */
function simpleClientEmail(opts: {
  title: string;
  lead: string;
  ctaHref: string;
  ctaLabel: string;
  hint?: string;
  lang?: ClientReportLang;
  b2b?: boolean;
}): string {
  const rows = [
    titleRow(opts.title),
    emailRow(
      emailParagraph(esc(opts.lead), `margin:0 0 18px;color:${MUTED};`) +
        emailButton(opts.ctaHref, esc(opts.ctaLabel)) +
        (opts.hint ? emailSmall(esc(opts.hint), "margin:18px 0 0;") : ""),
      "12px 36px 0",
    ),
  ].join("\n");
  return emailDocument({ rows, lang: opts.lang ?? "lv", b2b: opts.b2b });
}

export function partnerVerifyEmailHtml(opts: {
  verifyUrl: string;
  locale?: string;
  purpose?: "signup" | "email_change";
}): string {
  const locale = partnerMailLocale(opts.locale);
  const copy = PARTNER_VERIFY_COPY[locale];
  const change = opts.purpose === "email_change";
  return simpleClientEmail({
    title: change ? copy.titleChange : copy.title,
    lead: change ? copy.leadChange : copy.lead,
    ctaHref: opts.verifyUrl,
    ctaLabel: copy.cta,
    hint: copy.hint,
    lang: locale,
  });
}

export function partnerPasswordResetEmailHtml(opts: {
  resetUrl: string;
  locale?: string;
}): string {
  const locale = partnerMailLocale(opts.locale);
  const copy = PARTNER_RESET_COPY[locale];
  return simpleClientEmail({
    title: copy.title,
    lead: copy.lead,
    ctaHref: opts.resetUrl,
    ctaLabel: copy.cta,
    hint: copy.hint,
    lang: locale,
  });
}

/** Pogas pēc nolūka (Nils 06.11 C1): tikai skaidri nosauktas rindas „<Nolūks>: https://…”. */
const EMAIL_INTENT_BUTTONS: Array<{ re: RegExp; label: string }> = [
  { re: /^apmaksāt$/i, label: "Apmaksāt" },
  { re: /^pasūtīt(?:\s+provin\s+audit(?:s|u))?$/i, label: "Pasūtīt PROVIN AUDITU" },
  { re: /^atvērt\s+atskaiti$/i, label: "Atvērt atskaiti" },
  { re: /^lejupielādēt\s+rēķinu$/i, label: "Lejupielādēt rēķinu" },
  // Tulkotie klientu šabloni (Nils 25.11): poga klienta valodā.
  { re: /^pay$/i, label: "Pay" },
  { re: /^order(?:\s+provin\s+audit)?$/i, label: "Order PROVIN AUDIT" },
  { re: /^bezahlen$/i, label: "Bezahlen" },
  { re: /^bestellen$/i, label: "PROVIN AUDIT bestellen" },
  { re: /^оплатить$/iu, label: "Оплатить" },
  { re: /^заказать$/iu, label: "Заказать PROVIN AUDIT" },
];

function emailIntentButton(line: string): string | null {
  const m = /^([^:\n]{3,40}):\s*(https?:\/\/\S+)\s*$/.exec(line.trim());
  if (!m?.[2] || !isValidHttpUrl(m[2])) return null;
  const intent = EMAIL_INTENT_BUTTONS.find((b) => b.re.test((m[1] ?? "").trim()));
  return intent ? ctaButton(m[2], intent.label) : null;
}

function linkifyEscaped(text: string): string {
  return esc(text)
    .replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" target="_blank" class="c-lnk" style="color:${BRAND};word-break:break-all;">${u}</a>`)
    .replace(/\n/g, "<br/>");
}

/* ---------- operatora teksts (dīlera «Sūtīt klientam» u.c.) ---------- */

export type OperatorEmailSituation = "ready" | "no_data" | "cancelled";

/** Servera puses papildinājumi «Atskaite gatava» kartītei (ja sūtīšanas brīdī zināmi). */
export type ReportEmailExtras = {
  facts?: EmailFact[];
  car?: string | null;
  offerExpiresAt?: string | null;
};

/** Sūtīšanas brīža konteksts statusa kartei, faktiem un pielikumiem. Bez tā - tikai teksts rāmī. */
export type OperatorEmailContext = {
  situation: OperatorEmailSituation;
  productKind?: OperatorEmailProductKind;
  vin?: string | null;
  car?: string | null;
  /** DD.MM.YYYY; noklusējums - šodien (Rīga). */
  date?: string | null;
  facts?: readonly EmailFact[];
  attachments?: readonly { filename: string; bytes?: number | null }[];
  /** AUDITS piemaksas saites termiņš (ISO) - «Saite derīga līdz DD.MM.YYYY». */
  offerExpiresAt?: string | null;
  /**
   * B2B diskrētais režīms (AUDITS forma, Nils 27.11): kartē «Transportlīdzekļa pārbaude», bez pogām,
   * piedāvājuma bloka un atsauksmes zvaigznēm (arī, ja tekstā tādas rindas palikušas).
   */
  discreet?: boolean;
  /** «Labota versija» statusa kartē. */
  corrected?: boolean;
  /** B2C: konsultācijas bloks («Vajag konsultāciju par šo auto?») pirms paraksta. */
  consult?: boolean;
};

const OFFER_PAY_LINE_RE = /^(apmaksāt|pasūtīt)\s*:\s*(https?:\/\/\S*\/papildinajums\/[^\s)]+)\s*(.*)$/i;
const OFFER_PRICE_LINE_RE = /^(jau samaksāts|piemaksa|kopā)\s*:\s*(.+)$/i;
const GOOGLE_REVIEW_LINE_RE = /^(.*?)\s*:?\s*(https:\/\/(?:g\.page|www\.google\.[a-z.]+|search\.google\.com)\/\S+)\s*$/i;

const OFFER_DEFAULT_LEAD = "Dīlera dati parāda tikai oficiālajos servisos reģistrēto. Tajā pašā pasūtījumā pievienosim:";

const OFFER_BENEFITS = [
  { icon: "shield", title: "Negadījumi un nobraukums", sub: "No vairākām Eiropas datubāzēm" },
  { icon: "gavel", title: "Izsoļu arhīvi", sub: "Bildes, bojājumi, cenas" },
  { icon: "search", title: "Sludinājuma un risku analīze", sub: "Fakti un ieteikumi klātienes apskatei" },
] as const;

type ParsedOffer = {
  url: string;
  lead: string;
  prices: { label: string; value: string }[];
  charge: string;
  ttlText: string;
  /** Teksta rindkopu indeksi, ko aizvieto strukturētais bloks. */
  consumed: Set<number>;
  /** Pirmā aizvietotā rindkopa - bloka vieta. */
  at: number;
};

/** Atrod AUDITS piemaksas piedāvājumu operatora tekstā (saite /papildinajums/ + cenu rindas). */
function parseOfferFromParagraphs(paragraphs: string[]): ParsedOffer | null {
  const payIdx = paragraphs.findIndex((p) => p.split("\n").some((l) => OFFER_PAY_LINE_RE.test(l.trim())));
  if (payIdx < 0) return null;
  const consumed = new Set<number>([payIdx]);
  const payLines = paragraphs[payIdx]!.split("\n");
  const payLine = payLines.find((l) => OFFER_PAY_LINE_RE.test(l.trim()))!.trim();
  const m = OFFER_PAY_LINE_RE.exec(payLine)!;
  const url = m[2]!;
  const ttlText = (m[3] ?? "").replace(/^\(|\)$/g, "").trim();
  if (!isValidHttpUrl(url)) return null;
  // Citas rindas maksājuma rindkopā (ja operators tās pievienoja) paliek kā teksts priekšā blokam.
  const extraPayLines = payLines.filter((l) => l.trim() !== payLine && l.trim());

  const prices: { label: string; value: string }[] = [];
  let at = payIdx;
  let priceIdx = -1;
  for (let i = payIdx; i >= Math.max(0, payIdx - 2); i--) {
    const lines = paragraphs[i]!.split("\n").map((l) => l.trim());
    const hits = lines.filter((l) => OFFER_PRICE_LINE_RE.test(l));
    if (hits.length >= 2) {
      priceIdx = i;
      break;
    }
  }
  if (priceIdx >= 0) {
    const lines = paragraphs[priceIdx]!.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.every((l) => OFFER_PRICE_LINE_RE.test(l) || OFFER_PAY_LINE_RE.test(l))) {
      for (const l of lines) {
        const pm = OFFER_PRICE_LINE_RE.exec(l);
        if (pm) prices.push({ label: pm[1]!, value: pm[2]!.trim() });
      }
      consumed.add(priceIdx);
      at = priceIdx;
    }
  }
  let lead = OFFER_DEFAULT_LEAD;
  const introIdx = at - 1;
  if (introIdx >= 0 && consumed.has(at) && at !== payIdx) {
    const intro = paragraphs[introIdx]!;
    const lines = intro.split("\n").map((l) => l.trim()).filter(Boolean);
    const bullets = lines.filter((l) => /^[-•✓]\s/.test(l));
    if (bullets.length > 0 || /audit/i.test(intro)) {
      const head = lines.filter((l) => !/^[-•✓]\s/.test(l)).join(" ").trim();
      if (head) lead = head;
      consumed.add(introIdx);
      at = introIdx;
    }
  }
  if (extraPayLines.length > 0) {
    // Nezaudē operatora papildu tekstu: maksājuma rindkopu atstāj bez saites rindas.
    paragraphs[payIdx] = extraPayLines.join("\n");
    consumed.delete(payIdx);
  }
  const charge = prices.find((p) => /^piemaksa$/i.test(p.label))?.value ?? "";
  return { url, lead, prices, charge, ttlText, consumed, at };
}

/** Izsoļu arhīva klientam: arhīvs jau ir - piedāvājumā dīlera servisa vēsture izsoļu vietā. */
const OFFER_BENEFITS_AUCTION_ARCHIVE = [
  OFFER_BENEFITS[0],
  { icon: "doc", title: "Dīlera servisa vēsture", sub: "Oficiālie servisi, ja pieejama" },
  OFFER_BENEFITS[2],
] as const;

function offerBlockFromParsed(o: ParsedOffer, expiresAt?: string | null, kind: OperatorEmailProductKind = "dealer"): string {
  const archive = kind === "auction_archive";
  const until = formatEmailDateIso(expiresAt);
  const ttl = until ? `Saite derīga līdz ${until}` : o.ttlText ? o.ttlText.charAt(0).toUpperCase() + o.ttlText.slice(1) : "";
  const labelMap = (label: string): string => {
    if (/^jau samaksāts$/i.test(label)) return archive ? "Jau samaksāts (izsoļu arhīvs)" : "Jau samaksāts (dīlera dati)";
    if (/^kopā$/i.test(label)) return "Kopā PROVIN AUDITS";
    return label.charAt(0).toUpperCase() + label.slice(1);
  };
  return emailOfferRow({
    eyebrow: "Piedāvājums šim auto",
    title: "Papildiniet līdz pilnam PROVIN AUDITAM",
    lead: archive && o.lead === OFFER_DEFAULT_LEAD ? "Izsoļu arhīvs rāda auto stāvokli izsoles dienā. Tajā pašā pasūtījumā pievienosim:" : o.lead,
    benefits: archive ? OFFER_BENEFITS_AUCTION_ARCHIVE : OFFER_BENEFITS,
    prices: o.prices.map((p) => ({ label: labelMap(p.label), value: p.value })),
    ctaHref: o.url,
    ctaLabel: o.charge ? `Pasūtīt pilno auditu par ${o.charge}` : "Pasūtīt pilno auditu",
    note: [ttl, "dati paliek tajā pašā pasūtījumā"].filter(Boolean).join(" · "),
  });
}

function operatorStatusRow(ctx: OperatorEmailContext, lang: ClientReportLang): string {
  const kind = ctx.productKind ?? "dealer";
  const vin = vinForCard(ctx.vin);
  const date = ctx.date ?? formatEmailDate();
  if (ctx.situation === "ready") {
    return emailStatusCardRow({
      icon: "check",
      eyebrow: ctx.discreet ? B2B_DISCREET_PRODUCT[lang] : STATUS_PRODUCT_EYEBROW[kind][lang],
      title: ctx.corrected
        ? REPORT_CORRECTED_TITLE[lang]
        : kind === "auction_archive" && lang === "lv"
          ? "Izsoļu arhīvs gatavs"
          : STATUS_REPORT_READY[lang],
      car: ctx.car,
      vin: vin || null,
      date,
    });
  }
  return emailStatusCardRow({
    icon: "refund",
    tone: "neutral",
    eyebrow: STATUS_PRODUCT_EYEBROW[kind][lang],
    title: ctx.situation === "cancelled" ? STATUS_CANCELLED[lang] : STATUS_NO_DATA[lang],
    car: ctx.car,
    vin: vin || null,
    date,
  });
}

/**
 * Operatora rediģēts e-pasts (plain text → rindkopas) variantā A.
 * - teksts vienmēr escapots, rindu pārtraukumi saglabāti;
 * - poga tikai rindai „Apmaksāt: / Pasūtīt: / Atvērt atskaiti: / Lejupielādēt rēķinu: https://…”;
 * - AUDITS piemaksas piedāvājums (/papildinajums/ saite + cenas) → strukturēts bloks;
 * - Google atsauksmes rinda → zvaigznes (tikai, ja tā ir tekstā - operators to ieslēdza);
 * - `context` - statusa karte, fakti un pielikumu kartītes.
 */
export function dealerDataOperatorMessageEmailHtml(opts: {
  title?: string | null;
  text: string;
  b2bClient?: boolean;
  lang?: ClientReportLang;
  context?: OperatorEmailContext | null;
  /** Sūta cilvēks (atmaksas logs): kājenē nav «nosūtīts automātiski». */
  humanSent?: boolean;
}): string {
  const title = (opts.title ?? "").trim();
  const b2bClient = opts.b2bClient === true;
  const lang = opts.lang ?? "lv";
  const ctx = opts.context ?? null;
  const paragraphs = opts.text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  // Strukturētais AUDITS piedāvājums - tikai dīlera «Dati gatavi» e-pastā (LV teksti).
  const offerKind = ctx?.productKind ?? "dealer";
  const offer =
    !ctx?.discreet && lang === "lv" && ctx?.situation === "ready" && (offerKind === "dealer" || offerKind === "auction_archive")
      ? parseOfferFromParagraphs(paragraphs)
      : null;
  // B2C konsultācijas bloks: pirms paraksta; jautājumu rinda ir blokā, tāpēc atsevišķi to neatkārto.
  const consult = ctx?.consult === true && !b2bClient && !ctx.discreet;
  const consultSkip = new Set<number>();
  let consultAt = -1;
  if (consult) {
    paragraphs.forEach((p, i) => {
      if (QUESTION_LINES.has(p)) consultSkip.add(i);
    });
    const signIdx = paragraphs.findIndex((p) => SIGN_OFF_START_RE.test(p));
    consultAt = signIdx >= 0 ? signIdx : paragraphs.length;
  }

  const discreet = ctx?.discreet === true;
  const renderBlock = (block: string): string => {
    if (discreet) {
      // B2B diskrēts: tikai teksts (bez pogām / zvaigznēm), paraksts «PROVIN» zilā krāsā.
      const dl = block.split("\n");
      if ((dl[dl.length - 1] ?? "").trim() === "PROVIN" && dl.length >= 2) {
        const head = dl.slice(0, -1).join("\n").trim();
        return emailParagraph(`${esc(head).replace(/\n/g, "<br/>")}<br/><span style="color:${BRAND};font-weight:600;">PROVIN</span>`, "margin:0;");
      }
      return emailParagraph(esc(block).replace(/\n/g, "<br/>"), "margin:0;");
    }
    const button = emailIntentButton(block);
    if (button) return button;
    const lines = block.split("\n");
    const last = (lines[lines.length - 1] ?? "").trim();
    if (b2bClient && last === "PROVIN" && lines.length >= 2) {
      const head = lines.slice(0, -1).join("\n").trim();
      return emailParagraph(`${esc(head).replace(/\n/g, "<br/>")}<br/><span style="color:${BRAND};font-weight:600;">PROVIN</span>`, "margin:0;");
    }
    const review = lines.length === 1 ? GOOGLE_REVIEW_LINE_RE.exec(last) : null;
    if (review?.[2] && isValidHttpUrl(review[2]) && /g\.page|google\./i.test(review[2])) {
      const intro = (review[1] ?? "").trim().replace(/:$/, "");
      return googleReviewBlockHtml(intro ? `${intro}:` : GOOGLE_REVIEW_INTRO_HTML[lang], review[2]);
    }
    // Saite atsevišķā rindā pēc „… apmaksāt šeit:” - tas pats nolūks „Apmaksāt”.
    const prev = (lines[lines.length - 2] ?? "").trim();
    const payAfterColon =
      lines.length > 1 && isValidHttpUrl(last) && /apmaks\p{L}*[^:\n]*:$/iu.test(prev) ? ctaButton(last, "Apmaksāt") : null;
    const lastButton = lines.length > 1 ? (emailIntentButton(last) ?? payAfterColon) : null;
    if (lastButton) {
      const head = lines.slice(0, -1).join("\n").trim();
      return `${emailParagraph(linkifyEscaped(head), "margin:0;")}\n${lastButton}`;
    }
    return emailParagraph(linkifyEscaped(block), "margin:0;");
  };

  const cards = ctx?.attachments?.length ? attachmentCards(ctx.attachments, lang) : [];
  // Pielikumu kartītes - aiz rindkopas, kas min pielikumu / PDF; citādi aiz otrās rindkopas.
  let attachAfter = -1;
  if (cards.length) {
    const hit = paragraphs.findIndex(
      (p, i) => !offer?.consumed.has(i) && /pielikum|attach|anhang|вложени|\bPDF\b/i.test(p),
    );
    attachAfter = hit >= 0 ? hit : Math.min(1, paragraphs.length - 1);
  }

  const rows: string[] = [];
  if (ctx) {
    rows.push(operatorStatusRow(ctx, lang));
    rows.push(emailFactsRow(ctx.facts ?? []));
  } else if (title) {
    rows.push(titleRow(title));
  }

  let first = true;
  const pad = () => {
    const p = first ? (ctx || title ? "20px 36px 0" : "22px 36px 0") : "14px 36px 0";
    first = false;
    return p;
  };
  // «Pasūtīt PROVIN AUDITU: https://…» rindkopa kopā ar iepriekšējo tekstu - ietvarā (kā maketā).
  const isOrderButton = (p: string | undefined): boolean =>
    Boolean(p && /^pasūtīt(?:\s+provin\s+audits)?\s*:\s*https?:\/\/\S+$/i.test(p.trim()) && emailIntentButton(p));
  const boxedWithPrev = new Set<number>();
  paragraphs.forEach((p, i) => {
    if (i > 0 && !discreet && isOrderButton(p) && !offer?.consumed.has(i - 1) && !isOrderButton(paragraphs[i - 1]) && !emailIntentButton(paragraphs[i - 1]!)) {
      boxedWithPrev.add(i);
    }
  });

  paragraphs.forEach((block, i) => {
    if (consult && i === consultAt) {
      rows.push(consultBoxRow(lang, vinForCard(ctx?.vin)));
      first = false;
    }
    if (offer && i === offer.at) {
      rows.push(offerBlockFromParsed(offer, ctx?.offerExpiresAt, offerKind));
      first = false;
    }
    if (!offer?.consumed.has(i) && !boxedWithPrev.has(i) && !consultSkip.has(i)) {
      if (boxedWithPrev.has(i + 1)) {
        const boxed = `${renderBlock(block)}${emailIntentButton(paragraphs[i + 1]!)}`;
        const p = pad();
        rows.push(emailRow(emailBorderedBox(boxed), p === "14px 36px 0" ? "22px 36px 0" : p));
      } else {
        rows.push(emailRow(renderBlock(block), pad()));
      }
    }
    if (i === attachAfter) {
      rows.push(emailAttachmentsRow(cards));
      first = false;
    }
  });
  if (consult && consultAt >= paragraphs.length) rows.push(consultBoxRow(lang, vinForCard(ctx?.vin)));

  return emailDocument({
    rows: rows.filter(Boolean).join("\n"),
    lang,
    b2b: b2bClient,
    preheader: ctx ? (ctx.situation === "ready" ? (ctx.corrected ? REPORT_CORRECTED_TITLE[lang] : STATUS_REPORT_READY[lang]) : ctx.situation === "cancelled" ? STATUS_CANCELLED[lang] : STATUS_NO_DATA[lang]) : title || null,
    ...(opts.humanSent ? { humanSent: true } : {}),
  });
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
  date?: string | null;
}): string {
  const vinRaw = (opts.vin ?? "").trim();
  const vin = vinForCard(vinRaw);
  const amount = (opts.amountEur ?? "").trim() || "24,99 €";
  const status = emailStatusCardRow({
    icon: "refund",
    tone: "neutral",
    eyebrow: STATUS_PRODUCT_EYEBROW.dealer.lv,
    title: opts.cancelled ? STATUS_CANCELLED.lv : STATUS_NO_DATA.lv,
    vin: vin || null,
    date: opts.date ?? formatEmailDate(),
  });
  const facts = emailFactsRow([
    { value: amount, label: "atmaksāts uz karti" },
    { value: "1-7", label: "dienas bankā" },
  ]);
  const question = emailSmall(esc(CLIENT_EMAIL_QUESTION_LINE.lv));

  if (opts.cancelled) {
    const rows = [
      status,
      facts,
      emailRow(
        emailParagraph(
          `Atcēlām Jūsu oficiālā dīlera datu pasūtījumu un atmaksājām ${esc(amount)} pilnā apmērā uz karti, ar kuru maksājāt.`,
          "margin:0 0 10px;",
        ) + emailParagraph("Atkarībā no bankas nauda kontā parasti parādās 1-7 dienu laikā, bieži jau tajā pašā dienā.", "margin:0;"),
        "20px 36px 0",
      ),
      emailRow(question, "18px 36px 0"),
      emailRow(clientSignOffHtml(), "22px 36px 0"),
    ].join("\n");
    return emailDocument({ rows, preheader: `${STATUS_CANCELLED.lv} - ${amount}` });
  }

  const rows = [
    status,
    emailRow(
      emailParagraph("Labdien!", "margin:0 0 6px;") +
        emailParagraph(
          "Pārbaudījām Jūsu auto. Diemžēl oficiālā dīlera dati par to nav pieejami, tāpēc maksājumu atgriezām pilnā apmērā.",
          "margin:0;",
        ),
      "20px 36px 0",
    ),
    facts,
    emailRow(
      emailSmall("Atkarībā no bankas nauda kontā parasti parādās 1-7 dienu laikā, bieži jau tajā pašā dienā."),
      "14px 36px 0",
    ),
    emailRow(
      emailBorderedBox(
        emailParagraph("Auto vēl tikai plānojat pirkt?", "margin:0 0 4px;font-weight:600;") +
          emailSmall(
            "Iesakām PROVIN AUDITU: padziļinātu vēstures pārbaudi ar nobraukuma, negadījumu un risku analīzi.",
            "margin:0 0 16px;",
          ) +
          emailButton("https://provin.lv", "Pasūtīt PROVIN AUDITU"),
      ),
      "22px 36px 0",
    ),
    emailRow(question, "18px 36px 0"),
    emailRow(clientSignOffHtml(), "22px 36px 0"),
  ].join("\n");
  return emailDocument({ rows, preheader: `${STATUS_NO_DATA.lv} - ${amount}` });
}

export type MorningSummaryEmailLine = {
  title: string;
  detail: string;
};

function morningSummaryEmailSection(title: string, lines: MorningSummaryEmailLine[]): string {
  if (lines.length === 0) return "";
  const rows = lines
    .map(
      (line) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #ececec;font-size:14px;color:${INK};">${esc(line.title)}</td><td style="padding:8px 0;border-bottom:1px solid #ececec;font-size:13px;color:${MUTED};text-align:right;white-space:nowrap;">${esc(line.detail)}</td></tr>`,
    )
    .join("");
  return `<p style="margin:22px 0 8px;font-size:13px;font-weight:600;color:${INK};">${esc(title)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>`;
}

/** Admin rīta kopsavilkums: īss HTML, saite uz /admin/kopsavilkums. */
export function morningSummaryEmailHtml(opts: {
  dateLabel: string;
  pageUrl: string;
  open: number;
  urgent: number;
  overdue: number;
  openAudits: number;
  openPeeks: number;
  newPeeksLast24h: number;
  overdueAudits: MorningSummaryEmailLine[];
  dueTodayAudits: MorningSummaryEmailLine[];
  newPeeks: MorningSummaryEmailLine[];
  failingSources?: MorningSummaryEmailLine[];
  costAlerts?: MorningSummaryEmailLine[];
  /** Dīlera datu ēnu režīma statistika (viena rinda). */
  dealerShadowLine?: string | null;
  /** VIN SCAN uzraudzība: «N/M avoti strādā», pārlūka avotu problēmas. */
  vinScanLines?: readonly string[];
}): string {
  const vinScan = (opts.vinScanLines ?? [])
    .map((line) => `<p style="margin:20px 0 0;font-size:14px;color:${INK};">${esc(line)}</p>`)
    .join("\n");
  const shadow = opts.dealerShadowLine
    ? `<p style="margin:20px 0 0;font-size:14px;color:${INK};">${esc(opts.dealerShadowLine)}</p>`
    : "";
  const empty =
    opts.overdueAudits.length + opts.dueTodayAudits.length + opts.newPeeks.length === 0
      ? `<p style="margin:20px 0 0;font-size:15px;color:${MUTED};">Kavētu auditu nav, un pēdējās 24 h nav jaunu vērtējumu.</p>`
      : "";
  const inner = `
<p style="margin:0 0 6px;font-size:22px;font-weight:600;letter-spacing:-0.02em;">Rīta kopsavilkums</p>
<p style="margin:0 0 20px;font-size:14px;color:${MUTED};">${esc(opts.dateLabel)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
<tr>
<td style="width:33%;padding:10px 8px;background:#f4f4f5;border-radius:10px;text-align:center;">
<p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED};">Atvērti</p>
<p style="margin:0;font-size:22px;font-weight:700;color:${INK};">${opts.open}</p>
</td>
<td style="width:33%;padding:10px 8px;background:#fff7ed;border-radius:10px;text-align:center;">
<p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED};">Steidzami</p>
<p style="margin:0;font-size:22px;font-weight:700;color:${INK};">${opts.urgent}</p>
</td>
<td style="width:33%;padding:10px 8px;background:#fef2f2;border-radius:10px;text-align:center;">
<p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED};">Kavēti</p>
<p style="margin:0;font-size:22px;font-weight:700;color:${INK};">${opts.overdue}</p>
</td>
</tr>
</table>
<p style="margin:12px 0 0;font-size:13px;color:${MUTED};">Atvērtie auditi: ${opts.openAudits} · ātrie vērtējumi: ${opts.openPeeks} · jauni pēdējās 24 h: ${opts.newPeeksLast24h}</p>
${morningSummaryEmailSection("Kavētie auditi (48 h)", opts.overdueAudits)}
${morningSummaryEmailSection("Šodienas termiņi", opts.dueTodayAudits)}
${morningSummaryEmailSection("Jauni ātrie vērtējumi (24 h)", opts.newPeeks)}
${morningSummaryEmailSection("Datu avoti ar kļūdām 3 reizes pēc kārtas (pārbaudi piekļuvi)", opts.failingSources ?? [])}
${morningSummaryEmailSection("Izmaksas", opts.costAlerts ?? [])}
${vinScan}
${shadow}
${empty}
${ctaButton(opts.pageUrl, "Atvērt kopsavilkumu")}
`;
  return shell(inner);
}

/** B2B klienta e-pasts: zīmols PROVIN (bez .LV), zils #0061D2. */
export function b2bProvinEmailHtml(opts: { title: string; paragraphs: readonly string[]; lang?: ClientReportLang }): string {
  const paras = opts.paragraphs
    .map((p, i) => emailRow(emailParagraph(esc(p).replace(/\n/g, "<br/>"), "margin:0;"), i === 0 ? "14px 36px 0" : "12px 36px 0"))
    .join("\n");
  return emailDocument({ rows: `${titleRow(opts.title)}\n${paras}`, b2b: true, lang: opts.lang ?? "lv" });
}

export function staffInviteEmailHtml(opts: {
  name: string;
  inviteUrl: string;
  kind?: "invite" | "reset";
}): string {
  const name = opts.name.trim() || "kolēģi";
  const reset = opts.kind === "reset";
  const intro = reset
    ? `Sveiki, ${name}. Nils atiestatīja tavu IRISS paroli. Saite derīga 24 stundas un darbojas vienu reizi.`
    : `Sveiki, ${name}. Nils uzaicināja tevi uz IRISS. Saite derīga 24 stundas un darbojas vienu reizi.`;
  return simpleClientEmail({
    title: reset ? "IRISS parole" : "IRISS pieeja",
    lead: intro,
    ctaHref: opts.inviteUrl,
    ctaLabel: "Iestatīt paroli",
    hint: "Ja tu to neprasīji, ignorē šo vēstuli.",
  });
}

/** @deprecated B2B klients redz PROVIN. */
export const b2bIrissEmailHtml = b2bProvinEmailHtml;
export const b2bWalletRefundEmailHtml = b2bProvinEmailHtml;
