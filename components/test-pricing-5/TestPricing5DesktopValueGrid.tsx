import { TP5_DESKTOP_VALUE_BLOCKS } from "@/lib/test-pricing-5-desktop-value-blocks";

/** Renders only on `lg:`+ — borderless 3×2 grid, hidden on mobile/tablet. */
export function TestPricing5DesktopValueGrid() {
  return (
    <ul
      className="m-0 hidden list-none p-0 lg:mt-12 lg:grid lg:grid-cols-3 lg:gap-x-8 lg:gap-y-10"
      aria-label="PROVIN audita pamatvērtības"
    >
      {TP5_DESKTOP_VALUE_BLOCKS.map(({ title, Icon }) => (
        <li key={title} className="flex min-w-0 flex-col lg:gap-2.5">
          <Icon
            className="lg:h-5 lg:w-5 shrink-0 text-[#2563EB] [stroke-width:1.5]"
            aria-hidden
            strokeWidth={1.5}
          />
          <span className="lg:text-xs lg:font-bold lg:uppercase lg:leading-snug lg:tracking-wider lg:text-white">
            {title}
          </span>
        </li>
      ))}
    </ul>
  );
}
