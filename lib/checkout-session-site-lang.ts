import type { ClientReportLang } from "@/lib/client-report-i18n";

/**
 * Vietnes valoda, kurā klients pasūtīja (Nils 26.11): mūsu checkout vienmēr nodod Stripe `locale` no lapas
 * URL (/lv /en /ru /de), tāpēc `session.locale` = lapas valoda. Ja tā nav mūsu valoda (piem. Stripe «auto» -
 * pārlūka valoda), to NEizmanto: tad valoda no `success_url` / `cancel_url` ceļa, citādi LV.
 */
export function checkoutSessionSiteLang(session: {
  locale?: string | null;
  success_url?: string | null;
  cancel_url?: string | null;
}): ClientReportLang {
  const loc = (session.locale ?? "").trim().toLowerCase();
  if (loc === "lv" || loc === "en" || loc === "ru" || loc === "de") return loc;
  for (const url of [session.success_url, session.cancel_url]) {
    const m = /^https?:\/\/[^/]+\/(lv|en|ru|de)(?:[/?#]|$)/i.exec((url ?? "").trim());
    if (m) return m[1]!.toLowerCase() as ClientReportLang;
  }
  return "lv";
}
