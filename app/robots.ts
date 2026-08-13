import type { MetadataRoute } from "next";
import { getPublicSiteOrigin } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = getPublicSiteOrigin();
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/api/admin", "/test-pricing", "/test-checkout"] },
    ],
    sitemap: `${base.replace(/\/$/, "")}/sitemap.xml`,
  };
}
