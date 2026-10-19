"use client";

import { useState } from "react";
import { IrissListingCardPhotoGallery } from "@/components/admin/IrissListingCardPhotoGallery";
import { useAdminClientReady, useAdminMobileViewport } from "@/components/admin/useAdminMobileViewport";
import { IrissListingCardPriceColumn, IrissListingCardPriceColumnMobile } from "@/components/admin/IrissListingCardPriceColumn";
import { IrissListingCardSpecGrid } from "@/components/admin/IrissListingCardSpecGrid";
import { useListingVinOcr, type ListingVinOcrPatch } from "@/hooks/useListingVinOcr";
import { IrissAuctionLogo } from "@/components/admin/IrissAuctionLogo";
import { IrissListingOrderChips } from "@/components/admin/IrissListingOrderChips";
import { IrissListingSourceExtras, IrissListingSourceOpen } from "@/components/admin/IrissListingSourceOpen";
import { listingAuctionTypeLabel, isRealListingPriceChange } from "@/lib/iriss-listings-auto1-cents";
import {
  listingCardGallery,
  listingCountdown,
  listingDaysInAuctionLabel,
  listingSpecCells,
  listingStockNo,
  listingSubtitleParts,
  listingVinCardState,
  listingVinShort,
} from "@/lib/iriss-listings-card";
import { listingBidPrice, listingCardPriceLabel, listingExtrasI, listingFinalPrice, listingMaxBid, listingRealCost } from "@/lib/iriss-listings-cost";
import { countryFlagLabel } from "@/lib/iriss-listings-country-flag";
import { classifyListingDamage } from "@/lib/iriss-listings-damage";
import { resolveListingDetailUrl } from "@/lib/iriss-listings-detail-url";
import type { IrissMobilePlatform } from "@/lib/iriss-listings-mobile-platform";
import type { IrissListingOrderBrief } from "@/lib/iriss-listings-orders";
import { listingCostsFor, type IrissListPrefs } from "@/lib/iriss-listings-operator-prefs";
import { listingTaxCostArgs, listingTaxResolved } from "@/lib/iriss-listings-vat";
import type { IrissListingPlatform, IrissListingVehicle } from "@/lib/iriss-listings-types";
import type { IrissVinDuplicateLink } from "@/lib/iriss-vin-duplicates";
import { IrissVinDuplicateMark } from "@/components/admin/IrissVinDuplicateMark";

const PLATFORM_LABEL: Record<IrissListingPlatform, string> = {
  autobid: "AUTOBID",
  openline: "OPENLANE",
  auto1: "AUTO1",
  ecarstrade: "ECARSTRADE",
  mobilede: "MOBILE.DE",
  autoscout24: "AUTOSCOUT24",
};

const RECENT_WINDOW_HOURS = 36;

function hoursSince(iso: string, nowMs: number): number {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return (nowMs - t) / 36e5;
}

function isNew(v: IrissListingVehicle, nowMs: number | null): boolean {
  if (nowMs == null) return false;
  return v.change !== "gone" && hoursSince(v.firstSeenAt, nowMs) <= RECENT_WINDOW_HOURS;
}

function recentPriceChanges(v: IrissListingVehicle, nowMs: number | null): IrissListingVehicle["priceHistory"] {
  if (nowMs == null) return [];
  return v.priceHistory.filter((c) => isRealListingPriceChange(c) && hoursSince(c.at, nowMs) <= RECENT_WINDOW_HOURS);
}

function CountryFlag({ code }: { code: string }) {
  const f = countryFlagLabel(code);
  if (!f) return null;
  return (
    <span title={f.title} aria-label={f.title} className="text-[14px] leading-none">
      {f.flag}
    </span>
  );
}

export function IrissListingVehicleCard({
  v,
  nowMs,
  prefs,
  onPrefs,
  linked,
  budget,
  onOpen,
  onPreviewOrder,
  mobile,
  imageHidden,
  onImageError,
  onVinPatch,
  onCreateOrder,
  onCreateOffer,
  matchNew = false,
  duplicates = [],
}: {
  v: IrissListingVehicle;
  nowMs: number | null;
  prefs: IrissListPrefs;
  onPrefs: (next: IrissListPrefs) => void;
  linked: IrissListingOrderBrief[];
  budget: number | null;
  onOpen: () => void;
  onPreviewOrder: (order: IrissListingOrderBrief) => void;
  mobile: IrissMobilePlatform | null;
  imageHidden: boolean;
  onImageError: () => void;
  onVinPatch?: (id: string, patch: ListingVinOcrPatch) => void;
  onCreateOrder?: (v: IrissListingVehicle) => void | Promise<void>;
  onCreateOffer?: (v: IrissListingVehicle) => void | Promise<void>;
  matchNew?: boolean;
  duplicates?: readonly IrissVinDuplicateLink[];
}) {
  const [vinCopied, setVinCopied] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [offerBusy, setOfferBusy] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const phone = useAdminMobileViewport();
  const clientReady = useAdminClientReady();
  useListingVinOcr(v, (id, patch) => onVinPatch?.(id, patch), { enabled: clientReady && !phone });
  const gallery = listingCardGallery(v);
  const photos = imageHidden ? [] : gallery.photos;
  const interactive = gallery.interactive && photos.length > 1;
  const fresh = isNew(v, nowMs);
  const changes = recentPriceChanges(v, nowMs);
  const gone = v.change === "gone";
  const tax = listingTaxResolved(v, prefs.taxOv[v.id]);
  const extras = listingExtrasI(listingCostsFor(prefs, v.id));
  const bid = listingBidPrice(v);
  const priceLabel = listingCardPriceLabel(v);
  const taxArgs = listingTaxCostArgs(tax);
  const real = bid == null ? null : listingRealCost(taxArgs.kind, taxArgs.foreignVatPct, bid, extras);
  const gala = bid == null ? null : listingFinalPrice(tax, bid, extras);
  const mb = budget != null ? listingMaxBid(taxArgs.kind, taxArgs.foreignVatPct, budget, extras) : null;
  const room = mb != null && bid != null ? mb - bid : null;
  const dmg = classifyListingDamage(v.damageRaw);
  const fav = prefs.fav.includes(v.id);
  const hidden = prefs.hidden.includes(v.id);
  const auctionTypeLabel = listingAuctionTypeLabel(v.auctionType);
  const cd = listingCountdown(v.auctionEndAt, nowMs);
  const sourceHref = resolveListingDetailUrl(v);
  const specs = listingSpecCells(v);
  const subtitle = listingSubtitleParts(v);
  const stock = listingStockNo(v);
  const vinUi = listingVinCardState(v);
  const vin = vinUi?.vin ?? "";
  const days = listingDaysInAuctionLabel(v.auctionStartAt || v.firstSeenAt, nowMs);
  const referrerPolicy: "no-referrer" | undefined =
    v.platform === "openline" || /images\.openlane\.eu/i.test(photos[0] ?? "") ? "no-referrer" : undefined;
  const border = gone
    ? "border-[#E5E7EB] opacity-70"
    : fav
      ? "border-amber-200"
      : fresh
        ? "border-emerald-200"
        : changes.length > 0
          ? "border-sky-200"
          : "border-[#E5E7EB]";
  const city = v.location.replace(/,\s*[A-Z]{2}$/i, "").trim();

  function toggle(list: "fav" | "hidden") {
    const cur = prefs[list];
    const next = cur.includes(v.id) ? cur.filter((x) => x !== v.id) : [...cur, v.id];
    onPrefs({ ...prefs, [list]: next });
  }

  function copyVin() {
    if (!vin) return;
    void navigator.clipboard?.writeText(vin).then(
      () => {
        setVinCopied(true);
        window.setTimeout(() => setVinCopied(false), 1400);
      },
      () => undefined,
    );
  }

  const photoBlock = (
    <div className="w-full shrink-0 sm:w-[300px]" onClick={(e) => sourceHref && e.stopPropagation()}>
      <IrissListingCardPhotoGallery
        photos={photos}
        thumbUrl={v.thumbUrl}
        alt={v.title || "Auto foto"}
        interactive={interactive}
        referrerPolicy={referrerPolicy}
        onImageError={onImageError}
        compactMobile={phone}
        wrapHero={(inner) =>
          sourceHref ? (
            <IrissListingSourceOpen v={v} mobile={mobile} title={`Atvērt ${PLATFORM_LABEL[v.platform]}`} className="block h-full w-full">
              {inner}
            </IrissListingSourceOpen>
          ) : (
            inner
          )
        }
      />
    </div>
  );

  const favHide = (
    <div className="flex gap-1.5">
      <button
        type="button"
        title={fav ? "Noņemt no favorītiem" : "Favorīts"}
        onClick={() => toggle("fav")}
        className={`grid h-11 w-11 place-items-center rounded-lg border sm:h-9 sm:w-9 ${fav ? "border-amber-300 bg-amber-50 text-amber-500" : "border-[#E5E7EB] bg-white"}`}
      >
        {fav ? "★" : "☆"}
      </button>
      <button
        type="button"
        title={hidden ? "Rādīt atkal" : "Nav interesanti"}
        onClick={() => toggle("hidden")}
        className="grid h-11 w-11 place-items-center rounded-lg border border-[#E5E7EB] bg-white sm:h-9 sm:w-9"
      >
        {hidden ? "↺" : "✕"}
      </button>
    </div>
  );

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-white shadow-sm [content-visibility:auto] [contain-intrinsic-size:1px_220px] touch-manipulation hover:border-slate-300 sm:flex-row sm:items-stretch sm:gap-4 sm:overflow-visible sm:rounded-2xl sm:p-3.5 sm:[content-visibility:visible] ${border} ${fav ? "shadow-[0_0_0_2px_#fde68a]" : ""} ${hidden ? "opacity-50" : ""}`}
    >
      {photoBlock}

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-2.5 sm:p-0">
        {(stock || vinUi) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold tabular-nums text-slate-500">
            {stock ? <span>Nr. {stock}</span> : null}
            {stock && vinUi ? <span aria-hidden>·</span> : null}
            {vinUi ? (
              <span
                className="inline-flex flex-wrap items-center gap-1.5"
                data-provin-handoff-vin={vinUi.handoff ? vinUi.vin : undefined}
              >
                <span>VIN {listingVinShort(vinUi.vin)}</span>
                <button
                  type="button"
                  className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyVin();
                  }}
                >
                  {vinCopied ? "Nokopēts" : "Kopēt"}
                </button>
                <a
                  href={vinUi.scanHref}
                  className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-provin-accent)] hover:bg-slate-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  VIN SCAN
                </a>
              </span>
            ) : null}
          </div>
        )}
        <div className="text-[17px] font-semibold leading-tight text-[var(--color-apple-text)]" title={v.title}>
          {v.title || v.orderBrandModels[0] || "-"}
        </div>
        {subtitle ? <div className="text-[12px] text-[var(--color-provin-muted)]">{subtitle}</div> : null}
        {v.priceCompareNote ? <div className="text-[12px] text-[var(--color-provin-muted)]">{v.priceCompareNote}</div> : null}
        <IrissListingCardSpecGrid specs={specs} />

        <div className="flex flex-wrap items-center gap-1">
          {sourceHref ? (
            <IrissListingSourceOpen
              v={v}
              mobile={mobile}
              title={`Atvērt ${PLATFORM_LABEL[v.platform]}`}
              className="inline-flex items-center gap-1.5 bg-transparent text-[10px] font-semibold text-[var(--color-apple-text)]"
            >
              <span className="hidden sm:inline-flex">
                <IrissAuctionLogo platform={v.platform} fallback={PLATFORM_LABEL[v.platform]} size="md" />
              </span>
              <span className="text-[12px] font-medium text-[var(--label-secondary)] sm:hidden">
                Avots: {PLATFORM_LABEL[v.platform]}
                {city ? ` · ${city}` : ""}
              </span>
              {city ? <span className="hidden sm:inline">{city}</span> : null}
              <span className="hidden sm:inline"><CountryFlag code={v.countryCode} /></span>
            </IrissListingSourceOpen>
          ) : (
            <span className="inline-flex items-center gap-1.5 bg-transparent text-[10px] font-semibold text-[var(--color-apple-text)]">
              <span className="hidden sm:inline-flex">
                <IrissAuctionLogo platform={v.platform} fallback={PLATFORM_LABEL[v.platform]} size="md" />
              </span>
              <span className="text-[12px] font-medium text-[var(--label-secondary)] sm:hidden">
                Avots: {PLATFORM_LABEL[v.platform]}
                {city ? ` · ${city}` : ""}
              </span>
              {city ? <span className="hidden sm:inline">{city}</span> : null}
              <span className="hidden sm:inline"><CountryFlag code={v.countryCode} /></span>
            </span>
          )}
          <IrissListingSourceExtras v={v} mobile={mobile} />
          {days ? (
            <span className="inline-flex rounded-full border border-[#E5E7EB] bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {days}
            </span>
          ) : null}
          {auctionTypeLabel ? (
            <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 sm:inline-flex">
              {auctionTypeLabel}
            </span>
          ) : null}
          {gone ? (
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              PAZUDIS
            </span>
          ) : null}
          {!gone && matchNew ? (
            <span className="inline-flex rounded-[7px] bg-[var(--fill-secondary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--label-secondary)] sm:rounded-full sm:border sm:border-sky-200 sm:bg-sky-50 sm:font-semibold sm:text-sky-900">
              Jauns
            </span>
          ) : !gone && fresh ? (
            <span className="inline-flex rounded-[7px] bg-[var(--fill-secondary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--label-secondary)] sm:rounded-full sm:border sm:border-emerald-200/80 sm:bg-emerald-50 sm:font-semibold sm:text-emerald-800">
              Jauns
            </span>
          ) : null}
          {!gone && duplicates.length > 0 ? <IrissVinDuplicateMark links={duplicates} /> : null}
          {dmg.cats.map((c, i) => (
            <span key={c.name} className={`rounded-md bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white sm:text-[10px] ${i >= 2 ? "hidden sm:inline" : ""}`}>
              {c.name}
            </span>
          ))}
          {dmg.cats.length > 2 ? (
            <span className="rounded-md bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white sm:hidden">+{dmg.cats.length - 2}</span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <IrissListingOrderChips orders={linked} onPreview={onPreviewOrder} />
          {onCreateOrder ? (
            <button
              type="button"
              disabled={createBusy}
              className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              onClick={(e) => {
                e.stopPropagation();
                setCreateBusy(true);
                void Promise.resolve(onCreateOrder(v)).finally(() => setCreateBusy(false));
              }}
            >
              {createBusy ? "Veido…" : "Izveidot pasūtījumu"}
            </button>
          ) : null}
          {onCreateOffer ? (
            <button
              type="button"
              disabled={offerBusy}
              className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              onClick={(e) => {
                e.stopPropagation();
                setOfferBusy(true);
                void Promise.resolve(onCreateOffer(v)).finally(() => setOfferBusy(false));
              }}
            >
              {offerBusy ? "Veido…" : "Piedāvājums"}
            </button>
          ) : null}
        </div>

        <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <IrissListingCardPriceColumnMobile
            priceLabel={priceLabel}
            bid={bid}
            bidCount={v.bidCount}
            tax={tax}
            countdown={cd}
            priceBuyNow={v.priceBuyNow}
            priceTotal={v.priceTotal}
            budget={budget}
            gala={gala}
            real={real}
            maxBid={mb}
            room={room}
            topActions={favHide}
          />
        </div>

        {phone && !noteOpen && !(prefs.notes[v.id] ?? "").trim() ? (
          <button
            type="button"
            className="mt-auto w-full rounded-md border border-dashed border-slate-200 bg-slate-50 px-2 py-1 text-left text-[12px] text-slate-500"
            onClick={(e) => {
              e.stopPropagation();
              setNoteOpen(true);
            }}
          >
            Piezīme
          </button>
        ) : (
          <input
            className={`mt-auto w-full rounded-md border border-dashed px-2 py-1 text-[12px] outline-none ${prefs.notes[v.id] ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}
            placeholder="Piezīme…"
            value={prefs.notes[v.id] ?? ""}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onPrefs({ ...prefs, notes: { ...prefs.notes, [v.id]: e.target.value } })}
          />
        )}
      </div>

      {phone ? null : (
      <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <IrissListingCardPriceColumn
          priceLabel={priceLabel}
          bid={bid}
          bidCount={v.bidCount}
          tax={tax}
          countdown={cd}
          priceBuyNow={v.priceBuyNow}
          priceTotal={v.priceTotal}
          budget={budget}
          gala={gala}
          real={real}
          maxBid={mb}
          room={room}
          topActions={favHide}
        />
      </div>
      )}
    </article>
  );
}
