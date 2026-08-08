import { getMessages, getTranslations } from "next-intl/server";
import { FaqClient, type FaqItem } from "@/components/FaqClient";
import { HomeGoogleReviewsFeatured } from "@/components/home/HomeGoogleReviewsFeatured";
import { getGoogleReviewsProfileUrl } from "@/lib/google-reviews-data";

/**
 * Atsauksmes + pilns BUJ — tā pati asimetrija kā hero (7 / 5).
 * Google zvaigžņu vietā labajā pusē: visi biežāk uzdotie jautājumi.
 */
export async function HomeGoogleReviews() {
  const t = await getTranslations("GoogleReviews");
  const tFaq = await getTranslations("Faq");
  const messages = await getMessages();
  const profileUrl = getGoogleReviewsProfileUrl();

  const raw = (messages as { Faq?: { items?: FaqItem[] } }).Faq?.items;
  const allItems = Array.isArray(raw) ? raw : [];

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
      id="atsauksmes"
      className="home-body-ink relative bg-transparent"
      aria-labelledby="home-google-reviews-heading"
    >
      <div
        className="pointer-events-none h-px w-full bg-gradient-to-r from-transparent via-white/[0.12] to-transparent"
        aria-hidden
      />

      <div className="mx-auto w-full max-w-[80rem] px-[max(1rem,env(safe-area-inset-left,0px))] py-10 pr-[max(1rem,env(safe-area-inset-right,0px))] sm:py-12 lg:px-8 lg:pb-14 lg:pt-12">
        <h2 id="home-google-reviews-heading" className="sr-only">
          {t("title")}
        </h2>

        <div className="flex flex-col gap-10 lg:grid lg:grid-cols-12 lg:items-start lg:gap-16">
          <div className="min-w-0 text-center lg:col-span-7 lg:text-left">
            <HomeGoogleReviewsFeatured
              profileUrl={profileUrl}
              googleLabel={t("sourceLabel")}
              prevLabel={t("prev")}
              nextLabel={t("next")}
            />
          </div>

          <div
            id="biezi-jautajumi"
            className="min-w-0 scroll-mt-16 border-t border-white/[0.08] pt-8 lg:col-span-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"
            aria-labelledby="home-faq-heading"
          >
            <div className="w-full max-w-[27.5rem] lg:ml-auto">
              <header className="mb-4 border-b border-white/[0.08] pb-3">
                <h2
                  id="home-faq-heading"
                  className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45"
                >
                  {tFaq("homeEyebrow")}
                </h2>
              </header>
              <FaqClient title={tFaq("title")} items={allItems} tone="dark" embedded compact />
            </div>
          </div>
        </div>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      </div>
    </section>
  );
}
