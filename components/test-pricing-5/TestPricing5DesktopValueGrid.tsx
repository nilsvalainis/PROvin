import { TP5_DESKTOP_VALUE_BLOCKS } from "@/lib/test-pricing-5-desktop-value-blocks";

/** Renders only on `lg:`+ — borderless 3×2 icon grid for the desktop hero left column. */
export function TestPricing5DesktopValueGrid() {
  return (
    <ul
      className="m-0 hidden list-none p-0 lg:mt-12 lg:grid lg:grid-cols-3 lg:gap-x-6 lg:gap-y-8"
      aria-label="PROVIN audita pamatvērtības"
    >
      {TP5_DESKTOP_VALUE_BLOCKS.map(({ title, Icon }) => (
        <li key={title} className="flex min-w-0 flex-col gap-2">
          <Icon className="h-5 w-5 shrink-0 text-[#2563EB]" aria-hidden strokeWidth={1.5} />
          <span className="text-xs font-bold uppercase leading-snug tracking-wider text-white">
            {title}
          </span>
        </li>
      ))}
    </ul>
  );
}
