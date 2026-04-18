import type { MetadataRoute } from "next";
import { getPublicSiteOrigin } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = getPublicSiteOrigin();
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/api/admin"] },
    ],
    sitemap: `${base.replace(/\/$/, "")}/sitemap.xml`,
  };
}
