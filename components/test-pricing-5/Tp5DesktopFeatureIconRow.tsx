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
import { useLocale } from "next-intl";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import {
  getTp5DesktopHeroFeatures,
  type Tp5DesktopHeroFeatureIcon,
} from "@/lib/test-pricing-5-desktop-hero-features";
import { getTp5UiCopy } from "@/lib/test-pricing-5-ui-copy";

const ICON_BTN_BASE =
  "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] text-zinc-300 opacity-75 shadow-[0_0_12px_rgba(37,99,235,0.08)] transition-all duration-300 will-change-[transform,box-shadow,border-color,color] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]";

const ICON_BTN_HOVER =
  "hover:scale-105 hover:border-[#2563EB] hover:text-[#2563EB] hover:opacity-100 hover:shadow-[0_0_20px_rgba(37,99,235,0.25)]";

const LUCIDE_ICON_CLASS = "h-6 w-6 [stroke-width:1.6]";

const BRAND_LOGO_CLASS =
  "h-6 w-6 shrink-0 object-contain opacity-60 grayscale transition-all duration-300 group-hover:opacity-100 group-hover:grayscale-0";

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

export function Tp5DesktopFeatureIconRow() {
  const locale = useLocale();
  const features = getTp5DesktopHeroFeatures(locale);
  const uiCopy = getTp5UiCopy(locale);

  return (
    <div className={styles.tp5DesktopFeatureRow}>
      <DiagnosticScanLine variant="rail" motion="sweepLtr" className="w-full" />
      <ul
        className="mt-8 flex w-full list-none items-center justify-between gap-1"
        aria-label={uiCopy.featureIconRowAria}
      >
        {features.map((feature) => {
          const idlePulse = brandIdleClass(feature.icon);
          return (
            <li key={feature.label} className="flex shrink-0">
              <button
                type="button"
                className={`group relative ${ICON_BTN_BASE} ${ICON_BTN_HOVER}${idlePulse ? ` ${idlePulse}` : ""}`}
                aria-label={feature.label}
              >
                <FeatureTooltip label={feature.label} />
                <FeatureIconGlyph icon={feature.icon} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
