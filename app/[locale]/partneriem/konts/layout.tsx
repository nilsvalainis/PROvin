import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Footer } from "@/components/Footer";
import { B2bPartnerAccountShell } from "@/components/b2b/B2bPartnerAccountShell";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { routing } from "@/i18n/routing";
import { resolveActiveB2bPartner } from "@/lib/b2b-partner-auth";

export const dynamic = "force-dynamic";

export default async function PartneriemAccountLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const partner = await resolveActiveB2bPartner();
  if (!partner) {
    const { locale: raw } = await params;
    const locale = routing.locales.includes(raw as (typeof routing.locales)[number])
      ? raw
      : routing.defaultLocale;
    redirect(`/${locale}/partneriem`);
  }

  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <div className="home-hero-pricing-unified demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
        <B2bPartnerAccountShell>{children}</B2bPartnerAccountShell>
        <div id="site-content" className="min-w-0 bg-transparent pb-0 text-white home-body-ink">
          <section className="demo-design-dir__section bg-transparent pb-0">
            <Footer />
          </section>
        </div>
      </div>
    </div>
  );
}
