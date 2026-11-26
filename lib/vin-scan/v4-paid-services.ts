import { buildAutodnaVinCheckUrl, buildCarverticalPrecheckPurchaseUrl } from "@/lib/admin-vin-urls";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

/**
 * VIN SCAN v4, 6. bloks: maksas pakalpojumi (AutoDNA pilnā, carVertical, CARFAX pilnā).
 * Bez pasūtījuma tie tikai atver pirkuma lapu ar VIN pēc apstiprinājuma ar summu - nekas netiek nopirkts fonā.
 * AutoDNA un carVertical pērk no priekšapmaksas kredītiem (1 atskaite = 1 kredīts).
 */
export type VinScanV4PaidServiceDef = {
  id: "autodna_full" | "carvertical" | "carfax_full";
  label: string;
  description: string;
  price: string;
  href: string | null;
};

export function vinScanV4PaidServices(rawVin: string): VinScanV4PaidServiceDef[] {
  const vin = normalizeVin(rawVin);
  if (!isValidVin(vin)) return [];
  return [
    {
      id: "autodna_full",
      label: "AutoDNA pilnā",
      description: "vēsture, arhīva foto, bojājumi",
      price: "1 kredīts",
      href: buildAutodnaVinCheckUrl(vin),
    },
    {
      id: "carvertical",
      label: "carVertical",
      description: "nobraukums, bojājumi, zādzība",
      price: "1 kredīts",
      href: buildCarverticalPrecheckPurchaseUrl(vin),
    },
    {
      id: "carfax_full",
      label: "CARFAX pilnā",
      description: "serviss, negadījumi, nobraukums",
      price: "1 atskaite",
      href: `https://www.carfax.eu/preview-page?vin=${encodeURIComponent(vin)}`,
    },
  ];
}
