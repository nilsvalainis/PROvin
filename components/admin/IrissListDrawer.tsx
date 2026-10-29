"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardList, Download, EyeOff, ExternalLink, FilePlus2, RotateCcw, Star, X } from "lucide-react";
import Link from "next/link";
import { useListingVinOcr, type ListingVinOcrPatch } from "@/hooks/useListingVinOcr";
import { useAdminScrollLock } from "@/lib/admin-scroll-lock";
import { IrissListingBudgetBox } from "@/components/admin/IrissListingBudgetBox";
import { IrissListingOrderChips } from "@/components/admin/IrissListingOrderChips";
import { IrissListingSourceExtras, IrissListingSourceOpen } from "@/components/admin/IrissListingSourceOpen";
import { classifyListingDamage, highlightListingDamage } from "@/lib/iriss-listings-damage";
import { IrissListTaxBadge } from "@/components/admin/IrissListTaxBadge";
import { listingAuctionTypeLabel, realListingPriceHistory } from "@/lib/iriss-listings-auto1-cents";
import { listingCountdown } from "@/lib/iriss-listings-card";
import { DEFAULT_LISTING_COSTS, listingBidPrice, listingCardPriceLabel, listingExtrasI, listingFinalPrice, listingMaxBid, listingRealCost, type ListingCostParts, type ListingTaxKind } from "@/lib/iriss-listings-cost";
import { resolveListingDetailUrl } from "@/lib/iriss-listings-detail-url";
import { formatListingPowerKwLabel } from "@/lib/engine-power-kw";
import { listingDisplayImageUrl } from "@/lib/iriss-listing-image";
import { listingYearLabel } from "@/lib/iriss-listings-list-view";
import type { IrissListingOrderBrief } from "@/lib/iriss-listings-orders";
import { isIrissPasutijumsWorkingStatus } from "@/lib/iriss-pasutijumi-types";
import type { IrissMobilePlatform } from "@/lib/iriss-listings-mobile-platform";
import { countryFlagLabel } from "@/lib/iriss-listings-country-flag";
import { listingCostsFor, type IrissListPrefs, type ListingTaxOverride } from "@/lib/iriss-listings-operator-prefs";
import { listingTaxCostArgs, listingTaxFlagReason, listingTaxLabel, listingTaxResolved, taxFromVehicle } from "@/lib/iriss-listings-vat";
import type { IrissListingVehicle } from "@/lib/iriss-listings-types";
import { IRISS_LISTING_PLATFORM_LABEL } from "@/lib/iriss-listings-platform";
import { formatIrissEurCents, formatIrissEurWhole } from "@/lib/iriss-price-format";
import { IRISS_PD_STATUS_LV, irissPdNumberLabel, type IrissPdListRow } from "@/lib/iriss-piedavajumi-types";

function eur(n: number | null | undefined): string {
  return formatIrissEurWhole(n);
}
function dt(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleString("lv-LV", { timeZone: "Europe/Riga" }) : "-";
}
function eur2(n: number): string {
  return formatIrissEurCents(n);
}

const card = "rounded-[18px] bg-[var(--iriss-surface)] p-4 shadow-[0_0_0_.5px_rgba(0,0,0,.08),0_1px_3px_rgba(22,23,26,.05)]";
const h3 = "mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--iriss-ink-2)]";
const field = "h-10 w-full rounded-[12px] bg-[var(--iriss-surface)] px-3 text-[14px] text-[var(--iriss-ink)] shadow-[inset_0_0_0_1px_var(--iriss-line-strong)] outline-none";
const btn2 = "inline-flex h-10 items-center justify-center gap-1.5 rounded-[12px] bg-[var(--iriss-surface)] px-3.5 text-[13px] font-semibold text-[var(--iriss-ink)] shadow-[inset_0_0_0_1px_var(--iriss-line-strong)] disabled:opacity-45";
const btn1 = "inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[var(--iriss-graphite)] px-4 text-[13px] font-semibold text-[var(--iriss-on-graphite)] disabled:opacity-60";
const iconBtn = "grid h-10 w-10 place-items-center rounded-full bg-[var(--iriss-surface)] text-[var(--iriss-ink)] shadow-[inset_0_0_0_1px_var(--iriss-line-strong)] disabled:opacity-35";

/**
 * Sludinājuma logs (Nils 29.10 «pop up loga princips nepatīk» - pārbūvēts pēc pārējo sadaļu prakses):
 * - lielas bildes ar sīktēliem; cena, termiņš un budžets uzreiz redzami;
 * - darbības vienmēr apakšā: Izveidot piedāvājumu (Piedāvājumu sadaļā), Pasūtījuma detaļas, Atvērt avotā;
 * - ‹ › (arī ← →) pāriet uz iepriekšējo / nākamo sarakstā, neaizverot logu; pārlūka «Atpakaļ» aizver;
 * - piezīme un favorīts serverī (kopīgi visām ierīcēm); jau izveidotie piedāvājumi šim auto redzami.
 */
export function IrissListDrawer({
  v,
  prefs,
  orders,
  linked,
  budget,
  onClose,
  onPrefs,
  onPreviewOrder,
  mobile,
  onVinPatch,
  onPrev,
  onNext,
  position,
  onCreateOffer,
  offers = [],
  nowMs = null,
}: {
  v: IrissListingVehicle;
  prefs: IrissListPrefs;
  orders: readonly IrissListingOrderBrief[];
  linked: readonly IrissListingOrderBrief[];
  budget: number | null;
  onClose: () => void;
  onPrefs: (next: IrissListPrefs) => void;
  onPreviewOrder?: (order: IrissListingOrderBrief) => void;
  mobile?: IrissMobilePlatform | null;
  onVinPatch?: (id: string, patch: ListingVinOcrPatch) => void;
  onPrev?: () => void;
  onNext?: () => void;
  position?: { index: number; total: number } | null;
  onCreateOffer?: (v: IrissListingVehicle) => Promise<void> | void;
  offers?: readonly IrissPdListRow[];
  nowMs?: number | null;
}) {
  useAdminScrollLock(true);
  useListingVinOcr(v, (id, patch) => onVinPatch?.(id, patch));
  const detected = taxFromVehicle(v);
  const ov = prefs.taxOv[v.id];
  const tax = listingTaxResolved(v, ov);
  const costs = listingCostsFor(prefs, v.id);
  const extras = listingExtrasI(costs);
  const bid0 = listingBidPrice(v);
  const [bid, setBid] = useState(bid0 ?? 0);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [offerBusy, setOfferBusy] = useState(false);
  const [zipMsg, setZipMsg] = useState("");
  const [lvMsg, setLvMsg] = useState("");
  const dmg = classifyListingDamage(v.damageRaw);
  const lv = prefs.damageLv[v.id] ?? "";
  const taxArgs = listingTaxCostArgs(tax);
  const realAtBid = bid0 == null ? null : listingRealCost(taxArgs.kind, taxArgs.foreignVatPct, bid0, extras);
  const galaAtBid = bid0 == null ? null : listingFinalPrice(tax, bid0, extras);
  const real = bid0 == null ? null : listingRealCost(taxArgs.kind, taxArgs.foreignVatPct, bid, extras);
  const mb = budget != null ? listingMaxBid(taxArgs.kind, taxArgs.foreignVatPct, budget, extras) : null;
  const room = mb != null && bid0 != null ? mb - bid0 : null;
  const sourceHref = resolveListingDetailUrl(v);
  const yearLabel = listingYearLabel(v);
  const powerKwLabel = formatListingPowerKwLabel(v.powerKw);
  const reassigned = Boolean(prefs.orderOv[v.id]?.length);
  const assignValue = linked.length === 1 ? linked[0]!.id : "";
  const assignChoices = orders.filter((o) => isIrissPasutijumsWorkingStatus(o.listStatus) || linked.some((l) => l.id === o.id));
  const priceHistory = realListingPriceHistory(v.priceHistory);
  const auctionTypeLabel = listingAuctionTypeLabel(v.auctionType);
  const flag = countryFlagLabel(v.countryCode);
  const photos = [v.imageUrl, ...(v.imageUrls ?? [])].filter(Boolean).filter((u, i, a) => a.indexOf(u) === i);
  const shown = photos[Math.min(photoIdx, Math.max(0, photos.length - 1))];
  const referrerPolicy = v.platform === "openline" ? ("no-referrer" as const) : undefined;
  const cd = listingCountdown(v.auctionEndAt, nowMs);
  const fav = prefs.fav.includes(v.id);
  const hidden = prefs.hidden.includes(v.id);
  const facts = [v.mileageKm != null ? `${v.mileageKm.toLocaleString("lv-LV")} km` : "", v.fuel, v.transmission, powerKwLabel, flag ? flag.name : v.location]
    .filter(Boolean)
    .join(" · ");

  useEffect(() => {
    setBid(listingBidPrice(v) ?? 0);
    setPhotoIdx(0);
    setZipMsg("");
    setLvMsg("");
  }, [v]);

  function setNote(text: string) {
    onPrefs({ ...prefs, notes: { ...prefs.notes, [v.id]: text } });
  }
  function setTax(next: ListingTaxOverride | null) {
    const taxOv = { ...prefs.taxOv };
    if (!next) delete taxOv[v.id];
    else taxOv[v.id] = next;
    onPrefs({ ...prefs, taxOv });
  }
  function setCost(part: keyof ListingCostParts, value: number) {
    const cur = { ...(prefs.costOv[v.id] ?? {}), [part]: value };
    const clean = { ...cur };
    for (const k of Object.keys(clean) as (keyof ListingCostParts)[]) {
      if (clean[k] === prefs.costs[k]) delete clean[k];
    }
    const costOv = { ...prefs.costOv };
    if (Object.keys(clean).length === 0) delete costOv[v.id];
    else costOv[v.id] = clean;
    onPrefs({ ...prefs, costOv });
  }

  async function translate() {
    if (!v.damageRaw?.trim()) return;
    setLvMsg("Tulko...");
    try {
      const res = await fetch("/api/admin/iriss-listings/damage-translate", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: v.damageRaw }),
      });
      const body = (await res.json()) as { lv?: string; error?: string };
      if (!res.ok || !body.lv) {
        setLvMsg(body.error ?? "Tulkojums neizdevās.");
        return;
      }
      onPrefs({ ...prefs, damageLv: { ...prefs.damageLv, [v.id]: body.lv } });
      setLvMsg("");
    } catch (e) {
      setLvMsg(e instanceof Error ? e.message : "Tīkla kļūda.");
    }
  }

  async function downloadZip() {
    setZipMsg("Veido ZIP...");
    try {
      const res = await fetch("/api/admin/iriss-listings/photos-zip", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ urls: photos, title: v.title, year: v.year }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setZipMsg(body.error ?? "ZIP neizdevās.");
        return;
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${v.year || "auto"}-bildes.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      setZipMsg("ZIP lejupielādēts.");
    } catch (e) {
      setZipMsg(e instanceof Error ? e.message : "Tīkla kļūda.");
    }
  }

  async function createOffer() {
    if (!onCreateOffer || offerBusy) return;
    setOfferBusy(true);
    try {
      await onCreateOffer(v);
    } finally {
      setOfferBusy(false);
    }
  }

  return (
    <aside
      data-iriss-panel=""
      role="dialog"
      aria-modal="true"
      aria-label={v.title || "Sludinājums"}
      style={{ backgroundColor: "var(--iriss-bg)" }}
      className="iriss-slud fixed inset-0 z-[60] flex w-full flex-col touch-manipulation sm:inset-y-0 sm:right-0 sm:left-auto sm:max-w-[680px] sm:shadow-[-12px_0_32px_rgba(0,0,0,.14)]"
    >
      {/* Galvene: avots, pārslēgšana, favorīts / slēpt, aizvērt (vienmēr redzama). */}
      <div className="flex shrink-0 items-center gap-2 bg-[var(--iriss-surface)] px-3 pb-2.5 pt-[max(10px,env(safe-area-inset-top))] shadow-[0_1px_0_var(--iriss-line)] sm:px-5 sm:pt-3">
        <button type="button" onClick={onClose} className={`${iconBtn} sm:hidden`} aria-label="Atpakaļ">
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--iriss-ink-2)]">{IRISS_LISTING_PLATFORM_LABEL[v.platform] ?? v.platform}</span>
        {flag ? <span title={flag.title}>{flag.flag}</span> : null}
        <span className="grow" />
        {position && position.total > 1 ? (
          <div className="hidden items-center gap-1.5 sm:flex">
            <button type="button" className={iconBtn} disabled={!onPrev} onClick={onPrev} aria-label="Iepriekšējais auto" title="Iepriekšējais auto (←)">
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <span className="min-w-[3.5rem] text-center text-[12.5px] font-semibold tabular-nums text-[var(--iriss-ink-2)]">
              {position.index + 1} / {position.total}
            </span>
            <button type="button" className={iconBtn} disabled={!onNext} onClick={onNext} aria-label="Nākamais auto" title="Nākamais auto (→)">
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : null}
        <button
          type="button"
          className={`${iconBtn} ${fav ? "text-amber-500" : ""}`}
          title={fav ? "Noņemt no favorītiem" : "Favorīts"}
          aria-label={fav ? "Noņemt no favorītiem" : "Favorīts"}
          aria-pressed={fav}
          onClick={() => onPrefs({ ...prefs, fav: fav ? prefs.fav.filter((x) => x !== v.id) : [...prefs.fav, v.id] })}
        >
          <Star className="h-[18px] w-[18px]" fill={fav ? "currentColor" : "none"} aria-hidden />
        </button>
        <button
          type="button"
          className={iconBtn}
          title={hidden ? "Rādīt atkal" : "Nav interesanti"}
          aria-label={hidden ? "Rādīt atkal" : "Nav interesanti"}
          onClick={() => onPrefs({ ...prefs, hidden: hidden ? prefs.hidden.filter((x) => x !== v.id) : [...prefs.hidden, v.id] })}
        >
          {hidden ? <RotateCcw className="h-[18px] w-[18px]" aria-hidden /> : <EyeOff className="h-[18px] w-[18px]" aria-hidden />}
        </button>
        <button type="button" onClick={onClose} className={`${iconBtn} hidden sm:grid`} aria-label="Aizvērt" title="Aizvērt (Esc)">
          <X className="h-[18px] w-[18px]" aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 pb-6 pt-3 sm:px-5">
        <div>
          {v.stockNumber ? <div className="text-[12px] font-semibold text-[var(--iriss-ink-3)]">Nr. {v.stockNumber}</div> : null}
          <h2 className="text-[19px] font-bold leading-tight tracking-[-0.2px] text-[var(--iriss-ink)] sm:text-[21px]">
            {v.title} <span className="font-semibold text-[var(--iriss-ink-3)]">{yearLabel}</span>
          </h2>
          {facts ? <p className="mt-1 text-[13px] text-[var(--iriss-ink-2)]">{facts}</p> : null}
        </div>

        {/* Bildes: visa bilde (bez apgriešanas), pārslēdz ar bultām vai sīktēliem. */}
        {photos.length ? (
          <div className="overflow-hidden rounded-[18px] bg-[var(--iriss-surface)] shadow-[0_0_0_.5px_rgba(0,0,0,.08)]">
            <div className="relative aspect-[4/3] w-full bg-[var(--iriss-surface-2)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={listingDisplayImageUrl({ url: shown, maxWidth: 1100 })}
                alt={v.title || "Auto foto"}
                decoding="async"
                referrerPolicy={referrerPolicy}
                className="absolute inset-0 h-full w-full object-contain"
              />
              {photos.length > 1 ? (
                <>
                  <button
                    type="button"
                    className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/95 shadow"
                    aria-label="Iepriekšējā bilde"
                    onClick={() => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)}
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/95 shadow"
                    aria-label="Nākamā bilde"
                    onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)}
                  >
                    <ChevronRight className="h-5 w-5" aria-hidden />
                  </button>
                  <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11.5px] font-semibold tabular-nums text-white">
                    {photoIdx + 1} / {photos.length}
                  </span>
                </>
              ) : null}
            </div>
            {photos.length > 1 ? (
              <div className="flex gap-1.5 overflow-x-auto p-2 [scrollbar-width:thin]">
                {photos.map((u, i) => (
                  <button
                    key={`${u}-${i}`}
                    type="button"
                    onClick={() => setPhotoIdx(i)}
                    aria-label={`Bilde ${i + 1}`}
                    className={`relative h-14 w-[74px] shrink-0 overflow-hidden rounded-[10px] bg-[var(--iriss-surface-2)] ${i === photoIdx ? "ring-2 ring-[var(--iriss-graphite)]" : ""}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={listingDisplayImageUrl({ url: u, maxWidth: 200 })} alt="" loading="lazy" decoding="async" referrerPolicy={referrerPolicy} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Cena, termiņš un budžets. */}
        <section className={card}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className={h3.replace("mb-2 ", "")}>{listingCardPriceLabel(v)}{v.bidCount != null ? ` · ${v.bidCount} solījumi` : ""}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-[28px] font-bold tabular-nums leading-none tracking-[-0.4px]">{eur(bid0)}</span>
                <IrissListTaxBadge tax={tax} size="md" quiet />
              </div>
              {v.priceBuyNow != null && v.priceBuyNow !== bid0 ? <div className="mt-1 text-[12px] text-[var(--iriss-ink-2)]">pirkt uzreiz {eur(v.priceBuyNow)}</div> : null}
              {v.priceTotal != null && v.priceTotal !== bid0 ? <div className="mt-0.5 text-[12px] text-[var(--iriss-ink-2)]">kopā {eur(v.priceTotal)}</div> : null}
            </div>
            <div className="text-right">
              {cd.t ? <div className="text-[13px] font-bold tabular-nums text-[var(--iriss-brand)]">⏱ {cd.t}</div> : null}
              <div className="text-[12px] text-[var(--iriss-ink-2)]">{v.auctionEndAt ? `beidzas ${dt(v.auctionEndAt)}` : "Beigu laiks nav zināms"}</div>
              {auctionTypeLabel ? <div className="text-[12px] font-semibold text-[var(--iriss-warn)]">{auctionTypeLabel}</div> : null}
            </div>
          </div>
          <IrissListingBudgetBox
            budget={budget}
            gala={galaAtBid}
            real={realAtBid}
            maxBid={mb}
            room={room}
            priceMissing={bid0 == null}
            priceLabel={listingCardPriceLabel(v)}
          />
          {bid0 == null ? <p className="mt-2 text-[12.5px] text-[var(--iriss-ink-2)]">{budget != null ? `Klienta budžets ${eur(budget)}. ` : ""}Cenas vēl nav.</p> : null}
        </section>

        {/* Klients un pasūtījums. */}
        <section className={card}>
          <h3 className={h3}>Klients un pasūtījums</h3>
          {linked.length ? <IrissListingOrderChips orders={linked} onPreview={onPreviewOrder} /> : <p className="text-[13px] text-[var(--iriss-ink-2)]">Nav piesaistīts pasūtījumam.</p>}
          <label className="mt-3 block text-[12px] font-semibold text-[var(--iriss-ink-2)]">
            Piesaistīt citam pasūtījumam
            <select
              value={assignValue}
              onChange={(e) => {
                const id = e.target.value;
                const orderOv = { ...prefs.orderOv };
                if (!id) delete orderOv[v.id];
                else orderOv[v.id] = [id];
                onPrefs({ ...prefs, orderOv });
              }}
              className={`${field} mt-1 font-normal`}
            >
              <option value="">{reassigned ? "Automātiski no meklējuma" : "Automātiski no meklējuma (vairāki, ja URL kopīgs)"}</option>
              {assignChoices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.clientName} · {o.brandModel || "pasūtījums"} {o.productionYears ? `· ${o.productionYears}` : ""}
                </option>
              ))}
            </select>
          </label>
          {offers.length ? (
            <div className="mt-3">
              <div className="text-[12px] font-semibold text-[var(--iriss-ink-2)]">Piedāvājumi šim auto</div>
              <ul className="mt-1 space-y-1">
                {offers.map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/iriss/piedavajumi/${encodeURIComponent(o.id)}`} className="flex items-center justify-between gap-2 rounded-[12px] px-3 py-2 text-[13px] shadow-[inset_0_0_0_1px_var(--iriss-line)] hover:bg-[var(--iriss-surface-2)]">
                      <span className="font-semibold">{irissPdNumberLabel(o.number)}{o.clientName ? ` · ${o.clientName}` : ""}</span>
                      <span className="text-[12px] text-[var(--iriss-ink-2)]">{IRISS_PD_STATUS_LV[o.status]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className={card}>
          <h3 className={h3}>Piezīme</h3>
          <textarea
            value={prefs.notes[v.id] ?? ""}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Piezīme par šo auto (redzama visās ierīcēs)"
            className="min-h-[72px] w-full rounded-[12px] bg-[var(--iriss-surface)] p-3 text-[16px] text-[var(--iriss-ink)] shadow-[inset_0_0_0_1px_var(--iriss-line-strong)] outline-none sm:text-[14px]"
          />
        </section>

        <section className={card}>
          <h3 className={h3}>Tehniskais stāvoklis</h3>
          {dmg.status === "nodata" ? (
            <p className="text-[13px] text-[var(--iriss-ink-2)]">Nav datu. Detaļu lapā stāvokļa teksta nav.</p>
          ) : (
            <>
              <div className="rounded-[12px] bg-[var(--iriss-surface-2)] p-3 text-[13px]" dangerouslySetInnerHTML={{ __html: highlightListingDamage(v.damageRaw ?? "", dmg.spans) }} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {dmg.status === "none" ? <span className="rounded-full bg-[color-mix(in_srgb,var(--iriss-ok)_12%,transparent)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--iriss-ok)]">Tehn. bojājumi nav norādīti</span> : null}
                {dmg.cats.map((c) => (
                  <span key={c.name} className="rounded-full bg-[var(--iriss-bad-soft)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--iriss-bad)]">
                    ⚠ {c.name}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[13px]"><b>LV:</b> {lv || "tulkojums vēl nav ģenerēts"}</p>
              <button type="button" className={`${btn2} mt-2`} onClick={() => void translate()}>
                Ģenerēt LV tulkojumu
              </button>
              {lvMsg ? <p className="mt-1 text-[12px] text-[var(--iriss-ink-2)]">{lvMsg}</p> : null}
            </>
          )}
        </section>

        <section className={card}>
          <h3 className={h3}>Cenu vēsture</h3>
          {priceHistory.length === 0 ? (
            <p className="text-[13px] text-[var(--iriss-ink-2)]">Izmaiņu nav. Pirmo reizi {dt(v.firstSeenAt)}</p>
          ) : (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[320px] text-[12.5px]">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-[0.05em] text-[var(--iriss-ink-3)]">
                    <th className="py-1">Laiks</th>
                    <th>Lauks</th>
                    <th className="text-right">No</th>
                    <th className="text-right">Uz</th>
                  </tr>
                </thead>
                <tbody>
                  {priceHistory.map((h, i) => (
                    <tr key={`${h.at}-${i}`} className="border-t border-[var(--iriss-line)]">
                      <td className="py-1.5">{dt(h.at)}</td>
                      <td>{h.field === "buy_now" ? "Pirkt uzreiz" : h.field === "estimate" ? "Aplēse" : h.field === "start" ? "Sākuma" : h.field === "minimal" ? "Minimālā" : "Pašreizējā"}</td>
                      <td className="text-right tabular-nums">{eur(h.from)}</td>
                      <td className={`text-right font-semibold tabular-nums ${h.from != null && h.to != null && h.to > h.from ? "text-[var(--iriss-bad)]" : "text-[var(--iriss-ok)]"}`}>{eur(h.to)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Aprēķins: PVN režīms, izmaksas šim auto un kalkulators vienā vietā. */}
        <section className={card}>
          <h3 className={h3}>Aprēķins</h3>
          <label className="block text-[12px] font-semibold text-[var(--iriss-ink-2)]">
            PVN režīms
            <div className="mt-1 flex gap-2">
              <select
                value={ov?.kind ?? ""}
                onChange={(e) => {
                  const k = e.target.value as ListingTaxKind | "";
                  if (!k) setTax(null);
                  else setTax({ kind: k, rate: k === "gross" ? (ov?.rate ?? detected.rate ?? 19) : null });
                }}
                className={`${field} min-w-0 flex-1 font-normal`}
              >
                <option value="">Automātiski: {listingTaxLabel(detected)}</option>
                <option value="net">NETO</option>
                <option value="margin">Marža</option>
                <option value="gross">AR PVN x %</option>
              </select>
              {ov?.kind === "gross" ? (
                <input type="number" inputMode="numeric" value={ov.rate ?? ""} onChange={(e) => setTax({ kind: "gross", rate: Number(e.target.value) || null })} className={`${field} w-24 font-normal`} placeholder="%" />
              ) : null}
            </div>
          </label>
          <p className="mt-1 text-[11.5px] text-[var(--iriss-ink-3)]">Avota lauks: {detected.raw}</p>
          {detected.flag ? <p className="mt-0.5 text-[11.5px] text-[var(--iriss-warn)]">⚠ {listingTaxFlagReason(detected)}</p> : null}
          {tax.manual ? <p className="mt-0.5 text-[11.5px] text-[var(--iriss-ink-3)]">PVN režīms (manuāli)</p> : null}

          <div className="mt-3 grid grid-cols-2 gap-2">
            {([
              ["fee", "Izsoles komisija"],
              ["transport", "Transports"],
              ["commission", "Dzintarzeme Auto komisija"],
              ["unplanned", "Neplānotie"],
            ] as const).map(([k, l]) => (
              <label key={k} className="text-[12px] font-semibold text-[var(--iriss-ink-2)]">
                {l}
                <input type="number" inputMode="numeric" value={costs[k]} onChange={(e) => setCost(k, Number(e.target.value) || 0)} className={`${field} mt-1 font-normal`} />
              </label>
            ))}
          </div>
          <p className="mt-1 text-[11.5px] text-[var(--iriss-ink-3)]">Izmaksas kopā {eur(extras)} (noklusējums {eur(listingExtrasI(DEFAULT_LISTING_COSTS))}), bez PVN</p>

          {bid0 != null ? (
            <>
              <div className="mt-3 flex items-center gap-3">
                <span className="shrink-0 text-[12.5px] text-[var(--iriss-ink-2)]">Ja nosolām par</span>
                <input
                  type="range"
                  min={Math.round(bid0 * 0.7)}
                  max={Math.round(bid0 * 1.4)}
                  step={100}
                  value={bid}
                  onChange={(e) => setBid(Number(e.target.value))}
                  className="h-10 grow accent-[var(--iriss-graphite)]"
                  aria-label="Solījums"
                />
                <b className="w-24 text-right tabular-nums">{eur(bid)}</b>
              </div>
              {real ? (
                <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-[12.5px] tabular-nums">
                  <dt>Solījums {listingTaxLabel(tax)}</dt>
                  <dd>{eur2(bid)}</dd>
                  {tax.kind === "gross" ? (
                    <>
                      <dt className="pl-3 text-[var(--iriss-ink-3)]">bez ārvalstu PVN {tax.rate} %</dt>
                      <dd>{eur2(real.base)}</dd>
                    </>
                  ) : null}
                  <dt>Izmaksas</dt>
                  <dd>{eur2(extras)}</dd>
                  <dt>PVN 21 % no {tax.kind === "margin" ? "izdevumiem" : "solījuma un izmaksām"}</dt>
                  <dd>{eur2(real.vat)}</dd>
                  <dt className="border-t border-[var(--iriss-line)] pt-1 font-bold">Plānotā gala cena</dt>
                  <dd className="border-t border-[var(--iriss-line)] pt-1 font-bold">{eur(listingFinalPrice(tax, bid, extras))}</dd>
                  {budget != null ? (
                    <>
                      <dt className="text-[var(--iriss-ink-2)]">Klienta budžets</dt>
                      <dd className={listingFinalPrice(tax, bid, extras) <= budget ? "font-semibold text-[var(--iriss-ok)]" : "font-semibold text-[var(--iriss-bad)]"}>{eur(budget)}</dd>
                    </>
                  ) : null}
                </dl>
              ) : null}
            </>
          ) : null}
        </section>

        {photos.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={btn2} onClick={() => void downloadZip()}>
              <Download className="h-4 w-4" aria-hidden />
              Visas bildes ZIP
            </button>
            {zipMsg ? <span className="text-[12px] text-[var(--iriss-ink-2)]">{zipMsg}</span> : null}
          </div>
        ) : null}
      </div>

      {/* Darbības vienmēr redzamas apakšā. */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 bg-[var(--iriss-surface)] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-1px_0_var(--iriss-line)] sm:px-5">
        {onCreateOffer ? (
          <button type="button" className={`${btn1} flex-1 sm:flex-none`} disabled={offerBusy} onClick={() => void createOffer()}>
            <FilePlus2 className="h-4 w-4" aria-hidden />
            {offerBusy ? "Veido..." : "Izveidot piedāvājumu"}
          </button>
        ) : null}
        {linked.length && onPreviewOrder ? (
          <button type="button" className={`${btn2} flex-1 sm:flex-none`} onClick={() => onPreviewOrder(linked[0]!)}>
            <ClipboardList className="h-4 w-4" aria-hidden />
            Pasūtījuma detaļas
          </button>
        ) : null}
        {sourceHref ? (
          <IrissListingSourceOpen v={v} mobile={mobile ?? null} className={`${btn2} flex-1 sm:flex-none`}>
            <ExternalLink className="h-4 w-4" aria-hidden />
            Atvērt avotā
          </IrissListingSourceOpen>
        ) : null}
        <IrissListingSourceExtras v={v} mobile={mobile ?? null} />
        {position && position.total > 1 ? (
          <div className="flex w-full items-center justify-between gap-2 sm:hidden">
            <button type="button" className={btn2} disabled={!onPrev} onClick={onPrev}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Iepriekšējais
            </button>
            <span className="text-[12.5px] font-semibold tabular-nums text-[var(--iriss-ink-2)]">
              {position.index + 1} / {position.total}
            </span>
            <button type="button" className={btn2} disabled={!onNext} onClick={onNext}>
              Nākamais
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
