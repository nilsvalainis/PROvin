/**
 * 26.11 (Nils): WMI / VIN atšifrējums (vPIC, WMI tabula) dod tikai RAŽOŠANAS valsti.
 * Tā nav valsts, kur auto bijis vai reģistrēts: «Valstis» kartītē, valstu vēsturē un
 * pretrunu pārbaudēs to neskaita. Rāda tikai identitātē kā «Ražots: <valsts>».
 */
type RowCountryLike = {
  id?: string;
  flags?: { registrationCountry?: string; manufactureCountry?: string } | null;
};

/** Avoti, kuru valsts ir ražotājvalsts (WMI), nevis reģistrs. */
const MANUFACTURE_ONLY_SOURCES = new Set(["vin_decode"]);

export function isManufactureCountrySource(id: string | undefined): boolean {
  return MANUFACTURE_ONLY_SOURCES.has(String(id ?? "").trim());
}

/** Reģistrācijas / atrašanās valsts no VIN SCAN rindas. WMI rindai vienmēr "" (arī veciem momentuzņēmumiem). */
export function vinScanRowRegistrationCountry(row: RowCountryLike): string {
  if (isManufactureCountrySource(row.id)) return "";
  return String(row.flags?.registrationCountry ?? "").trim().toUpperCase();
}

/** Ražotājvalsts (ISO2) no WMI rindas; vecajos momentuzņēmumos tā glabājās `registrationCountry`. */
export function vinScanRowManufactureCountry(row: RowCountryLike): string {
  const made = String(row.flags?.manufactureCountry ?? "").trim().toUpperCase();
  if (made) return made;
  if (isManufactureCountrySource(row.id)) return String(row.flags?.registrationCountry ?? "").trim().toUpperCase();
  return "";
}
