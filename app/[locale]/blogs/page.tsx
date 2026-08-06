import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BlogIndex } from "@/components/blog/BlogIndex";
import { BlogPageShell } from "@/components/blog/BlogPageShell";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return {
    title: t("blogsTitle"),
    description: t("blogsDescription"),
  };
}

export default async function BlogsPage({ params }: Props) {
  const { locale } = await params;
  return (
    <BlogPageShell>
      <BlogIndex locale={locale} />
    </BlogPageShell>
  );
}
