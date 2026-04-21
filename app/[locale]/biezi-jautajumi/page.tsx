import type { Metadata } from "next";
import { getMessages, getTranslations } from "next-intl/server";
import { Faq } from "@/components/Faq";
import { Link } from "@/i18n/navigation";
import { getPublicSiteOrigin } from "@/lib/site-url";

type Props = { params: Promise<{ locale: string }> };

type FaqMsgItem = { q: string; a: string };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return {
    title: t("faqTitle"),
    description: t("faqDescription"),
  };
}

export default async function FaqPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("Misc");
  const messages = await getMessages();
  const raw = (messages as { Faq?: { items?: FaqMsgItem[] } }).Faq?.items;
  const items = Array.isArray(raw) ? raw : [];
  const base = getPublicSiteOrigin().replace(/\/$/, "");
  const pageUrl = `${base}/${locale}/biezi-jautajumi`;
  const faqLd =
    items.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((it) => ({
            "@type": "Question",
            name: it.q,
            acceptedAnswer: { "@type": "Answer", text: it.a },
          })),
          url: pageUrl,
        }
      : null;

  return (
    <>
      <div className="border-b border-black/[0.06] bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-[720px]">
          <Link
            href="/"
            className="provin-lift-subtle inline-flex items-center gap-1 rounded-lg border border-transparent px-1 py-1 text-[14px] font-normal text-provin-accent transition hover:underline"
          >
            {t("faqBack")}
          </Link>
        </div>
      </div>
      {faqLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      ) : null}
      <Faq tone="light" />
    </>
  );
}
