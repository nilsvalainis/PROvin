import { getTranslations } from "next-intl/server";
import { HomeGoogleReviewsFeatured } from "@/components/home/HomeGoogleReviewsFeatured";
import {
  GOOGLE_REVIEWS_AGGREGATE_RATING,
  getGoogleReviewsProfileUrl,
} from "@/lib/google-reviews-data";

/** Sociālais pierādījums — editorial citāts, ne kartīšu siena. */
export async function HomeGoogleReviews() {
  const t = await getTranslations("GoogleReviews");
  const profileUrl = getGoogleReviewsProfileUrl();

  return (
    <section
      id="atsauksmes"
      className="home-body-ink relative bg-transparent px-4 py-12 sm:py-14"
      aria-labelledby="home-google-reviews-heading"
    >
      <div className="mx-auto w-full max-w-[min(100%,80rem)]">
        <h2 id="home-google-reviews-heading" className="sr-only">
          {t("title")}
        </h2>
        <HomeGoogleReviewsFeatured
          profileUrl={profileUrl}
          ratingLabel={t("ratingLine", { rating: GOOGLE_REVIEWS_AGGREGATE_RATING })}
        />
      </div>
    </section>
  );
}
