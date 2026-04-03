import { Suspense } from "react";
import { OrderSection } from "@/components/OrderSection";

function OrderSectionFallback() {
  return (
    <section className="min-h-[420px] scroll-mt-[calc(2.75rem+1px)] overflow-hidden border-b border-black/[0.06] bg-[#f7f8fa] sm:scroll-mt-12">
      <div className="mx-auto min-w-0 max-w-[692px] animate-pulse px-4 py-12 text-center sm:px-6">
        <div className="mx-auto h-4 w-40 rounded bg-[#e8e8ed]" />
        <div className="mx-auto mt-8 h-12 max-w-[200px] rounded-lg bg-[#ececf0]" />
        <div className="mx-auto mt-10 max-w-[560px] space-y-3">
          <div className="h-11 rounded-xl bg-white/80" />
          <div className="h-11 rounded-xl bg-white/80" />
        </div>
      </div>
    </section>
  );
}

export function FinalCta({ cancelled }: { cancelled: boolean }) {
  return (
    <Suspense fallback={<OrderSectionFallback />}>
      <OrderSection cancelled={cancelled} />
    </Suspense>
  );
}
