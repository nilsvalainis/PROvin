import { TP5_DESKTOP_VALUE_BLOCKS } from "@/lib/test-pricing-5-desktop-value-blocks";

/** Renders only on `lg:`+ — borderless 2×3 grid, hidden on mobile/tablet. */
export function TestPricing5DesktopValueGrid() {
  return (
    <ul
      className="m-0 hidden list-none p-0 lg:mt-8 lg:grid lg:grid-cols-2 lg:gap-x-10 lg:gap-y-8"
      aria-label="PROVIN audita pamatvērtības"
    >
      {TP5_DESKTOP_VALUE_BLOCKS.map(({ titleLine1, titleLine2, Icon }) => (
        <li key={`${titleLine1}-${titleLine2}`} className="flex min-w-0 flex-col lg:gap-3.5">
          <Icon
            className="lg:h-9 lg:w-9 shrink-0 text-[#2563EB] xl:h-10 xl:w-10 [stroke-width:1.5]"
            aria-hidden
            strokeWidth={1.5}
          />
          <span className="lg:text-sm lg:font-bold lg:uppercase lg:leading-snug lg:tracking-wide lg:text-white">
            <span className="lg:block">{titleLine1}</span>
            <span className="lg:block">{titleLine2}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
