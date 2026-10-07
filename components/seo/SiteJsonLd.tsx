import { JsonLd } from "@/components/seo/JsonLd";
import { buildSiteGraphJsonLd } from "@/lib/seo-json-ld";

type Props = {
  locale: string;
  description: string;
};

/** Globālais JSON-LD: WebSite + Organization / LocalBusiness. */
export function SiteJsonLd({ locale, description }: Props) {
  return <JsonLd data={buildSiteGraphJsonLd(locale, description)} />;
}
