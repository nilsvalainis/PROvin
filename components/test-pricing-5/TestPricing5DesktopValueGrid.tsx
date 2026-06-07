import { TP5_DESKTOP_VALUE_BLOCKS } from "@/lib/test-pricing-5-desktop-value-blocks";

/** Renders only on `lg:`+ — hidden on mobile/tablet. */
export function TestPricing5DesktopValueGrid() {
  return (
    <ul
      className="m-0 hidden list-none p-0 lg:mt-10 lg:grid lg:grid-cols-2 lg:gap-6 xl:grid-cols-3"
      aria-label="PROVIN audita pamatvērtības"
    >
      {TP5_DESKTOP_VALUE_BLOCKS.map(({ title, Icon }) => (
        <li key={title} className="flex min-w-0 items-center gap-3">
          <Icon
            className="h-6 w-6 shrink-0 text-[#2563EB] [stroke-width:1.5]"
            aria-hidden
            strokeWidth={1.5}
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-200">
            {title}
          </span>
        </li>
      ))}
    </ul>
  );
}
