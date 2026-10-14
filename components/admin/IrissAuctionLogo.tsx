"use client";

import { useState } from "react";
import {
  IRISS_AUCTION_LOGO_LABEL,
  irissAuctionLogoSrc,
  type IrissAuctionLogoKey,
} from "@/lib/iriss-auction-logos";

export function IrissAuctionLogo({
  platform,
  fallback,
  className = "h-4 w-[36px]",
}: {
  platform: IrissAuctionLogoKey;
  fallback?: string;
  className?: string;
}) {
  const src = irissAuctionLogoSrc(platform);
  const label = IRISS_AUCTION_LOGO_LABEL[platform];
  const text = fallback || label;
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return <span className="text-[10px] font-semibold leading-none tracking-tight">{text}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={label}
      title={label}
      width={36}
      height={20}
      decoding="async"
      className={className}
      onError={() => setBroken(true)}
    />
  );
}
