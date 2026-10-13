/**
 * Biluppgifter API vieta (vēl nav pieslēgta).
 * VIN SCAN Ziemeļvalstu VIN rāda publiskās saites; HTML zonde paliek kā pagaidu ceļš.
 * Kad būs atslēga, `probeBiluppgifter` vispirms sauc `fetchBiluppgifterApi`.
 */

export function biluppgifterApiConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(String(env.BILUPPGIFTER_API_KEY ?? "").trim());
}

export type BiluppgifterApiVehicle = {
  make: string;
  model: string;
  year: string;
};

export type BiluppgifterApiResult = {
  found: boolean;
  message: string;
  vehicle?: BiluppgifterApiVehicle;
  odometer?: string;
};

/** Nav implementēts. Atgriež null, lai zonde ietu uz publisko lapu / saitēm. */
export async function fetchBiluppgifterApi(_vin: string): Promise<BiluppgifterApiResult | null> {
  if (!biluppgifterApiConfigured()) return null;
  return null;
}
