import { AlertTriangle, Globe2, Headphones, ScanSearch } from "lucide-react";

export type HeroServiceItem = {
  title: string;
  body: string;
};

/**
 * Tās pašas Lucide ikonas kā Pricing 9-bloku režģim:
 * Globe2, ScanSearch, AlertTriangle, Headphones.
 */
const HERO_SVC_ICONS = [Globe2, ScanSearch, AlertTriangle, Headphones] as const;

/** 1:1 ar `PricingIncluded` — outline, bez apļa fona. */
const heroSvcIconClass =
  "h-8 w-8 shrink-0 text-[#0061D2] [stroke-width:1.5] sm:h-[32px] sm:w-[32px]";

/** 1:1 ar `PricingIncluded` pillarRowClass (caurspīdīgs, rounded-xl, tā pati ēna). */
const heroSvcPillarClass =
  "provin-lift-subtle flex min-h-0 gap-3 rounded-xl border-0 bg-transparent p-3.5 text-left shadow-[0_2px_22px_rgba(15,23,42,0.055)] sm:gap-3.5 sm:p-4";

/**
 * Hero: 4 horizontāli bloki viena zem otra, pilnā platumā, bez pelēka apvalka —
 * tieši uz lapas fona, stils kā 9-bloku režģa kartītēm.
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
    <ul className="mx-auto flex w-full min-w-0 max-w-full list-none flex-col gap-3">
      {rows.map(({ item, index }) => {
        const Icon = HERO_SVC_ICONS[index] ?? Globe2;
        return (
          <li key={`hero-svc-${index}`} className={`${heroSvcPillarClass} min-w-0`}>
            <Icon className={heroSvcIconClass} aria-hidden strokeWidth={1.5} />
            <div className="min-w-0 flex-1 pt-0.5">
              <h3 className="text-[15px] font-medium leading-snug tracking-tight text-[#1d1d1f] sm:text-[16px]">
                {item.title}
              </h3>
              <p className="mt-1 text-[12px] font-normal leading-relaxed text-[#86868b] sm:text-[13px] sm:leading-relaxed">
                {item.body}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
