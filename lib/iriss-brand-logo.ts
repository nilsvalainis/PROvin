/** Local brand mark paths for IRISS list rows (no CDN). */
import { dealerBrandHasWideMark, dealerBrandLogoPublicPath } from "@/lib/dealer-brand-logo-path";

const IRISS_BRAND_SLUG: Record<string, string> = {
  audi: "audi",
  bmw: "bmw",
  citroen: "citroen",
  dacia: "dacia",
  jaguar: "jaguar",
  "land-rover": "land-rover",
  landrover: "land-rover",
  mercedes: "mercedes",
  "mercedes-benz": "mercedes",
  mb: "mercedes",
  mini: "mini",
  opel: "opel",
  peugeot: "peugeot",
  renault: "renault",
  rolls: "rolls-royce",
  "rolls-royce": "rolls-royce",
  rollsroyce: "rolls-royce",
  seat: "seat",
  cupra: "cupra",
  subaru: "subaru",
  skoda: "skoda",
  smart: "smart",
  volkswagen: "volkswagen",
  vw: "volkswagen",
  volvo: "volvo",
  polestar: "polestar",
  porsche: "porsche",
  bentley: "bentley",
  lamborghini: "lamborghini",
  toyota: "toyota",
  lexus: "lexus",
  ford: "ford",
  mazda: "mazda",
  honda: "honda",
  nissan: "nissan",
  infiniti: "infiniti",
  mitsubishi: "mitsubishi",
  suzuki: "suzuki",
  ds: "ds",
  "ds automobiles": "ds",
  vauxhall: "vauxhall",
  fiat: "fiat",
  abarth: "abarth",
  "alfa romeo": "alfa-romeo",
  "alfa-romeo": "alfa-romeo",
  lancia: "lancia",
  jeep: "jeep",
  alpine: "alpine",
  hyundai: "hyundai",
  kia: "kia",
  genesis: "genesis",
  ferrari: "ferrari",
  maserati: "maserati",
  "aston martin": "aston-martin",
  "aston-martin": "aston-martin",
  lotus: "lotus",
  mg: "mg",
};

function irissSlugForBrandModel(brandModel: string): string | null {
  const token = irissBrandToken(brandModel);
  if (!token) return null;
  const normalized = brandModel
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_./]+/g, " ")
    .replace(/\s+/g, " ");
  for (const key of ["aston martin", "alfa romeo", "land rover", "mercedes-benz", "rolls-royce", "ds automobiles"]) {
    if (normalized === key || normalized.startsWith(key + " ")) {
      return IRISS_BRAND_SLUG[key] ?? IRISS_BRAND_SLUG[key.replace(/ /g, "-")] ?? null;
    }
  }
  if (normalized.startsWith("land ")) return IRISS_BRAND_SLUG["land-rover"] ?? null;
  return IRISS_BRAND_SLUG[token] ?? null;
}

export function irissBrandToken(brandModel: string): string {
  return (
    brandModel
      .trim()
      .split(/\s+/)[0]
      ?.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9-]/g, "") ?? ""
  );
}

export function irissBrandLogoUsesWideLayout(brandModel: string): boolean {
  const slug = irissSlugForBrandModel(brandModel);
  return slug ? dealerBrandHasWideMark(slug) : false;
}

export function irissBrandLogoSrc(brandModel: string): string | null {
  const slug = irissSlugForBrandModel(brandModel);
  if (!slug) return null;
  return dealerBrandLogoPublicPath(slug, {
    cacheBust: false,
    variant: dealerBrandHasWideMark(slug) ? "wide" : "primary",
  });
}

export function irissBrandFallbackLabel(brandModel: string): string {
  const token = irissBrandToken(brandModel).toUpperCase();
  if (!token || token === "-") return "AU";
  return token.length >= 2 ? token.slice(0, 2) : token;
}
