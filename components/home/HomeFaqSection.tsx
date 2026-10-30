import { Minus, Plus } from "lucide-react";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import type { FaqItem } from "@/components/FaqClient";
import { JsonLd } from "@/components/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { contactMailtoHref, whatsappWebUrl } from "@/lib/contact";
import { faqPageHref } from "@/lib/paths";
import { buildFaqPageJsonLd } from "@/lib/seo-json-ld";

const GHOST_BTN =
  "inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/20 bg-white/[0.04] px-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/85 no-underline transition hover:border-white/35 hover:bg-white/[0.08] hover:text-white";

/** Sākumlapas BUJ (makets «Pilna lapa»): kreisajā pusē virsraksts un kontakti, labajā numurēti jautājumi. Bez klienta JS. */
export async function HomeFaqSection() {
  const t = await getTranslations("Faq");
  const tFooter = await getTranslations("Footer");
  const locale = await getLocale();
  const messages = await getMessages();
  const raw = (messages as { Faq?: { items?: FaqItem[] } }).Faq?.items;
  const items = Array.isArray(raw) ? raw : [];
  const faqJsonLd = items.length > 0 ? buildFaqPageJsonLd(locale, "", items) : null;

  return (
    <section id="biezi-jautajumi" aria-labelledby="home-faq-heading" className="home-body-ink scroll-mt-16 bg-transparent">
      <div className="mx-auto grid max-w-[80rem] gap-10 px-[max(1rem,env(safe-area-inset-left,0px))] py-14 pr-[max(1rem,env(safe-area-inset-right,0px))] sm:py-20 lg:grid-cols-12 lg:gap-10 lg:px-10 lg:py-24">
        <div className="flex flex-col gap-4 lg:col-span-4 lg:self-start">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{t("homeEyebrow")}</p>
          <h2 id="home-faq-heading" className="text-balance text-[1.75rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-zinc-50 sm:text-[2.25rem]">
            {t("homeTitle")}
          </h2>
          <p className="text-[15px] leading-relaxed text-zinc-400">{t("homeSub")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a href={whatsappWebUrl()} target="_blank" rel="noopener noreferrer" className={GHOST_BTN}>
              {tFooter("whatsapp")}
            </a>
            <a href={contactMailtoHref()} className={GHOST_BTN}>
              {t("homeEmail")}
            </a>
          </div>
          <Link href={faqPageHref()} className="mt-1 text-sm font-semibold text-[#5c9dff] no-underline transition hover:text-white">
            {t("homeAll")} →
          </Link>
        </div>

        <div className="flex flex-col gap-2.5 lg:col-span-8">
          {items.map((item, i) => (
            <details
              key={item.id}
              open={i === 0}
              className="group rounded-2xl border border-white/[0.08] bg-[#0b0c10] transition open:border-[#2563eb]/40 open:bg-[#2563eb]/[0.05]"
            >
              <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 sm:px-6 sm:py-5 [&::-webkit-details-marker]:hidden">
                <span className="w-6 shrink-0 font-mono text-[12px] text-zinc-500">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1 text-[15px] font-semibold leading-snug text-zinc-50 sm:text-base">{item.q}</span>
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 text-zinc-300 transition group-open:border-[#2563eb] group-open:bg-[#2563eb] group-open:text-white"
                >
                  <Plus className="h-4 w-4 group-open:hidden" strokeWidth={2} />
                  <Minus className="hidden h-4 w-4 group-open:block" strokeWidth={2} />
                </span>
              </summary>
              <p className="whitespace-pre-line px-5 pb-5 pl-[3.75rem] text-[14px] leading-relaxed text-zinc-300 sm:px-6 sm:pl-[4.25rem]">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
      {faqJsonLd ? <JsonLd data={faqJsonLd} /> : null}
    </section>
  );
}
