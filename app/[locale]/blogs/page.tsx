import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buildPublicPageMetadata } from "@/lib/seo-public-metadata";
import { BlogIndex } from "@/components/blog/BlogIndex";
import { BlogPageShell } from "@/components/blog/BlogPageShell";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildBlogIndexJsonLd } from "@/lib/seo-json-ld";
import { listBlogPosts, resolveBlogLocale } from "@/lib/blog/posts";

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
    ogImageAlt: t("ogImageAlt"),
  });
}

export default async function BlogsPage({ params }: Props) {
  const { locale } = await params;
  const posts = await listBlogPosts();
  const ld = buildBlogIndexJsonLd(
    locale,
    posts.map((p) => ({ slug: p.slug, title: resolveBlogLocale(p, locale).content.title, publishedAt: p.publishedAt })),
  );
  return (
    <BlogPageShell>
      <JsonLd data={ld} />
      <BlogIndex locale={locale} />
      <div id="site-content" className="min-w-0 bg-transparent pb-0 text-white home-body-ink">
        <Footer />
      </div>
    </BlogPageShell>
  );
}
