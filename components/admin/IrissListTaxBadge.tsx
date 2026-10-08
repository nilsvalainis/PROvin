import { listingTaxLabel, type ListingTax } from "@/lib/iriss-listings-vat";

export function IrissListTaxBadge({ tax, size = "md" }: { tax: ListingTax; size?: "sm" | "md" }) {
  const cls =
    tax.kind === "net"
      ? "text-blue-900 bg-blue-100 border-blue-300"
      : tax.kind === "margin"
        ? "text-purple-900 bg-purple-100 border-purple-300"
        : tax.kind === "gross"
          ? "text-orange-950 bg-orange-100 border-orange-300"
          : "text-amber-900 bg-yellow-100 border-yellow-400 border-dashed";
  const sizeCls = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[13px] sm:text-[14px]";
  return (
    <span className={`inline-flex items-center rounded-md border font-extrabold leading-none ${sizeCls} ${cls}`} title={tax.raw}>
      {listingTaxLabel(tax)}
    </span>
  );
}
