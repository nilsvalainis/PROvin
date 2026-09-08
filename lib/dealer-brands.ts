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

/** @deprecated Prefer TP5_DEALER_BRAND_GROUPS — kept for row-style consumers. */
export const TP5_DEALER_BRAND_ROWS = TP5_DEALER_BRAND_GROUPS;

export type Tp5DealerBrand = (typeof TP5_DEALER_BRAND_GROUPS)[number][number];

export const TP5_DEALER_BRANDS: readonly Tp5DealerBrand[] = TP5_DEALER_BRAND_GROUPS.flat();

const LOGO_V = "10";

/** Logo paths only where an SVG ships under /public/brand-logos. */
export const TP5_DEALER_BRAND_LOGO_SRC: Partial<Record<Tp5DealerBrand, string>> = {
  "Mercedes-Benz": `/brand-logos/mercedes.svg?v=${LOGO_V}`,
  BMW: `/brand-logos/bmw.svg?v=${LOGO_V}`,
  MINI: `/brand-logos/mini.svg?v=${LOGO_V}`,
  "Rolls-Royce": `/brand-logos/rolls-royce.svg?v=${LOGO_V}`,
  Audi: `/brand-logos/audi.svg?v=${LOGO_V}`,
  Volkswagen: `/brand-logos/volkswagen.svg?v=${LOGO_V}`,
  Volvo: `/brand-logos/volvo.svg?v=${LOGO_V}`,
  "Land Rover": `/brand-logos/land-rover.svg?v=${LOGO_V}`,
  Jaguar: `/brand-logos/jaguar.svg?v=${LOGO_V}`,
  Škoda: `/brand-logos/skoda.svg?v=${LOGO_V}`,
  SEAT: `/brand-logos/seat.svg?v=${LOGO_V}`,
  Subaru: `/brand-logos/subaru.svg?v=${LOGO_V}`,
  Peugeot: `/brand-logos/peugeot.svg?v=${LOGO_V}`,
  Citroën: `/brand-logos/citroen.svg?v=${LOGO_V}`,
  Renault: `/brand-logos/renault.svg?v=${LOGO_V}`,
  Dacia: `/brand-logos/dacia.svg?v=${LOGO_V}`,
  Opel: `/brand-logos/opel.svg?v=${LOGO_V}`,
  Smart: `/brand-logos/smart.svg?v=${LOGO_V}`,
};

/** Brands that have a local logo asset (logo grids). */
export const TP5_DEALER_BRANDS_WITH_LOGO: readonly Tp5DealerBrand[] = TP5_DEALER_BRANDS.filter(
  (brand) => Boolean(TP5_DEALER_BRAND_LOGO_SRC[brand]),
);

/** Brands whose PNG still ships with a solid black plate (none after alpha strip). */
export const TP5_DEALER_BRAND_DARK_PLATE = new Set<string>([]);
