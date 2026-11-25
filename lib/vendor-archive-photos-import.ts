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
import { dhashImage } from "@/lib/photo-dhash";
import {
  LISTING_HISTORY_MAX_PHOTOS,
  makeSourceBlockPhotoGroupId,
  syncSourceBlockPhotoGroupsAndFlat,
  type SourceBlockPhotoGroup,
} from "@/lib/source-block-photo-types";
import {
  isDuplicateDhash,
  mergeVendorArchivePhotoGroups,
  type ArchiveIncomingGroup,
  type VendorArchiveSource,
  type VendorArchiveVia,
} from "@/lib/vendor-archive-photo-group";
import { extractVendorArchivePhotos, type ExtractedArchiveGroup } from "@/lib/vendor-archive-photos-pdf";

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

type AnyGroup = { photos: { id: string }[]; archive?: { hashes?: Record<string, string> } };

/** Zināmie dHash: no grupu meta, citādi nolasa JPEG (līdz limitam). */
async function collectHashes(groups: AnyGroup[], read: (id: string) => Promise<Buffer | null>): Promise<string[]> {
  const known: string[] = [];
  const toRead: string[] = [];
  for (const g of groups) {
    for (const p of g.photos) {
      const h = g.archive?.hashes?.[p.id];
      if (h) known.push(h);
      else if (toRead.length < EXISTING_HASH_READ_LIMIT) toRead.push(p.id);
    }
  }
  const read2 = await mapPool(toRead, 6, async (id) => {
    const buf = await read(id);
    return buf ? dhashImage(buf) : null;
  });
  return [...known, ...read2.filter((h): h is string => Boolean(h))];
}

export type VendorArchiveImportResult = {
  tirgus: WorkspaceSourceBlocks["tirgus"];
  added: number;
  duplicates: number;
  overLimit: number;
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
  const seen = [
    ...(await collectHashes(tirgusGroups, (id) => readSourceBlockPhotoJpeg(sessionId, id))),
    ...(await collectHashes(ccGroups, (id) => readCcVinPhotoJpeg(sessionId, id))),
  ];
  let capacity = LISTING_HISTORY_MAX_PHOTOS - tirgusGroups.reduce((n, g) => n + g.photos.length, 0);
  let duplicates = 0;
  let overLimit = 0;
  const incoming: ArchiveIncomingGroup[] = [];
  for (const g of args.groups) {
    const inc: ArchiveIncomingGroup = { source, date: g.date, via, ...(g.expected ? { expected: g.expected } : {}), photos: [] };
    for (const photo of g.photos) {
      const hash = await dhashImage(photo.jpeg);
      if (!hash) continue;
      if (isDuplicateDhash(hash, seen)) {
        duplicates++;
        continue;
      }
      if (capacity <= 0) {
        overLimit++;
        continue;
      }
      const id = makeSourceBlockPhotoId();
      await writeSourceBlockPhotoJpeg(sessionId, id, photo.jpeg);
      seen.push(hash);
      capacity--;
      inc.photos.push({ id, hash });
    }
    if (inc.photos.length) incoming.push(inc);
  }
  const notes = [...(args.notes ?? [])];
  if (duplicates) notes.push(`${duplicates} dublikāti izlaisti.`);
  if (overLimit) notes.push(`${overLimit} foto neielikti - sasniegts ${LISTING_HISTORY_MAX_PHOTOS} foto griests.`);
  if (!incoming.length) return { tirgus, added: 0, duplicates, overLimit, extracted, notes, changed: false };
  const merged = mergeVendorArchivePhotoGroups(tirgusGroups, incoming, {
    max: LISTING_HISTORY_MAX_PHOTOS,
    makeGroupId: makeSourceBlockPhotoGroupId,
  });
  const synced = syncSourceBlockPhotoGroupsAndFlat(merged.groups, LISTING_HISTORY_MAX_PHOTOS);
  return {
    tirgus: { ...tirgus, photoGroups: synced.photoGroups, photos: synced.photos },
    added: merged.added,
    duplicates,
    overLimit: overLimit + merged.overLimit,
    extracted,
    notes,
    changed: merged.added > 0,
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

/** Import, kas nekad nemet: kļūdu gadījumā bloks paliek kā bija, piezīme paskaidro. */
export async function tryImportVendorArchivePhotosFromPdf(
  args: Parameters<typeof importVendorArchivePhotosFromPdf>[0],
): Promise<VendorArchiveImportResult> {
  try {
    return await importVendorArchivePhotosFromPdf(args);
  } catch (e) {
    console.error("[vendor-archive-photos] import failed", e instanceof Error ? e.message.slice(0, 200) : "unknown");
    return {
      tirgus: args.sourceBlocks.tirgus,
      added: 0,
      duplicates: 0,
      overLimit: 0,
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
