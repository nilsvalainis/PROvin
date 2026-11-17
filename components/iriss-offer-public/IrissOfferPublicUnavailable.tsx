import { IRISS_OFFER_PUBLIC_BRAND, IRISS_OFFER_PUBLIC_LABELS } from "@/lib/iriss-offer-client-link";

export function IrissOfferPublicUnavailable({
  title = IRISS_OFFER_PUBLIC_LABELS.unavailableTitle,
  body = IRISS_OFFER_PUBLIC_LABELS.unavailableBody,
}: {
  title?: string;
  body?: string;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16 text-center">
      <p className="text-[13px] font-semibold tracking-[0.12em] text-[#9a3412]">{IRISS_OFFER_PUBLIC_BRAND}</p>
      <h1 className="mt-6 text-[26px] font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[#6e6e73]">{body}</p>
      <p className="mt-8 text-[10px] leading-relaxed text-[#c7c7cc]">
        {IRISS_OFFER_PUBLIC_BRAND}
      </p>
    </main>
  );
}
