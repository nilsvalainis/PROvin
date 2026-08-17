const LOCAL_BRAND_LOGOS: Record<string, string> = {
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
  seat: "/brand-logos/seat.svg",
  skoda: "/brand-logos/skoda.svg",
  smart: "/brand-logos/smart.svg",
  volkswagen: "/brand-logos/volkswagen.svg",
  vw: "/brand-logos/volkswagen.svg",
  volvo: "/brand-logos/volvo.svg",
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
  return LOCAL_BRAND_LOGOS[token] ?? null;
}

export function irissBrandFallbackLabel(brandModel: string): string {
  const token = irissBrandToken(brandModel).toUpperCase();
  if (!token || token === "—") return "AU";
  return token.length >= 2 ? token.slice(0, 2) : token;
}
