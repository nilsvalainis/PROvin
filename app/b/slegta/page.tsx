import type { Metadata } from "next";
import { Lock } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PROVIN BUSINESS",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

/** Partnera saite atvērta ne no partnera sludinājuma. Dizains: docs/makets-business-poga/GALA-lapa.md. */
export default function BusinessLinkClosedPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-[#09090b] px-4 text-[#f4f4f5] antialiased">
      <p className="mx-auto w-full max-w-[1120px] py-6 text-[22px] font-extrabold tracking-[-0.035em]">
        PRO<span className="text-[#5c9dff]">VIN</span>
      </p>
      <div className="flex flex-1 items-center justify-center pb-24">
        <div className="w-full max-w-[460px] rounded-3xl border border-white/[0.12] bg-[linear-gradient(160deg,rgba(255,255,255,.07),rgba(255,255,255,.02))] px-7 py-10 text-center">
          <span className="mx-auto grid h-[52px] w-[52px] place-items-center rounded-2xl border border-white/[0.12] bg-white/[0.06]">
            <Lock className="h-[22px] w-[22px] text-[#d4d4d8]" aria-hidden />
          </span>
          <h1 className="mt-5 text-[26px] font-extrabold tracking-[-0.03em]">Saite nav pieejama</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#a1a1aa]">
            Šī lapa atveras tikai no PROVIN partnera auto sludinājuma. Atveriet auto sludinājumu partnera vietnē un
            spiediet PROVIN pogu vēlreiz.
          </p>
          <Link
            href="/lv"
            className="mt-6 inline-flex h-[46px] items-center rounded-full border border-white/20 px-5 text-[14px] font-semibold"
          >
            Uz provin.lv
          </Link>
        </div>
      </div>
    </main>
  );
}
