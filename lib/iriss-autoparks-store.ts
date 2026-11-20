import "server-only";

import { createHash, randomUUID } from "node:crypto";
import {
  AUTOPARKS_OWNER_LV,
  AUTOPARKS_STATUS_LV,
  autoparksOwner,
  isAutoparksOwner,
  AUTOPARKS_STAGE_LV,
  AUTOPARKS_ARCHIVE_RESTORED_TEXT,
  autoparksArchiveOnStatusChange,
  autoparksRoom,
  isAutoparksStatus,
  normalizeAutoparksState,
  type AutoparksCar,
  type AutoparksFile,
  type AutoparksFileKind,
  type AutoparksNote,
  type AutoparksRoom,
  type AutoparksStage,
  type AutoparksState,
  type AutoparksStatus,
  type AutoparksWorkItem,
} from "@/lib/iriss-autoparks";
import { applyManualRegistryPatch, type RegistryFile, type RegistryValues } from "@/lib/iriss-autoparks-registry";
import { applyRegistryFileToState, type AutoparksRegistryImportResult } from "@/lib/iriss-autoparks-registry-apply";
import type { LogisticsOrder } from "@/lib/iriss-logistics-types";
import { readLogisticsJsonFile, mutateLogisticsJsonFile } from "@/lib/iriss-logistics-store";
import { readAutoparksStoredBytes, storeAutoparksFileBytes } from "@/lib/iriss-autoparks-files";
import { autoparksSyncForLogisticsAction, findAutoparksCarForOrder, type LogisticsSyncAction } from "@/lib/iriss-autoparks-transit";

/** Tā pati Loģistikas krātuve (Blob vai mape), atsevišķs fails. Esošos Loģistikas datus neaiztiek. */
const AUTOPARKS_FILE = "autoparks.json";

export type AutoparksActor = { id: string; name: string };

export async function readAutoparksState(): Promise<AutoparksState> {
  return normalizeAutoparksState(await readLogisticsJsonFile(AUTOPARKS_FILE));
}

/**
 * Vienīgais rakstīšanas ceļš: nolasa ar etag, piemēro izmaiņas, raksta ar `ifMatch`; konfliktā atkārto.
 * Tā paralēli ievadīti dati (piem. IRISS aģents un migrācija) netiek pārrakstīti.
 * `mutate` atgriež `write: false`, ja nekas nav jāmaina.
 */
export async function mutateAutoparksState<R>(
  mutate: (state: AutoparksState) => { result: R; write?: boolean } | Promise<{ result: R; write?: boolean }>,
): Promise<R> {
  return mutateLogisticsJsonFile(AUTOPARKS_FILE, async (raw) => {
    const state = normalizeAutoparksState(raw);
    const out = await mutate(state);
    if (out.write === false) return { result: out.result };
    return { next: { ...state, events: state.events.slice(-2000) }, result: out.result };
  });
}

function event(carId: string, actor: AutoparksActor, text: string) {
  return { id: `ae-${randomUUID()}`, carId, at: new Date().toISOString(), actorName: actor.name, text };
}

export type AutoparksCarInput = Partial<
  Pick<
    AutoparksCar,
    "vin" | "make" | "model" | "year" | "plate" | "color" | "mileageKm" | "location" | "purchasePriceEur" | "salePriceEur" | "status" | "arrivedAt" | "displayName" | "equipmentLine" | "listPriceEur" | "owner"
  >
> & {
  /** Ar roku labotie reģistra lauki (tiek atzīmēti kā "labots"). */
  registry?: Partial<RegistryValues>;
};

export async function createAutoparksCar(input: AutoparksCarInput & { orderId?: string }, actor: AutoparksActor): Promise<AutoparksCar> {
  const now = new Date().toISOString();
  const car: AutoparksCar = {
    id: `ap-${randomUUID()}`,
    orderId: input.orderId?.trim() ?? "",
    vin: (input.vin ?? "").trim().toUpperCase().slice(0, 32),
    make: (input.make ?? "").trim().slice(0, 60),
    model: (input.model ?? "").trim().slice(0, 80),
    year: (input.year ?? "").trim().slice(0, 8),
    plate: (input.plate ?? "").trim().toUpperCase().slice(0, 16),
    color: (input.color ?? "").trim().slice(0, 40),
    mileageKm: input.mileageKm ?? null,
    status: isAutoparksStatus(input.status) ? input.status : "prep_waiting",
    statusChangedAt: now,
    location: (input.location ?? "").trim().slice(0, 120),
    purchasePriceEur: input.purchasePriceEur ?? null,
    salePriceEur: input.salePriceEur ?? null,
    // J52 LABOJUMS: tukšs, kamēr auto nav tiešām atvests - vecāk tika uzspiests šodienas datums,
    // un tas pats aizsegtu "Atvests" vērtību, ja Pamatdati UI mēģina to notīrīt (sk. autoparksV2Basics).
    arrivedAt: (input.arrivedAt ?? "").trim().slice(0, 10),
    archivedAt: "",
    // Jauniem ierakstiem īpašnieks vienmēr saglabāts; vecie paliek bez lauka (= IRISS).
    owner: isAutoparksOwner(input.owner) ? input.owner : "IRISS",
    createdAt: now,
    updatedAt: now,
  };
  // Nils 20.11: jauns auto uzreiz ar statusu «Pārdots» - uzreiz arhīvā.
  const archive = car.status === "sold" ? autoparksArchiveOnStatusChange({ ...car, status: "prep_waiting" }, "sold", now) : null;
  if (archive) Object.assign(car, { archivedAt: archive.car.archivedAt, archiveReason: archive.car.archiveReason });
  return mutateAutoparksState((state) => {
    // Atkārtots "Uz Autoparku" paralēli: tas pats pasūtījums netiek pievienots divreiz.
    const dup = input.orderId ? state.cars.find((c) => c.orderId === car.orderId) : undefined;
    if (dup) return { result: dup, write: false };
    state.cars.push(car);
    state.events.push(event(car.id, actor, input.orderId ? "Pārvietots no Loģistikas" : "Pievienots Autoparkam"));
    if (archive) state.events.push(event(car.id, actor, archive.text));
    return { result: car };
  });
}

/**
 * Atkārtots "Uz Autoparku" tam pašam pasūtījumam neveido dublikātu.
 * Nils 27.10 (Loģistika = Autoparka posms «Ceļā»): «+ Nopirkts» izveido auto ar statusu `in_transit`.
 */
export async function ensureAutoparksCarFromOrder(
  order: LogisticsOrder,
  actor: AutoparksActor,
  opts: { status?: AutoparksStatus } = {},
): Promise<{ car: AutoparksCar; created: boolean }> {
  const state = await readAutoparksState();
  const existing = state.cars.find((c) => c.orderId === order.id || (order.vin && c.vin === order.vin.toUpperCase()));
  if (existing) {
    // Agrāk bez VIN izveidots ieraksts: VIN no Loģistikas aizpilda tukšo lauku (citu VIN nepārraksta).
    if (!existing.vin && order.vin) {
      const filled = await patchAutoparksCar(existing.id, { vin: order.vin }, actor);
      if (filled) return { car: filled, created: false };
    }
    return { car: existing, created: false };
  }
  const titleParts = order.title.trim().split(/\s+/);
  const car = await createAutoparksCar(
    {
      orderId: order.id,
      vin: order.vin,
      make: order.make || titleParts[0] || "",
      model: (order.model || titleParts.slice(1).join(" ")).replace(/\s*\(?(19|20)\d{2}\)?\s*$/, ""),
      year: order.title.match(/\b(19|20)\d{2}\b/)?.[0] ?? "",
      mileageKm: order.mileageKm,
      status: opts.status,
    },
    actor,
  );
  return { car, created: true };
}

/**
 * «Atvests» (Loģistika -> Autoparks): auto, kas bija «Ceļā», pāriet uz «Gaida sagatavošanu» un saņem atvešanas datumu.
 * Citos statusos (piem. jau Servisā) netiek aiztikts.
 */
export async function markAutoparksCarArrived(carId: string, actor: AutoparksActor, today = new Date()): Promise<AutoparksCar | null> {
  return mutateAutoparksState((state) => {
    const idx = state.cars.findIndex((c) => c.id === carId);
    if (idx < 0) return { result: null, write: false };
    const prev = state.cars[idx]!;
    if (prev.status !== "in_transit") return { result: prev, write: false };
    const now = new Date().toISOString();
    const next: AutoparksCar = {
      ...prev,
      status: "prep_waiting",
      statusChangedAt: now,
      arrivedAt: prev.arrivedAt || today.toISOString().slice(0, 10),
      updatedAt: now,
    };
    state.cars[idx] = next;
    state.events.push(event(carId, actor, "Atvests: Ceļā -> Gaida sagatavošanu"));
    return { result: next };
  });
}

/**
 * P2 (Nils 20.11): Loģistikas darbība delivered / archive / other_company sinhronizē saistīto Autoparka auto
 * (pēc `orderId`, tad VIN). Noteikumi - `autoparksSyncForLogisticsAction`. Nekad nedzēš.
 */
export async function syncAutoparksCarWithLogisticsAction(
  order: Pick<LogisticsOrder, "id" | "vin">,
  action: LogisticsSyncAction,
  actor: AutoparksActor,
  today = new Date(),
): Promise<AutoparksCar | null> {
  return mutateAutoparksState((state) => {
    const car = findAutoparksCarForOrder(state.cars, order);
    if (!car) return { result: null, write: false };
    const plan = autoparksSyncForLogisticsAction(car, action);
    if (!plan) return { result: car, write: false };
    const idx = state.cars.findIndex((c) => c.id === car.id);
    const now = new Date().toISOString();
    let next: AutoparksCar = car;
    if (plan.status) {
      next = {
        ...car,
        status: plan.status,
        statusChangedAt: now,
        arrivedAt: plan.setArrived ? car.arrivedAt || today.toISOString().slice(0, 10) : car.arrivedAt,
        updatedAt: now,
      };
      state.cars[idx] = next;
    }
    state.events.push(event(car.id, actor, plan.text));
    return { result: next };
  });
}

/**
 * P2 (Nils 20.11, 4A): admins pēc apstiprinājuma pārceļ «Ceļā bez Loģistikas» auto uz «Noliktavā».
 * `eligible` - servera pārbaudīts saraksts (in_transit bez aktīva Loģistikas ieraksta); citus id izlaiž.
 */
export async function moveTransitCarsToStock(ids: readonly string[], eligible: ReadonlySet<string>, actor: AutoparksActor): Promise<string[]> {
  return mutateAutoparksState((state) => {
    const moved: string[] = [];
    const now = new Date().toISOString();
    for (const id of new Set(ids)) {
      if (!eligible.has(id)) continue;
      const idx = state.cars.findIndex((c) => c.id === id);
      const prev = idx >= 0 ? state.cars[idx]! : null;
      if (!prev || prev.status !== "in_transit" || prev.archivedAt) continue;
      state.cars[idx] = { ...prev, status: "prep_waiting", statusChangedAt: now, updatedAt: now };
      state.events.push(event(id, actor, "Ceļā bez Loģistikas -> Noliktavā (admins)"));
      moved.push(id);
    }
    return moved.length ? { result: moved } : { result: moved, write: false };
  });
}

/** Migrācija: esošam Autoparka auto (pēc VIN) piesaista Loģistikas ierakstu, ja tam vēl nav cita. Statusu neaiztiek. */
export async function linkAutoparksCarToOrder(carId: string, orderId: string, actor: AutoparksActor): Promise<boolean> {
  return mutateAutoparksState((state) => {
    const idx = state.cars.findIndex((c) => c.id === carId);
    if (idx < 0 || state.cars[idx]!.orderId) return { result: false, write: false };
    state.cars[idx] = { ...state.cars[idx]!, orderId, updatedAt: new Date().toISOString() };
    state.events.push(event(carId, actor, "Sasaistīts ar Loģistikas ierakstu"));
    return { result: true };
  });
}

export async function patchAutoparksCar(id: string, patch: AutoparksCarInput, actor: AutoparksActor): Promise<AutoparksCar | null> {
  return mutateAutoparksState((state) => {
  const idx = state.cars.findIndex((c) => c.id === id);
  if (idx < 0) return { result: null, write: false };
  const prev = state.cars[idx]!;
  const now = new Date().toISOString();
  let next: AutoparksCar = { ...prev, updatedAt: now };
  const text = (v: string | undefined, max: number) => (v === undefined ? undefined : v.trim().slice(0, max));
  next.vin = text(patch.vin, 32)?.toUpperCase() ?? prev.vin;
  next.make = text(patch.make, 60) ?? prev.make;
  next.model = text(patch.model, 80) ?? prev.model;
  next.year = text(patch.year, 8) ?? prev.year;
  next.plate = text(patch.plate, 16)?.toUpperCase() ?? prev.plate;
  next.color = text(patch.color, 40) ?? prev.color;
  next.location = text(patch.location, 120) ?? prev.location;
  if (patch.mileageKm !== undefined) next.mileageKm = patch.mileageKm;
  if (patch.purchasePriceEur !== undefined) next.purchasePriceEur = patch.purchasePriceEur;
  if (patch.salePriceEur !== undefined) next.salePriceEur = patch.salePriceEur;
  if (patch.arrivedAt !== undefined) next.arrivedAt = patch.arrivedAt;
  if (patch.displayName !== undefined) next.displayName = patch.displayName.trim().slice(0, 160);
  if (patch.equipmentLine !== undefined) next.equipmentLine = patch.equipmentLine.trim().slice(0, 300);
  if (patch.listPriceEur !== undefined) next.listPriceEur = patch.listPriceEur;
  if (patch.registry && Object.keys(patch.registry).length > 0) next.registry = applyManualRegistryPatch(prev.registry, patch.registry);
  if (isAutoparksOwner(patch.owner) && patch.owner !== autoparksOwner(prev)) {
    next.owner = patch.owner;
    state.events.push(event(id, actor, `Īpašnieks: ${AUTOPARKS_OWNER_LV[autoparksOwner(prev)]} -> ${AUTOPARKS_OWNER_LV[patch.owner]}`));
  }
  if (isAutoparksStatus(patch.status) && patch.status !== prev.status) {
    const archive = autoparksArchiveOnStatusChange(next, patch.status, now);
    if (archive) next = archive.car;
    next.status = patch.status;
    next.statusChangedAt = now;
    state.events.push(event(id, actor, `Statuss: ${AUTOPARKS_STATUS_LV[prev.status]} -> ${AUTOPARKS_STATUS_LV[patch.status]}`));
    if (archive) state.events.push(event(id, actor, archive.text));
  }
  state.cars[idx] = next;
  return { result: next };
  });
}

/** Statuss, uz kuru pārdotu auto atgriež «Atjaunot no arhīva» (Nils 20.11). */
export const AUTOPARKS_RESTORE_SOLD_STATUS: AutoparksStatus = "for_sale";

export type AutoparksRestoreResult = { car: AutoparksCar; prevStatus: AutoparksStatus; statusChanged: boolean; changed: boolean };

/**
 * Nils 20.11: «Atjaunot no arhīva». Noņem `archivedAt`; ja statuss «Pārdots» (arī vecs pārdotais bez `archivedAt`,
 * kas arhīvā ir atvasināti), statuss -> «Pārdošanā», citādi auto paliktu arhīvā. null - nav atrasts; write: false - nav arhīvā.
 */
export async function restoreAutoparksCarFromArchive(id: string, actor: AutoparksActor): Promise<AutoparksRestoreResult | null> {
  return mutateAutoparksState<AutoparksRestoreResult | null>((state) => {
    const idx = state.cars.findIndex((c) => c.id === id);
    if (idx < 0) return { result: null, write: false };
    const prev = state.cars[idx]!;
    const sold = prev.status === "sold";
    if (!prev.archivedAt && !sold) return { result: { car: prev, prevStatus: prev.status, statusChanged: false, changed: false }, write: false };
    const now = new Date().toISOString();
    const { archiveReason: _drop, ...rest } = prev;
    const next: AutoparksCar = { ...rest, archivedAt: "", updatedAt: now };
    if (sold) {
      next.status = AUTOPARKS_RESTORE_SOLD_STATUS;
      next.statusChangedAt = now;
      state.events.push(event(id, actor, `Statuss: ${AUTOPARKS_STATUS_LV.sold} -> ${AUTOPARKS_STATUS_LV[AUTOPARKS_RESTORE_SOLD_STATUS]}`));
    }
    state.cars[idx] = next;
    state.events.push(event(id, actor, AUTOPARKS_ARCHIVE_RESTORED_TEXT));
    return { result: { car: next, prevStatus: prev.status, statusChanged: sold, changed: true } };
  });
}

/** Arhīvs ar roku (vai atpakaļ). Dati paliek, sarakstā redzams cilnē "Arhīvs". Atjaunošana - `restoreAutoparksCarFromArchive`. */
export async function setAutoparksArchived(id: string, archived: boolean, actor: AutoparksActor): Promise<AutoparksCar | null> {
  if (!archived) return (await restoreAutoparksCarFromArchive(id, actor))?.car ?? null;
  return mutateAutoparksState((state) => {
  const idx = state.cars.findIndex((c) => c.id === id);
  if (idx < 0) return { result: null, write: false };
  const prev = state.cars[idx]!;
  if (prev.archivedAt) return { result: prev, write: false };
  const now = new Date().toISOString();
  const next: AutoparksCar = { ...prev, archivedAt: now, updatedAt: now };
  state.cars[idx] = next;
  state.events.push(event(id, actor, "Pārvietots uz arhīvu"));
  return { result: next };
  });
}

/**
 * Dzēš auto ar visu istabu (faili, piezīmes, tāme, notikumi). Neatgriezeniski, tāpēc tikai pēc apstiprinājuma UI.
 * Failu saturs krātuvē paliek (nav saites), bet sarakstā un istabā vairs neparādās.
 */
export async function deleteAutoparksCar(id: string): Promise<boolean> {
  return mutateAutoparksState((state) => {
    if (!state.cars.some((c) => c.id === id)) return { result: false, write: false };
    state.cars = state.cars.filter((c) => c.id !== id);
    state.files = state.files.filter((f) => f.carId !== id);
    state.notes = state.notes.filter((n) => n.carId !== id);
    state.work = state.work.filter((w) => w.carId !== id);
    state.events = state.events.filter((e) => e.carId !== id);
    return { result: true };
  });
}

export async function getAutoparksRoom(id: string): Promise<AutoparksRoom | null> {
  return autoparksRoom(await readAutoparksState(), id);
}

export async function addAutoparksNote(carId: string, stage: AutoparksStage, text: string, actor: AutoparksActor): Promise<AutoparksNote | null> {
  const note: AutoparksNote = {
    id: `an-${randomUUID()}`,
    carId,
    stage,
    text: text.trim().slice(0, 4000),
    authorId: actor.id,
    authorName: actor.name,
    createdAt: new Date().toISOString(),
  };
  if (!note.text) return null;
  return mutateAutoparksState((state) => {
    if (!state.cars.some((c) => c.id === carId)) return { result: null, write: false };
    state.notes.push(note);
    return { result: note };
  });
}

/** Tāme: visu sarakstu saglabā kopā (maz rindu, vienkāršāk nekā rindu API). */
export async function replaceAutoparksWork(
  carId: string,
  rows: ReadonlyArray<Pick<AutoparksWorkItem, "id" | "title" | "qty" | "priceEur" | "done">>,
): Promise<AutoparksWorkItem[] | null> {
  return mutateAutoparksState((state) => {
  if (!state.cars.some((c) => c.id === carId)) return { result: null, write: false };
  const prev = new Map(state.work.filter((w) => w.carId === carId).map((w) => [w.id, w]));
  const now = new Date().toISOString();
  const next: AutoparksWorkItem[] = rows
    .filter((r) => r.title.trim())
    .slice(0, 200)
    .map((r) => ({
      id: prev.has(r.id) ? r.id : `aw-${randomUUID()}`,
      carId,
      title: r.title.trim().slice(0, 200),
      qty: Number.isFinite(r.qty) && r.qty > 0 ? r.qty : 1,
      priceEur: r.priceEur != null && Number.isFinite(r.priceEur) ? r.priceEur : null,
      done: r.done === true,
      createdAt: prev.get(r.id)?.createdAt ?? now,
    }));
  state.work = [...state.work.filter((w) => w.carId !== carId), ...next];
  return { result: next };
  });
}

export async function addAutoparksFile(input: {
  carId: string;
  stage: AutoparksStage;
  kind: AutoparksFileKind;
  title: string;
  fileName: string;
  contentType: string;
  bytes: Buffer;
  scanned: boolean;
  actor: AutoparksActor;
}): Promise<{ file: AutoparksFile; duplicate: boolean } | null> {
  const before = await readAutoparksState();
  const car = before.cars.find((c) => c.id === input.carId);
  if (!car) return null;
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const dup = before.files.find((f) => f.carId === input.carId && f.sha256 === sha256 && !f.deletedAt);
  if (dup) return { file: dup, duplicate: true };
  const title = input.title.trim().slice(0, 160) || input.fileName.replace(/\.[a-z0-9]{2,5}$/i, "").slice(0, 160) || "Dokuments";
  // Saturs vispirms krātuvē (Dropbox vai Blob), tikai tad ieraksts JSON ar etag pārbaudi.
  const stored = await storeAutoparksFileBytes({
    car,
    stage: input.stage,
    title,
    fileName: input.fileName,
    contentType: input.contentType,
    bytes: input.bytes,
    sha256,
  });
  const file: AutoparksFile = {
    id: `af-${randomUUID()}`,
    carId: input.carId,
    stage: input.stage,
    kind: input.kind,
    title,
    fileName: input.fileName.slice(0, 200),
    contentType: input.contentType,
    size: input.bytes.length,
    blobPath: stored.blobPath,
    ...(stored.dropboxId ? { dropboxId: stored.dropboxId, dropboxPath: stored.dropboxPath } : {}),
    ...(stored.thumbBlobPath ? { thumbBlobPath: stored.thumbBlobPath } : {}),
    sha256,
    scanned: input.scanned,
    uploadedBy: input.actor.id,
    uploadedByName: input.actor.name,
    createdAt: new Date().toISOString(),
    deletedAt: "",
  };
  return mutateAutoparksState<{ file: AutoparksFile; duplicate: boolean } | null>((state) => {
    const idx = state.cars.findIndex((c) => c.id === input.carId);
    if (idx < 0) return { result: null, write: false };
    const again = state.files.find((f) => f.carId === input.carId && f.sha256 === sha256 && !f.deletedAt);
    if (again) return { result: { file: again, duplicate: true }, write: false };
    if (stored.folder && !state.cars[idx]!.dropboxFolderId) {
      state.cars[idx] = { ...state.cars[idx]!, dropboxFolderId: stored.folder.id, dropboxFolderPath: stored.folder.path };
    }
    state.files.push(file);
    state.events.push(event(input.carId, input.actor, `${AUTOPARKS_STAGE_LV[input.stage]}: pievienots "${file.title}"`));
    return { result: { file, duplicate: false } };
  });
}

export async function patchAutoparksFile(
  id: string,
  patch: { stage?: AutoparksStage; kind?: AutoparksFileKind; title?: string },
): Promise<AutoparksFile | null> {
  return mutateAutoparksState((state) => {
    const idx = state.files.findIndex((f) => f.id === id && !f.deletedAt);
    if (idx < 0) return { result: null, write: false };
    const prev = state.files[idx]!;
    const next = {
      ...prev,
      stage: patch.stage ?? prev.stage,
      kind: patch.kind ?? prev.kind,
      title: patch.title?.trim().slice(0, 160) || prev.title,
    };
    state.files[idx] = next;
    return { result: next };
  });
}

/** Faila dzēšana ir mīkstā: ieraksts un fails paliek krātuvē (arī Dropbox). */
export async function softDeleteAutoparksFile(id: string, actor: AutoparksActor): Promise<AutoparksFile | null> {
  return mutateAutoparksState((state) => {
    const idx = state.files.findIndex((f) => f.id === id);
    if (idx < 0) return { result: null, write: false };
    const prev = state.files[idx]!;
    if (prev.deletedAt) return { result: prev, write: false };
    const next = { ...prev, deletedAt: new Date().toISOString() };
    state.files[idx] = next;
    state.events.push(event(prev.carId, actor, `Izņemts "${prev.title}"`));
    return { result: next };
  });
}

export async function findAutoparksFile(id: string): Promise<{ file: AutoparksFile; car: AutoparksCar } | null> {
  const state = await readAutoparksState();
  const file = state.files.find((f) => f.id === id && !f.deletedAt);
  const car = file ? state.cars.find((c) => c.id === file.carId) : undefined;
  return file && car ? { file, car } : null;
}

export async function readAutoparksFileBytes(id: string): Promise<{ file: AutoparksFile; car: AutoparksCar; bytes: Buffer; contentType: string } | null> {
  const found = await findAutoparksFile(id);
  if (!found) return null;
  const stored = await readAutoparksStoredBytes(found.file);
  if (!stored) return null;
  return { ...found, bytes: stored.bytes, contentType: found.file.contentType || stored.contentType };
}

export type { AutoparksRegistryImportResult };

/**
 * CSDD reģistra imports pēc VIN (sk. `applyRegistryFileToState`). Aizpilda tikai reģistra laukus
 * (un tukšu marku/modeli/nobraukumu); pilnā nolasījumā pievieno jaunos un atzīmē izņemtos.
 * Nila labotos laukus un arhīvu neaiztiek.
 */
export async function applyAutoparksRegistryFile(file: RegistryFile, importFile: string): Promise<AutoparksRegistryImportResult> {
  // Pamatdatu labojumi (VIN, īpašnieks) ir v2 - saskaņošanai vajag efektīvās vērtības (tikai lasīšana).
  const { readAutoparksV2State } = await import("@/lib/iriss-autoparks-v2-store");
  const v2 = await readAutoparksV2State();
  return mutateAutoparksState((state) => {
    const { result, changed } = applyRegistryFileToState(state, file, importFile, new Date().toISOString(), v2);
    return { result, write: changed };
  });
}
