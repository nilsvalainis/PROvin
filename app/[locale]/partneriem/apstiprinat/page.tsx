import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { B2bPartnerHero } from "@/components/b2b/B2bPartnerHero";
import { B2bPartnerVerifyEmail } from "@/components/b2b/B2bPartnerVerifyEmail";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PROVIN partneru e-pasta apstiprinājums",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "PROVIN", statusBarStyle: "black-translucent" },
};

type Props = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function PartnerVerifyEmailPage({ searchParams }: Props) {
  const t = await getTranslations("Partner");
  const raw = await searchParams;
  const token = typeof raw.token === "string" ? raw.token.trim() : "";

  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <div className="home-hero-pricing-unified demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
        <B2bPartnerHero
          hideContact
          widePanel
          panel={
            <div className="flex w-full flex-col gap-3">
              <p className="text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-[#93c5fd]">
                {t("verifyPageTitle")}
              </p>
              <B2bPartnerVerifyEmail token={token} />
            </div>
          }
        />
      </div>
    </div>
  );
}
