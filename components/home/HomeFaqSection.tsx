import { getMessages, getTranslations } from "next-intl/server";
import { FaqClient, type FaqItem } from "@/components/FaqClient";
import { Link } from "@/i18n/navigation";

const HOME_FAQ_LIMIT = 4;

/**
 * Atsevišķs BUJ bloks (demo / test-pricing lapām).
 * Sākumlapa: BUJ ir iekšā `HomeGoogleReviews` labajā kolonnā.
 */
export async function HomeFaqSection() {
  const tFaq = await getTranslations("Faq");
  const messages = await getMessages();
  const raw = (messages as { Faq?: { items?: FaqItem[] } }).Faq?.items;
  const allItems = Array.isArray(raw) ? raw : [];
  const homeItems = allItems.slice(0, HOME_FAQ_LIMIT);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: allItems.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  return (
    <section
      id="biezi-jautajumi"
      className="home-body-ink relative bg-transparent"
      aria-labelledby="home-faq-heading"
    >
      <div
        className="pointer-events-none h-px w-full bg-gradient-to-r from-transparent via-white/[0.12] to-transparent"
        aria-hidden
      />

      <div className="mx-auto w-full max-w-[80rem] px-[max(1rem,env(safe-area-inset-left,0px))] py-8 pr-[max(1rem,env(safe-area-inset-right,0px))] sm:py-10 lg:px-8 lg:pb-12 lg:pt-10">
        <div className="mx-auto w-full max-w-[min(36rem,100%)] lg:mx-0 lg:max-w-[min(40rem,100%)]">
          <header className="mb-4 flex items-end justify-between gap-4 border-b border-white/[0.08] pb-3">
            <h2
              id="home-faq-heading"
              className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45"
            >
              {tFaq("homeEyebrow")}
            </h2>
            <Link
              href="/biezi-jautajumi"
              className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-provin-accent no-underline transition hover:text-white"
            >
              {tFaq("homeSeeAll")}
            </Link>
          </header>

          <FaqClient title={tFaq("title")} items={homeItems} tone="dark" embedded compact />
        </div>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      </div>
    </section>
  );
}
