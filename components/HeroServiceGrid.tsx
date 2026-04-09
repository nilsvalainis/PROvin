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

const heroSvcIconClass =
  "h-8 w-8 shrink-0 text-[#0061D2] [stroke-width:1.5] sm:h-[32px] sm:w-[32px]";

/** Kartīte: spēcīgāka ēna (≈2×), bez kreisās malas rāmja; bez provin-lift-subtle, lai nav CSS hover konflikta. */
const heroSvcCardClass =
  [
    "flex min-h-0 gap-3 rounded-xl border-0 bg-transparent py-3.5 px-4 text-left",
    "shadow-[0_4px_44px_rgba(15,23,42,0.11)] transition-[transform,box-shadow] duration-200 ease-out will-change-transform",
    "hover:scale-[1.01] hover:shadow-[0_10px_48px_rgba(15,23,42,0.15)]",
    "motion-reduce:hover:scale-100 motion-reduce:hover:shadow-[0_4px_44px_rgba(15,23,42,0.11)]",
    "sm:gap-3.5 sm:py-4 sm:px-5",
  ].join(" ");

const iconShellClass =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 sm:h-11 sm:w-11 sm:rounded-xl";

/**
 * Hero: 4 bloki vienā maigi zilā, noapaļotā apvalkā; sašaurināta kolonna, centrēta.
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
    <div className="mx-auto -mt-4 w-full max-w-[67.7376rem] rounded-[3rem] bg-blue-50/30 p-8 backdrop-blur-[1px] sm:-mt-5 sm:p-10 md:p-12">
      <ul className="mx-auto flex w-full min-w-0 max-w-[33.8688rem] list-none flex-col gap-3 sm:max-w-[38.1024rem]">
        {rows.map(({ item, index }) => {
          const Icon = HERO_SVC_ICONS[index] ?? Globe2;
          return (
            <li key={`hero-svc-${index}`} className={`${heroSvcCardClass} min-w-0`}>
              <div className={iconShellClass} aria-hidden>
                <Icon className={heroSvcIconClass} aria-hidden strokeWidth={1.5} />
              </div>
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
    </div>
  );
}
