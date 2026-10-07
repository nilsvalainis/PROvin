import { getCompanyLegal, getCompanyPublicBrand } from "@/lib/company";
import { contactEmail, CONTACT_PHONE_TEL } from "@/lib/contact";
import { IRISS_SOCIAL_DEFAULTS } from "@/lib/iriss-social-defaults";
import { PUBLIC_SERVICE_OFFERS, serviceOfferUrl } from "@/lib/seo-offers";
import { publicPageUrl } from "@/lib/seo-public-metadata";
import { DEFAULT_OG_IMAGE_PATH } from "@/lib/seo-public-paths";
import { getPublicSiteOrigin } from "@/lib/site-url";

export type BreadcrumbItem = { name: string; path: string };

export function jsonLdLanguage(locale: string): string {
  if (locale === "en") return "en-GB";
  if (locale === "de") return "de-DE";
  if (locale === "ru") return "ru-RU";
  return "lv-LV";
}

export function siteOrigin(): string {
  return getPublicSiteOrigin().replace(/\/$/, "");
}

export function organizationId(): string {
  return `${siteOrigin()}/#organization`;
}

export function websiteId(locale: string): string {
  return `${publicPageUrl(locale)}#website`;
}

export function parseLegalPostalAddress(legalAddress: string): {
  "@type": "PostalAddress";
  streetAddress: string;
  addressLocality: string;
  postalCode: string;
  addressCountry: string;
} {
  const parts = legalAddress.split(",").map((p) => p.trim()).filter(Boolean);
  const streetAddress = parts[0] || legalAddress;
  const addressLocality = parts[1] || "Tukums";
  const postalRaw = parts.find((p) => /LV-?\d{4}/i.test(p)) ?? "LV3101";
  const postalCode = postalRaw.replace(/LV-?/i, "LV-");
  return {
    "@type": "PostalAddress",
    streetAddress,
    addressLocality,
    postalCode,
    addressCountry: "LV",
  };
}

function sameAs(): string[] {
  return [IRISS_SOCIAL_DEFAULTS.tiktok, IRISS_SOCIAL_DEFAULTS.youtube, IRISS_SOCIAL_DEFAULTS.instagram];
}

export function buildOrganizationJsonLd(locale: string, description: string) {
  const legal = getCompanyLegal();
  const brand = getCompanyPublicBrand();
  const origin = siteOrigin();
  return {
    "@type": ["Organization", "ProfessionalService", "LocalBusiness"],
    "@id": organizationId(),
    name: brand,
    legalName: legal.legalName,
    url: publicPageUrl(locale),
    description,
    image: `${origin}${DEFAULT_OG_IMAGE_PATH}`,
    logo: { "@type": "ImageObject", url: `${origin}/icon`, width: 512, height: 512 },
    email: contactEmail(),
    telephone: CONTACT_PHONE_TEL,
    address: parseLegalPostalAddress(legal.legalAddress),
    areaServed: { "@type": "Country", name: "Latvia" },
    sameAs: sameAs(),
    priceRange: "24,99 €-99,99 €",
  };
}

export function buildWebsiteJsonLd(locale: string, description: string) {
  const brand = getCompanyPublicBrand();
  return {
    "@type": "WebSite",
    "@id": websiteId(locale),
    url: publicPageUrl(locale),
    name: brand,
    description,
    inLanguage: jsonLdLanguage(locale),
    publisher: { "@id": organizationId() },
  };
}

export function buildSiteGraphJsonLd(locale: string, description: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [buildWebsiteJsonLd(locale, description), buildOrganizationJsonLd(locale, description)],
  };
}

export function buildServiceOffersJsonLd(
  locale: string,
  names: Record<"mini" | "audits" | "dealer", string>,
  descriptions: Record<"mini" | "audits" | "dealer", string>,
) {
  const brand = getCompanyPublicBrand();
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: PUBLIC_SERVICE_OFFERS.map((offer, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Service",
        "@id": `${serviceOfferUrl(locale, offer)}`,
        name: names[offer.id],
        description: descriptions[offer.id],
        provider: { "@id": organizationId() },
        areaServed: { "@type": "Country", name: "Latvia" },
        brand: { "@type": "Brand", name: brand },
        offers: {
          "@type": "Offer",
          url: publicPageUrl(locale),
          price: offer.price,
          priceCurrency: offer.priceCurrency,
          availability: "https://schema.org/InStock",
        },
      },
    })),
  };
}

export function buildFaqPageJsonLd(
  locale: string,
  path: string,
  items: { q: string; a: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: publicPageUrl(locale, path),
    inLanguage: jsonLdLanguage(locale),
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}

export function buildBreadcrumbJsonLd(locale: string, items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: publicPageUrl(locale, item.path),
    })),
  };
}

export function buildBlogPostingJsonLd(args: {
  locale: string;
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  tags: string[];
  image?: string;
}) {
  const origin = siteOrigin();
  const url = publicPageUrl(args.locale, `/blogs/${args.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: args.title,
    description: args.description,
    datePublished: `${args.publishedAt}T12:00:00.000Z`,
    dateModified: `${args.publishedAt}T12:00:00.000Z`,
    inLanguage: jsonLdLanguage(args.locale),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    keywords: args.tags.join(", "),
    author: {
      "@type": "Organization",
      "@id": organizationId(),
      name: getCompanyPublicBrand(),
    },
    publisher: {
      "@type": "Organization",
      "@id": organizationId(),
      name: getCompanyPublicBrand(),
      logo: { "@type": "ImageObject", url: `${origin}/icon`, width: 512, height: 512 },
    },
    image: args.image ? [args.image] : [`${origin}${DEFAULT_OG_IMAGE_PATH}`],
  };
}
