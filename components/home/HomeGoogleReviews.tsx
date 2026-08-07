import { getTranslations } from "next-intl/server";
import { HomeGoogleReviewsFeatured } from "@/components/home/HomeGoogleReviewsFeatured";
import {
  GOOGLE_REVIEWS_AGGREGATE_RATING,
  getGoogleReviewsProfileUrl,
} from "@/lib/google-reviews-data";

/**
 * Sociālais pierādījums zem hero — tilts + tā pati 80rem / 7+5 asimetrija kā desktop hero.
 */
export async function HomeGoogleReviews() {
  const t = await getTranslations("GoogleReviews");
  const profileUrl = getGoogleReviewsProfileUrl();

  return (
    <section
      id="atsauksmes"
      className="home-body-ink relative bg-transparent"
      aria-labelledby="home-google-reviews-heading"
    >
      {/* Viegls tilts no hero */}
      <div
        className="pointer-events-none h-px w-full bg-gradient-to-r from-transparent via-white/[0.12] to-transparent"
        aria-hidden
      />

      <div
        className="mx-auto w-full max-w-[80rem] px-[max(1rem,env(safe-area-inset-left,0px))] py-10 pr-[max(1rem,env(safe-area-inset-right,0px))] sm:py-12 lg:gap-16 lg:px-8 lg:pb-14 lg:pt-12"
      >
        <h2 id="home-google-reviews-heading" className="sr-only">
          {t("title")}
        </h2>
        <HomeGoogleReviewsFeatured
          profileUrl={profileUrl}
          ratingLabel={t("ratingLine", { rating: GOOGLE_REVIEWS_AGGREGATE_RATING })}
          readFullLabel={t("readFull")}
          closeLabel={t("close")}
        />
      </div>
    </section>
  );
}
