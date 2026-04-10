"use client";

import {
  AlertTriangle,
  Building2,
  Globe2,
  Headphones,
  Scale,
  ScanSearch,
  Shield,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { SilverTiltFrame } from "@/components/home/SilverTiltFrame";

export type PricingGridItem = {
  title: string;
  body: string;
  href?: boolean;
};

const GRID_LUCIDE_ICONS: LucideIcon[] = [
  Globe2,
  Building2,
  Shield,
  ScanSearch,
  AlertTriangle,
  Sparkles,
  Scale,
  Headphones,
  ShieldCheck,
];

const iconClass =
  "h-8 w-8 shrink-0 text-[#60a5fa] [stroke-width:1.5] sm:h-[32px] sm:w-[32px]";

type PricingIncludedClientProps = {
  grid: PricingGridItem[];
  irissHref: string;
  irissLinkLabel: string;
};

export function PricingIncludedClient({ grid, irissHref, irissLinkLabel }: PricingIncludedClientProps) {
  return (
    <ul className="grid list-none grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-5">
      {grid.map((item, i) => {
        const Icon = GRID_LUCIDE_ICONS[i] ?? Globe2;
        const titleShimmer = item.title.toLowerCase().includes("iriss");
        const inner = (
          <>
            <Icon className={iconClass} aria-hidden strokeWidth={1.5} />
            <div className="min-w-0 flex-1 pt-0.5">
              <h3 className="text-[15px] font-medium leading-snug tracking-tight text-white sm:text-[16px]">
                {titleShimmer ? <span className="provin-chrome-shimmer">{item.title}</span> : item.title}
              </h3>
              <p className="mt-1 text-[12px] font-normal leading-relaxed text-[#b8bcc4] sm:text-[13px] sm:leading-relaxed">
                {item.body}
              </p>
              {item.href ? (
                <p className="mt-2 text-[11px] font-medium text-provin-accent sm:text-[12px]">
                  {irissLinkLabel} <span aria-hidden>↓</span>
                </p>
              ) : null}
            </div>
          </>
        );

        if (item.href) {
          return (
            <li key={item.title} className="min-w-0">
              <SilverTiltFrame className="h-full min-h-[100%]">
                <Link
                  href={irissHref}
                  className="provin-lift-subtle flex min-h-[100%] gap-3 p-3.5 text-left transition hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent sm:gap-3.5 sm:p-4"
                >
                  {inner}
                </Link>
              </SilverTiltFrame>
            </li>
          );
        }

        return (
          <li key={item.title} className="min-w-0">
            <SilverTiltFrame className="h-full">
              <div className="provin-lift-subtle flex min-h-0 gap-3 p-3.5 text-left sm:gap-3.5 sm:p-4">{inner}</div>
            </SilverTiltFrame>
          </li>
        );
      })}
    </ul>
  );
}
