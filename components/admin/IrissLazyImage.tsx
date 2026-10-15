"use client";

import Image from "next/image";
import { listingImageHostnameAllowed } from "@/lib/iriss-listing-image";

/**
 * List/grid photo. Known auction hosts use next/image (unoptimized, so the browser
 * loads the thumb URL with `sizes`). Other URLs stay a lazy img.
 */
export function IrissLazyImage({
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
  onError?: () => void;
}) {
  if (!src) return null;
  if (!listingImageHostnameAllowed(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy={referrerPolicy}
        className="absolute inset-0 h-full w-full object-cover"
        onError={onError}
      />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      sizes={sizes}
      referrerPolicy={referrerPolicy}
      className="object-cover"
      onError={onError}
    />
  );
}
