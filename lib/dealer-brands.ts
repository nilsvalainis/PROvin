/**
 * Official dealer brand coverage for B2C + B2B (+ AZ.VIN demo).
 * Groups follow manufacturer ownership / portfolio order.
 */

export const TP5_DEALER_BRAND_GROUPS = [
  ["BMW", "MINI", "Rolls-Royce"],
  ["Mercedes-Benz", "Smart"],
  ["Volkswagen", "Audi", "Škoda", "SEAT", "CUPRA", "Porsche", "Bentley", "Lamborghini"],
  ["Volvo", "Polestar"],
  ["Jaguar", "Land Rover"],
  ["Toyota", "Lexus"],
  ["Ford"],
  ["Mazda", "Honda", "Nissan", "Infiniti", "Mitsubishi", "Subaru", "Suzuki"],
  [
    "Peugeot",
    "Citroën",
    "DS Automobiles",
    "Opel",
    "Vauxhall",
    "Fiat",
    "Abarth",
    "Alfa Romeo",
    "Lancia",
    "Jeep",
  ],
  ["Renault", "Dacia", "Alpine"],
  ["Hyundai", "Kia", "Genesis"],
  ["Ferrari", "Maserati", "Aston Martin", "Lotus", "MG"],
] as const;

/** @deprecated Prefer TP5_DEALER_BRAND_GROUPS - kept for row-style consumers. */
export const TP5_DEALER_BRAND_ROWS = TP5_DEALER_BRAND_GROUPS;

export type Tp5DealerBrand = (typeof TP5_DEALER_BRAND_GROUPS)[number][number];

export const TP5_DEALER_BRANDS: readonly Tp5DealerBrand[] = TP5_DEALER_BRAND_GROUPS.flat();

const LOGO_V = "12";

/** Logo paths only where an SVG ships under /public/brand-logos. */
export const TP5_DEALER_BRAND_LOGO_SRC: Partial<Record<Tp5DealerBrand, string>> = {
  "Mercedes-Benz": `/brand-logos/mercedes.svg?v=${LOGO_V}`,
  "BMW": `/brand-logos/bmw.svg?v=${LOGO_V}`,
  "MINI": `/brand-logos/mini.svg?v=${LOGO_V}`,
  "Rolls-Royce": `/brand-logos/rolls-royce.svg?v=${LOGO_V}`,
  "Smart": `/brand-logos/smart.svg?v=${LOGO_V}`,
  "Volkswagen": `/brand-logos/volkswagen.svg?v=${LOGO_V}`,
  "Audi": `/brand-logos/audi.svg?v=${LOGO_V}`,
  "Škoda": `/brand-logos/skoda.svg?v=${LOGO_V}`,
  "SEAT": `/brand-logos/seat.svg?v=${LOGO_V}`,
  "CUPRA": `/brand-logos/cupra.svg?v=${LOGO_V}`,
  "Porsche": `/brand-logos/porsche.svg?v=${LOGO_V}`,
  "Bentley": `/brand-logos/bentley.svg?v=${LOGO_V}`,
  "Lamborghini": `/brand-logos/lamborghini.svg?v=${LOGO_V}`,
  "Volvo": `/brand-logos/volvo.svg?v=${LOGO_V}`,
  "Polestar": `/brand-logos/polestar.svg?v=${LOGO_V}`,
  "Jaguar": `/brand-logos/jaguar.svg?v=${LOGO_V}`,
  "Land Rover": `/brand-logos/land-rover.svg?v=${LOGO_V}`,
  "Toyota": `/brand-logos/toyota.svg?v=${LOGO_V}`,
  "Lexus": `/brand-logos/lexus.svg?v=${LOGO_V}`,
  "Ford": `/brand-logos/ford.svg?v=${LOGO_V}`,
  "Mazda": `/brand-logos/mazda.svg?v=${LOGO_V}`,
  "Honda": `/brand-logos/honda.svg?v=${LOGO_V}`,
  "Nissan": `/brand-logos/nissan.svg?v=${LOGO_V}`,
  "Infiniti": `/brand-logos/infiniti.svg?v=${LOGO_V}`,
  "Mitsubishi": `/brand-logos/mitsubishi.svg?v=${LOGO_V}`,
  "Subaru": `/brand-logos/subaru.svg?v=${LOGO_V}`,
  "Suzuki": `/brand-logos/suzuki.svg?v=${LOGO_V}`,
  "Peugeot": `/brand-logos/peugeot.svg?v=${LOGO_V}`,
  "Citroën": `/brand-logos/citroen.svg?v=${LOGO_V}`,
  "DS Automobiles": `/brand-logos/ds.svg?v=${LOGO_V}`,
  "Opel": `/brand-logos/opel.svg?v=${LOGO_V}`,
  "Vauxhall": `/brand-logos/vauxhall.svg?v=${LOGO_V}`,
  "Fiat": `/brand-logos/fiat.svg?v=${LOGO_V}`,
  "Abarth": `/brand-logos/abarth.svg?v=${LOGO_V}`,
  "Alfa Romeo": `/brand-logos/alfa-romeo.svg?v=${LOGO_V}`,
  "Lancia": `/brand-logos/lancia.svg?v=${LOGO_V}`,
  "Jeep": `/brand-logos/jeep.svg?v=${LOGO_V}`,
  "Renault": `/brand-logos/renault.svg?v=${LOGO_V}`,
  "Dacia": `/brand-logos/dacia.svg?v=${LOGO_V}`,
  "Alpine": `/brand-logos/alpine.svg?v=${LOGO_V}`,
  "Hyundai": `/brand-logos/hyundai.svg?v=${LOGO_V}`,
  "Kia": `/brand-logos/kia.svg?v=${LOGO_V}`,
  "Genesis": `/brand-logos/genesis.svg?v=${LOGO_V}`,
  "Ferrari": `/brand-logos/ferrari.svg?v=${LOGO_V}`,
  "Maserati": `/brand-logos/maserati.svg?v=${LOGO_V}`,
  "Aston Martin": `/brand-logos/aston-martin.svg?v=${LOGO_V}`,
  "Lotus": `/brand-logos/lotus.svg?v=${LOGO_V}`,
  "MG": `/brand-logos/mg.svg?v=${LOGO_V}`,
};

/** Brands that have a local logo asset (logo grids). */
export const TP5_DEALER_BRANDS_WITH_LOGO: readonly Tp5DealerBrand[] = TP5_DEALER_BRANDS.filter(
  (brand) => Boolean(TP5_DEALER_BRAND_LOGO_SRC[brand]),
);

/** Brands whose PNG still ships with a solid black plate (none after alpha strip). */
export const TP5_DEALER_BRAND_DARK_PLATE = new Set<string>([]);
