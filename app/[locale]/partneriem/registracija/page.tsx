import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { B2bPartnerHero } from "@/components/b2b/B2bPartnerHero";
import { B2bPartnerInviteRegister } from "@/components/b2b/B2bPartnerInviteRegister";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { getOpenB2bInvite } from "@/lib/b2b-partner-invite-store";
import { isSafeB2bInviteToken } from "@/lib/b2b-partner-invite";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PROVIN partneru reģistrācija",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "PROVIN", statusBarStyle: "black-translucent" },
};

type Props = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function PartnerInviteRegisterPage({ searchParams }: Props) {
  const t = await getTranslations("Partner");
  const raw = await searchParams;
  const token = typeof raw.token === "string" ? raw.token.trim() : "";
  const invite = isSafeB2bInviteToken(token) ? await getOpenB2bInvite(token) : null;

  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <div className="home-hero-pricing-unified demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
        <B2bPartnerHero
          panel={
            invite ? (
              <B2bPartnerInviteRegister token={invite.token} />
            ) : (
              <p className="text-[0.84rem] leading-relaxed text-zinc-400">{t("inviteInvalid")}</p>
            )
          }
        />
      </div>
    </div>
  );
}
