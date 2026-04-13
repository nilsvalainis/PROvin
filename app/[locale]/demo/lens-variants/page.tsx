import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { DemoStudioQuickLinksFollowUp } from "@/components/demo/DemoStudioQuickLinks";
import { Link } from "@/i18n/navigation";
import { LensVariantDemos } from "@/components/demo/LensVariantDemos";
import "@/components/demo/lens-variant-demos.css";
import { routing } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Demo — palielināmā stikla varianti",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LensVariantsDemoPage({ params }: PageProps) {
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
          <a href="#lens-demo-geometry" className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/50 hover:text-white/80">
            §1 Ģeometrija
          </a>
          <a href="#lens-demo-motion" className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/50 hover:text-white/80">
            §2 Kustība
          </a>
          <span className="text-[10px] text-white/25">|</span>
          <a href="#lens-demo-2d" className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#7eb6ff]/80 hover:text-[#7eb6ff]">
            2D silueti
          </a>
          <span className="text-[10px] text-white/25">|</span>
          <a href="#lens-demo-alternates" className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/50 hover:text-white/80">
            §5 Alt.
          </a>
          <a href="#lens-demo-visual" className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/50 hover:text-white/80">
            §3 Vizuāls
          </a>
          <a href="#lens-demo-a11y" className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/50 hover:text-white/80">
            §4 A11y
          </a>
        </div>
      </div>
      <DemoStudioQuickLinksFollowUp />
      <LensVariantDemos />
    </div>
  );
}
