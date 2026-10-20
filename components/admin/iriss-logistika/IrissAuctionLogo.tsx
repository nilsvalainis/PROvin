"use client";

import { logisticsAuctionLogo } from "@/lib/iriss-logistics-auction-logo";

export function IrissAuctionLogo({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  const logo = logisticsAuctionLogo(name);
  if (!name.trim()) return null;
  if (logo.src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo.src} alt={logo.alt} title={logo.label} className={`inline-block h-4 w-auto max-w-[4.5rem] object-contain object-left ${className}`} />
    );
  }
  return (
    <span className={`inline-flex items-center rounded bg-[#eef2f6] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#334155] ${className}`}>
      {logo.label}
    </span>
  );
}
