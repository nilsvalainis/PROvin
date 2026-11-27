import "server-only";

/**
 * Pēc arhīva foto importa (Nils 25.11):
 * 1) visas šī avota arhīva foto -> pasūtījuma Dropbox mapē `Arhīva foto/<Avots> <datums>/NN.jpg` (bez dublikātiem:
 *    jau esošos failus izlaiž; releja pilnā bilde pārraksta PDF sīktēlu);
 * 2) ja «PDF augšas bilde» nekad nav aizpildīta - ieliek ārpuses priekšas foto no arhīva.
 * Nekad nemet kļūdu - imports paliek derīgs arī bez Dropbox.
 */

import type { WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { readCcVinPhotoJpeg } from "@/lib/admin-cc-vin-photo-store";
import { makeListingAnalysisPhotoId, writeListingAnalysisPhotoJpeg } from "@/lib/admin-listing-analysis-photo-store";
import { readSourceBlockPhotoJpeg } from "@/lib/admin-source-block-photo-store";
import { getDropboxClient, type DropboxClient } from "@/lib/dropbox-client";
import { currentOrderDropboxFolderPath, ensureOrderDropboxFolder } from "@/lib/order-dropbox";
import sharp from "sharp";

import { archiveCoverAllowed, archiveCoverCandidates, pickArchiveCoverPhotoId } from "@/lib/vendor-archive-cover";
import type { VendorArchiveSource } from "@/lib/vendor-archive-photo-group";
import {
  ARCHIVE_DROPBOX_ROOT,
  archiveDropboxFolders,
  planArchiveDropboxUploads,
} from "@/lib/vendor-archive-photos-dropbox-path";

const LOG = "[vendor-archive-sync]";

type Groups = { id: string; photos: { id: string }[]; archive?: { source: VendorArchiveSource; date: string } }[];

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

function archiveGroups(blocks: WorkspaceSourceBlocks): { tirgus: Groups; cc: Groups } {
  return {
    tirgus: (blocks.tirgus.photoGroups ?? []) as Groups,
    cc: (blocks.cc_vin?.photoGroups ?? []) as Groups,
  };
}

/** Bildes JPEG no tās krātuves, kurā tā ir (tirgus vai izsoļu arhīvs). */
function makeReader(sessionId: string, blocks: WorkspaceSourceBlocks) {
  const { cc } = archiveGroups(blocks);
  const ccIds = new Set(cc.flatMap((g) => g.photos.map((p) => p.id)));
  return (id: string) => (ccIds.has(id) ? readCcVinPhotoJpeg(sessionId, id) : readSourceBlockPhotoJpeg(sessionId, id));
}

export async function mirrorVendorArchivePhotosToDropbox(args: {
  sessionId: string;
  source: VendorArchiveSource;
  sourceBlocks: WorkspaceSourceBlocks;
  upgradedIds?: readonly string[];
  client?: DropboxClient | null;
}): Promise<{ uploaded: number; failed: number; folder: string | null }> {
  const client = args.client === undefined ? getDropboxClient() : args.client;
  if (!client) return { uploaded: 0, failed: 0, folder: null };
  const { tirgus, cc } = archiveGroups(args.sourceBlocks);
  const groups = [...tirgus, ...cc];
  const folders = archiveDropboxFolders(groups, args.source);
  if (!folders.length) return { uploaded: 0, failed: 0, folder: null };
  const rec = await ensureOrderDropboxFolder(args.sessionId, { client, materialize: true });
  if (!rec || rec.state !== "ok" || !rec.path) return { uploaded: 0, failed: 0, folder: null };
  // Ceļš pēc mapes id (ne ieraksta `path`): ja mapi tikko pārdēvēja, foto nedrīkst izveidot otru mapi ar veco nosaukumu.
  const orderFolder = await currentOrderDropboxFolderPath(client, rec);
  if (!orderFolder) return { uploaded: 0, failed: 0, folder: null };
  const root = `${orderFolder}/${ARCHIVE_DROPBOX_ROOT}`;
  const existing = new Map<string, Set<string>>();
  for (const f of folders) {
    try {
      const { entries } = await client.listAll(`${root}/${f}`, { maxPages: 5 });
      existing.set(f, new Set(entries.filter((e) => e.tag === "file").map((e) => e.name.toLowerCase())));
    } catch {
      existing.set(f, new Set()); // mapes vēl nav
    }
  }
  const plan = planArchiveDropboxUploads({ groups, source: args.source, existing, upgraded: new Set(args.upgradedIds ?? []) });
  const read = makeReader(args.sessionId, args.sourceBlocks);
  const res = await mapPool(plan, 4, async (item) => {
    try {
      const buf = await read(item.photoId);
      if (!buf) return false;
      await client.upload(`${root}/${item.folder}/${item.name}`, new Uint8Array(buf), item.overwrite ? "overwrite" : "add", {
        autorename: false,
      });
      return true;
    } catch (e) {
      console.warn(`${LOG} upload failed`, { sessionId: args.sessionId.slice(-8), error: e instanceof Error ? e.message.slice(0, 80) : "unknown" });
      return false;
    }
  });
  const uploaded = res.filter(Boolean).length;
  return { uploaded, failed: res.length - uploaded, folder: `${root}` };
}

/**
 * Titulbilde no arhīva: kopē izvēlēto JPEG «Sludinājuma analīzes» krātuvē (jauns la_ph_ id) un atgriež atjaunoto bloku.
 * null - nav jāmaina (Nila titulbilde jau ir / noņemta / nav kandidātu).
 */
export async function pickVendorArchiveCover(args: {
  sessionId: string;
  source: VendorArchiveSource;
  sourceBlocks: WorkspaceSourceBlocks;
}): Promise<WorkspaceSourceBlocks["listing_analysis"] | null> {
  const la = args.sourceBlocks.listing_analysis;
  if (!la || !archiveCoverAllowed(la.coverPhoto)) return null;
  const { tirgus, cc } = archiveGroups(args.sourceBlocks);
  // Vispirms «Sludinājuma vēsture» (tirgus), tad izsoļu arhīvs.
  const candidates = [...archiveCoverCandidates(tirgus, [args.source]), ...archiveCoverCandidates(cc, [args.source])];
  if (!candidates.length) return null;
  const read = makeReader(args.sessionId, args.sourceBlocks);
  const bufs = new Map<string, Buffer>();
  const dims = new Map<string, { width: number; height: number }>();
  for (const c of candidates.slice(0, 9)) {
    const buf = await read(c.photoId).catch(() => null);
    if (!buf) continue;
    try {
      const m = await sharp(buf).metadata();
      bufs.set(c.photoId, buf);
      dims.set(c.photoId, { width: m.width ?? 0, height: m.height ?? 0 });
    } catch {
      /* bojāta bilde */
    }
  }
  const pick = pickArchiveCoverPhotoId(candidates, dims);
  const buf = pick ? bufs.get(pick) : null;
  if (!buf) return null;
  const id = makeListingAnalysisPhotoId();
  await writeListingAnalysisPhotoJpeg(args.sessionId, id, buf);
  return { ...la, coverPhoto: { id } };
}

/** Abi soļi kopā; kļūdas tikai logā + piezīmē. */
export async function finalizeVendorArchiveImport(args: {
  sessionId: string;
  source: VendorArchiveSource;
  sourceBlocks: WorkspaceSourceBlocks;
  upgradedIds?: readonly string[];
}): Promise<{ notes: string[]; listingAnalysis: WorkspaceSourceBlocks["listing_analysis"] | null }> {
  const notes: string[] = [];
  let listingAnalysis: WorkspaceSourceBlocks["listing_analysis"] | null = null;
  try {
    listingAnalysis = await pickVendorArchiveCover(args);
    if (listingAnalysis) notes.push("Titulbilde ielikta automātiski no arhīva foto.");
  } catch (e) {
    console.error(`${LOG} cover failed`, e instanceof Error ? e.message.slice(0, 120) : "unknown");
  }
  try {
    const d = await mirrorVendorArchivePhotosToDropbox(args);
    if (d.uploaded) notes.push(`${d.uploaded} foto saglabāti Dropbox mapē «${ARCHIVE_DROPBOX_ROOT}».`);
    if (d.failed) notes.push(`${d.failed} foto neizdevās saglabāt Dropbox.`);
  } catch (e) {
    console.error(`${LOG} dropbox failed`, e instanceof Error ? e.message.slice(0, 120) : "unknown");
    notes.push("Arhīva foto neizdevās saglabāt Dropbox.");
  }
  return { notes, listingAnalysis };
}
