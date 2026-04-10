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
  "h-8 w-8 shrink-0 text-[#6b7280] transition-colors group-hover:text-[#0061D2] [stroke-width:1.5] sm:h-[32px] sm:w-[32px]";

/** 2×2 režģis: feature card, pelēka ikona → zila hover; viegla ēna tikai hover. */
const heroSvcCardClass =
  [
    "group flex min-h-0 flex-row items-start gap-3 rounded-xl border border-[#e5e7eb] bg-white/95 p-4 text-left shadow-none",
    "transition-[box-shadow,transform] duration-200 ease-out",
    "hover:shadow-[0_12px_40px_rgba(15,23,42,0.07)]",
    "motion-reduce:hover:shadow-none",
    "sm:gap-3.5 sm:p-4",
  ].join(" ");

const iconShellClass =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f9fafb] transition-colors group-hover:bg-[#e8f2fc] sm:h-11 sm:w-11 sm:rounded-xl";

/**
 * Hero: 4 bloki 2×2 režģī; glass apvalks, balts / viegli caurspīdīgs.
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
    <div className="mx-auto -mt-4 w-full max-w-[42rem] rounded-[2rem] border border-[#e5e7eb] bg-white/85 p-5 backdrop-blur-[10px] sm:-mt-5 sm:p-7 md:max-w-[44rem] md:p-8">
      <ul className="mx-auto grid w-full grid-cols-1 list-none gap-3 sm:grid-cols-2 sm:gap-4">
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
