import type { Metadata } from "next";
import { B2bPartnerHero } from "@/components/b2b/B2bPartnerHero";
import { B2bPartnerResetPassword } from "@/components/b2b/B2bPartnerResetPassword";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PROVIN partneru parole",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "PROVIN", statusBarStyle: "black-translucent" },
};

type Props = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function PartnerPasswordResetPage({ searchParams }: Props) {
  const raw = await searchParams;
  const token = typeof raw.token === "string" ? raw.token.trim() : "";

  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <div className="home-hero-pricing-unified demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
        <B2bPartnerHero hideContact widePanel panel={<B2bPartnerResetPassword token={token} />} />
      </div>
    </div>
  );
}
