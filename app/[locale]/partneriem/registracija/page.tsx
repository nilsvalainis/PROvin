import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { B2bPartnerInviteRegister } from "@/components/b2b/B2bPartnerInviteRegister";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { Footer } from "@/components/Footer";
import { getOpenB2bInvite } from "@/lib/b2b-partner-invite-store";
import { isSafeB2bInviteToken } from "@/lib/b2b-partner-invite";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PROVIN partneru reģistrācija",
  robots: { index: false, follow: false },
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
      <div className="demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent px-4 py-10 text-zinc-100">
        <h1 className="text-xl font-bold tracking-tight">{t("inviteRegisterTitle")}</h1>
        {invite ? (
          <div className="mt-6">
            <B2bPartnerInviteRegister token={invite.token} />
          </div>
        ) : (
          <p className="mt-4 max-w-lg text-sm text-zinc-400">{t("inviteInvalid")}</p>
        )}
        <div className="mt-16">
          <Footer />
        </div>
      </div>
    </div>
  );
}
