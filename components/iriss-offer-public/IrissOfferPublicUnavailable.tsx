import { IRISS_OFFER_PUBLIC_BRAND, IRISS_OFFER_PUBLIC_LABELS, IRISS_OFFER_PUBLIC_LEGAL } from "@/lib/iriss-offer-client-link";

export function IrissOfferPublicUnavailable() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16 text-center">
      <p className="text-[13px] font-semibold tracking-[0.12em] text-[#9a3412]">{IRISS_OFFER_PUBLIC_BRAND}</p>
      <h1 className="mt-6 text-[26px] font-semibold tracking-tight">{IRISS_OFFER_PUBLIC_LABELS.unavailableTitle}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[#6e6e73]">{IRISS_OFFER_PUBLIC_LABELS.unavailableBody}</p>
      <p className="mt-8 text-[10px] leading-relaxed text-[#c7c7cc]">
        {IRISS_OFFER_PUBLIC_BRAND}
        <br />
        {IRISS_OFFER_PUBLIC_LEGAL}
      </p>
    </main>
  );
}
