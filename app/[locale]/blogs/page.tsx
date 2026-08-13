import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buildPublicPageMetadata } from "@/lib/seo-public-metadata";
import { BlogIndex } from "@/components/blog/BlogIndex";
import { BlogPageShell } from "@/components/blog/BlogPageShell";

type Props = { params: Promise<{ locale: string }> };

/** ISR: bloga saraksts nav personalizēts. Admin saglabāšana izsauc `revalidatePath`
 * (`app/api/admin/blog-posts/route.ts`), tāpēc izmaiņas parādās uzreiz; stunda ir drošības tīkls. */
export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return buildPublicPageMetadata({
    locale,
    path: "/blogs",
    title: t("blogsTitle"),
    description: t("blogsDescription"),
  });
}

export default async function BlogsPage({ params }: Props) {
  const { locale } = await params;
  return (
    <BlogPageShell>
      <BlogIndex locale={locale} />
    </BlogPageShell>
  );
}
