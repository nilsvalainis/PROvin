"use client";

import { Star, X } from "lucide-react";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { IrissAuctionLogo } from "@/components/admin/IrissAuctionLogo";
import { IrissListingCardPhotoGallery } from "@/components/admin/IrissListingCardPhotoGallery";
import { IrissListingCardPriceColumn, IrissListingCardPriceColumnMobile } from "@/components/admin/IrissListingCardPriceColumn";
import { IrissListingCardSpecGrid } from "@/components/admin/IrissListingCardSpecGrid";
import {
  listingCountdown,
  listingDaysInAuctionLabel,
  listingSpecCells,
  listingSubtitleParts,
} from "@/lib/iriss-listings-card";
import { countryFlagLabel } from "@/lib/iriss-listings-country-flag";
import { IRISS_LISTING_PLATFORM_LABEL } from "@/lib/iriss-listings-platform";
import {
  irissListBrowserStorage,
  migrateIrissListPrefs,
  parseIrissListPrefs,
  type IrissListPrefs,
} from "@/lib/iriss-listings-operator-prefs";
import { IrissPriceChangeChip, IrissPriceHistoryPanel } from "@/components/admin/IrissPriceChangeChip";
import { irissPriceHistoryRows, latestIrissPriceChip } from "@/lib/iriss-listing-price-chips";
import { orderRoomHitGallery, orderRoomHitPricing, orderRoomHitStockNo } from "@/lib/iriss-order-room-hit-pricing";
import type { IrissOrderRoomHit } from "@/lib/iriss-order-room";

const PLATFORM_LABEL: Record<string, string> = {
  autobid: "AUTOBID",
  openline: "OPENLANE",
  auto1: "AUTO1",
  ecarstrade: "ECARSTRADE",
  mobilede: "MOBILE.DE",
  autoscout24: "AUTOSCOUT24",
};

function CountryFlag({ code }: { code: string }) {
  const f = countryFlagLabel(code);
  if (!f) return null;
  return (
    <span title={f.title} aria-label={f.title} className="text-[14px] leading-none">
      {f.flag}
    </span>
  );
}

const HIT_CARD_NAV_IGNORE = "a,button,input,textarea,select,[role='menu'],[data-iriss-no-card-nav]";

export function IrissOrderRoomHitCard({
  hit,
  budget,
  isFav,
  dismissed,
  auctionUrl,
  onToggleFav,
  onDismiss,
  onRestore,
  matchSection,
  actions,
}: {
  hit: IrissOrderRoomHit;
  budget: number | null;
  isFav: boolean;
  dismissed: boolean;
  auctionUrl?: string;
  onToggleFav: () => void;
  onDismiss: () => void;
  onRestore: () => void;
  matchSection: ReactNode;
  actions: ReactNode;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [prefs, setPrefs] = useState<IrissListPrefs>(() => {
    const storage = irissListBrowserStorage();
    return storage ? migrateIrissListPrefs(storage) : parseIrissListPrefs(null);
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const storage = irissListBrowserStorage();
    if (!storage) return;
    setPrefs(migrateIrissListPrefs(storage));
  }, []);

  const gallery = orderRoomHitGallery(hit);
  const photos = gallery.photos;
  const interactive = gallery.interactive && photos.length > 1;
  const stock = orderRoomHitStockNo(hit);
  const specs = listingSpecCells({
    firstRegistration: hit.firstRegistration || hit.year,
    mileageKm: hit.mileageKm,
    fuel: typeof hit.fuel === "string" ? hit.fuel : "",
    transmission: typeof hit.transmission === "string" ? hit.transmission : "",
    powerKw: typeof hit.powerKw === "string" ? hit.powerKw : hit.powerKw != null ? String(hit.powerKw) : "",
  });
  const subtitle = listingSubtitleParts({ bodyType: hit.bodyType });
  const pricing = orderRoomHitPricing(hit, prefs, budget);
  const cd = listingCountdown(hit.auctionEndAt, nowMs);
  const days = listingDaysInAuctionLabel(hit.auctionStartAt || hit.firstSeenAt, nowMs);
  const priceChip = latestIrissPriceChip(hit.priceHistory);
  const priceRows = irissPriceHistoryRows(hit.priceHistory);
  const city = hit.location.replace(/,\s*[A-Z]{2}$/i, "").trim();
  const referrerPolicy: "no-referrer" | undefined =
    hit.platform === "openline" || /images\.openlane\.eu/i.test(photos[0] ?? "") ? "no-referrer" : undefined;

  function openAuction() {
    if (!auctionUrl) return;
    window.open(auctionUrl, "_blank", "noopener");
  }

  function onCardClick(e: MouseEvent<HTMLElement>) {
    const t = e.target;
    if (!(t instanceof Element) || t.closest(HIT_CARD_NAV_IGNORE)) return;
    openAuction();
  }

  const favHide = (
    <div className="flex gap-1.5" data-iriss-no-card-nav onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        title={isFav ? "Noņemt no saglabātajiem" : "Saglabāt"}
        aria-pressed={isFav}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFav();
        }}
        className={`grid h-11 w-11 place-items-center rounded-lg border sm:h-9 sm:w-9 ${isFav ? "border-amber-300 bg-amber-50 text-amber-500" : "border-[var(--iriss-line)] bg-white"}`}
      >
        <Star className={`h-4 w-4 ${isFav ? "fill-amber-400 text-amber-500" : "text-slate-500"}`} aria-hidden />
      </button>
      <button
        type="button"
        title={dismissed ? "Rādīt atkal" : "Nav interesanti"}
        onClick={(e) => {
          e.stopPropagation();
          if (dismissed) onRestore();
          else onDismiss();
        }}
        className="grid h-11 w-11 place-items-center rounded-lg border border-[var(--iriss-line)] bg-white sm:h-9 sm:w-9"
      >
        <X className="h-4 w-4 text-slate-500" aria-hidden />
      </button>
    </div>
  );

  const priceProps = {
    priceLabel: pricing.priceLabel,
    bid: pricing.bid,
    bidCount: hit.bidCount,
    tax: pricing.tax,
    countdown: cd,
    priceBuyNow: hit.priceBuyNow,
    priceTotal: hit.priceTotal,
    budget,
    gala: pricing.gala,
    real: pricing.real,
    maxBid: pricing.mb,
    room: pricing.room,
    topActions: favHide,
  };

  return (
    <article
      className={`flex min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--iriss-line)] bg-white sm:flex-row sm:items-stretch sm:gap-4 sm:rounded-2xl sm:p-3.5${auctionUrl ? " cursor-pointer" : ""}`}
      data-iriss-hit-card
      role={auctionUrl ? "link" : undefined}
      tabIndex={auctionUrl ? 0 : undefined}
      onClick={auctionUrl ? onCardClick : undefined}
      onKeyDown={
        auctionUrl
          ? (e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              if (e.target instanceof Element && e.target.closest(HIT_CARD_NAV_IGNORE)) return;
              e.preventDefault();
              openAuction();
            }
          : undefined
      }
    >
      <IrissListingCardPhotoGallery
        photos={photos}
        thumbUrl={hit.thumbUrl}
        alt={hit.title || "Auto foto"}
        interactive={interactive}
        referrerPolicy={referrerPolicy}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-2.5 sm:p-0">
        {stock ? (
          <div className="text-[11px] font-semibold tabular-nums text-slate-500">
            <span>Nr. {stock}</span>
          </div>
        ) : null}
        <div className="text-[17px] font-semibold leading-tight text-[var(--color-apple-text)]" title={hit.title}>
          {auctionUrl ? (
            <a href={auctionUrl} target="_blank" rel="noopener" className="text-inherit no-underline" onClick={(e) => e.stopPropagation()}>
              {hit.title || "Sludinājums"}
            </a>
          ) : (
            hit.title || "Sludinājums"
          )}
        </div>
        {subtitle ? <div className="text-[12px] text-[var(--color-provin-muted)]">{subtitle}</div> : null}
        <IrissListingCardSpecGrid specs={specs} />
        <div className="flex flex-wrap items-center gap-1">
          <span className="inline-flex items-center gap-1.5 bg-transparent text-[10px] font-semibold text-[var(--color-apple-text)]">
            <IrissAuctionLogo platform={hit.platform} fallback={PLATFORM_LABEL[hit.platform] ?? IRISS_LISTING_PLATFORM_LABEL[hit.platform]} size="md" />
            {city ? <span>{city}</span> : null}
            <CountryFlag code={hit.countryCode} />
          </span>
          {days ? (
            <span className="inline-flex rounded-full border border-[var(--iriss-line)] bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {days}
            </span>
          ) : null}
          {priceChip ? <IrissPriceChangeChip chip={priceChip} /> : null}
        </div>
        <IrissPriceHistoryPanel rows={priceRows} />
        <div data-iriss-no-card-nav onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          {matchSection}
        </div>
        <div data-iriss-no-card-nav onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <IrissListingCardPriceColumnMobile {...priceProps} />
        </div>
        <div data-iriss-no-card-nav onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          {actions}
        </div>
      </div>

      <div data-iriss-no-card-nav onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <IrissListingCardPriceColumn {...priceProps} />
      </div>
    </article>
  );
}
