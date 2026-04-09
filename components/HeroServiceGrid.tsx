import { AlertTriangle, Globe2, Headphones, ScanSearch } from "lucide-react";

export type HeroServiceItem = {
  title: string;
  body: string;
};

/**
 * Tās pašas Lucide ikonas kā līdz šim (Pricing 9-bloku atbilstība):
 * Globe2, ScanSearch, AlertTriangle, Headphones.
 */
const HERO_SVC_ICONS = [Globe2, ScanSearch, AlertTriangle, Headphones] as const;

const iconInCircleClass =
  "h-[1.2rem] w-[1.2rem] shrink-0 text-[#0061D2] sm:h-5 sm:w-5 [stroke-width:1.5]";

/**
 * Hero: viena kolonna, 4 horizontāli bloki — balts, rounded-[2rem], maiga ēna;
 * ikona gaiši zilā aplī, teksts pa labi, pa kreisi.
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
    <div className="mx-auto w-full max-w-[min(100%,440px)] rounded-[2rem] bg-[#ececf0] p-3 sm:p-3.5">
      <ul className="flex list-none flex-col gap-2.5 sm:gap-3">
        {rows.map(({ item, index }) => {
          const Icon = HERO_SVC_ICONS[index] ?? Globe2;
          return (
            <li key={`hero-svc-${index}`} className="min-w-0">
              <article className="flex flex-row items-start gap-3 rounded-[2rem] bg-white px-4 py-3.5 text-left shadow-sm sm:gap-4 sm:px-5 sm:py-4">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8f1fc] sm:h-10 sm:w-10"
                  aria-hidden
                >
                  <Icon className={iconInCircleClass} aria-hidden strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 className="text-[13px] font-semibold leading-snug tracking-tight text-[#1d1d1f] sm:text-[15px] sm:font-medium">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-[11px] font-normal leading-relaxed text-[#6e6e73] sm:text-[12px]">
                    {item.body}
                  </p>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
