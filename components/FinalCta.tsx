import { Suspense } from "react";
import { OrderSection } from "@/components/OrderSection";

function OrderSectionFallback() {
  return (
    <div className="relative z-10 min-h-[420px] scroll-mt-[calc(2.75rem+1px)] py-12 sm:scroll-mt-12">
      <div className="demo-design-dir__shell mx-auto min-w-0 max-w-[692px] animate-pulse text-center">
        <div className="mx-auto h-4 w-40 rounded bg-black/[0.06]" />
        <div className="mx-auto mt-8 h-12 max-w-[200px] rounded-lg bg-black/[0.05]" />
        <div className="mx-auto mt-10 max-w-[560px] space-y-3">
          <div className="h-11 rounded-xl bg-white/80 shadow-sm" />
          <div className="h-11 rounded-xl bg-white/80 shadow-sm" />
        </div>
      </div>
    </div>
  );
}

export function FinalCta({
  cancelled,
  orderEmbedded = false,
}: {
  cancelled: boolean;
  orderEmbedded?: boolean;
}) {
  return (
    <Suspense fallback={<OrderSectionFallback />}>
      <OrderSection cancelled={cancelled} embedded={orderEmbedded} />
    </Suspense>
  );
}
