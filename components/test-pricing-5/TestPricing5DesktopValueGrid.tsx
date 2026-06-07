import { TP5_DESKTOP_VALUE_BLOCKS } from "@/lib/test-pricing-5-desktop-value-blocks";

/** Same Lucide treatment as homepage PROVIN AUDITS (`HomeServiceComparison`). */
const comparisonIconClass = "marketing-hero-pillar-icon shrink-0 [stroke-width:1.6]";

const blueCircleTone =
  "border-[#0066ff]/70 shadow-[0_0_0_1px_rgba(0,102,255,0.2),0_0_18px_rgba(0,102,255,0.14)]";

const redCircleTone =
  "border-[#ff342e]/70 shadow-[0_0_0_1px_rgba(255,52,46,0.2),0_0_18px_rgba(255,52,46,0.14)]";

const valueTitleClass =
  "lg:text-[12px] lg:font-semibold lg:uppercase lg:leading-snug lg:tracking-[0.06em] lg:text-white xl:text-sm xl:tracking-[0.07em]";

/** Renders only on `lg:`+ — borderless 3×2 grid, hidden on mobile/tablet. */
export function TestPricing5DesktopValueGrid() {
  return (
    <ul
      className="m-0 hidden list-none p-0 lg:mt-14 lg:grid lg:grid-cols-3 lg:gap-x-8 lg:gap-y-10"
      aria-label="PROVIN audita pamatvērtības"
    >
      {TP5_DESKTOP_VALUE_BLOCKS.map(({ titleLine1, titleLine2, Icon, riskCard }) => {
        const iconTone = riskCard
          ? "marketing-hero-pillar-icon--risk text-[#ff342e]"
          : "text-[#0066ff]";
        const circleTone = riskCard ? redCircleTone : blueCircleTone;

        return (
          <li key={`${titleLine1}-${titleLine2}`} className="flex min-w-0 flex-col lg:gap-3">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border bg-black ${circleTone}`}
            >
              <Icon
                className={`${comparisonIconClass} h-7 w-7 ${iconTone}`.trim()}
                aria-hidden
                strokeWidth={1.6}
              />
            </div>
            <span className={valueTitleClass}>
              <span className="lg:block">{titleLine1}</span>
              <span className="lg:block">{titleLine2}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
