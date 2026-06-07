import { TP5_DESKTOP_VALUE_BLOCKS } from "@/lib/test-pricing-5-desktop-value-blocks";

/** Renders only on `lg:`+ — hidden on mobile/tablet. */
export function TestPricing5DesktopValueGrid() {
  return (
    <ul
      className="m-0 hidden list-none p-0 lg:mt-12 lg:grid lg:grid-cols-2 lg:gap-x-12 lg:gap-y-10 lg:pb-2"
      aria-label="PROVIN audita pamatvērtības"
    >
      {TP5_DESKTOP_VALUE_BLOCKS.map(({ title, description, Icon }) => (
        <li key={title} className="flex min-w-0 lg:items-start lg:gap-4">
          <Icon
            className="lg:h-6 lg:w-6 shrink-0 text-[#2563EB] [stroke-width:1.5]"
            aria-hidden
            strokeWidth={1.5}
          />
          <div className="min-w-0 flex-1">
            <p className="lg:text-sm lg:font-bold lg:uppercase lg:tracking-wider lg:text-white">
              {title}
            </p>
            <p className="lg:mt-1 lg:text-xs lg:leading-relaxed lg:text-gray-400">{description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
