/**
 * PROVIN klientu e-pastu kopīgais rāmis - Nila apstiprinātais makets, variants A «Gaišā kartīte» (22.11.2026).
 *
 * - tabulu izkārtojums, inline stili, bulletproof pogas (td ar bgcolor + a);
 * - @media telefonam (≤480 px), tumšais režīms: meta color-scheme + prefers-color-scheme + [data-ogsc];
 * - ikonas tikai PNG 2x no https://www.provin.lv/email/*.png (Gmail neattēlo SVG; data: URI nelieto);
 * - bez JS. Teksts vienmēr escapots šeit vai izsaucējā.
 */
import type { ClientReportLang } from "@/lib/client-report-i18n";

export const EMAIL_ICON_BASE_URL = "https://www.provin.lv/email";

export type EmailIconName = "check" | "refund" | "doc" | "shield" | "gavel" | "search" | "star";

/** Gaišā režīma krāsas (inline). Tumšās - tikai caur <style> klasēm. */
export const EMAIL_COLORS = {
  bg: "#f2f3f5",
  card: "#ffffff",
  ink: "#16181d",
  mut: "#646b76",
  line: "#e4e7eb",
  tint: "#eef4ff",
  tintLine: "#dbe6fb",
  tile: "#f6f7f9",
  blue: "#0061D2",
  logoBlue: "#0066ff",
  ghostLine: "#cfd4db",
} as const;

export const EMAIL_FONT = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";
const MONO = "Menlo,Consolas,monospace";

const C = EMAIL_COLORS;
const F = EMAIL_FONT;

const DARK_RULES: Record<string, string> = {
  ".c-bg": "background-color:#0d0e11 !important",
  ".c-card": "background-color:#17191e !important",
  ".c-ink": "color:#eef0f3 !important",
  ".c-mut": "color:#9aa1ac !important",
  ".c-line": "border-color:#2a2d34 !important",
  ".c-hr": "background-color:#2a2d34 !important",
  ".c-tint": "background-color:#13223d !important;border-color:#1f3560 !important",
  ".c-tile": "background-color:#1f2228 !important",
  ".c-lnk": "color:#6ea2ff !important",
  ".c-gh": "border-color:#3a3e46 !important",
  ".c-ght": "color:#eef0f3 !important",
  /* Vecais brīvais saturs (piem. sludinājuma komentārs): teksts gaišs uz tumšās kartītes. */
  ".c-gen p,.c-gen li,.c-gen strong,.c-gen span": "color:#eef0f3 !important",
};

function darkCss(prefix: string): string {
  return Object.entries(DARK_RULES)
    .map(([sel, rule]) => `${sel.split(",").map((x) => `${prefix}${x}`).join(",")}{${rule}}`)
    .join("");
}

const MOBILE_CSS =
  "@media (max-width:480px){" +
  ".m-pad{padding-left:20px !important;padding-right:20px !important}" +
  ".m-pad2{padding:18px 16px !important}" +
  ".m-outer{padding:12px 8px 28px !important}" +
  ".m-stack{display:block !important;width:100% !important;padding:0 0 8px 0 !important;text-align:left !important}" +
  ".m-full{width:100% !important}" +
  ".m-tile{padding:12px 10px 10px !important}" +
  ".m-num{font-size:18px !important;line-height:24px !important}" +
  ".m-btn{display:block !important}" +
  "}";

export function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escapots teksts ar rindu pārtraukumiem (operatora teksts). */
export function escMultiline(s: string): string {
  return escHtml(s.replace(/\r\n/g, "\n")).replace(/\n/g, "<br/>");
}

export function emailIconUrl(name: EmailIconName): string {
  return `${EMAIL_ICON_BASE_URL}/${name}.png`;
}

export function emailIconImg(name: EmailIconName, size = 20, alt = ""): string {
  return `<img src="${emailIconUrl(name)}" width="${size}" height="${size}" alt="${escHtml(alt)}" style="display:block;border:0;outline:none;width:${size}px;height:${size}px;">`;
}

/** Datums DD.MM.YYYY Rīgas laikā. */
export function formatEmailDate(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("lv-LV", {
    timeZone: "Europe/Riga",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}.${get("month")}.${get("year")}`;
}

/** ISO → DD.MM.YYYY (Rīga); nederīgs → "". */
export function formatEmailDateIso(iso: string | null | undefined): string {
  const t = Date.parse(String(iso ?? ""));
  return Number.isFinite(t) ? formatEmailDate(new Date(t)) : "";
}

const TABLE = 'role="presentation" cellpadding="0" cellspacing="0" border="0"';

export function emailRow(inner: string, pad = "18px 36px 0"): string {
  return `<tr><td class="m-pad" style="padding:${pad};font-family:${F};">${inner}</td></tr>`;
}

export function emailParagraph(innerHtml: string, extraStyle = ""): string {
  return `<p class="c-ink" style="margin:0 0 14px;font-family:${F};font-size:15px;line-height:24px;color:${C.ink};${extraStyle}">${innerHtml}</p>`;
}

export function emailSmall(innerHtml: string, extraStyle = ""): string {
  return `<p class="c-mut" style="margin:0;font-family:${F};font-size:13px;line-height:20px;color:${C.mut};${extraStyle}">${innerHtml}</p>`;
}

export function emailLink(href: string, label: string, extraStyle = ""): string {
  return `<a href="${escHtml(href)}" target="_blank" class="c-lnk" style="color:${C.blue};text-decoration:none;font-weight:600;${extraStyle}">${label}</a>`;
}

/** Bulletproof poga. `label` - jau escapots HTML. */
export function emailButton(href: string, labelHtml: string, kind: "primary" | "ghost" = "primary"): string {
  const h = escHtml(href);
  if (kind === "ghost") {
    return `<table ${TABLE} class="m-full"><tr><td align="center" class="c-gh" style="border:1px solid ${C.ghostLine};border-radius:999px;"><a href="${h}" target="_blank" class="c-ght m-btn" style="display:inline-block;padding:13px 26px;font-family:${F};font-size:15px;font-weight:600;line-height:20px;color:${C.ink};text-decoration:none;border-radius:999px;">${labelHtml}</a></td></tr></table>`;
  }
  return `<table ${TABLE} class="m-full"><tr><td align="center" bgcolor="${C.blue}" style="border-radius:999px;background-color:${C.blue};"><a href="${h}" target="_blank" class="m-btn" style="display:inline-block;padding:14px 28px;font-family:${F};font-size:15px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;border-radius:999px;">${labelHtml}</a></td></tr></table>`;
}

export function emailSpacer(h: number): string {
  return `<div style="height:${h}px;line-height:${h}px;font-size:1px;">&nbsp;</div>`;
}

function emailHr(): string {
  return `<table ${TABLE} width="100%"><tr><td class="c-hr" height="1" style="height:1px;line-height:1px;font-size:1px;background-color:${C.line};">&nbsp;</td></tr></table>`;
}

/** Ietvars ar apmali (piedāvājums, konsultācija). `inner` - gatavs HTML. */
export function emailBorderedBox(inner: string): string {
  return `<table ${TABLE} width="100%" class="c-line" style="border:1px solid ${C.line};border-radius:14px;"><tr><td class="m-pad2" style="padding:20px 22px;font-family:${F};">${inner}</td></tr></table>`;
}

/** Logo kā teksts: «PRO» + zils «VIN» (+ «.LV» privātiem klientiem; B2B tikai PROVIN). */
export function emailHeaderRow(b2b: boolean): string {
  const suffix = b2b ? "" : `<span class="c-ink" style="color:${C.ink};">.LV</span>`;
  return `<tr><td class="m-pad" style="padding:26px 36px 0;"><table ${TABLE} width="100%"><tr><td style="font-family:${F};font-size:22px;font-weight:800;letter-spacing:-0.4px;line-height:26px;"><span class="c-ink" style="color:${C.ink};">PRO</span><span style="color:${C.logoBlue};">VIN</span>${suffix}</td></tr></table></td></tr>`;
}

export type EmailStatusCard = {
  icon: EmailIconName;
  /** "success" - zilgana karte; "neutral" - pelēka (atmaksa / atcelts, ne sarkana). */
  tone?: "success" | "neutral";
  eyebrow: string;
  title: string;
  car?: string | null;
  vin?: string | null;
  date?: string | null;
};

export function emailStatusCardRow(o: EmailStatusCard): string {
  const neutral = o.tone === "neutral";
  const bg = neutral ? C.tile : C.tint;
  const border = neutral ? C.line : C.tintLine;
  const cls = neutral ? "c-tile c-line" : "c-tint";
  const car = (o.car ?? "").trim();
  const vin = (o.vin ?? "").trim();
  const date = (o.date ?? "").trim();
  const metaParts = [
    vin ? `VIN <span style="font-family:${MONO};letter-spacing:0.3px;">${escHtml(vin)}</span>` : "",
    date ? escHtml(date) : "",
  ].filter(Boolean);
  const icon = `<table ${TABLE}><tr><td class="c-card" width="40" height="40" align="center" valign="middle" bgcolor="#ffffff" style="width:40px;height:40px;border-radius:999px;background-color:#ffffff;">${emailIconImg(o.icon, 20)}</td></tr></table>`;
  return `<tr><td class="m-pad" style="padding:22px 36px 0;"><table ${TABLE} width="100%" class="${cls}" bgcolor="${bg}" style="background-color:${bg};border:1px solid ${border};border-radius:14px;"><tr>
<td width="40" valign="top" style="padding:18px 0 18px 18px;">${icon}</td>
<td valign="top" style="padding:16px 18px 16px 14px;font-family:${F};">
<p class="c-mut" style="margin:0 0 2px;font-size:12px;line-height:16px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;color:${C.mut};">${escHtml(o.eyebrow)}</p>
<p class="c-ink" style="margin:0;font-size:20px;line-height:26px;font-weight:700;letter-spacing:-0.3px;color:${C.ink};">${escHtml(o.title)}</p>${
    car
      ? `\n<p class="c-ink" style="margin:6px 0 0;font-size:15px;line-height:22px;font-weight:600;color:${C.ink};">${escHtml(car)}</p>`
      : ""
  }${
    metaParts.length
      ? `\n<p class="c-mut" style="margin:${car ? "2px" : "6px"} 0 0;font-size:13px;line-height:20px;color:${C.mut};">${metaParts.join(" · ")}</p>`
      : ""
  }
</td></tr></table></td></tr>`;
}

export type EmailFact = { value: string; label: string };

/** 2-3 faktu flīzes (tikai fakti, bez ieteikumiem). Tukšs saraksts - nekas. */
export function emailFactsRow(facts: readonly EmailFact[]): string {
  const list = facts.filter((f) => f.value.trim() && f.label.trim()).slice(0, 3);
  if (list.length === 0) return "";
  const w = Math.floor(100 / list.length);
  const cells = list
    .map(
      (f, i) =>
        `<td width="${w}%" valign="top" style="padding:${i ? "0 0 0 8px" : "0"};"><table ${TABLE} width="100%"><tr><td class="c-tile m-tile" bgcolor="${C.tile}" style="background-color:${C.tile};border-radius:10px;padding:14px 14px 12px;font-family:${F};"><p class="c-ink m-num" style="margin:0;font-size:22px;line-height:28px;font-weight:700;letter-spacing:-0.3px;color:${C.ink};">${escHtml(f.value)}</p><p class="c-mut" style="margin:2px 0 0;font-size:12px;line-height:16px;color:${C.mut};">${escHtml(f.label)}</p></td></tr></table></td>`,
    )
    .join("");
  return `<tr><td class="m-pad" style="padding:16px 36px 0;"><table ${TABLE} width="100%"><tr>${cells}</tr></table></td></tr>`;
}

export type EmailAttachmentCard = { name: string; meta?: string | null };

export function emailAttachmentsRow(files: readonly EmailAttachmentCard[]): string {
  const list = files.filter((f) => f.name.trim());
  if (list.length === 0) return "";
  const cards = list
    .map(
      (f) =>
        `<table ${TABLE} width="100%" class="c-line" style="border:1px solid ${C.line};border-radius:10px;margin:0 0 8px;"><tr><td width="24" valign="middle" style="padding:12px 0 12px 14px;">${emailIconImg("doc", 20)}</td><td valign="middle" style="padding:12px 14px 12px 10px;font-family:${F};"><p class="c-ink" style="margin:0;font-size:14px;line-height:20px;font-weight:600;color:${C.ink};word-break:break-all;">${escHtml(f.name)}</p>${
          f.meta?.trim()
            ? `<p class="c-mut" style="margin:0;font-size:12px;line-height:16px;color:${C.mut};">${escHtml(f.meta.trim())}</p>`
            : ""
        }</td></tr></table>`,
    )
    .join("");
  return `<tr><td class="m-pad" style="padding:16px 36px 0;">${cards}</td></tr>`;
}

/** Faila izmērs «1,4 MB» / «320 KB». */
export function formatEmailFileSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export type EmailOfferBenefit = { icon: EmailIconName; title: string; sub: string };

export type EmailOfferBlock = {
  eyebrow: string;
  title: string;
  lead: string;
  benefits: readonly EmailOfferBenefit[];
  /** Cenu tabulas rindas; pēdējā - treknā «Kopā». */
  prices: readonly { label: string; value: string }[];
  ctaHref: string;
  ctaLabel: string;
  note?: string | null;
};

export function emailOfferRow(o: EmailOfferBlock): string {
  const benefits = o.benefits
    .map(
      (b) =>
        `<table ${TABLE} width="100%" style="margin:0 0 12px;"><tr><td width="40" valign="top"><table ${TABLE}><tr><td class="c-tint" width="40" height="40" align="center" valign="middle" bgcolor="${C.tint}" style="width:40px;height:40px;border-radius:999px;background-color:${C.tint};">${emailIconImg(b.icon, 20)}</td></tr></table></td><td valign="middle" style="padding-left:12px;font-family:${F};"><p class="c-ink" style="margin:0;font-size:15px;line-height:20px;font-weight:600;color:${C.ink};">${escHtml(b.title)}</p><p class="c-mut" style="margin:2px 0 0;font-size:13px;line-height:18px;color:${C.mut};">${escHtml(b.sub)}</p></td></tr></table>`,
    )
    .join("");
  const n = o.prices.length;
  const priceRows = o.prices
    .map((p, i) => {
      const last = i === n - 1;
      const border = last ? "" : `border-bottom:1px solid ${C.line};`;
      const lineCls = last ? "" : " c-line";
      const size = last ? "16px" : "14px";
      return `<tr><td class="${last ? "c-ink" : "c-mut"}${lineCls}" style="padding:10px 0;${border}font-family:${F};font-size:${size};font-weight:${last ? "700" : "400"};color:${last ? C.ink : C.mut};">${escHtml(p.label)}</td><td align="right" class="c-ink${lineCls}" style="padding:10px 0;${border}font-family:${F};font-size:${size};font-weight:${last ? "700" : "600"};color:${C.ink};white-space:nowrap;">${escHtml(p.value).replace(/ €/g, "&nbsp;€")}</td></tr>`;
    })
    .join("");
  const priceTable = n ? `<table ${TABLE} width="100%">${priceRows}</table>${emailSpacer(18)}` : "";
  const inner = `<p class="c-mut" style="margin:0 0 4px;font-size:12px;line-height:16px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;color:${C.mut};">${escHtml(o.eyebrow)}</p>
<p class="c-ink" style="margin:0 0 6px;font-size:19px;line-height:26px;font-weight:700;letter-spacing:-0.3px;color:${C.ink};">${escHtml(o.title)}</p>
<p class="c-mut" style="margin:0 0 18px;font-size:14px;line-height:21px;color:${C.mut};">${escMultiline(o.lead)}</p>
${benefits}${emailSpacer(6)}${priceTable}${emailButton(o.ctaHref, escHtml(o.ctaLabel).replace(/ €/g, "&nbsp;€"))}${
    o.note?.trim()
      ? `\n<p class="c-mut" style="margin:10px 0 0;font-size:12px;line-height:18px;color:${C.mut};">${escHtml(o.note.trim())}</p>`
      : ""
  }`;
  return `<tr><td class="m-pad" style="padding:24px 36px 0;"><table ${TABLE} width="100%" class="c-line" style="border:1px solid ${C.line};border-radius:14px;"><tr><td class="m-pad2" style="padding:22px 22px 20px;font-family:${F};">${inner}</td></tr></table></td></tr>`;
}

/** 5 zvaigznes - katra ved uz Google atsauksmi. */
export function emailReviewStars(href: string, size = 22): string {
  const h = escHtml(href);
  let out = "";
  for (let i = 0; i < 5; i++) {
    out += `<td style="padding:0 4px 0 0;"><a href="${h}" target="_blank" style="text-decoration:none;">${emailIconImg("star", size, "★")}</a></td>`;
  }
  return `<table ${TABLE}><tr>${out}</tr></table>`;
}

const FOOTER_AUTO: Record<ClientReportLang, string> = {
  lv: "Šis e-pasts nosūtīts automātiski.",
  en: "This email was sent automatically.",
  ru: "Это письмо отправлено автоматически.",
  de: "Diese E-Mail wurde automatisch gesendet.",
};

export function emailFooterRows(b2b: boolean): string {
  const contacts = `${emailLink("mailto:info@provin.lv", "info@provin.lv")} · ${emailLink("tel:+37129502039", "29&nbsp;502&nbsp;039")}`;
  const site = b2b
    ? ""
    : `<td class="m-stack c-mut" valign="top" align="right" style="font-family:${F};font-size:13px;line-height:20px;color:${C.mut};"><a href="https://www.provin.lv/lv" target="_blank" class="c-lnk" style="color:${C.blue};text-decoration:none;">provin.lv</a></td>`;
  return `<tr><td class="m-pad" style="padding:26px 36px 0;">${emailHr()}</td></tr>
<tr><td class="m-pad" style="padding:16px 36px 28px;"><table ${TABLE} width="100%"><tr><td class="m-stack c-mut" valign="top" style="font-family:${F};font-size:13px;line-height:20px;color:${C.mut};">${contacts}</td>${site}</tr></table></td></tr>`;
}

/**
 * Pilns HTML dokuments: fons → kartīte (max 600 px) → «Šis e-pasts nosūtīts automātiski.».
 * `rows` - <tr> rindas kartītes iekšienē (bez galvenes un kājenes - tās pieliek šeit).
 */
export function emailDocument(opts: {
  rows: string;
  lang?: ClientReportLang;
  b2b?: boolean;
  preheader?: string | null;
  /** Bez kontaktu kājenes (iekšējie admin e-pasti). */
  omitContacts?: boolean;
  /** false - tikai gaišs (iekšējie e-pasti ar krāsainām flīzēm). Noklusējums: true. */
  darkMode?: boolean;
}): string {
  const dark = opts.darkMode !== false;
  const lang = opts.lang ?? "lv";
  const b2b = opts.b2b === true;
  const pre = (opts.preheader ?? "").trim();
  const preheader = pre
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escHtml(pre)}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
${
    dark
      ? `<meta name="color-scheme" content="light dark"/>
<meta name="supported-color-schemes" content="light dark"/>`
      : `<meta name="color-scheme" content="light"/>
<meta name="supported-color-schemes" content="light"/>`
  }
<title>PROVIN</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&amp;display=swap" rel="stylesheet"/>
<style>
:root{color-scheme:${dark ? "light dark" : "light"};supported-color-schemes:${dark ? "light dark" : "light"}}
body{margin:0;padding:0;-webkit-text-size-adjust:100%}
a{text-decoration:none}
${MOBILE_CSS}${dark ? `\n@media (prefers-color-scheme:dark){${darkCss("")}}\n${darkCss("[data-ogsc] ")}` : ""}
</style>
</head>
<body class="c-bg" style="margin:0;padding:0;background-color:${C.bg};">
${preheader}<table ${TABLE} width="100%" class="c-bg" bgcolor="${C.bg}" style="background-color:${C.bg};"><tr><td align="center" class="m-outer" style="padding:32px 16px 40px;">
<table ${TABLE} width="100%" class="c-card" bgcolor="${C.card}" style="max-width:600px;background-color:${C.card};border-radius:14px;">
${emailHeaderRow(b2b)}
${opts.rows}
${opts.omitContacts ? `<tr><td style="padding:0 0 28px;"></td></tr>` : emailFooterRows(b2b)}
</table>
<p class="c-mut" style="margin:18px 0 0;font-family:${F};font-size:12px;line-height:18px;color:${C.mut};text-align:center;">${FOOTER_AUTO[lang]}</p>
</td></tr></table>
</body>
</html>`;
}
