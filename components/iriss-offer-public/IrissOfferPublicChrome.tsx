import type { ReactNode } from "react";
import { DzintarzemeOfferBrandLogo } from "@/components/iriss-offer-public/DzintarzemeOfferBrandLogo";
import { IRISS_OFFER_PUBLIC_BRAND, IRISS_OFFER_PUBLIC_LEGAL } from "@/lib/iriss-offer-client-link";

export function irissOfferPublicCardClass(extra = "") {
  return `mt-3.5 rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${extra}`.trim();
}

export function IrissOfferPublicSectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525b]">{children}</h2>;
}

export function IrissOfferPublicSpecCell({
  label,
  value,
  className = "",
  valueClassName = "",
}: {
  label: string;
  value: string;
  className?: string;
  valueClassName?: string;
}) {
  if (!value.trim()) return null;
  return (
    <div className={`rounded-xl border border-[#e4e4e7] bg-[#fafafa] p-2.5 ${className}`.trim()}>
      <b className="block text-[10px] font-medium text-[#52525b]">{label}</b>
      <span className={`mt-1 block text-[13px] font-semibold leading-snug text-[#111827] ${valueClassName}`.trim()}>
        {value}
      </span>
    </div>
  );
}

export function IrissOfferPublicKvRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  if (!value.trim()) return null;
  return (
    <div
      className={`flex items-baseline justify-between gap-3 border-b border-[#e4e4e7] py-2.5 text-[14px] last:border-0 ${
        strong ? "border-0 pt-1 text-[16px] font-bold" : ""
      }`}
    >
      <span className={strong ? "text-[#111827]" : "text-[#52525b]"}>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

export function IrissOfferPublicBrandHeader() {
  return (
    <div className="flex items-start justify-between gap-3">
      <DzintarzemeOfferBrandLogo />
      <p className="text-right text-[11px] leading-tight text-[#6e6e73]">
        {IRISS_OFFER_PUBLIC_BRAND}
        <br />
        {IRISS_OFFER_PUBLIC_LEGAL}
      </p>
    </div>
  );
}

export function IrissOfferPublicFooter({ pathHint }: { pathHint?: string }) {
  return (
    <footer className="mt-6 text-center text-[10px] leading-relaxed text-[#a1a1aa]">
      <p>
        {IRISS_OFFER_PUBLIC_BRAND} · {IRISS_OFFER_PUBLIC_LEGAL}
      </p>
      {pathHint ? <p className="mt-0.5 truncate">{pathHint}</p> : null}
    </footer>
  );
}

export function IrissOfferPublicShell({
  children,
  embedded = false,
}: {
  children: ReactNode;
  /** Admina priekšskatījumā: bez pilna ekrāna augstuma. */
  embedded?: boolean;
}) {
  const Tag = embedded ? "div" : "main";
  return (
    <Tag
      className={`w-full max-w-[720px] text-[#111827] ${
        embedded ? "mx-auto px-0 pb-2 pt-1" : "mx-auto min-h-dvh px-4 pb-10 pt-7 sm:px-7"
      }`}
    >
      {children}
    </Tag>
  );
}
