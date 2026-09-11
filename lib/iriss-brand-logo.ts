/** Local brand mark paths for IRISS list rows (no CDN). */
const IRISS_BRAND_LOGO: Record<string, string> = {
  audi: "/brand-logos/audi.svg",
  bmw: "/brand-logos/bmw.svg",
  citroen: "/brand-logos/citroen.svg",
  dacia: "/brand-logos/dacia.svg",
  jaguar: "/brand-logos/jaguar.svg",
  "land-rover": "/brand-logos/land-rover.svg",
  landrover: "/brand-logos/land-rover.svg",
  mercedes: "/brand-logos/mercedes.svg",
  "mercedes-benz": "/brand-logos/mercedes.svg",
  mb: "/brand-logos/mercedes.svg",
  mini: "/brand-logos/mini.svg",
  opel: "/brand-logos/opel.svg",
  peugeot: "/brand-logos/peugeot.svg",
  renault: "/brand-logos/renault.svg",
  rolls: "/brand-logos/rolls-royce.svg",
  "rolls-royce": "/brand-logos/rolls-royce.svg",
  rollsroyce: "/brand-logos/rolls-royce.svg",
  seat: "/brand-logos/seat.svg",
  cupra: "/brand-logos/cupra.svg",
  subaru: "/brand-logos/subaru.svg",
  skoda: "/brand-logos/skoda.svg",
  smart: "/brand-logos/smart.svg",
  volkswagen: "/brand-logos/volkswagen.svg",
  vw: "/brand-logos/volkswagen.svg",
  volvo: "/brand-logos/volvo.svg",
  polestar: "/brand-logos/polestar.svg",
  porsche: "/brand-logos/porsche.svg",
  bentley: "/brand-logos/bentley.svg",
  lamborghini: "/brand-logos/lamborghini.svg",
  toyota: "/brand-logos/toyota.svg",
  lexus: "/brand-logos/lexus.svg",
  ford: "/brand-logos/ford.svg",
  mazda: "/brand-logos/mazda.svg",
  honda: "/brand-logos/honda.svg",
  nissan: "/brand-logos/nissan.svg",
  infiniti: "/brand-logos/infiniti.svg",
  mitsubishi: "/brand-logos/mitsubishi.svg",
  suzuki: "/brand-logos/suzuki.svg",
  ds: "/brand-logos/ds.svg",
  "ds automobiles": "/brand-logos/ds.svg",
  vauxhall: "/brand-logos/vauxhall.svg",
  fiat: "/brand-logos/fiat.svg",
  abarth: "/brand-logos/abarth.svg",
  "alfa romeo": "/brand-logos/alfa-romeo.svg",
  "alfa-romeo": "/brand-logos/alfa-romeo.svg",
  lancia: "/brand-logos/lancia.svg",
  jeep: "/brand-logos/jeep.svg",
  alpine: "/brand-logos/alpine.svg",
  hyundai: "/brand-logos/hyundai.svg",
  kia: "/brand-logos/kia.svg",
  genesis: "/brand-logos/genesis.svg",
  ferrari: "/brand-logos/ferrari.svg",
  maserati: "/brand-logos/maserati.svg",
  "aston martin": "/brand-logos/aston-martin.svg",
  "aston-martin": "/brand-logos/aston-martin.svg",
  lotus: "/brand-logos/lotus.svg",
  mg: "/brand-logos/mg.svg",
};

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

export function irissBrandLogoSrc(brandModel: string): string | null {
  const token = irissBrandToken(brandModel);
  if (!token) return null;
  // Prefer multi-word keys (Land Rover, Alfa Romeo, Aston Martin) before first-token fallback.
  const normalized = brandModel
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_./]+/g, " ")
    .replace(/\s+/g, " ");
  for (const key of ["aston martin", "alfa romeo", "land rover", "mercedes-benz", "rolls-royce", "ds automobiles"]) {
    if (normalized === key || normalized.startsWith(key + " ")) {
      return IRISS_BRAND_LOGO[key] ?? IRISS_BRAND_LOGO[key.replace(/ /g, "-")] ?? null;
    }
  }
  if (normalized.startsWith("land ")) return IRISS_BRAND_LOGO["land-rover"] ?? null;
  return IRISS_BRAND_LOGO[token] ?? null;
}

export function irissBrandFallbackLabel(brandModel: string): string {
  const token = irissBrandToken(brandModel).toUpperCase();
  if (!token || token === "-") return "AU";
  return token.length >= 2 ? token.slice(0, 2) : token;
}
