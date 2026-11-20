/**
 * VIN SCAN kešs ir pēc VIN, bet daži avoti meklē pēc numurzīmes (RDW - NL, Regitra - LT, DVSA - UK, car.info - SE).
 * Ja operators ievada citu vai jaunu numuru, šo avotu kešotās rindas nedrīkst atgriezt (var būt cita numura dati).
 */
import { isValidScanPlate, normalizeScanPlate, type VinScanPlateKind, type VinScanPlates } from "@/lib/vin-scan/plates";

/** Avoti, kuru rezultāts ir atkarīgs no numurzīmes (ne tikai no VIN). */
export const VIN_SCAN_PLATE_SOURCES: Readonly<Record<VinScanPlateKind, readonly string[]>> = {
  lv: [],
  nl: ["rdw"],
  lt: ["regitra"],
  fi: [],
  uk: ["dvsa_mot"],
  se: ["carinfo"],
};

const KINDS: readonly VinScanPlateKind[] = ["lv", "nl", "lt", "fi", "uk", "se"];

/** Numuru veidi, kur pieprasījumā ir derīgs numurs, kas atšķiras no kešā saglabātā (arī ja kešā tā nebija). */
export function changedVinScanPlateKinds(prev: VinScanPlates | null | undefined, next: VinScanPlates): VinScanPlateKind[] {
  return KINDS.filter((kind) => {
    const want = normalizeScanPlate(next[kind] ?? "");
    if (!isValidScanPlate(kind, want)) return false;
    return normalizeScanPlate(prev?.[kind] ?? "") !== want;
  });
}

/** Avotu ID, kuru kešotās rindas nav derīgas jaunajiem numuriem. */
export function vinScanPlateStaleSourceIds(prev: VinScanPlates | null | undefined, next: VinScanPlates): Set<string> {
  const out = new Set<string>();
  for (const kind of changedVinScanPlateKinds(prev, next)) {
    for (const id of VIN_SCAN_PLATE_SOURCES[kind]) out.add(id);
  }
  return out;
}

/** Saglabājamie numuri: jaunais derīgais numurs aizstāj veco, tukšs pieprasījuma lauks veco patur. */
export function mergeVinScanPlates(prev: VinScanPlates | null | undefined, next: VinScanPlates): VinScanPlates {
  const out = { ...next };
  for (const kind of KINDS) {
    if (!isValidScanPlate(kind, next[kind] ?? "") && prev?.[kind]) out[kind] = prev[kind];
  }
  return out;
}
