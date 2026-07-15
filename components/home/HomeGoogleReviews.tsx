import { getTranslations } from "next-intl/server";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import {
  GOOGLE_REVIEWS,
  GOOGLE_REVIEWS_AGGREGATE_RATING,
  getGoogleReviewsProfileUrl,
  type GoogleReviewEntry,
} from "@/lib/google-reviews-data";
import { homeEditorialSectionBodyLeadClass, homeEditorialSectionTitleClass } from "@/lib/home-layout";

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62Z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
      />
    </svg>
  );
}

function StarRow({ count = 5 }: { count?: number }) {
  return (
    <span className="provin-google-review-stars" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <svg key={i} viewBox="0 0 20 20" className="provin-google-review-star provin-google-review-star--sm">
          <path
            fill="currentColor"
            d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292Z"
          />
        </svg>
      ))}
    </span>
  );
}

function reviewPreviewText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function ReviewCard({ review, profileUrl }: { review: GoogleReviewEntry; profileUrl: string }) {
  const preview = reviewPreviewText(review.text);
  return (
    <a
      href={profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="provin-google-review-card"
      title={preview}
      aria-label={`${review.author}: ${preview}`}
    >
      <div className="provin-google-review-card__head">
        <p className="provin-google-review-card__author">{review.author}</p>
        <p className="provin-google-review-card__meta">
          <StarRow count={review.rating} />
          <span className="provin-google-review-card__date">{review.relativeDateLv}</span>
        </p>
      </div>
      <div className="provin-google-review-card__text-wrap">
        <p className="provin-google-review-card__text">{preview}</p>
      </div>
    </a>
  );
}

/** Kurētas Google atsauksmes — kompakts horizontālais rinda, vienāda kartīšu izmēra. */
export async function HomeGoogleReviews() {
  const t = await getTranslations("GoogleReviews");
  const profileUrl = getGoogleReviewsProfileUrl();

  return (
    <section
      id="atsauksmes"
      className="demo-design-dir__section home-body-ink bg-transparent py-10 sm:py-12"
      aria-labelledby="home-google-reviews-heading"
    >
      <div className="demo-design-dir__shell">
        <header className="text-center">
          <p className="demo-design-dir__kicker">{t("kicker")}</p>
          <h2 id="home-google-reviews-heading" className={homeEditorialSectionTitleClass}>
            {t("title")}
          </h2>
          <div className="mx-auto mt-3 w-full max-w-[min(100%,42rem)] px-1 sm:px-2">
            <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
          </div>
          <div
            className="provin-google-reviews-rating-badge mx-auto mt-3"
            aria-label={`${GOOGLE_REVIEWS_AGGREGATE_RATING} no 5 zvaigznēm`}
          >
            <StarRow count={GOOGLE_REVIEWS_AGGREGATE_RATING} />
            <span className="provin-google-reviews-rating-badge__source">
              <GoogleGlyph className="h-3.5 w-3.5" />
              {t("sourceLabel")}
            </span>
          </div>
          <p className={`${homeEditorialSectionBodyLeadClass} mt-2 sm:mt-3`}>{t("lead")}</p>
        </header>

        <div className="provin-google-reviews-rail-shell mt-6 sm:mt-7">
          <div className="provin-google-reviews-rail" role="list">
            {GOOGLE_REVIEWS.map((review) => (
              <ReviewCard key={review.id} review={review} profileUrl={profileUrl} />
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-center sm:mt-6">
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="provin-google-reviews-cta"
          >
            <GoogleGlyph className="h-3.5 w-3.5 shrink-0" />
            {t("viewAll")}
          </a>
        </div>
      </div>
    </section>
  );
}
