import type { MetadataRoute } from "next";
import { getPublicSiteOrigin } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = getPublicSiteOrigin().replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api/admin",
          "/test-pricing",
          "/test-checkout",
          "/demo",
          "/view",
          "/p",
          "/pasutit",
          "/paldies",
          "/partneriem/konts",
          "/partneriem/parole",
          "/partneriem/registracija",
          "/partneriem/apstiprinat",
          "/_next/static/media/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
