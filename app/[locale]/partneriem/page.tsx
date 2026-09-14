import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { B2bPartnerPreview } from "@/components/b2b/B2bPartnerPreview";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { Footer } from "@/components/Footer";
import { routing } from "@/i18n/routing";
import { resolveActiveB2bPartner } from "@/lib/b2b-partner-auth";
import { readB2bPartnerServerSession } from "@/lib/b2b-partner-server-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PROVIN partneriem",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "PROVIN", statusBarStyle: "black-translucent" },
};

export default async function PartneriemPage({ params }: { params: Promise<{ locale: string }> }) {
  const session = await readB2bPartnerServerSession();
  if (session) {
    const partner = await resolveActiveB2bPartner();
    if (partner) {
      const { locale: raw } = await params;
      const locale = routing.locales.includes(raw as (typeof routing.locales)[number])
        ? raw
        : routing.defaultLocale;
      redirect(`/${locale}/partneriem/konts`);
    }
  }

  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <div className="home-hero-pricing-unified demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
        <B2bPartnerPreview />
        <div id="site-content" className="min-w-0 bg-transparent pb-0 text-white home-body-ink">
          <section className="demo-design-dir__section bg-transparent pb-0">
            <Footer variant="b2b" />
          </section>
        </div>
      </div>
    </div>
  );
}
