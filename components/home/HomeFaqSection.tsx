import { getMessages, getTranslations } from "next-intl/server";
import { FaqClient, type FaqItem } from "@/components/FaqClient";
import { Link } from "@/i18n/navigation";

const HOME_FAQ_LIMIT = 4;

/** Kompakts BUJ — tikai top jautājumi; pārējie uz `/biezi-jautajumi`. */
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
      className="home-body-ink relative bg-transparent px-4 py-10 sm:py-12"
      aria-labelledby="home-faq-heading"
    >
      <div className="mx-auto w-full max-w-[min(36rem,calc(100vw-2rem))]">
        <header className="mb-5 flex items-end justify-between gap-4 border-b border-white/[0.08] pb-3">
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

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      </div>
    </section>
  );
}
