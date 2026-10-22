import "server-only";

import { randomUUID } from "node:crypto";
import { DropboxApiError, getDropboxClient, type DropboxClient, type DropboxEntry } from "@/lib/dropbox-client";
import type { AutoparksCar, AutoparksFile, AutoparksFileKind, AutoparksStage, AutoparksState } from "@/lib/iriss-autoparks";
import { autoparksDropboxRoot, matchStockFolderByVin, vinTail, type AutoparksOwner } from "@/lib/iriss-autoparks-dropbox-path";
import { autoparksDropboxEnabled, resolveAutoparksCarFolder } from "@/lib/iriss-autoparks-files";
import { fillAutoparksFromStock, type AutoparksFillable } from "@/lib/iriss-autoparks-info-txt";
import { mutateAutoparksState, readAutoparksState } from "@/lib/iriss-autoparks-store";
import { mutateLogisticsJsonFile, readLogisticsJsonFile } from "@/lib/iriss-logistics-store";

const SYNC_FILE = "autoparks-dropbox-sync.json";
const OWNERS: AutoparksOwner[] = ["IRISS", "DZA"];
const SYNC_ACTOR = "Dropbox";

type SyncCursors = Record<string, { cursor: string; updatedAt: string }>;

export type AutoparksDropboxSyncResult = {
  ok: boolean;
  error?: string;
  roots: Array<{ root: string; entries: number; full: boolean; skipped?: string }>;
  linked: number;
  filesAdded: number;
  filesRemoved: number;
  fieldsFilled: number;
};

/** Mapes satura grupa: viena auto mape (pirmais līmenis zem saknes). */
type FolderGroup = { name: string; folder: DropboxEntry | null; files: DropboxEntry[]; deleted: DropboxEntry[] };

const IMAGE_RE = /\.(jpe?g|png|heic|heif|webp|gif)$/i;

export function isStockPhoto(name: string): boolean {
  return IMAGE_RE.test(name);
}

/** Dokumenta posms un veids pēc nosaukuma (proforma/rēķins = iegādes rēķins, CMR = transports). */
export function classifyStockDocument(name: string): { stage: AutoparksStage; kind: AutoparksFileKind } {
  const n = name.toLowerCase();
  if (/cmr|transport|pārvad|parvad/.test(n)) return { stage: "transport", kind: "other" };
  if (/proforma|invoice|rechnung|r[eē]ķin|rekin/.test(n)) return { stage: "purchase", kind: "invoice" };
  if (/l[iī]gum|contract|vertrag/.test(n)) return { stage: "sale", kind: "contract" };
  return { stage: "purchase", kind: "other" };
}

function contentTypeFor(name: string): string {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    txt: "text/plain",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    edoc: "application/vnd.etsi.asic-e+zip",
  };
  return map[ext] ?? "application/octet-stream";
}

/** Sadala ierakstus pa auto mapēm (pirmais līmenis zem saknes). Saknes faili un "_" mapes netiek skatītas. */
export function groupStockEntries(entries: readonly DropboxEntry[], root: string): Map<string, FolderGroup> {
  const rootLower = root.toLowerCase().replace(/\/+$/, "");
  const groups = new Map<string, FolderGroup>();
  for (const e of entries) {
    const pl = e.pathLower || e.pathDisplay.toLowerCase();
    if (!pl.startsWith(`${rootLower}/`)) continue;
    const relDisplay = (e.pathDisplay || e.pathLower).slice(rootLower.length + 1);
    const segs = relDisplay.split("/");
    const top = segs[0] ?? "";
    if (!top || top.startsWith("_")) continue;
    const key = top.toLowerCase();
    const g = groups.get(key) ?? { name: top, folder: null, files: [], deleted: [] };
    if (segs.length === 1) {
      if (e.tag === "folder") g.folder = e;
      else if (e.tag === "deleted") g.deleted.push(e);
      else continue; // fails tieši saknē - nav auto mape
    } else if (e.tag === "file") g.files.push(e);
    else if (e.tag === "deleted") g.deleted.push(e);
    groups.set(key, g);
  }
  return groups;
}

type CarOwnerView = AutoparksCar & { owner?: AutoparksOwner };

function ownerOf(car: AutoparksCar): AutoparksOwner {
  return (car as CarOwnerView).owner === "DZA" ? "DZA" : "IRISS";
}

/** Atrod auto mapei: pēc saistītā id, citādi pēc VIN (tikai nesaistītiem un tikai, ja viennozīmīgi). */
export function carForStockFolder(cars: readonly AutoparksCar[], owner: AutoparksOwner, name: string, folderId: string): AutoparksCar | null {
  if (folderId) {
    const byId = cars.find((c) => c.dropboxFolderId === folderId);
    if (byId) return byId;
  }
  const candidates = cars.filter(
    (c) => !c.dropboxFolderId && ownerOf(c) === owner && c.vin && matchStockFolderByVin([name], c.vin).kind === "found",
  );
  return candidates.length === 1 ? candidates[0]! : null;
}

type PlannedCarChange = {
  carId: string;
  link: { id: string; path: string } | null;
  fill: AutoparksFillable;
  addFiles: AutoparksFile[];
  removeDropboxIds: string[];
};

async function readInfoTxt(client: DropboxClient, files: DropboxEntry[]): Promise<string | null> {
  const info = files.find((f) => f.name.toLowerCase() === "info.txt");
  if (!info || info.size > 256 * 1024) return null;
  try {
    return (await client.download(info.id || info.pathLower)).bytes.toString("utf8");
  } catch {
    return null;
  }
}

/** Plāno izmaiņas vienai mapei (tīkla lasīšana te, rakstīšana vēlāk vienā CAS solī). */
async function planGroup(
  client: DropboxClient,
  state: AutoparksState,
  owner: AutoparksOwner,
  g: FolderGroup,
  root = "",
): Promise<PlannedCarChange | null> {
  let folder = g.folder;
  // Inkrementālās izmaiņās mapes ieraksta var nebūt (mainījās tikai faili) - id nolasām pēc ceļa.
  if (!folder && root) {
    const meta = await client.getMetadata(`${root.replace(/\/+$/, "")}/${g.name}`);
    if (meta?.tag === "folder") folder = meta;
  }
  const car0 = carForStockFolder(state.cars, owner, g.name, folder?.id ?? "");
  if (!car0) return null;
  if (!folder || !folder.id) {
    const meta = car0.dropboxFolderId ? await client.getMetadata(car0.dropboxFolderId) : null;
    folder = meta?.tag === "folder" ? meta : null;
  }
  const link = folder && (car0.dropboxFolderId !== folder.id || car0.dropboxFolderPath !== folder.pathDisplay) ? { id: folder.id, path: folder.pathDisplay } : null;
  const infoTxt = await readInfoTxt(client, g.files);
  const fill = fillAutoparksFromStock(car0, folder?.name ?? g.name, infoTxt);
  const known = new Set(state.files.map((f) => f.dropboxId).filter(Boolean));
  const now = new Date().toISOString();
  const addFiles: AutoparksFile[] = g.files
    .filter((f) => f.id && !known.has(f.id) && !isStockPhoto(f.name) && f.name.toLowerCase() !== "info.txt" && !f.name.startsWith("."))
    .map((f) => {
      const cls = classifyStockDocument(f.name);
      return {
        id: `af-${randomUUID()}`,
        carId: car0.id,
        stage: cls.stage,
        kind: cls.kind,
        title: f.name.replace(/\.[a-z0-9]{2,5}$/i, "").slice(0, 160) || "Dokuments",
        fileName: f.name.slice(0, 200),
        contentType: contentTypeFor(f.name),
        size: f.size,
        blobPath: "",
        dropboxId: f.id,
        dropboxPath: f.pathDisplay,
        sha256: "",
        scanned: false,
        uploadedBy: "dropbox",
        uploadedByName: SYNC_ACTOR,
        createdAt: f.serverModified || now,
        deletedAt: "",
      };
    });
  // Dzēsti ieraksti nāk tikai ar ceļu. Atzīmējam tikai, ja fails pēc id tiešām vairs nav (pārvietošana id nemaina).
  const removeDropboxIds: string[] = [];
  const deletedPaths = new Set(g.deleted.map((d) => d.pathLower));
  for (const f of state.files) {
    if (f.carId !== car0.id || !f.dropboxId || f.deletedAt || !deletedPaths.has((f.dropboxPath ?? "").toLowerCase())) continue;
    if (!(await client.getMetadata(f.dropboxId))) removeDropboxIds.push(f.dropboxId);
  }
  if (!link && Object.keys(fill).length === 0 && addFiles.length === 0 && removeDropboxIds.length === 0) return null;
  return { carId: car0.id, link, fill, addFiles, removeDropboxIds };
}

/** Piemēro plānu: tikai tukšus laukus, bez dublikātiem; paralēli ievadītais paliek. */
export function applyPlannedChanges(state: AutoparksState, plans: readonly PlannedCarChange[]): { linked: number; filesAdded: number; filesRemoved: number; fieldsFilled: number } {
  const out = { linked: 0, filesAdded: 0, filesRemoved: 0, fieldsFilled: 0 };
  const now = new Date().toISOString();
  for (const p of plans) {
    const idx = state.cars.findIndex((c) => c.id === p.carId);
    if (idx < 0) continue;
    const car = { ...state.cars[idx]! };
    let changed = false;
    if (p.link && (!car.dropboxFolderId || car.dropboxFolderId === p.link.id)) {
      if (!car.dropboxFolderId) {
        out.linked += 1;
        state.events.push({ id: `ae-${randomUUID()}`, carId: car.id, at: now, actorName: SYNC_ACTOR, text: `Sasaistīts ar Dropbox mapi "${p.link.path.split("/").pop()}"` });
      }
      car.dropboxFolderId = p.link.id;
      car.dropboxFolderPath = p.link.path;
      changed = true;
    }
    for (const [k, v] of Object.entries(p.fill) as Array<[keyof AutoparksFillable, string | number]>) {
      if (k === "mileageKm") {
        if (car.mileageKm == null && typeof v === "number") {
          car.mileageKm = v;
          out.fieldsFilled += 1;
          changed = true;
        }
      } else if (typeof v === "string" && !String(car[k] ?? "").trim()) {
        (car as Record<string, unknown>)[k] = k === "vin" ? v.toUpperCase() : v;
        out.fieldsFilled += 1;
        changed = true;
      }
    }
    if (changed) state.cars[idx] = { ...car, updatedAt: now };
    const known = new Set(state.files.filter((f) => f.dropboxId).map((f) => f.dropboxId));
    for (const f of p.addFiles) {
      if (known.has(f.dropboxId)) continue;
      state.files.push(f);
      known.add(f.dropboxId);
      out.filesAdded += 1;
    }
    if (p.removeDropboxIds.length) {
      const rm = new Set(p.removeDropboxIds);
      state.files = state.files.map((f) => {
        if (f.carId !== car.id || f.deletedAt || !f.dropboxId || !rm.has(f.dropboxId)) return f;
        out.filesRemoved += 1;
        return { ...f, deletedAt: now };
      });
    }
  }
  return out;
}

async function listChanges(client: DropboxClient, root: string, cursor: string | undefined): Promise<{ entries: DropboxEntry[]; cursor: string; full: boolean }> {
  if (cursor) {
    try {
      const entries: DropboxEntry[] = [];
      let c = cursor;
      for (let i = 0; i < 50; i++) {
        const page = await client.listFolderContinue(c);
        entries.push(...page.entries);
        c = page.cursor || c;
        if (!page.hasMore) break;
      }
      return { entries, cursor: c, full: false };
    } catch (err) {
      // Kursors novecojis (reset) -> pilna pārskatīšana.
      if (!(err instanceof DropboxApiError && err.status === 409)) throw err;
    }
  }
  const all = await client.listAll(root, { recursive: true });
  return { entries: all.entries, cursor: all.cursor, full: true };
}

let inflight: Promise<AutoparksDropboxSyncResult> | null = null;

/** Dropbox webhook / manuāla sinhronizācija: /STOCK izmaiņas -> Autoparks (saites, dokumenti, info.txt lauki). */
export function runAutoparksDropboxSync(opts: { full?: boolean } = {}): Promise<AutoparksDropboxSyncResult> {
  inflight ??= syncOnce(opts).finally(() => {
    inflight = null;
  });
  return inflight;
}

async function syncOnce(opts: { full?: boolean }): Promise<AutoparksDropboxSyncResult> {
  const result: AutoparksDropboxSyncResult = { ok: true, roots: [], linked: 0, filesAdded: 0, filesRemoved: 0, fieldsFilled: 0 };
  const client = autoparksDropboxEnabled() ? getDropboxClient() : null;
  if (!client) return { ...result, ok: false, error: "dropbox_not_configured" };
  const cursors = ((await readLogisticsJsonFile(SYNC_FILE)) as { roots?: SyncCursors } | null)?.roots ?? {};
  const nextCursors: SyncCursors = {};
  for (const owner of OWNERS) {
    const root = autoparksDropboxRoot(owner);
    try {
      const meta = await client.getMetadata(root);
      if (!meta || meta.tag !== "folder") {
        result.roots.push({ root, entries: 0, full: false, skipped: "root_missing" });
        continue;
      }
      const changes = await listChanges(client, root, opts.full ? undefined : cursors[root]?.cursor);
      const state = await readAutoparksState();
      const plans: PlannedCarChange[] = [];
      for (const g of groupStockEntries(changes.entries, meta.pathDisplay || root).values()) {
        const plan = await planGroup(client, state, owner, g, meta.pathDisplay || root);
        if (plan) plans.push(plan);
      }
      if (plans.length) {
        const stats = await mutateAutoparksState((s) => {
          const r = applyPlannedChanges(s, plans);
          const any = r.linked + r.filesAdded + r.filesRemoved + r.fieldsFilled > 0 || plans.some((p) => p.link);
          return { result: r, write: any };
        });
        result.linked += stats.linked;
        result.filesAdded += stats.filesAdded;
        result.filesRemoved += stats.filesRemoved;
        result.fieldsFilled += stats.fieldsFilled;
      }
      nextCursors[root] = { cursor: changes.cursor, updatedAt: new Date().toISOString() };
      result.roots.push({ root, entries: changes.entries.length, full: changes.full });
    } catch (err) {
      result.ok = false;
      result.error = err instanceof Error ? err.message.slice(0, 200) : "sync_failed";
      result.roots.push({ root, entries: 0, full: false, skipped: "error" });
    }
  }
  if (Object.keys(nextCursors).length) {
    await mutateLogisticsJsonFile(SYNC_FILE, (raw) => {
      const prev = ((raw as { roots?: SyncCursors } | null)?.roots ?? {}) as SyncCursors;
      return { next: { version: 1, roots: { ...prev, ...nextCursors } }, result: undefined };
    });
  }
  return result;
}

/**
 * Jaunam auto: atrod vai izveido /STOCK mapi, saglabā id un nolasa info.txt/dokumentus.
 * Kļūdas tikai žurnālā - auto izveide no tā neatkarīga.
 */
export async function linkAutoparksCarToDropbox(carId: string, opts: { create?: boolean } = {}): Promise<{ linked: boolean; path?: string; error?: string }> {
  const client = autoparksDropboxEnabled() ? getDropboxClient() : null;
  if (!client) return { linked: false, error: "dropbox_not_configured" };
  try {
    const state = await readAutoparksState();
    const car = state.cars.find((c) => c.id === carId);
    if (!car) return { linked: false, error: "not_found" };
    // Bez VIN mapi automātiski neveidojam (nosaukums vēlāk nesakristu); to izdara pirmā faila augšupielāde.
    const folder = await resolveAutoparksCarFolder(client, car, { create: opts.create !== false && Boolean(vinTail(car.vin)) });
    if (!folder) return { linked: false };
    const listing = await client.listAll(folder.path, { recursive: false });
    const meta = await client.getMetadata(folder.id);
    const owner = ownerOf(car);
    const plan = await planGroup(client, { ...state, cars: state.cars.map((c) => (c.id === carId ? { ...c, dropboxFolderId: folder.id } : c)) }, owner, {
      name: meta?.name ?? folder.path.split("/").pop() ?? "",
      folder: meta,
      files: listing.entries.filter((e) => e.tag === "file"),
      deleted: [],
    });
    const linkPlan: PlannedCarChange = plan ?? { carId, link: null, fill: {}, addFiles: [], removeDropboxIds: [] };
    linkPlan.link = folder;
    await mutateAutoparksState((s) => ({ result: applyPlannedChanges(s, [linkPlan]) }));
    return { linked: true, path: folder.path };
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 200) : "link_failed";
    console.warn("[autoparks dropbox link]", msg);
    return { linked: false, error: msg };
  }
}
