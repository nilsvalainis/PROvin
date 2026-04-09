import { AlertTriangle, Globe2, Headphones, ScanSearch } from "lucide-react";

export type HeroServiceItem = {
  title: string;
  body: string;
};

/**
 * Tās pašas Lucide ikonas kā Pricing 9-bloku režģī:
 * Starptautiskās datubāzes, Sludinājuma audits, Tehnisko risku analīze, Papildu konsultācija.
 */
const HERO_SVC_ICONS = [Globe2, ScanSearch, AlertTriangle, Headphones] as const;

/** Pricing `iconClass` ir 32px (h-8); +20% ≈ 38.4px → 2.4rem */
const heroSvcIconClass =
  "h-[2.4rem] w-[2.4rem] shrink-0 text-[#0061D2] [stroke-width:1.5] sm:h-[2.4rem] sm:w-[2.4rem]";

/** 1:1 ar `PricingIncluded` pillarRowClass — caurspīdīgs, tā pati ēna/apmale (border-0). */
const heroSvcCardClass =
  "provin-lift-subtle flex min-h-0 gap-3 rounded-xl border-0 bg-transparent p-3.5 text-left shadow-[0_2px_22px_rgba(15,23,42,0.055)] sm:gap-3.5 sm:p-4";

/**
 * Hero: 2×2 režģis (mobile + desktop), vizuāli kā „Kas iekļauts auditā?” 9 bloku kartītes.
 */
export function HeroServiceGrid({ items }: { items: HeroServiceItem[] }) {
  const [a, b, c, d] = items;
  if (!a || !b || !c || !d) return null;
  const rows = [
    { item: a, index: 0 as const },
    { item: b, index: 1 as const },
    { item: c, index: 2 as const },
    { item: d, index: 3 as const },
  ];

  return (
    <ul className="mx-auto grid w-full max-w-[min(100%,34rem)] list-none grid-cols-2 gap-3">
      {rows.map(({ item, index }) => {
        const Icon = HERO_SVC_ICONS[index] ?? Globe2;
        return (
          <li key={`hero-svc-${index}`} className="min-w-0">
            <article className={`${heroSvcCardClass} h-full items-start`}>
              <Icon className={heroSvcIconClass} aria-hidden strokeWidth={1.5} />
              <div className="min-w-0 flex-1 pt-0.5">
                <h3 className="text-[15px] font-medium leading-snug tracking-tight text-[#1d1d1f] sm:text-[16px]">
                  {item.title}
                </h3>
                <p className="mt-1 text-[12px] font-normal leading-relaxed text-[#86868b] sm:text-[13px] sm:leading-relaxed">
                  {item.body}
                </p>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
