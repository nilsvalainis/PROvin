"use client";

import { useState, type ReactNode } from "react";
import { listingAppUrl, listingCopyId, resolveListingDetailUrl } from "@/lib/iriss-listings-detail-url";
import type { IrissMobilePlatform } from "@/lib/iriss-listings-mobile-platform";
import type { IrissListingVehicle } from "@/lib/iriss-listings-types";

export function IrissListingSourceOpen({
  v,
  mobile,
  className,
  title,
  children,
}: {
  v: Pick<IrissListingVehicle, "platform" | "detailUrl" | "stockNumber" | "auctionId" | "externalId">;
  mobile: IrissMobilePlatform | null;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  const web = resolveListingDetailUrl(v);
  const app = listingAppUrl(v, mobile);
  const href = mobile && app ? app : web;
  if (!href) return <span className={className}>{children}</span>;
  const useApp = Boolean(mobile && app);
  return (
    <a
      href={href}
      title={title}
      className={className}
      {...(useApp ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </a>
  );
}

export function IrissListingSourceExtras({
  v,
  mobile,
}: {
  v: Pick<IrissListingVehicle, "platform" | "detailUrl" | "stockNumber" | "auctionId" | "externalId">;
  mobile: IrissMobilePlatform | null;
}) {
  const [copied, setCopied] = useState(false);
  if (!mobile) return null;
  const web = resolveListingDetailUrl(v);
  const copyId = listingCopyId(v);
  return (
    <span className="inline-flex items-center gap-1">
      {v.platform === "openline" && web ? (
        <a
          href={web}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-slate-600"
          onClick={(e) => e.stopPropagation()}
        >
          Web
        </a>
      ) : null}
      {copyId ? (
        <button
          type="button"
          className="inline-flex items-center rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-slate-600"
          onClick={(e) => {
            e.stopPropagation();
            void navigator.clipboard?.writeText(copyId).then(
              () => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1400);
              },
              () => undefined,
            );
          }}
        >
          {copied ? "Nokopēts" : "Kopēt ID"}
        </button>
      ) : null}
    </span>
  );
}
