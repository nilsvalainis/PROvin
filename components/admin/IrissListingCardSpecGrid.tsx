import type { ListingSpecCell } from "@/lib/iriss-listings-card";

export function IrissListingCardSpecGrid({ specs }: { specs: ListingSpecCell[] }) {
  if (specs.length === 0) return null;
  return (
    <div className="grid grid-cols-3 gap-2 border-y-0 py-0 sm:grid-cols-5 sm:border-y sm:border-dashed sm:border-[#E5E7EB] sm:py-2">
      {specs.map((c) => (
        <div key={c.label}>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{c.label}</div>
          <div className="text-[13px] font-semibold tabular-nums text-[var(--color-apple-text)]">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
