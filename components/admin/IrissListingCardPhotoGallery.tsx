"use client";

import { useRef, useState, type MouseEvent, type ReactNode, type TouchEvent } from "react";
import { IrissLazyImage } from "@/components/admin/IrissLazyImage";
import { listingDisplayImageUrl } from "@/lib/iriss-listing-image";
import { listingThumbOverflowLabel } from "@/lib/iriss-listings-card";
import { irissGalleryIndexAfterSwipe, irissHorizontalSwipeDirection } from "@/lib/iriss-touch-swipe";

function ListingPhoto({
  src,
  alt,
  sizes,
  referrerPolicy,
  onError,
}: {
  src: string;
  alt: string;
  sizes: string;
  referrerPolicy?: "no-referrer";
  onError: () => void;
}) {
  return (
    <span className="relative block h-full w-full">
      <IrissLazyImage src={src} alt={alt} sizes={sizes} referrerPolicy={referrerPolicy} onError={onError} />
    </span>
  );
}

export function IrissListingCardPhotoGallery({
  photos,
  thumbUrl,
  alt,
  interactive,
  referrerPolicy,
  onImageError,
  wrapHero,
  onHeroClick,
  compactMobile = false,
}: {
  photos: string[];
  thumbUrl?: string;
  alt: string;
  interactive: boolean;
  referrerPolicy?: "no-referrer";
  onImageError?: () => void;
  wrapHero?: (image: ReactNode) => ReactNode;
  onHeroClick?: () => void;
  /** Telefonā mazāks hero; desktop nemaina. */
  compactMobile?: boolean;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressPhotoClickRef = useRef(false);
  const idx = photos.length ? Math.min(photoIndex, photos.length - 1) : 0;
  const currentPhoto = photos[idx] ?? "";
  const heroSrc = listingDisplayImageUrl({
    url: currentPhoto,
    thumbUrl: idx === 0 ? thumbUrl : undefined,
    maxWidth: compactMobile ? 320 : 480,
  });
  const overflow = listingThumbOverflowLabel(photos.length);

  function step(delta: number) {
    if (!photos.length) return;
    setPhotoIndex((i) => (i + delta + photos.length) % photos.length);
  }

  function onPhotoTouchStart(e: TouchEvent<HTMLDivElement>) {
    const target = e.target;
    if (target instanceof Element && target.closest("button")) {
      swipeStartRef.current = null;
      return;
    }
    const touch = e.touches[0];
    if (!touch) return;
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function onPhotoTouchEnd(e: TouchEvent<HTMLDivElement>) {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || !interactive) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const direction = irissHorizontalSwipeDirection(touch.clientX - start.x, touch.clientY - start.y);
    if (!direction) return;
    suppressPhotoClickRef.current = true;
    setPhotoIndex((i) => irissGalleryIndexAfterSwipe(photos.length, i, direction));
  }

  function onPhotoClickCapture(e: MouseEvent<HTMLDivElement>) {
    if (!suppressPhotoClickRef.current) return;
    suppressPhotoClickRef.current = false;
    e.preventDefault();
    e.stopPropagation();
  }

  const heroInner = heroSrc ? (
    <ListingPhoto
      src={heroSrc}
      alt={alt}
      sizes="(max-width: 767px) 100vw, 300px"
      referrerPolicy={referrerPolicy}
      onError={() => onImageError?.()}
    />
  ) : (
    <div className="h-full w-full bg-slate-50" />
  );

  return (
    <div className="w-full shrink-0 space-y-1.5 sm:w-[300px]">
      <div
        className={`relative w-full overflow-hidden rounded-none border-0 sm:h-[200px] sm:rounded-lg sm:border sm:border-slate-200/90 ${compactMobile ? "h-[160px]" : "h-[220px]"}`}
        style={{ touchAction: "manipulation" }}
        onTouchStart={onPhotoTouchStart}
        onTouchEnd={onPhotoTouchEnd}
        onClickCapture={onPhotoClickCapture}
        onClick={onHeroClick}
        role={onHeroClick ? "button" : undefined}
        tabIndex={onHeroClick ? 0 : undefined}
      >
        {wrapHero ? wrapHero(heroInner) : heroInner}
        {photos.length > 0 ? (
          <span className="absolute left-1.5 top-1.5 hidden rounded-full bg-black/55 px-1.5 text-[10px] font-semibold text-white sm:inline-flex">
            📷 {photos.length}
          </span>
        ) : null}
        {interactive && photos.length > 1 ? (
          <div className="absolute inset-x-0 bottom-2 z-10 flex justify-center gap-1 sm:hidden">
            {photos.slice(0, 6).map((src, i) => (
              <span
                key={`${src}-${i}`}
                className={`h-1.5 w-1.5 rounded-full ${idx === i ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
        ) : null}
        {interactive ? (
          <>
            <button
              type="button"
              aria-label="Iepriekšējā bilde"
              className="absolute left-1.5 top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow sm:grid"
              onClick={(e) => {
                e.stopPropagation();
                step(-1);
              }}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Nākamā bilde"
              className="absolute right-1.5 top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow sm:grid"
              onClick={(e) => {
                e.stopPropagation();
                step(1);
              }}
            >
              ›
            </button>
          </>
        ) : null}
      </div>
      {interactive ? (
        <div className="hidden gap-1.5 sm:flex">
          {photos.slice(0, 4).map((src, i) => {
            const last = i === 3 && overflow;
            return (
              <button
                key={`${src}-${i}`}
                type="button"
                aria-label={last ? `${overflow} bildes` : `Bilde ${i + 1}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setPhotoIndex(i);
                }}
                className={`relative h-[46px] flex-1 overflow-hidden rounded-md border border-slate-200/90 ${idx === i && !last ? "ring-2 ring-[var(--color-provin-accent)]" : ""}`}
              >
                <ListingPhoto
                  src={listingDisplayImageUrl({ url: src, thumbUrl: i === 0 ? thumbUrl : undefined, maxWidth: 160 })}
                  alt=""
                  sizes="72px"
                  referrerPolicy={referrerPolicy}
                  onError={() => onImageError?.()}
                />
                {last ? (
                  <div className="absolute inset-0 grid place-items-center bg-black/45 text-[11px] font-bold text-white">{overflow}</div>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
