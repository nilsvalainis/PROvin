import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Faq } from "@/components/Faq";
import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return {
    title: t("faqTitle"),
    description: t("faqDescription"),
  };
}

export default async function FaqPage() {
  const t = await getTranslations("Misc");

  return (
    <>
      <div className="border-b border-black/[0.06] bg-gradient-to-r from-[#f5f5f7] to-provin-surface-2 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-[720px]">
          <Link
            href="/"
            className="provin-lift-subtle inline-flex items-center gap-1 rounded-lg border border-transparent px-1 py-1 text-[14px] font-normal text-provin-accent transition hover:underline"
          >
            {t("faqBack")}
          </Link>
        </div>
      </div>
      <Faq tone="light" />
    </>
  );
}
