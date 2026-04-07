import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

type Props = {
  searchParams: Promise<{ session_id?: string }>;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return {
    title: t("thanksTitle"),
    robots: { index: false, follow: false },
  };
}

export default async function ThanksPage({ searchParams, params }: Props) {
  const sp = await searchParams;
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Thanks" });
  const sid = sp.session_id;

  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center sm:px-8">
      <div className="provin-lift-strong mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-provin-accent text-white shadow-[0_6px_20px_rgba(0,0,0,0.14)]">
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="mt-10 text-[32px] font-semibold tracking-tight text-[#1d1d1f] sm:text-[40px]">{t("title")}</h1>
      <p className="mx-auto mt-5 max-w-[65ch] text-[17px] font-normal leading-relaxed text-[#86868b]">{t("body")}</p>
      {sid && (
        <p className="provin-lift-subtle mt-8 break-all rounded-2xl border border-black/[0.06] bg-[#f5f5f7] px-4 py-3 font-mono text-[12px] font-normal text-[#86868b]">
          {t("sessionLabel")} {sid}
        </p>
      )}
      <Link
        href="/"
        className="provin-btn-ghost provin-lift-subtle mt-10 inline-flex min-h-[44px] items-center justify-center rounded-full border border-black/[0.12] bg-white px-6 text-[17px] font-normal text-provin-accent shadow-sm"
      >
        {t("back")}
      </Link>
    </div>
  );
}
