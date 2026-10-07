import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildBreadcrumbJsonLd, type BreadcrumbItem } from "@/lib/seo-json-ld";

type Props = {
  locale: string;
  items: BreadcrumbItem[];
};

export async function PageBreadcrumbs({ locale, items }: Props) {
  const t = await getTranslations("Breadcrumbs");
  if (items.length < 2) return null;
  const jsonLd = buildBreadcrumbJsonLd(locale, items);

  return (
    <>
      <JsonLd data={jsonLd} />
      <nav
        aria-label={t("navAria")}
        className="mx-auto w-full max-w-[80rem] px-[max(1rem,env(safe-area-inset-left,0px))] pt-5 pr-[max(1rem,env(safe-area-inset-right,0px))] sm:pt-6 lg:px-8"
      >
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
          {items.map((item, index) => {
            const last = index === items.length - 1;
            return (
              <li key={`${item.path}:${item.name}`} className="inline-flex min-w-0 items-center gap-x-2">
                {index > 0 ? (
                  <span aria-hidden className="text-white/20">
                    /
                  </span>
                ) : null}
                {last ? (
                  <span className="truncate text-white/55">{item.name}</span>
                ) : (
                  <Link href={item.path || "/"} className="truncate text-white/40 no-underline transition hover:text-provin-accent">
                    {item.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
