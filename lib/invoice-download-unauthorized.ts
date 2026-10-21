import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from "@/i18n/locales";
import { escapeHtml } from "@/lib/html-escape";
import deThanks from "@/messages/de/thanks.json";
import enThanks from "@/messages/en/thanks.json";
import lvThanks from "@/messages/lv/thanks.json";
import ruThanks from "@/messages/ru/thanks.json";

const COPY: Record<AppLocale, { title: string; body: string; home: string }> = {
  lv: {
    title: lvThanks.Thanks.invoiceAttachedTitle,
    body: lvThanks.Thanks.invoiceAttachedBody,
    home: lvThanks.Thanks.invoiceAttachedHome,
  },
  en: {
    title: enThanks.Thanks.invoiceAttachedTitle,
    body: enThanks.Thanks.invoiceAttachedBody,
    home: enThanks.Thanks.invoiceAttachedHome,
  },
  de: {
    title: deThanks.Thanks.invoiceAttachedTitle,
    body: deThanks.Thanks.invoiceAttachedBody,
    home: deThanks.Thanks.invoiceAttachedHome,
  },
  ru: {
    title: ruThanks.Thanks.invoiceAttachedTitle,
    body: ruThanks.Thanks.invoiceAttachedBody,
    home: ruThanks.Thanks.invoiceAttachedHome,
  },
};

export function resolveInvoiceUnauthorizedLocale(args: {
  cookieLocale?: string | null;
  acceptLanguage?: string | null;
}): AppLocale {
  if (isAppLocale(args.cookieLocale?.trim())) return args.cookieLocale!.trim() as AppLocale;
  const accept = args.acceptLanguage ?? "";
  for (const part of accept.split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase() ?? "";
    const base = tag.split("-")[0] ?? "";
    if (isAppLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/** Pārlūka navigācija (vecā saite citā ierīcē) vs JSON klients. */
export function invoiceDownloadWantsHtml(accept: string | null | undefined): boolean {
  const a = accept?.toLowerCase() ?? "";
  if (!a || a === "*/*") return true;
  const html = a.includes("text/html");
  const json = a.includes("application/json");
  if (html) return true;
  if (json) return false;
  return false;
}

export function invoiceUnauthorizedCopy(locale: AppLocale): { title: string; body: string; home: string } {
  return COPY[locale];
}

export function buildInvoiceUnauthorizedHtml(locale: AppLocale): string {
  const copy = invoiceUnauthorizedCopy(locale);
  const title = escapeHtml(copy.title);
  const body = escapeHtml(copy.body);
  const home = escapeHtml(copy.home);
  const homeHref = locale === DEFAULT_LOCALE ? "/lv" : `/${locale}`;
  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="robots" content="noindex, nofollow"/>
  <title>${title}</title>
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#07080a;color:#f4f4f5;font-family:ui-sans-serif,system-ui,sans-serif;}
    main{max-width:36rem;padding:2rem 1.25rem;text-align:center;}
    h1{margin:0 0 1rem;font-size:1.65rem;font-weight:600;letter-spacing:-0.02em;}
    p{margin:0 0 1.75rem;font-size:1.05rem;line-height:1.55;color:rgba(244,244,245,.72);}
    a{display:inline-flex;min-height:44px;align-items:center;justify-content:center;padding:0 1.4rem;border-radius:999px;background:#0066ff;color:#fff;text-decoration:none;font-weight:500;}
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${body}</p>
    <a href="${homeHref}">${home}</a>
  </main>
</body>
</html>`;
}
