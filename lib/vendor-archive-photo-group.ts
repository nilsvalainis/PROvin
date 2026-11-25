/**
 * Arhīva foto no AutoDNA / CarVertical atskaitēm (25.11, Nila lēmumi):
 * - pēc noklusējuma «Sludinājuma vēsture» (tirgus) grupās, viena grupa = viens datums;
 * - klientam virsrakstā TIKAI datums; avots redzams adminā (šī meta), klientam - tikai ja ieslēgts «Rādīt avotu klientam»;
 * - grupu ar vienu klikšķi var pārvietot uz izsoļu portālu arhīvu (cc_vin) un atpakaļ - meta ceļo līdzi.
 *
 * Tīrs modulis (bez sharp / Blob) - der gan serverim, gan admin UI.
 */

export const VENDOR_ARCHIVE_SOURCES = ["carvertical", "autodna"] as const;
export type VendorArchiveSource = (typeof VENDOR_ARCHIVE_SOURCES)[number];

/** Kā foto iegūti: no PDF (sīktēli) vai caur releju (pilnas bildes, 2. fāze). */
export type VendorArchiveVia = "pdf" | "relay";

export type VendorArchiveGroupMeta = {
  source: VendorArchiveSource;
  /** Datums kā atskaitē: «07.2020» (CarVertical) vai «12.11.2024» (AutoDNA). */
  date: string;
  via: VendorArchiveVia;
  /** Admins ieslēdzis «Rādīt avotu klientam». */
  showSource?: boolean;
  /** Atskaitē norādītais skaits (AutoDNA «Fotogrāfijas N»), ja zināms. */
  expected?: number;
  /** photoId -> dHash (16 hex), dublikātu atpazīšanai bez bilžu pārlasīšanas. */
  hashes?: Record<string, string>;
};

export const VENDOR_ARCHIVE_SOURCE_LABEL: Record<VendorArchiveSource, string> = {
  carvertical: "CarVertical",
  autodna: "AutoDNA",
};

/** Hamming attālums dHash; ≤ šī = tā pati bilde (cita kompresija / izmērs). */
export const ARCHIVE_DHASH_DUP_MAX_DISTANCE = 10;

const DHASH_RE = /^[a-f0-9]{16}$/;

export function isVendorArchiveSource(v: unknown): v is VendorArchiveSource {
  return typeof v === "string" && (VENDOR_ARCHIVE_SOURCES as readonly string[]).includes(v);
}

function cleanDate(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().replace(/\.$/, "").slice(0, 20) : "";
}

/** Normalizē meta; `photoIds` - atstāj hash tikai grupā esošām bildēm. */
export function parseVendorArchiveGroupMeta(
  raw: unknown,
  photoIds?: readonly string[],
): VendorArchiveGroupMeta | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (!isVendorArchiveSource(o.source)) return undefined;
  const date = cleanDate(o.date);
  const via: VendorArchiveVia = o.via === "relay" ? "relay" : "pdf";
  const expected =
    typeof o.expected === "number" && Number.isFinite(o.expected) && o.expected > 0 && o.expected < 1000
      ? Math.floor(o.expected)
      : undefined;
  let hashes: Record<string, string> | undefined;
  if (o.hashes && typeof o.hashes === "object") {
    const keep = photoIds ? new Set(photoIds) : null;
    for (const [id, h] of Object.entries(o.hashes as Record<string, unknown>)) {
      if (typeof h !== "string" || !DHASH_RE.test(h)) continue;
      if (keep && !keep.has(id)) continue;
      (hashes ??= {})[id] = h;
    }
  }
  return {
    source: o.source,
    date,
    via,
    ...(o.showSource === true ? { showSource: true } : {}),
    ...(expected ? { expected } : {}),
    ...(hashes ? { hashes } : {}),
  };
}

/** Virsraksts, ko redz klients (PDF): tikai datums vai «Avots · datums». */
export function vendorArchiveClientTitle(meta: Pick<VendorArchiveGroupMeta, "source" | "date">, showSource: boolean): string {
  const date = meta.date.trim();
  if (!showSource) return date;
  return [VENDOR_ARCHIVE_SOURCE_LABEL[meta.source], date].filter(Boolean).join(" · ");
}

type GroupWithArchive = { id: string; title: string; photos: { id: string }[]; archive?: VendorArchiveGroupMeta };

/**
 * «Rādīt avotu klientam»: ja virsraksts ir automātiskais (vai tukšs), to pārslēdz;
 * ar roku ierakstītu parakstu neaiztiek.
 */
export function setVendorArchiveShowSource<G extends GroupWithArchive>(group: G, show: boolean): G {
  const meta = group.archive;
  if (!meta) return group;
  const current = group.title.trim();
  const autoTitles = [vendorArchiveClientTitle(meta, true), vendorArchiveClientTitle(meta, false), ""];
  const title = autoTitles.includes(current) ? vendorArchiveClientTitle(meta, show) : group.title;
  const nextMeta: VendorArchiveGroupMeta = { ...meta };
  if (show) nextMeta.showSource = true;
  else delete nextMeta.showSource;
  return { ...group, title, archive: nextMeta };
}

/** Admin rindai: «CarVertical · 07.2020 · no PDF». */
export function vendorArchiveAdminLabel(meta: VendorArchiveGroupMeta): string {
  return [
    VENDOR_ARCHIVE_SOURCE_LABEL[meta.source],
    meta.date,
    meta.via === "relay" ? "pilnas bildes" : "no PDF",
  ]
    .filter(Boolean)
    .join(" · ");
}

// ---------------------------------------------------------------------------------------------
// dHash salīdzināšana (tīra)

export function dhashDistance(a: string, b: string): number {
  if (!DHASH_RE.test(a) || !DHASH_RE.test(b)) return 64;
  let n = 0;
  for (let i = 0; i < 16; i++) {
    let x = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    while (x) {
      n += x & 1;
      x >>= 1;
    }
  }
  return n;
}

export function isDuplicateDhash(
  hash: string,
  others: Iterable<string>,
  maxDistance = ARCHIVE_DHASH_DUP_MAX_DISTANCE,
): boolean {
  for (const o of others) if (dhashDistance(hash, o) <= maxDistance) return true;
  return false;
}

// ---------------------------------------------------------------------------------------------
// Grupu sapludināšana (tīra)

export type ArchiveIncomingPhoto = { id: string; hash: string };
export type ArchiveIncomingGroup = {
  source: VendorArchiveSource;
  date: string;
  via: VendorArchiveVia;
  expected?: number;
  photos: ArchiveIncomingPhoto[];
};

function countPhotos(groups: { photos: unknown[] }[]): number {
  return groups.reduce((n, g) => n + g.photos.length, 0);
}

/**
 * Ieliek jaunās bildes grupās: tas pats avots + datums -> esošā grupa (arī ja divreiz vienā atskaitē),
 * citādi jauna grupa ar virsrakstu = datums. Griests `max` kopā visām grupām.
 */
export function mergeVendorArchivePhotoGroups<G extends GroupWithArchive>(
  groups: G[],
  incoming: ArchiveIncomingGroup[],
  opts: { max: number; makeGroupId: () => string },
): { groups: G[]; added: number; overLimit: number } {
  const out = groups.map((g) => ({ ...g, photos: [...g.photos] }));
  let total = countPhotos(out);
  let added = 0;
  let overLimit = 0;
  for (const inc of incoming) {
    const date = cleanDate(inc.date);
    let target = out.find((g) => g.archive?.source === inc.source && g.archive.date === date);
    for (const ph of inc.photos) {
      if (total >= opts.max) {
        overLimit++;
        continue;
      }
      if (!target) {
        const archive: VendorArchiveGroupMeta = {
          source: inc.source,
          date,
          via: inc.via,
          ...(inc.expected ? { expected: inc.expected } : {}),
        };
        target = { id: opts.makeGroupId(), title: vendorArchiveClientTitle(archive, false), photos: [], archive } as unknown as G;
        out.push(target);
      }
      if (target.photos.some((p) => p.id === ph.id)) continue;
      target.photos.push({ id: ph.id });
      const meta = target.archive!;
      target.archive = {
        ...meta,
        ...(inc.via === "relay" ? { via: "relay" as const } : {}),
        ...(inc.expected && !meta.expected ? { expected: inc.expected } : {}),
        hashes: { ...(meta.hashes ?? {}), [ph.id]: ph.hash },
      };
      total++;
      added++;
    }
  }
  return { groups: out, added, overLimit };
}
