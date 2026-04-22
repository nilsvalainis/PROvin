import { getCompanyLegal, getCompanyPublicBrand } from "@/lib/company";
import { getPublicSiteOrigin } from "@/lib/site-url";

type Props = {
  locale: string;
  description: string;
};

/**
 * Globālais JSON-LD: WebSite + Organization (Google sapratnei par zīmolu un vietni).
 */
export function SiteJsonLd({ locale, description }: Props) {
  const base = getPublicSiteOrigin().replace(/\/$/, "");
  const url = `${base}/${locale}`;
  const brand = getCompanyPublicBrand();
  const legal = getCompanyLegal();
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${url}#website`,
        url,
        name: brand,
        description,
        inLanguage: "lv-LV",
        publisher: { "@id": `${url}#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${url}#organization`,
        name: brand,
        legalName: legal.legalName,
        /** Saskan ar kājeni / Stripe — viena rindiņa kā `getCompanyLegal().legalAddress` */
        address: legal.legalAddress,
        url,
        description,
        logo: { "@type": "ImageObject", url: `${url}/opengraph-image`, width: 1200, height: 630 },
      },
    ],
  };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />
  );
}
