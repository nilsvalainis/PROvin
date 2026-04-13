import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ProductionLensVariants } from "@/components/demo/ProductionLensVariants";
import { routing } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Demo — lupas dizaina varianti",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LupaVariantsDemoPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-w-0 bg-[#030304] text-white">
      <div className="sticky z-[28] border-b border-white/[0.08] bg-[#030304]/92 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-[#030304]/78">
        <div className="mx-auto flex max-w-[min(72rem,calc(100vw-2rem))] flex-wrap items-center gap-3 px-4 sm:px-6">
          <Link
            href="/demo"
            className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/45 transition hover:text-[#7eb6ff]"
          >
            ← Demo studija
          </Link>
          <span className="text-[10px] text-white/25">|</span>
          <a href="#lupa-v1" className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/50 hover:text-white/80">
            V1–V4
          </a>
          <a href="#lupa-v5" className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/50 hover:text-white/80">
            V5–V8
          </a>
          <a href="#lupa-v9" className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/50 hover:text-white/80">
            V9–V10
          </a>
          <span className="text-[10px] text-white/25">|</span>
          <Link
            href="/demo/lens-variants"
            className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#7eb6ff]/80 hover:text-[#7eb6ff]"
          >
            Ģeometrijas demo
          </Link>
        </div>
      </div>
      <ProductionLensVariants />
    </div>
  );
}
