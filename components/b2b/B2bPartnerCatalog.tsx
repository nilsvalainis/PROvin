"use client";

import {
  Camera,
  ClipboardCheck,
  Gauge,
  Globe2,
  List,
  ShieldCheck,
  Store,
  Tags,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import {
  B2B_PARTNER_PRICE,
  getB2bCatalog,
  splitB2bGoalAroundLink,
  type B2bCatalogItem,
  type B2bCatalogPackage,
  type B2bPartnerPlanId,
} from "@/lib/b2b-partner-copy";
import { DealerCoverageBrandSections } from "@/components/test-pricing-5/DealerCoverageBrandSections";
import { DealerHeroBrandChips } from "@/components/test-pricing-5/DealerHeroBrandChips";
import { getTp5UiCopy, type Tp5UiCopy } from "@/lib/test-pricing-5-ui-copy";

const LUCIDE_ICON_CLASS = "h-4 w-4 [stroke-width:1.6] sm:h-[1.125rem] sm:w-[1.125rem]";
const BRAND_LOGO_CLASS = "h-4 w-4 shrink-0 object-contain sm:h-[1.125rem] sm:w-[1.125rem]";
const TILE_HEIGHT_CLASS = "h-12";
/** 7×h-12 + 6×gap-1.5: same total as BUSINESS tiles; brand chips scroll inside. */
const MATCHED_STACK_CLASS = "flex h-[calc(7*3rem+6*0.375rem)] min-h-0 min-w-0 flex-col gap-1.5 overflow-hidden";
const ITEM_TILE_CLASS =
  `flex ${TILE_HEIGHT_CLASS} w-full items-center gap-3 rounded-[0.35rem] bg-white/[0.03] px-3 sm:gap-3.5`;
const TITLE_CLASS = "text-balance text-lg font-bold leading-snug tracking-tight text-zinc-100 sm:text-xl";
const TITLE_RULE_CLASS = "mt-2.5 h-px w-full bg-white/10";
const GOAL_CLASS =
  "text-balance text-[0.8125rem] font-medium leading-[1.55] text-zinc-200 sm:text-[0.875rem] sm:leading-[1.6]";
const FOOT_CLASS = "text-[0.62rem] leading-[1.4] text-white/40";

type CatalogPackage = B2bCatalogPackage;

function PackageTitle({ title }: { title: string }) {
  return (
    <div>
      <h2 className={TITLE_CLASS}>
        {title === "PROVIN BUSINESS" ? (
          <>
            PRO<span className="text-[#2563EB]">VIN</span> BUSINESS
          </>
        ) : (
          title
        )}
      </h2>
      <div className={TITLE_RULE_CLASS} aria-hidden />
    </div>
  );
}

function SourceBrandMark({ src }: { src: string }) {
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center sm:h-[1.125rem] sm:w-[1.125rem]">
      <Image src={src} alt="" width={18} height={18} className={BRAND_LOGO_CLASS} />
    </span>
  );
}

function SourcePairTitle() {
  return (
    <>
      <SourceBrandMark src="/brand/carvertical-logo.png" />
      <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 text-[0.8125rem] font-bold leading-snug text-zinc-100 sm:gap-x-6 sm:text-[0.875rem]">
        CarVertical
        <span className="inline-flex items-center gap-3 sm:gap-3.5">
          <SourceBrandMark src="/brand/autodna-logo.png" />
          AutoDNA
        </span>
      </p>
    </>
  );
}

function ItemIcon({ icon }: { icon: B2bCatalogItem["icon"] }) {
  if (icon === "logos") return null;
  const glyph =
    icon === "store" ? (
      <Store className={LUCIDE_ICON_CLASS} aria-hidden />
    ) : icon === "globe" ? (
      <Globe2 className={LUCIDE_ICON_CLASS} aria-hidden />
    ) : icon === "camera" ? (
      <Camera className={LUCIDE_ICON_CLASS} aria-hidden />
    ) : icon === "shield" ? (
      <ShieldCheck className={LUCIDE_ICON_CLASS} aria-hidden />
    ) : icon === "clipboard" ? (
      <ClipboardCheck className={LUCIDE_ICON_CLASS} aria-hidden />
    ) : icon === "list" ? (
      <List className={LUCIDE_ICON_CLASS} aria-hidden />
    ) : icon === "gauge" ? (
      <Gauge className={LUCIDE_ICON_CLASS} aria-hidden />
    ) : (
      <Tags className={LUCIDE_ICON_CLASS} aria-hidden />
    );
  return <span className="flex shrink-0 text-zinc-400">{glyph}</span>;
}

function PackageGoal({
  goal,
  dealerLink,
  onOpenDealer,
  openLabel,
  dealerOpen,
}: {
  goal: string;
  dealerLink?: string;
  onOpenDealer?: () => void;
  openLabel: string;
  dealerOpen?: boolean;
}) {
  const parts = onOpenDealer ? splitB2bGoalAroundLink(goal, dealerLink) : null;
  if (!parts) {
    return <p className={`mt-3 ${GOAL_CLASS}`}>{goal}</p>;
  }
  return (
    <p className={`mt-3 ${GOAL_CLASS}`}>
      {parts.before}
      <button
        type="button"
        className={styles.b2bDealerGoalLink}
        onClick={onOpenDealer}
        aria-label={openLabel}
        aria-expanded={dealerOpen}
      >
        {parts.link}
      </button>
      {parts.after}
    </p>
  );
}

function ItemList({
  items,
  className,
  onOpenDealer,
  openLabel,
  dealerOpen = false,
  dealer,
  brandsCopy,
}: {
  items: readonly B2bCatalogItem[];
  className: string;
  onOpenDealer?: () => void;
  openLabel: string;
  dealerOpen?: boolean;
  dealer?: CatalogPackage;
  brandsCopy?: Tp5UiCopy;
}) {
  const panelId = useId();
  if (items.length === 0) return null;
  return (
    <ul className={className}>
      {items.map((item) => {
        const row = (
          <>
            {item.icon === "logos" ? (
              <SourcePairTitle />
            ) : (
              <>
                <ItemIcon icon={item.icon} />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.8125rem] font-bold leading-snug text-zinc-100 sm:text-[0.875rem]">{item.title}</p>
                  {item.description ? (
                    <p className="mt-1 text-[0.8125rem] font-normal leading-[1.55] text-gray-400 sm:text-[0.875rem] sm:leading-[1.6]">
                      {item.description}
                    </p>
                  ) : null}
                </div>
              </>
            )}
          </>
        );
        if (item.opensDealer && onOpenDealer && dealer && brandsCopy) {
          return (
            <li key={item.title}>
              <button
                type="button"
                className={`${ITEM_TILE_CLASS} ${styles.b2bDealerSourceRow}`}
                onClick={onOpenDealer}
                aria-expanded={dealerOpen}
                aria-controls={panelId}
                aria-label={openLabel}
              >
                {row}
                <span className={styles.b2bDealerAccordionMark} aria-hidden>
                  {dealerOpen ? "−" : "+"}
                </span>
              </button>
              {dealerOpen ? (
                <div id={panelId} className={styles.b2bDealerAccordion}>
                  <p className={GOAL_CLASS}>{dealer.goal}</p>
                  <div className="mt-4">
                    <DealerHeroBrandChips ariaLabel={brandsCopy.dealerBrandsAria} embedded />
                  </div>
                </div>
              ) : null}
            </li>
          );
        }
        return (
          <li key={item.title} className={ITEM_TILE_CLASS}>
            {row}
          </li>
        );
      })}
    </ul>
  );
}

function canHoverFinePointer(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function GuaranteeInfoTip({ body, infoAria }: { body: string; infoAria: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const tipId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root || !(event.target instanceof Node)) return;
      if (!root.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setOpen((prev) => !prev);
  }

  return (
    <span
      ref={rootRef}
      className="relative shrink-0"
      onMouseEnter={() => {
        if (canHoverFinePointer()) setOpen(true);
      }}
      onMouseLeave={() => {
        if (canHoverFinePointer()) setOpen(false);
      }}
    >
      <button
        type="button"
        className="inline-flex h-[0.95rem] w-[0.95rem] items-center justify-center rounded-full border border-emerald-300/45 bg-emerald-950/40 text-[0.56rem] font-bold leading-none text-emerald-100 transition-colors hover:border-[#2563EB] hover:bg-[#2563EB]/20 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
        aria-label={infoAria}
        aria-expanded={open}
        aria-controls={tipId}
        onClick={toggle}
      >
        <span aria-hidden>i</span>
      </button>
      {open ? (
        <span
          id={tipId}
          role="tooltip"
          className="absolute bottom-[calc(100%+0.45rem)] right-0 z-20 w-[min(18rem,calc(100vw-2rem))] rounded-[0.7rem] border border-white/14 bg-[linear-gradient(160deg,rgb(28_32_40_/_0.98)_0%,rgb(14_16_22_/_0.98)_100%)] px-3.5 py-2.5 text-left text-[0.68rem] font-normal leading-[1.45] text-zinc-200 shadow-[0_12px_28px_rgb(0_0_0_/_0.35)]"
        >
          {body}
        </span>
      ) : null}
    </span>
  );
}

function GuaranteeBlock({ title, body, infoAria }: { title: string; body: string; infoAria: string }) {
  return (
    <div
      className={`relative flex ${TILE_HEIGHT_CLASS} w-full shrink-0 items-center gap-3 overflow-visible rounded-[0.35rem] border border-emerald-300/30 bg-emerald-500/[0.08] px-3 sm:gap-3.5`}
    >
      <span className="flex shrink-0 text-emerald-300">
        <ShieldCheck className={LUCIDE_ICON_CLASS} aria-hidden />
      </span>
      <p className="min-w-0 flex-1 truncate text-[0.8125rem] font-bold leading-snug text-emerald-100 sm:text-[0.875rem]">
        {title}
      </p>
      <GuaranteeInfoTip body={body} infoAria={infoAria} />
    </div>
  );
}

function DealerBrandLockup({
  copy,
  fill,
}: {
  copy: Tp5UiCopy;
  fill?: boolean;
}) {
  return (
    <div
      className={
        fill
          ? `min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-width:thin] ${styles.dealerB2bBrandChipsFill}`
          : undefined
      }
    >
      <DealerCoverageBrandSections copy={copy} ariaLabel={copy.dealerBrandsAria} />
    </div>
  );
}

function PackageCta({ plan }: { plan: B2bPartnerPlanId }) {
  const t = useTranslations("Partner");
  return (
    <button type="button" className={`${styles.liquidCta} mt-6`}>
      <span className={styles.liquidCtaShimmer} aria-hidden />
      <span className={styles.liquidCtaLabel}>{t("payCta", { price: B2B_PARTNER_PRICE[plan] })}</span>
    </button>
  );
}

function PackageStack({
  pkg,
  plan,
  brandsCopy,
  listClassName,
  infoAria,
  showCta,
  onOpenDealer,
  openLabel,
  dealerOpen,
  accordionDealer,
  accordionBrandsCopy,
}: {
  pkg: CatalogPackage;
  plan: B2bPartnerPlanId;
  brandsCopy?: Tp5UiCopy;
  listClassName: string;
  infoAria: string;
  showCta: boolean;
  onOpenDealer?: () => void;
  openLabel: string;
  dealerOpen?: boolean;
  accordionDealer?: CatalogPackage;
  accordionBrandsCopy?: Tp5UiCopy;
}) {
  const isDealer = "guaranteeTitle" in pkg;
  return (
    <article className="flex min-w-0 flex-col">
      <PackageTitle title={pkg.title} />
      <PackageGoal
        goal={pkg.goal}
        dealerLink={pkg.goalDealerLink}
        onOpenDealer={onOpenDealer}
        openLabel={openLabel}
        dealerOpen={dealerOpen}
      />
      <ItemList
        items={pkg.items}
        className={listClassName}
        onOpenDealer={onOpenDealer}
        openLabel={openLabel}
        dealerOpen={dealerOpen}
        dealer={accordionDealer}
        brandsCopy={accordionBrandsCopy}
      />
      {brandsCopy ? (
        <div className="mt-7 flex min-w-0 flex-col gap-1.5 overflow-visible">
          <DealerBrandLockup copy={brandsCopy} />
          {isDealer ? (
            <GuaranteeBlock
              title={pkg.guaranteeTitle ?? ""}
              body={pkg.guaranteeBody ?? ""}
              infoAria={infoAria}
            />
          ) : null}
        </div>
      ) : isDealer ? (
        <div className="mt-7">
          <GuaranteeBlock
            title={pkg.guaranteeTitle ?? ""}
            body={pkg.guaranteeBody ?? ""}
            infoAria={infoAria}
          />
        </div>
      ) : null}
      {pkg.foot ? <p className={`mt-4 ${FOOT_CLASS}`}>{pkg.foot}</p> : null}
      {showCta ? <PackageCta plan={plan} /> : null}
    </article>
  );
}

export function B2bPartnerCatalog({
  showCta = false,
  plan,
  className,
}: {
  showCta?: boolean;
  /** When set, show only that package (partner landing expand links). */
  plan?: B2bPartnerPlanId;
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("Partner");
  const uiCopy = getTp5UiCopy(locale);
  const catalog = getB2bCatalog(locale);
  const business = catalog.business;
  const dealer = catalog.dealer;
  const onlyBusiness = plan === "business";
  const onlyDealer = plan === "dealer";
  const single = onlyBusiness || onlyDealer;
  const [dealerOpen, setDealerOpen] = useState(false);
  const toggleDealer = () => setDealerOpen((open) => !open);
  const openLabel = t("dealerDisclosureOpen");
  const dealerTrigger = onlyDealer ? undefined : toggleDealer;
  const accordion = onlyDealer
    ? {}
    : {
        dealerOpen,
        accordionDealer: dealer,
        accordionBrandsCopy: uiCopy,
      };

  return (
    <section
      className={`scroll-mt-16 bg-transparent px-0 pb-4 pt-2 sm:pb-8 sm:pt-4 lg:pb-10${className ? ` ${className}` : ""}`}
      aria-label={onlyBusiness ? business.title : onlyDealer ? dealer.title : undefined}
    >
      <div className="w-full min-w-0">
        {single ? (
          <div className="flex flex-col">
            {onlyBusiness ? (
              <PackageStack
                pkg={business}
                plan="business"
                infoAria={uiCopy.dealerRefundInfoAria}
                listClassName="mt-7 flex min-w-0 flex-col gap-1.5"
                showCta={showCta}
                onOpenDealer={dealerTrigger}
                openLabel={openLabel}
                {...accordion}
              />
            ) : (
              <PackageStack
                pkg={dealer}
                plan="dealer"
                brandsCopy={uiCopy}
                infoAria={uiCopy.dealerRefundInfoAria}
                listClassName="mt-7 flex min-w-0 flex-col gap-1.5"
                showCta={showCta}
                openLabel={openLabel}
              />
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-10 lg:hidden">
              <PackageStack
                pkg={dealer}
                plan="dealer"
                brandsCopy={uiCopy}
                infoAria={uiCopy.dealerRefundInfoAria}
                listClassName="mt-7 flex min-w-0 flex-col gap-1.5"
                showCta={showCta}
                openLabel={openLabel}
              />
              <div className="h-px w-full bg-white/15" aria-hidden />
              <PackageStack
                pkg={business}
                plan="business"
                infoAria={uiCopy.dealerRefundInfoAria}
                listClassName="mt-7 flex min-w-0 flex-col gap-1.5"
                showCta={showCta}
                onOpenDealer={dealerTrigger}
                openLabel={openLabel}
                {...accordion}
              />
            </div>

            <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] lg:grid-rows-[auto_auto_auto_auto_auto] lg:items-start lg:gap-x-10">
              <PackageTitle title={business.title} />
              <div className={`${showCta ? "row-span-5" : "row-span-4"} self-stretch bg-white/15`} aria-hidden />
              <PackageTitle title={dealer.title} />

              <PackageGoal
                goal={business.goal}
                dealerLink={business.goalDealerLink}
                onOpenDealer={dealerTrigger}
                openLabel={openLabel}
                dealerOpen={dealerOpen}
              />
              <p className={`mt-3 ${GOAL_CLASS}`}>{dealer.goal}</p>

              <ItemList
                items={business.items}
                className="mt-7 flex min-w-0 flex-col gap-1.5"
                onOpenDealer={dealerTrigger}
                openLabel={openLabel}
                dealerOpen={dealerOpen}
                dealer={dealer}
                brandsCopy={uiCopy}
              />
              <div className={`mt-7 ${MATCHED_STACK_CLASS}`}>
                <DealerBrandLockup copy={uiCopy} fill />
                <GuaranteeBlock
                  title={dealer.guaranteeTitle ?? ""}
                  body={dealer.guaranteeBody ?? ""}
                  infoAria={uiCopy.dealerRefundInfoAria}
                />
              </div>

              {business.foot ? <p className={`mt-4 ${FOOT_CLASS}`}>{business.foot}</p> : <div />}
              <div />

              {showCta ? <PackageCta plan="business" /> : null}
              {showCta ? <PackageCta plan="dealer" /> : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}


