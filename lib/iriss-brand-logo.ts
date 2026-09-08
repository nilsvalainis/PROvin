const LOCAL_BRAND_LOGOS: Record<string, string> = {
  abarth: "/brand-logos/abarth.svg",
  alpine: "/brand-logos/alpine.svg",
  alfa: "/brand-logos/alfa-romeo.svg",
  "alfa-romeo": "/brand-logos/alfa-romeo.svg",
  alfaromeo: "/brand-logos/alfa-romeo.svg",
  aston: "/brand-logos/aston-martin.svg",
  "aston-martin": "/brand-logos/aston-martin.svg",
  astonmartin: "/brand-logos/aston-martin.svg",
  audi: "/brand-logos/audi.svg",
  bentley: "/brand-logos/bentley.svg",
  bmw: "/brand-logos/bmw.svg",
  citroen: "/brand-logos/citroen.svg",
  cupra: "/brand-logos/cupra.svg",
  dacia: "/brand-logos/dacia.svg",
  ds: "/brand-logos/ds-automobiles.svg",
  "ds-automobiles": "/brand-logos/ds-automobiles.svg",
  ferrari: "/brand-logos/ferrari.svg",
  fiat: "/brand-logos/fiat.svg",
  ford: "/brand-logos/ford.svg",
  genesis: "/brand-logos/genesis.svg",
  honda: "/brand-logos/honda.svg",
  hyundai: "/brand-logos/hyundai.svg",
  infiniti: "/brand-logos/infiniti.svg",
  jaguar: "/brand-logos/jaguar.svg",
  jeep: "/brand-logos/jeep.svg",
  kia: "/brand-logos/kia.svg",
  lamborghini: "/brand-logos/lamborghini.svg",
  lancia: "/brand-logos/lancia.svg",
  land: "/brand-logos/land-rover.svg",
  "land-rover": "/brand-logos/land-rover.svg",
  landrover: "/brand-logos/land-rover.svg",
  lexus: "/brand-logos/lexus.svg",
  lotus: "/brand-logos/lotus.svg",
  maserati: "/brand-logos/maserati.svg",
  mazda: "/brand-logos/mazda.svg",
  mercedes: "/brand-logos/mercedes.svg",
  "mercedes-benz": "/brand-logos/mercedes.svg",
  mb: "/brand-logos/mercedes.svg",
  mg: "/brand-logos/mg.svg",
  mini: "/brand-logos/mini.svg",
  mitsubishi: "/brand-logos/mitsubishi.svg",
  nissan: "/brand-logos/nissan.svg",
  opel: "/brand-logos/opel.svg",
  peugeot: "/brand-logos/peugeot.svg",
  polestar: "/brand-logos/polestar.svg",
  porsche: "/brand-logos/porsche.svg",
  renault: "/brand-logos/renault.svg",
  rolls: "/brand-logos/rolls-royce.svg",
  "rolls-royce": "/brand-logos/rolls-royce.svg",
  rollsroyce: "/brand-logos/rolls-royce.svg",
  seat: "/brand-logos/seat.svg",
  skoda: "/brand-logos/skoda.svg",
  smart: "/brand-logos/smart.svg",
  subaru: "/brand-logos/subaru.svg",
  suzuki: "/brand-logos/suzuki.svg",
  toyota: "/brand-logos/toyota.svg",
  vauxhall: "/brand-logos/vauxhall.svg",
  volkswagen: "/brand-logos/volkswagen.svg",
  vw: "/brand-logos/volkswagen.svg",
  volvo: "/brand-logos/volvo.svg",
};

/** Longer needles first so “Land Rover” / “Alfa Romeo” resolve correctly. */
const BRAND_NEEDLES: { needle: string; key: string }[] = [
  { needle: "mercedes-benz", key: "mercedes-benz" },
  { needle: "rolls-royce", key: "rolls-royce" },
  { needle: "land rover", key: "land-rover" },
  { needle: "land-rover", key: "land-rover" },
  { needle: "alfa romeo", key: "alfa-romeo" },
  { needle: "alfa-romeo", key: "alfa-romeo" },
  { needle: "aston martin", key: "aston-martin" },
  { needle: "ds automobiles", key: "ds-automobiles" },
  { needle: "mercedes", key: "mercedes" },
  { needle: "volkswagen", key: "volkswagen" },
  { needle: "lamborghini", key: "lamborghini" },
  { needle: "mitsubishi", key: "mitsubishi" },
  { needle: "polestar", key: "polestar" },
  { needle: "porsche", key: "porsche" },
  { needle: "bentley", key: "bentley" },
  { needle: "maserati", key: "maserati" },
  { needle: "ferrari", key: "ferrari" },
  { needle: "genesis", key: "genesis" },
  { needle: "hyundai", key: "hyundai" },
  { needle: "infiniti", key: "infiniti" },
  { needle: "vauxhall", key: "vauxhall" },
  { needle: "renault", key: "renault" },
  { needle: "peugeot", key: "peugeot" },
  { needle: "citroen", key: "citroen" },
  { needle: "toyota", key: "toyota" },
  { needle: "lexus", key: "lexus" },
  { needle: "honda", key: "honda" },
  { needle: "nissan", key: "nissan" },
  { needle: "mazda", key: "mazda" },
  { needle: "suzuki", key: "suzuki" },
  { needle: "subaru", key: "subaru" },
  { needle: "jaguar", key: "jaguar" },
  { needle: "volvo", key: "volvo" },
  { needle: "skoda", key: "skoda" },
  { needle: "cupra", key: "cupra" },
  { needle: "alpine", key: "alpine" },
  { needle: "abarth", key: "abarth" },
  { needle: "lancia", key: "lancia" },
  { needle: "lotus", key: "lotus" },
  { needle: "dacia", key: "dacia" },
  { needle: "smart", key: "smart" },
  { needle: "mini", key: "mini" },
  { needle: "seat", key: "seat" },
  { needle: "audi", key: "audi" },
  { needle: "bmw", key: "bmw" },
  { needle: "opel", key: "opel" },
  { needle: "jeep", key: "jeep" },
  { needle: "fiat", key: "fiat" },
  { needle: "ford", key: "ford" },
  { needle: "kia", key: "kia" },
  { needle: "mg", key: "mg" },
  { needle: "vw", key: "vw" },
];

function normalizeBrandHaystack(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_./]+/g, " ")
    .replace(/\s+/g, " ");
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

export function irissBrandLogoSrc(brandModel: string): string | null {
  const hay = normalizeBrandHaystack(brandModel);
  if (!hay) return null;
  for (const { needle, key } of BRAND_NEEDLES) {
    if (hay === needle || hay.startsWith(`${needle} `) || hay.includes(` ${needle} `)) {
      return LOCAL_BRAND_LOGOS[key] ?? null;
    }
  }
  const token = irissBrandToken(brandModel);
  if (!token) return null;
  return LOCAL_BRAND_LOGOS[token] ?? null;
}

export function irissBrandFallbackLabel(brandModel: string): string {
  const token = irissBrandToken(brandModel).toUpperCase();
  if (!token || token === "—") return "AU";
  return token.length >= 2 ? token.slice(0, 2) : token;
}
