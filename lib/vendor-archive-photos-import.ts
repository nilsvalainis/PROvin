import "server-only";

/**
 * Arhīva foto imports «Sludinājuma vēsturē» (tirgus) + grupas pārvietošana uz izsoļu portālu arhīvu (cc_vin) un atpakaļ.
 * Dedup pēc dHash: iekš importa, pret esošajām tirgus bildēm un pret izsoļu arhīva bildēm.
 * Atkārtota palaišana ir droša: jau esošas bildes izlaiž, ar roku pievienotās neaiztiek.
 */

import type { WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { makeCcVinPhotoId, readCcVinPhotoJpeg, writeCcVinPhotoJpeg } from "@/lib/admin-cc-vin-photo-store";
import {
  makeSourceBlockPhotoId,
  readSourceBlockPhotoJpeg,
  writeSourceBlockPhotoJpeg,
} from "@/lib/admin-source-block-photo-store";
import { CC_VIN_MAX_PHOTOS, makeCcVinPhotoGroupId, syncCcVinPhotoGroupsAndFlat, type CcVinPhotoGroup } from "@/lib/cc-vin-photo-types";
import sharp from "sharp";

import { dhashImage } from "@/lib/photo-dhash";
import {
  LISTING_HISTORY_MAX_PHOTOS,
  makeSourceBlockPhotoGroupId,
  syncSourceBlockPhotoGroupsAndFlat,
  type SourceBlockPhotoGroup,
} from "@/lib/source-block-photo-types";
import {
  ARCHIVE_DHASH_DUP_MAX_DISTANCE,
  dhashDistance,
  mergeVendorArchivePhotoGroups,
  type ArchiveIncomingGroup,
  type VendorArchiveSource,
  type VendorArchiveVia,
} from "@/lib/vendor-archive-photo-group";
import { extractVendorArchivePhotos, type ExtractedArchiveGroup } from "@/lib/vendor-archive-photos-pdf";
import { fetchVendorArchiveRelayPhotos, RELAY_ARCHIVE_REASON_LV, vendorArchiveRelayConfigured } from "@/lib/vendor-archive-relay";

const EXISTING_HASH_READ_LIMIT = 250;

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

type AnyGroup = {
  photos: { id: string }[];
  archive?: { source?: string; via?: string; hashes?: Record<string, string> };
};

type PhotoStore = "tirgus" | "cc_vin";
/** Zināma bilde: hash + kur tā glabājas; `upgradable` - tā paša avota PDF sīktēls (releja bilde to var aizstāt). */
type KnownPhoto = { hash: string; store: PhotoStore; id: string; upgradable: boolean };

/** Zināmie dHash: no grupu meta, citādi nolasa JPEG (līdz limitam). */
async function collectHashes(
  groups: AnyGroup[],
  store: PhotoStore,
  source: VendorArchiveSource,
  read: (id: string) => Promise<Buffer | null>,
): Promise<KnownPhoto[]> {
  const known: KnownPhoto[] = [];
  const toRead: { id: string; upgradable: boolean }[] = [];
  for (const g of groups) {
    const upgradable = g.archive?.source === source && g.archive.via !== "relay";
    for (const p of g.photos) {
      const h = g.archive?.hashes?.[p.id];
      if (h) known.push({ hash: h, store, id: p.id, upgradable });
      else if (toRead.length < EXISTING_HASH_READ_LIMIT) toRead.push({ id: p.id, upgradable });
    }
  }
  const read2 = await mapPool(toRead, 6, async (x) => {
    const buf = await read(x.id);
    const hash = buf ? await dhashImage(buf) : null;
    return hash ? { hash, store, id: x.id, upgradable: x.upgradable } : null;
  });
  return [...known, ...read2.filter((h): h is KnownPhoto => h != null)];
}

async function imageWidth(buf: Buffer | null): Promise<number> {
  if (!buf) return 0;
  try {
    return (await sharp(buf).metadata()).width ?? 0;
  } catch {
    return 0;
  }
}

export type VendorArchiveImportResult = {
  tirgus: WorkspaceSourceBlocks["tirgus"];
  added: number;
  duplicates: number;
  overLimit: number;
  /** Releja pilnā bilde aizstāja PDF sīktēlu (tas pats id, lielāka izšķirtspēja). */
  upgraded: number;
  extracted: number;
  notes: string[];
  changed: boolean;
};

/** Jau izvilktas grupas -> Blob + tirgus grupas (kopīgs PDF un releja ceļam). */
export async function importVendorArchiveGroups(args: {
  sessionId: string;
  source: VendorArchiveSource;
  via: VendorArchiveVia;
  groups: ExtractedArchiveGroup[];
  sourceBlocks: WorkspaceSourceBlocks;
  notes?: string[];
}): Promise<VendorArchiveImportResult> {
  const { sessionId, source, via, sourceBlocks } = args;
  const tirgus = sourceBlocks.tirgus;
  const tirgusGroups = (tirgus.photoGroups ?? []) as SourceBlockPhotoGroup[];
  const ccGroups = (sourceBlocks.cc_vin?.photoGroups ?? []) as CcVinPhotoGroup[];
  const extracted = args.groups.reduce((n, g) => n + g.photos.length, 0);
  const seen: KnownPhoto[] = [
    ...(await collectHashes(tirgusGroups, "tirgus", source, (id) => readSourceBlockPhotoJpeg(sessionId, id))),
    ...(await collectHashes(ccGroups, "cc_vin", source, (id) => readCcVinPhotoJpeg(sessionId, id))),
  ];
  let capacity = LISTING_HISTORY_MAX_PHOTOS - tirgusGroups.reduce((n, g) => n + g.photos.length, 0);
  let duplicates = 0;
  let overLimit = 0;
  let upgraded = 0;
  const upgradedIds = new Set<string>();
  const incoming: ArchiveIncomingGroup[] = [];
  for (const g of args.groups) {
    const inc: ArchiveIncomingGroup = { source, date: g.date, via, ...(g.expected ? { expected: g.expected } : {}), photos: [] };
    for (const photo of g.photos) {
      const hash = await dhashImage(photo.jpeg);
      if (!hash) continue;
      const match = seen.find((k) => dhashDistance(hash, k.hash) <= ARCHIVE_DHASH_DUP_MAX_DISTANCE);
      if (match) {
        // 2. fāze: tā paša avota PDF sīktēlu aizstāj ar releja pilno bildi (tas pats id - grupas un PDF nemainās).
        if (via === "relay" && match.upgradable && !upgradedIds.has(match.id)) {
          const old = match.store === "tirgus" ? await readSourceBlockPhotoJpeg(sessionId, match.id) : await readCcVinPhotoJpeg(sessionId, match.id);
          if (photo.width > (await imageWidth(old)) * 1.15) {
            if (match.store === "tirgus") await writeSourceBlockPhotoJpeg(sessionId, match.id, photo.jpeg);
            else await writeCcVinPhotoJpeg(sessionId, match.id, photo.jpeg);
            upgradedIds.add(match.id);
            upgraded++;
            continue;
          }
        }
        duplicates++;
        continue;
      }
      if (capacity <= 0) {
        overLimit++;
        continue;
      }
      const id = makeSourceBlockPhotoId();
      await writeSourceBlockPhotoJpeg(sessionId, id, photo.jpeg);
      seen.push({ hash, store: "tirgus", id, upgradable: false });
      capacity--;
      inc.photos.push({ id, hash });
    }
    if (inc.photos.length) incoming.push(inc);
  }
  const notes = [...(args.notes ?? [])];
  if (upgraded) notes.push(`${upgraded} PDF sīktēli aizstāti ar pilnām bildēm.`);
  if (duplicates) notes.push(`${duplicates} dublikāti izlaisti.`);
  if (overLimit) notes.push(`${overLimit} foto neielikti - sasniegts ${LISTING_HISTORY_MAX_PHOTOS} foto griests.`);
  // Tirgus grupas, kurās bildes aizstātas -> «pilnas bildes» (tikai meta; id paliek).
  const baseGroups = upgradedIds.size
    ? tirgusGroups.map((g) =>
        g.archive && g.photos.some((p) => upgradedIds.has(p.id)) ? { ...g, archive: { ...g.archive, via: "relay" as const } } : g,
      )
    : tirgusGroups;
  const metaChanged = baseGroups !== tirgusGroups && baseGroups.some((g, i) => g !== tirgusGroups[i]);
  if (!incoming.length) {
    if (!metaChanged) return { tirgus, added: 0, duplicates, overLimit, upgraded, extracted, notes, changed: false };
    const syncedMeta = syncSourceBlockPhotoGroupsAndFlat(baseGroups, LISTING_HISTORY_MAX_PHOTOS);
    return {
      tirgus: { ...tirgus, photoGroups: syncedMeta.photoGroups, photos: syncedMeta.photos },
      added: 0,
      duplicates,
      overLimit,
      upgraded,
      extracted,
      notes,
      changed: true,
    };
  }
  const merged = mergeVendorArchivePhotoGroups(baseGroups, incoming, {
    max: LISTING_HISTORY_MAX_PHOTOS,
    makeGroupId: makeSourceBlockPhotoGroupId,
  });
  const synced = syncSourceBlockPhotoGroupsAndFlat(merged.groups, LISTING_HISTORY_MAX_PHOTOS);
  return {
    tirgus: { ...tirgus, photoGroups: synced.photoGroups, photos: synced.photos },
    added: merged.added,
    duplicates,
    overLimit: overLimit + merged.overLimit,
    upgraded,
    extracted,
    notes,
    changed: merged.added > 0 || metaChanged,
  };
}

export async function importVendorArchivePhotosFromPdf(args: {
  sessionId: string;
  source: VendorArchiveSource;
  pdfBytes: Uint8Array;
  sourceBlocks: WorkspaceSourceBlocks;
}): Promise<VendorArchiveImportResult> {
  const res = await extractVendorArchivePhotos(args.source, args.pdfBytes);
  return importVendorArchiveGroups({
    sessionId: args.sessionId,
    source: args.source,
    via: "pdf",
    groups: res.groups,
    sourceBlocks: args.sourceBlocks,
    notes: res.notes,
  });
}

/**
 * PDF sīktēli + (ja relejs pieslēgts un VIN zināms) releja pilnās bildes: tās aizstāj PDF versijas (dHash),
 * jaunās pievieno. Relejs nepieejams -> paliek PDF versijas.
 */
export async function importVendorArchivePhotosFull(args: {
  sessionId: string;
  source: VendorArchiveSource;
  pdfBytes: Uint8Array | null;
  vin?: string;
  sourceBlocks: WorkspaceSourceBlocks;
  relayTimeoutMs?: number;
}): Promise<VendorArchiveImportResult> {
  const fromPdf = args.pdfBytes
    ? await importVendorArchivePhotosFromPdf({ ...args, pdfBytes: args.pdfBytes })
    : null;
  const blocks = fromPdf?.changed ? { ...args.sourceBlocks, tirgus: fromPdf.tirgus } : args.sourceBlocks;
  const vin = (args.vin ?? "").trim();
  if (!vin || !vendorArchiveRelayConfigured(args.source)) {
    return fromPdf ?? { tirgus: blocks.tirgus, added: 0, duplicates: 0, overLimit: 0, upgraded: 0, extracted: 0, notes: [], changed: false };
  }
  const relay = await fetchVendorArchiveRelayPhotos(args.source, vin, { timeoutMs: args.relayTimeoutMs });
  if (!relay.ok) {
    const note = RELAY_ARCHIVE_REASON_LV[relay.reason];
    const base = fromPdf ?? { tirgus: blocks.tirgus, added: 0, duplicates: 0, overLimit: 0, upgraded: 0, extracted: 0, notes: [], changed: false };
    return { ...base, notes: note ? [...base.notes, note] : base.notes };
  }
  const fromRelay = await importVendorArchiveGroups({
    sessionId: args.sessionId,
    source: args.source,
    via: "relay",
    groups: relay.groups,
    sourceBlocks: blocks,
  });
  return {
    tirgus: fromRelay.tirgus,
    added: (fromPdf?.added ?? 0) + fromRelay.added,
    duplicates: fromRelay.duplicates,
    overLimit: (fromPdf?.overLimit ?? 0) + fromRelay.overLimit,
    upgraded: fromRelay.upgraded,
    extracted: (fromPdf?.extracted ?? 0) + fromRelay.extracted,
    notes: [...(fromPdf?.notes ?? []).filter((n) => !/dublikāti izlaisti/.test(n)), ...fromRelay.notes],
    changed: Boolean(fromPdf?.changed) || fromRelay.changed,
  };
}

/** Import, kas nekad nemet: kļūdu gadījumā bloks paliek kā bija, piezīme paskaidro. */
export async function tryImportVendorArchivePhotosFromPdf(
  args: Parameters<typeof importVendorArchivePhotosFull>[0],
): Promise<VendorArchiveImportResult> {
  try {
    return await importVendorArchivePhotosFull(args);
  } catch (e) {
    console.error("[vendor-archive-photos] import failed", e instanceof Error ? e.message.slice(0, 200) : "unknown");
    return {
      tirgus: args.sourceBlocks.tirgus,
      added: 0,
      duplicates: 0,
      overLimit: 0,
      upgraded: 0,
      extracted: 0,
      notes: ["Arhīva foto neizdevās nolasīt."],
      changed: false,
    };
  }
}

export type ArchiveGroupMoveTarget = "cc_vin" | "tirgus";

/**
 * Pārvieto vienu grupu starp «Sludinājuma vēsturi» un izsoļu portālu arhīvu: JPEG kopē uz otru krātuvi (jauni id),
 * meta (avots, datums, hash) ceļo līdzi. Vecās bildes atsauces pazūd -> klients tās atzīmē kā dzēstas (kapakmeņi).
 */
export async function moveVendorArchiveGroup(args: {
  sessionId: string;
  groupId: string;
  to: ArchiveGroupMoveTarget;
  sourceBlocks: WorkspaceSourceBlocks;
}): Promise<
  | { ok: true; tirgus: WorkspaceSourceBlocks["tirgus"]; cc_vin: WorkspaceSourceBlocks["cc_vin"]; moved: number }
  | { ok: false; error: "group_not_found" | "photo_limit" | "photo_missing" }
> {
  const { sessionId, groupId, to, sourceBlocks } = args;
  const tirgus = sourceBlocks.tirgus;
  const cc = sourceBlocks.cc_vin;
  const tirgusGroups = (tirgus.photoGroups ?? []) as SourceBlockPhotoGroup[];
  const ccGroups = (cc.photoGroups ?? []) as CcVinPhotoGroup[];
  const group: SourceBlockPhotoGroup | CcVinPhotoGroup | undefined =
    to === "cc_vin" ? tirgusGroups.find((g) => g.id === groupId) : ccGroups.find((g) => g.id === groupId);
  if (!group) return { ok: false, error: "group_not_found" };
  const targetCount = (to === "cc_vin" ? ccGroups : tirgusGroups).reduce((n, g) => n + g.photos.length, 0);
  const targetMax = to === "cc_vin" ? CC_VIN_MAX_PHOTOS : LISTING_HISTORY_MAX_PHOTOS;
  if (targetCount + group.photos.length > targetMax) return { ok: false, error: "photo_limit" };

  const read = to === "cc_vin" ? readSourceBlockPhotoJpeg : readCcVinPhotoJpeg;
  const write = to === "cc_vin" ? writeCcVinPhotoJpeg : writeSourceBlockPhotoJpeg;
  const makeId = to === "cc_vin" ? makeCcVinPhotoId : makeSourceBlockPhotoId;
  const idMap = new Map<string, string>();
  for (const p of group.photos) {
    const buf = await read(sessionId, p.id);
    if (!buf) return { ok: false, error: "photo_missing" };
    const id = makeId();
    await write(sessionId, id, buf);
    idMap.set(p.id, id);
  }
  const hashes = group.archive?.hashes
    ? Object.fromEntries(
        Object.entries(group.archive.hashes)
          .filter(([id]) => idMap.has(id))
          .map(([id, h]) => [idMap.get(id)!, h]),
      )
    : undefined;
  const moved = {
    id: to === "cc_vin" ? makeCcVinPhotoGroupId() : makeSourceBlockPhotoGroupId(),
    title: group.title,
    photos: group.photos.map((p) => ({ id: idMap.get(p.id)! })),
    ...(group.archive ? { archive: { ...group.archive, ...(hashes ? { hashes } : {}) } } : {}),
  };
  if (to === "cc_vin") {
    const nextTirgus = syncSourceBlockPhotoGroupsAndFlat(tirgusGroups.filter((g) => g.id !== groupId), LISTING_HISTORY_MAX_PHOTOS);
    const nextCc = syncCcVinPhotoGroupsAndFlat([...ccGroups, moved as CcVinPhotoGroup]);
    return {
      ok: true,
      tirgus: { ...tirgus, ...nextTirgus },
      cc_vin: { ...cc, ...nextCc },
      moved: moved.photos.length,
    };
  }
  const nextCc = syncCcVinPhotoGroupsAndFlat(ccGroups.filter((g) => g.id !== groupId));
  const nextTirgus = syncSourceBlockPhotoGroupsAndFlat([...tirgusGroups, moved as SourceBlockPhotoGroup], LISTING_HISTORY_MAX_PHOTOS);
  return {
    ok: true,
    tirgus: { ...tirgus, ...nextTirgus },
    cc_vin: { ...cc, ...nextCc },
    moved: moved.photos.length,
  };
}
