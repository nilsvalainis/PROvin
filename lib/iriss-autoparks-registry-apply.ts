/**
 * CSDD tirdzniecības reģistra faila piemērošana Autoparka stāvoklim (tīra funkcija, bez krātuves).
 *
 * - Visi faili: esošās (ne arhīva) kartītes pēc VIN papildina ar reģistra laukiem; Nila labotos laukus nepārraksta.
 * - Tikai pilns nolasījums (`snapshot.complete`, Hetzner cron): jauni pieņemtie auto tiek pievienoti,
 *   un auto, kas iepriekš bija pieņemts (ir akta nr.), bet nolasījumā vairs nav, saņem `registry.removedAt`.
 * - Autoparka manuālie lauki (statuss, cenas, piezīmes, nosaukums, aprīkojums) netiek mainīti nekad.
 */

import { randomUUID } from "node:crypto";
import { autoparksOwner, type AutoparksCar, type AutoparksEvent, type AutoparksState } from "@/lib/iriss-autoparks";
import {
  emptyAutoparksRegistry,
  mergeRegistryValues,
  registryStatusInTrade,
  type RegistryFile,
  type RegistryFileVehicle,
  type RegistryKey,
} from "@/lib/iriss-autoparks-registry";

export const REGISTRY_IMPORT_ACTOR_NAME = "CSDD reģistrs";

/** Statuss, ko ieliek reģistra laukā, kad auto pilnajā nolasījumā vairs nav. */
export const REGISTRY_REMOVED_STATUS = "Izņemts no tirdzniecības";

/**
 * Drošības slieksnis: ja nolasījumā pazustu vairāk nekā šī daļa no firmas pieņemtajiem auto
 * (un vismaz 3), tas drīzāk ir nolasīšanas kļūda - izņemšanu tai firmai neatzīmē.
 */
export const REGISTRY_REMOVAL_GUARD_SHARE = 0.5;

export type AutoparksRegistryImportResult = {
  matched: number;
  updated: number;
  /** VIN, kam nav aktīvas kartītes un kas netika pievienoti (rokas fails vai statuss "pārdots"). */
  unmatched: string[];
  /** Jaunas kartītes no pilnā nolasījuma. */
  added: number;
  /** Atzīmēti kā vairs nav tirdzniecībā. */
  removed: number;
  /** Bija atzīmēti kā izņemti, bet atkal ir reģistrā. */
  returned: number;
  /** Mainīts reģistra statuss. */
  statusChanged: number;
  /** Mainīts akta nr. vai datums. */
  actUpdated: number;
  /** VIN ir tikai arhīvā - jaunu kartīti neveido, arhīvu neaiztiek. */
  archivedOnly: number;
  /** Firmas, kurām izņemšana netika atzīmēta drošības sliekšņa dēļ. */
  removalGuarded: string[];
};

function newEvent(carId: string, at: string, text: string): AutoparksEvent {
  return { id: `ae-${randomUUID()}`, carId, at, actorName: REGISTRY_IMPORT_ACTOR_NAME, text };
}

function splitMakeModel(makeModel: string): { make: string; model: string } {
  const [make, ...rest] = makeModel.trim().split(/\s+/);
  return { make: (make ?? "").slice(0, 60), model: rest.join(" ").slice(0, 80) };
}

function inTrade(v: RegistryFileVehicle): boolean {
  return registryStatusInTrade(v.values.status);
}

function newCarFromRegistry(v: RegistryFileVehicle, meta: { now: string; importFile: string; registryDate: string }): AutoparksCar {
  const { registry } = mergeRegistryValues(undefined, v.values, { importedAt: meta.now, importFile: meta.importFile, registryDate: meta.registryDate });
  const { make, model } = splitMakeModel(registry.makeModel);
  return {
    id: `ap-${randomUUID()}`,
    orderId: "",
    vin: v.vin,
    make,
    model,
    year: registry.firstRegDate.slice(0, 4),
    plate: "",
    color: "",
    mileageKm: registry.odometerKm,
    status: "prep_waiting",
    statusChangedAt: meta.now,
    location: "",
    purchasePriceEur: null,
    salePriceEur: null,
    arrivedAt: (registry.tradeActDate || meta.now).slice(0, 10),
    archivedAt: "",
    owner: v.owner ?? "IRISS",
    createdAt: meta.now,
    updatedAt: meta.now,
    registry,
  };
}

export function applyRegistryFileToState(
  state: AutoparksState,
  file: RegistryFile,
  importFile: string,
  now: string = new Date().toISOString(),
): { result: AutoparksRegistryImportResult; changed: boolean } {
  const byVin = new Map(file.vehicles.map((v) => [v.vin, v]));
  const meta = { importedAt: now, importFile, registryDate: file.generatedAt };
  const snapshot = file.snapshot?.complete ? file.snapshot : undefined;
  const snapshotOwners = new Set<string>(snapshot?.owners ?? []);
  const result: AutoparksRegistryImportResult = {
    matched: 0,
    updated: 0,
    unmatched: [],
    added: 0,
    removed: 0,
    returned: 0,
    statusChanged: 0,
    actUpdated: 0,
    archivedOnly: 0,
    removalGuarded: [],
  };
  const seen = new Set<string>();

  // Drošības slieksnis pa firmām: cik pieņemto auto pazustu.
  const guarded = new Set<string>();
  if (snapshot) {
    for (const owner of snapshotOwners) {
      const accepted = state.cars.filter(
        (c) => c.vin && !c.archivedAt && autoparksOwner(c) === owner && c.registry?.tradeActNo && !c.registry.removedAt,
      );
      const listed = file.vehicles.some((v) => v.owner === owner || (!v.owner && owner === "IRISS"));
      // Skaita tikai pazudušos; tieši "pārdots" statuss reģistrā ir uzticams un slieksnī neietilpst.
      const missing = accepted.filter((c) => !byVin.has(c.vin)).length;
      if (accepted.length > 0 && (!listed || (missing >= 3 && missing / accepted.length > REGISTRY_REMOVAL_GUARD_SHARE))) {
        guarded.add(owner);
      }
    }
    result.removalGuarded = [...guarded];
  }

  let changed = false;
  state.cars = state.cars.map((car) => {
    if (!car.vin || car.archivedAt) return car;
    const rec = byVin.get(car.vin);
    if (!rec) {
      // Pilnajā nolasījumā šīs firmas pieņemtā auto vairs nav -> "izņemts" (tikai reģistra lauki).
      const owner = autoparksOwner(car);
      if (!snapshot || !snapshotOwners.has(owner) || guarded.has(owner)) return car;
      if (!car.registry?.tradeActNo || car.registry.removedAt) return car;
      return markRemoved(car);
    }
    seen.add(rec.vin);
    result.matched += 1;
    const prevReg = car.registry ?? emptyAutoparksRegistry();
    const merged = mergeRegistryValues(car.registry, rec.values, meta);
    let registry = merged.registry;
    const fields: RegistryKey[] = [...merged.changed];
    const texts: string[] = [];
    if (!inTrade(rec)) {
      if (!registry.removedAt) {
        registry = { ...registry, removedAt: now };
        texts.push(`CSDD reģistrs: statuss "${registry.status}" - vairs nav tirdzniecībā`);
      }
    } else if (registry.removedAt) {
      registry = { ...registry, removedAt: "" };
      result.returned += 1;
      texts.push("CSDD reģistrs: atkal pieņemts tirdzniecībā");
    }
    if (registry.removedAt && !prevReg.removedAt) result.removed += 1;
    if (fields.includes("status")) result.statusChanged += 1;
    if (fields.includes("tradeActNo") || fields.includes("tradeActDate")) {
      result.actUpdated += 1;
      if (prevReg.tradeActNo && registry.tradeActNo !== prevReg.tradeActNo) texts.push(`CSDD reģistrs: akta nr. ${prevReg.tradeActNo} -> ${registry.tradeActNo}`);
    }
    const next: AutoparksCar = { ...car, registry };
    let filled = 0;
    if (!next.mileageKm && registry.odometerKm != null) {
      next.mileageKm = registry.odometerKm;
      filled += 1;
    }
    if (!next.make && !next.model && registry.makeModel) {
      Object.assign(next, splitMakeModel(registry.makeModel));
      filled += 1;
    }
    if (fields.length === 0 && filled === 0 && texts.length === 0) return car;
    result.updated += 1;
    changed = true;
    next.updatedAt = now;
    if (fields.length + filled > 0) state.events.push(newEvent(car.id, now, `CSDD reģistrs: atjaunoti ${fields.length + filled} lauki`));
    for (const t of texts) state.events.push(newEvent(car.id, now, t));
    return next;
  });

  function markRemoved(car: AutoparksCar): AutoparksCar {
    const reg = car.registry!;
    const status = reg.manual.includes("status") ? reg.status : REGISTRY_REMOVED_STATUS;
    if (status !== reg.status) result.statusChanged += 1;
    result.removed += 1;
    result.updated += 1;
    changed = true;
    state.events.push(newEvent(car.id, now, "CSDD reģistrs: vairs nav pieņemts tirdzniecībā"));
    return { ...car, updatedAt: now, registry: { ...reg, status, removedAt: now, registryDate: file.generatedAt || reg.registryDate } };
  }

  const archivedVins = new Set(state.cars.filter((c) => c.vin && c.archivedAt).map((c) => c.vin));
  for (const v of byVin.values()) {
    if (seen.has(v.vin)) continue;
    if (archivedVins.has(v.vin)) {
      result.archivedOnly += 1;
      continue;
    }
    const owner = v.owner ?? "IRISS";
    if (snapshot && snapshotOwners.has(owner) && inTrade(v)) {
      const car = newCarFromRegistry(v, { now, importFile, registryDate: file.generatedAt });
      state.cars.push(car);
      state.events.push(newEvent(car.id, now, "Pievienots no CSDD tirdzniecības reģistra"));
      result.added += 1;
      changed = true;
      continue;
    }
    result.unmatched.push(v.vin);
  }

  return { result, changed };
}
