"use client";

import {
  ClipboardCheck,
  Globe2,
  Search,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale } from "next-intl";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import {
  getTp5DesktopHeroFeatures,
  type Tp5DesktopHeroFeatureIcon,
} from "@/lib/test-pricing-5-desktop-hero-features";
import {
  TP5_DEALER_BRAND_DARK_PLATE,
  TP5_DEALER_BRAND_LOGO_SRC,
  TP5_DEALER_BRANDS,
  type Tp5MobileServiceId,
} from "@/lib/test-pricing-5-mobile";
import { getTp5UiCopy } from "@/lib/test-pricing-5-ui-copy";

const ICON_BTN_BASE =
  "relative flex shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] text-zinc-300 opacity-75 shadow-[0_0_12px_rgba(37,99,235,0.08)] transition-all duration-300 will-change-[transform,box-shadow,border-color,color] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]";

const ICON_BTN_FEATURE = `${ICON_BTN_BASE} h-14 w-14`;

const ICON_BTN_BRAND = `${ICON_BTN_BASE} h-11 w-11 xl:h-12 xl:w-12`;

const ICON_BTN_HOVER =
  "hover:scale-105 hover:border-[#2563EB] hover:text-[#2563EB] hover:opacity-100 hover:shadow-[0_0_20px_rgba(37,99,235,0.25)]";

const LUCIDE_ICON_CLASS = "h-6 w-6 [stroke-width:1.6]";

const BRAND_LOGO_CLASS =
  "h-6 w-6 shrink-0 object-contain opacity-60 grayscale transition-all duration-300 group-hover:opacity-100 group-hover:grayscale-0";

const DEALER_LOGO_CLASS =
  "h-5 w-5 shrink-0 object-contain opacity-80 transition-all duration-300 group-hover:opacity-100 group-hover:scale-105 xl:h-6 xl:w-6";

const SWAP_TRANSITION = { duration: 0.28, ease: [0.4, 0, 0.2, 1] as const };

function brandIdleClass(icon: Tp5DesktopHeroFeatureIcon): string | undefined {
  if (icon === "carvertical") return styles.brandIconIdleCarVertical;
  if (icon === "autodna") return styles.brandIconIdleAutoDna;
  return undefined;
}

function FeatureIconGlyph({ icon }: { icon: Tp5DesktopHeroFeatureIcon }) {
  switch (icon) {
    case "consultation":
      return <Users className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "listing-analysis":
      return <Search className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "eu-registry":
      return <ShieldCheck className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "inspection-tips":
      return <ClipboardCheck className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "carvertical":
      return (
        <Image
          src="/brand/carvertical-logo.png"
          alt=""
          width={24}
          height={24}
          className={`${BRAND_LOGO_CLASS} ${styles.brandLogoIdleCarVertical}`}
          aria-hidden
        />
      );
    case "autodna":
      return (
        <Image
          src="/brand/autodna-logo.png"
          alt=""
          width={24}
          height={24}
          className={`${BRAND_LOGO_CLASS} ${styles.brandLogoIdleAutoDna}`}
          aria-hidden
        />
      );
    case "dealer-data":
      return <Store className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "international":
      return <Globe2 className={LUCIDE_ICON_CLASS} aria-hidden />;
    default:
      return null;
  }
}

function FeatureTooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-[calc(100%+0.55rem)] left-1/2 z-20 w-max max-w-[14rem] -translate-x-1/2 translate-y-1 text-center text-xs font-medium tracking-wide text-gray-300 opacity-0 transition-all duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
    >
      {label}
    </span>
  );
}

type Props = {
  /** Desktop pricing card active tier — dealer swaps the rail to manufacturer logos. */
  activeServiceId?: Tp5MobileServiceId;
};

export function Tp5DesktopFeatureIconRow({ activeServiceId = "audits" }: Props) {
  const locale = useLocale();
  const features = getTp5DesktopHeroFeatures(locale, activeServiceId);
  const uiCopy = getTp5UiCopy(locale);
  const showDealerBrands = activeServiceId === "dealer";

  return (
    <div className={styles.tp5DesktopFeatureRow}>
      <DiagnosticScanLine variant="rail" motion="sweepLtr" className="w-full" />
      <div className="relative mt-8 min-h-[7.5rem] w-full">
        <AnimatePresence mode="wait" initial={false}>
          {showDealerBrands ? (
            <motion.ul
              key="dealer-brands"
              className="absolute inset-x-0 top-0 grid w-full list-none grid-cols-8 gap-x-1 gap-y-2.5 xl:gap-y-3"
              aria-label={uiCopy.dealerBrandsAria}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={SWAP_TRANSITION}
            >
              {TP5_DEALER_BRANDS.map((brand) => {
                const src = TP5_DEALER_BRAND_LOGO_SRC[brand];
                const darkPlate = TP5_DEALER_BRAND_DARK_PLATE.has(brand);
                return (
                  <li key={brand} className="flex justify-center">
                    <button
                      type="button"
                      className={`group relative ${ICON_BTN_BRAND} ${ICON_BTN_HOVER}`}
                      aria-label={brand}
                    >
                      <FeatureTooltip label={brand} />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt=""
                        className={`${DEALER_LOGO_CLASS}${darkPlate ? ` ${styles.dealerInlineBrandLogoDarkPlate}` : ""}`}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        aria-hidden
                      />
                    </button>
                  </li>
                );
              })}
            </motion.ul>
          ) : (
            <motion.ul
              key={`features-${activeServiceId}`}
              className="absolute inset-x-0 top-0 flex w-full list-none items-center justify-between gap-1"
              aria-label={uiCopy.featureIconRowAria}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={SWAP_TRANSITION}
            >
              {features.map((feature) => {
                const idlePulse = brandIdleClass(feature.icon);
                return (
                  <li key={feature.icon} className="flex shrink-0">
                    <button
                      type="button"
                      className={`group relative ${ICON_BTN_FEATURE} ${ICON_BTN_HOVER}${idlePulse ? ` ${idlePulse}` : ""}`}
                      aria-label={feature.label}
                    >
                      <FeatureTooltip label={feature.label} />
                      <FeatureIconGlyph icon={feature.icon} />
                    </button>
                  </li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
