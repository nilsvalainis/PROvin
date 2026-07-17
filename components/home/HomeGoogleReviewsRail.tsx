import {
  GOOGLE_REVIEWS,
  type GoogleReviewEntry,
} from "@/lib/google-reviews-data";

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

function ReviewCard({
  review,
  profileUrl,
  duplicate = false,
}: {
  review: GoogleReviewEntry;
  profileUrl: string;
  duplicate?: boolean;
}) {
  const preview = reviewPreviewText(review.text);
  return (
    <a
      href={profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="provin-google-review-card"
      title={preview}
      aria-label={`${review.author}: ${preview}`}
      aria-hidden={duplicate || undefined}
      tabIndex={duplicate ? -1 : undefined}
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

/** Horizontāla rinda ar lēnu auto-slīdēšanu (pauze uz hover). */
export function HomeGoogleReviewsRail({ profileUrl }: { profileUrl: string }) {
  return (
    <div className="provin-google-reviews-rail-shell mt-6 sm:mt-8">
      <div className="provin-google-reviews-marquee">
        <div className="provin-google-reviews-track">
          {GOOGLE_REVIEWS.map((review) => (
            <ReviewCard key={review.id} review={review} profileUrl={profileUrl} />
          ))}
          {GOOGLE_REVIEWS.map((review) => (
            <ReviewCard
              key={`dup-${review.id}`}
              review={review}
              profileUrl={profileUrl}
              duplicate
            />
          ))}
        </div>
      </div>
    </div>
  );
}
