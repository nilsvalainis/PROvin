"use client";

import { useState } from "react";
import { useListingVinOcr, type ListingVinOcrPatch } from "@/hooks/useListingVinOcr";
import { IrissAuctionLogo } from "@/components/admin/IrissAuctionLogo";
import { IrissListingBudgetBox } from "@/components/admin/IrissListingBudgetBox";
import { IrissListingOrderChips } from "@/components/admin/IrissListingOrderChips";
import { IrissListingSourceExtras, IrissListingSourceOpen } from "@/components/admin/IrissListingSourceOpen";
import { IrissListTaxBadge } from "@/components/admin/IrissListTaxBadge";
import { listingAuctionTypeLabel, isRealListingPriceChange } from "@/lib/iriss-listings-auto1-cents";
import {
  listingCardGallery,
  listingCountdown,
  listingDaysInAuctionLabel,
  listingFmtEur,
  listingSpecCells,
  listingStockNo,
  listingSubtitleParts,
  listingThumbOverflowLabel,
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

const PLATFORM_LABEL: Record<IrissListingPlatform, string> = {
  autobid: "AUTOBID",
  openline: "OPENLANE",
  auto1: "AUTO1",
  ecarstrade: "ECARSTRADE",
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

function ListingPhoto({
  src,
  alt,
  className,
  referrerPolicy,
  onError,
}: {
  src: string;
  alt: string;
  className: string;
  referrerPolicy?: "no-referrer";
  onError: () => void;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy={referrerPolicy} className={className} onError={onError} />
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
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [vinCopied, setVinCopied] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  useListingVinOcr(v, (id, patch) => onVinPatch?.(id, patch));
  const gallery = listingCardGallery(v);
  const photos = imageHidden ? [] : gallery.photos;
  const interactive = gallery.interactive && photos.length > 1;
  const idx = photos.length ? Math.min(photoIndex, photos.length - 1) : 0;
  const currentPhoto = photos[idx] ?? "";
  const overflow = listingThumbOverflowLabel(photos.length);
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
    v.platform === "openline" || /images\.openlane\.eu/i.test(currentPhoto) ? "no-referrer" : undefined;
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

  function step(delta: number) {
    if (!photos.length) return;
    setPhotoIndex((i) => (i + delta + photos.length) % photos.length);
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
    <div className="w-full shrink-0 space-y-1.5 sm:w-[300px]" onClick={(e) => sourceHref && e.stopPropagation()}>
      <div className="relative h-[220px] w-full overflow-hidden rounded-none border-0 sm:h-[200px] sm:rounded-lg sm:border sm:border-slate-200/90">
        {currentPhoto ? (
          sourceHref ? (
            <IrissListingSourceOpen v={v} mobile={mobile} title={`Atvērt ${PLATFORM_LABEL[v.platform]}`}>
              <ListingPhoto
                src={currentPhoto}
                alt={v.title || "Auto foto"}
                referrerPolicy={referrerPolicy}
                className="h-full w-full bg-slate-100 object-cover"
                onError={onImageError}
              />
            </IrissListingSourceOpen>
          ) : (
            <ListingPhoto
              src={currentPhoto}
              alt={v.title || "Auto foto"}
              referrerPolicy={referrerPolicy}
              className="h-full w-full bg-slate-100 object-cover"
              onError={onImageError}
            />
          )
        ) : (
          <div className="h-full w-full bg-slate-50" />
        )}
        {photos.length > 0 ? (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-1.5 text-[10px] font-semibold text-white">
            📷 {photos.length}
          </span>
        ) : null}
        {interactive ? (
          <>
            <button
              type="button"
              aria-label="Iepriekšējā bilde"
              className="absolute left-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow"
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
              className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow"
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
                <ListingPhoto src={src} alt="" referrerPolicy={referrerPolicy} className="h-full w-full object-cover" onError={onImageError} />
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
        {specs.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 border-y-0 py-0 sm:grid-cols-6 sm:border-y sm:border-dashed sm:border-[#E5E7EB] sm:py-2">
            {specs.map((c) => (
              <div key={c.label}>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{c.label}</div>
                <div className="text-[13px] font-semibold tabular-nums text-[var(--color-apple-text)]">{c.value}</div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-1">
          {sourceHref ? (
            <IrissListingSourceOpen
              v={v}
              mobile={mobile}
              title={`Atvērt ${PLATFORM_LABEL[v.platform]}`}
              className="inline-flex items-center gap-1.5 bg-transparent text-[10px] font-semibold text-[var(--color-apple-text)]"
            >
              <IrissAuctionLogo platform={v.platform} fallback={PLATFORM_LABEL[v.platform]} size="md" />
              {city ? <span>{city}</span> : null}
              <CountryFlag code={v.countryCode} />
            </IrissListingSourceOpen>
          ) : (
            <span className="inline-flex items-center gap-1.5 bg-transparent text-[10px] font-semibold text-[var(--color-apple-text)]">
              <IrissAuctionLogo platform={v.platform} fallback={PLATFORM_LABEL[v.platform]} size="md" />
              {city ? <span>{city}</span> : null}
              <CountryFlag code={v.countryCode} />
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
          {!gone && fresh ? (
            <span className="inline-flex rounded-full border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
              JAUNS
            </span>
          ) : null}
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
        </div>

        <div className="sm:hidden">
          <div className="rounded-xl bg-[#f2f2f5] p-3">
            <div className="flex items-start justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {priceLabel}{v.bidCount != null ? ` · ${v.bidCount} solījumi` : ""}
              </div>
              <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                {favHide}
              </div>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-[26px] font-extrabold tabular-nums leading-none">{bid == null ? "-" : listingFmtEur(bid)}</span>
              <IrissListTaxBadge tax={tax} size="md" quiet />
            </div>
            {v.priceBuyNow != null && v.priceBuyNow !== bid ? (
              <div className="mt-0.5 text-[11px] text-slate-500">pirkt uzreiz {listingFmtEur(v.priceBuyNow)}</div>
            ) : null}
            {v.priceTotal != null && v.priceTotal !== bid ? (
              <div className="mt-0.5 text-[11px] text-slate-500">kopā {listingFmtEur(v.priceTotal)}</div>
            ) : null}
            {cd.t || cd.end ? (
              <div className={`mt-2 flex flex-wrap items-center gap-1.5 text-[12px] font-extrabold tabular-nums ${cd.k}`}>
                ⏱ {cd.t}
                {cd.end ? <span className="font-semibold text-slate-500">· {cd.end}</span> : null}
              </div>
            ) : null}
          </div>
          <IrissListingBudgetBox budget={budget} gala={gala} real={real} maxBid={mb} room={room} priceMissing={bid == null} priceLabel={priceLabel} />
        </div>

        <input
          className={`mt-auto w-full rounded-md border border-dashed px-2 py-1 text-[12px] outline-none ${prefs.notes[v.id] ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}
          placeholder="Piezīme…"
          value={prefs.notes[v.id] ?? ""}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onPrefs({ ...prefs, notes: { ...prefs.notes, [v.id]: e.target.value } })}
        />
      </div>

      <div className="hidden w-[260px] shrink-0 sm:block">
        <div className="rounded-xl bg-[#f2f2f5] p-3">
          <div className="flex items-start justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {priceLabel}{v.bidCount != null ? ` · ${v.bidCount} solījumi` : ""}
            </div>
            <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
              {favHide}
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-[26px] font-extrabold tabular-nums leading-none">{bid == null ? "-" : listingFmtEur(bid)}</span>
            <IrissListTaxBadge tax={tax} size="md" quiet />
          </div>
          {v.priceBuyNow != null && v.priceBuyNow !== bid ? (
            <div className="mt-0.5 text-[11px] text-slate-500">pirkt uzreiz {listingFmtEur(v.priceBuyNow)}</div>
          ) : null}
          {v.priceTotal != null && v.priceTotal !== bid ? (
            <div className="mt-0.5 text-[11px] text-slate-500">kopā {listingFmtEur(v.priceTotal)}</div>
          ) : null}
          {cd.t || cd.end ? (
            <div className={`mt-2 flex flex-wrap items-center gap-1.5 text-[12px] font-extrabold tabular-nums ${cd.k}`}>
              ⏱ {cd.t}
              {cd.end ? <span className="font-semibold text-slate-500">· {cd.end}</span> : null}
            </div>
          ) : null}
        </div>
        <IrissListingBudgetBox budget={budget} gala={gala} real={real} maxBid={mb} room={room} priceMissing={bid == null} priceLabel={priceLabel} />
      </div>
    </article>
  );
}
