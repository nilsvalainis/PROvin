"use client";

import {
  ClipboardCheck,
  Dna,
  Globe2,
  Search,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import {
  TP5_DESKTOP_HERO_FEATURES,
  type Tp5DesktopHeroFeatureIcon,
} from "@/lib/test-pricing-5-desktop-hero-features";

const ICON_BTN_BASE =
  "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] text-gray-500 opacity-60 shadow-none scale-100 transition-all duration-300 will-change-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]";

const ICON_BTN_HOVER =
  "hover:scale-105 hover:border-[#2563EB]/40 hover:text-[#2563EB] hover:opacity-100 hover:shadow-[0_0_20px_rgba(37,99,235,0.25)]";

const LUCIDE_ICON_CLASS = "h-6 w-6 [stroke-width:1.6]";

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
        <span className="text-[0.7rem] font-bold tracking-tight" aria-hidden>
          CV
        </span>
      );
    case "autodna":
      return <Dna className={LUCIDE_ICON_CLASS} aria-hidden />;
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
      className="pointer-events-none absolute bottom-[calc(100%+0.55rem)] left-1/2 z-20 w-max max-w-[14rem] -translate-x-1/2 translate-y-1 text-center text-xs font-medium tracking-wide text-zinc-300 opacity-0 transition-all duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
    >
      {label}
    </span>
  );
}

export function Tp5DesktopFeatureIconRow() {
  return (
    <div className="hidden w-full lg:block lg:mt-16">
      <DiagnosticScanLine variant="rail" motion="sweepLtr" className="w-full" />
      <ul
        className="mt-8 flex w-full list-none items-center justify-between gap-1"
        aria-label="PROVIN audita pakalpojumu priekšrocības"
      >
        {TP5_DESKTOP_HERO_FEATURES.map((feature) => (
          <li key={feature.label} className="flex shrink-0">
            <button
              type="button"
              className={`group relative ${ICON_BTN_BASE} ${ICON_BTN_HOVER}`}
              aria-label={feature.label}
            >
              <FeatureTooltip label={feature.label} />
              <FeatureIconGlyph icon={feature.icon} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
