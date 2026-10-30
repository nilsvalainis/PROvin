import type { ListingSpecCell } from "@/lib/iriss-listings-card";

export function IrissListingCardSpecGrid({
  specs,
  layout = "list",
}: {
  specs: ListingSpecCell[];
  layout?: "list" | "grid";
}) {
  if (specs.length === 0) return null;
  const grid = layout === "grid";
  return (
    <div
      className={
        grid
          ? "grid grid-cols-2 gap-x-4 gap-y-2"
          : "grid grid-cols-3 gap-x-3 gap-y-2 border-y-0 py-0 sm:grid-cols-[repeat(auto-fill,minmax(6.75rem,1fr))] sm:border-y sm:border-dashed sm:border-[var(--iriss-line)] sm:py-2"
      }
    >
      {specs.map((c) => (
        <div key={c.label} className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{c.label}</div>
          <div className="break-words text-[13px] font-semibold tabular-nums text-[var(--color-apple-text)]">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
