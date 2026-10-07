import type { MetadataRoute } from "next";

/** Indeksējamie publiskie ceļi (bez lokales prefiksa). */
export const INDEXABLE_PUBLIC_PATHS: {
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
}[] = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/vin-koda-parbaude", changeFrequency: "monthly", priority: 0.9 },
  { path: "/pakalpojumi", changeFrequency: "weekly", priority: 0.85 },
  { path: "/biezi-jautajumi", changeFrequency: "monthly", priority: 0.8 },
  { path: "/par-mums", changeFrequency: "monthly", priority: 0.75 },
  { path: "/blogs", changeFrequency: "weekly", priority: 0.75 },
  { path: "/partneriem", changeFrequency: "monthly", priority: 0.6 },
  { path: "/privatuma-politika", changeFrequency: "yearly", priority: 0.4 },
  { path: "/lietosanas-noteikumi", changeFrequency: "yearly", priority: 0.4 },
];

/** Vecie / angliskie sliekšņa ceļi → kanoniskais ceļš bez lokales. */
export const LEGACY_PATH_ALIASES: Record<string, string> = {
  "/faq": "/biezi-jautajumi",
  "/about": "/par-mums",
  "/samples": "/pakalpojumi",
  "/paraugi": "/pakalpojumi",
  "/blog": "/blogs",
  "/services": "/pakalpojumi",
  "/terms": "/lietosanas-noteikumi",
  "/privacy": "/privatuma-politika",
};

export const SEO_LOCALE_HEADER = "x-provin-locale";
export const DEFAULT_OG_IMAGE_PATH = "/og.png";
