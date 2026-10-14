"use client";

import { useState } from "react";
import {
  IRISS_AUCTION_LOGO_LABEL,
  irissAuctionLogoSrc,
  type IrissAuctionLogoKey,
} from "@/lib/iriss-auction-logos";

const SIZE_CLASS = {
  sm: "h-3.5 max-w-[72px]",
  md: "h-4 max-w-[88px]",
  lg: "h-5 max-w-[110px]",
} as const;

/** Autobid.de official mark is stacked; give it more height so it matches landscape wordmarks. */
const STACKED_SIZE_CLASS = {
  sm: "h-6 max-w-[44px]",
  md: "h-7 max-w-[52px]",
  lg: "h-8 max-w-[60px]",
} as const;

const STACKED_KEYS = new Set<IrissAuctionLogoKey>(["autobid"]);

export function IrissAuctionLogo({
  platform,
  fallback,
  size = "md",
  className,
}: {
  platform: IrissAuctionLogoKey;
  fallback?: string;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  const src = irissAuctionLogoSrc(platform);
  const label = IRISS_AUCTION_LOGO_LABEL[platform];
  const text = fallback || label;
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return <span className="text-[10px] font-semibold leading-none tracking-tight">{text}</span>;
  }
  const fit = STACKED_KEYS.has(platform) ? STACKED_SIZE_CLASS[size] : SIZE_CLASS[size];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={label}
      title={label}
      height={16}
      decoding="async"
      className={`${className ?? fit} w-auto object-contain object-left drop-shadow-[0_0_0.65px_rgba(255,255,255,0.95)]`}
      onError={() => setBroken(true)}
    />
  );
}
