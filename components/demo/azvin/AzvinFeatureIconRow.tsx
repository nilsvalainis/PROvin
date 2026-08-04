"use client";

import { Flag, Gavel, Globe2, Store } from "lucide-react";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import azvinStyles from "@/app/[locale]/demo/azvin/azvin.module.css";
import {
  AZVIN_ICON_IDS,
  type AzvinHeroCopy,
  type AzvinIconId,
} from "@/lib/azvin-hero-copy";

const ICON_BTN_BASE =
  "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] text-zinc-300 opacity-75 shadow-[0_0_12px_rgba(37,99,235,0.08)] transition-all duration-300 will-change-[transform,box-shadow,border-color,color] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]";

const ICON_BTN_HOVER =
  "hover:scale-105 hover:border-[#2563EB] hover:text-[#2563EB] hover:opacity-100 hover:shadow-[0_0_20px_rgba(37,99,235,0.25)]";

const LUCIDE_ICON_CLASS = "h-6 w-6 [stroke-width:1.6]";

function IconGlyph({ id }: { id: AzvinIconId }) {
  switch (id) {
    case "koreaUsa":
      return <Flag className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "europe":
      return <Globe2 className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "auction":
      return <Gavel className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "dealer":
      return <Store className={LUCIDE_ICON_CLASS} aria-hidden />;
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
  copy: AzvinHeroCopy;
  /** Show on mobile too (PROVIN desktop-only row uses CSS hide). */
  forceVisible?: boolean;
};

export function AzvinFeatureIconRow({ copy, forceVisible = false }: Props) {
  return (
    <div
      className={
        forceVisible
          ? `${styles.tp5DesktopFeatureRow} ${azvinStyles.iconRowAlways}`
          : styles.tp5DesktopFeatureRow
      }
    >
      <DiagnosticScanLine variant="rail" motion="sweepLtr" className="w-full" />
      <ul
        className="mt-8 flex w-full list-none items-center justify-between gap-1"
        aria-label={copy.iconRowAria}
      >
        {AZVIN_ICON_IDS.map((id) => {
          const label = copy.icons[id];
          return (
            <li key={id} className="flex shrink-0">
              <button
                type="button"
                className={`group relative ${ICON_BTN_BASE} ${ICON_BTN_HOVER}`}
                aria-label={label}
              >
                <FeatureTooltip label={label} />
                <IconGlyph id={id} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
