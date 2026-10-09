import { listingTaxLabel, listingTaxTooltip, type ListingTax } from "@/lib/iriss-listings-vat";

export function IrissListTaxBadge({ tax, size = "md" }: { tax: ListingTax; size?: "sm" | "md" }) {
  const title = listingTaxTooltip(tax);
  const warn = Boolean(tax.flag);
  if (tax.kind === "margin") {
    const sizeCls = size === "sm" ? "px-1 py-px text-[9px]" : "px-1.5 py-0.5 text-[10px] sm:text-[11px]";
    return (
      <span
        className={`inline-flex items-center gap-0.5 rounded border border-slate-300/90 bg-slate-50 font-medium leading-none text-slate-500 ${sizeCls}`}
        title={title}
      >
        {listingTaxLabel(tax)}
        {warn ? <span aria-label="PVN brīdinājums">⚠</span> : null}
        {tax.manual ? <span className="font-normal text-slate-400">(manuāli)</span> : null}
      </span>
    );
  }
  const cls =
    tax.kind === "net"
      ? "text-blue-900 bg-blue-100 border-blue-300"
      : "text-orange-950 bg-orange-100 border-orange-300";
  const sizeCls = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[13px] sm:text-[14px]";
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-md border font-extrabold leading-none ${sizeCls} ${cls}`} title={title}>
      {listingTaxLabel(tax)}
      {warn ? <span aria-label="PVN brīdinājums">⚠</span> : null}
      {tax.manual ? <span className="text-[10px] font-semibold">(manuāli)</span> : null}
    </span>
  );
}
