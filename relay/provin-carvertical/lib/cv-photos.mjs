/**
 * CarVertical arhīva foto no JAU NOPIRKTAS atskaites (tīrā loģika, testējama bez pārlūka).
 *
 * Kā to dara pati CarVertical atskaite (viewer.carvertical.com, JS izpētīts 25.11.2026):
 *   GET api.carvertical.net/reports/{id} -> { dataDict: { photo: { version, records } , ... } }
 *   - version "1.x": records [{ date, contentType: "application/zip" | "image/jpeg", photos: [...] }]
 *       ZIP: photos = [{ setId }] (-> GET /reports/{id}/photos?setId=) vai [{ bucket, key }] (-> https://{bucket}.s3.amazonaws.com/{key})
 *       JPEG: photos = [string | { url } | { bucket, key, size }] -> attēla saite (bucket/key -> CloudFront attēlu apstrādātājs)
 *   - version "2.x" un jaunāka: records [{ date, sets: [{ id }] }] -> GET /reports/{id}/photos?setId={id}
 *   Komplekta atbilde ir ZIP: manifest.json ([{ file, rank, ... }]) + attēlu faili oriģinālajā izmērā.
 */
import { inflateRawSync } from "node:zlib";

import { archiveDateLabel } from "./archive-photos.mjs";

/** CarVertical attēlu apstrādātājs (viewer `cloudFrontConfig.baseUrl`). Bez `edits` - oriģinālais izmērs. */
export const CV_IMAGE_BASE = "https://dzcn1o1d7w7lq.cloudfront.net";
export const CV_ZIP_MAX_BYTES = 80 * 1024 * 1024;
export const CV_PHOTO_MAX = 100;

const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,120}$/;
const BUCKET_RE = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

function safeKey(key) {
  const k = String(key ?? "");
  return k && k.length <= 600 && !k.includes("..") && !/[\s\\]/.test(k) ? k : "";
}

/** Attēla saite no ieraksta: string | {url} | {bucket,key} (pēdējais - CloudFront attēlu apstrādātājs, oriģināls). */
export function cvImageUrl(entry) {
  if (typeof entry === "string") return entry.startsWith("https://") ? entry : "";
  if (!entry || typeof entry !== "object") return "";
  if (typeof entry.url === "string") return entry.url.startsWith("https://") ? entry.url : "";
  const bucket = String(entry.bucket ?? "");
  const key = safeKey(entry.key);
  if (!BUCKET_RE.test(bucket) || !key) return "";
  return `${CV_IMAGE_BASE}/${Buffer.from(JSON.stringify({ bucket, key })).toString("base64")}`;
}

export function cvS3ZipUrl(bucket, key) {
  const b = String(bucket ?? "");
  const k = safeKey(key);
  if (!BUCKET_RE.test(b) || !k) return "";
  return `https://${b}.s3.amazonaws.com/${k.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * dataDict.photo -> [{date, kind:"set", setId} | {date, kind:"zip", url} | {date, kind:"url", url}].
 * Datums kā atskaitē (MM.GGGG).
 */
export function parseCvPhotoSection(dataDict) {
  const photo = dataDict && typeof dataDict === "object" ? dataDict.photo : null;
  const records = Array.isArray(photo?.records) ? photo.records : [];
  const version = String(photo?.version ?? "");
  const items = [];
  const seen = new Set();
  const push = (it) => {
    const k = it.setId ? `set:${it.setId}` : it.url;
    if (!k || seen.has(k)) return;
    seen.add(k);
    items.push(it);
  };
  for (const r of records) {
    if (!r || typeof r !== "object") continue;
    const date = archiveDateLabel(r.date, "month");
    if (Array.isArray(r.sets)) {
      for (const s of r.sets) {
        const id = s && typeof s === "object" ? String(s.id ?? "") : "";
        if (SAFE_ID_RE.test(id) && id !== "legacy") push({ date, kind: "set", setId: id });
      }
    }
    if (!Array.isArray(r.photos)) continue;
    const isZip = String(r.contentType ?? "").toLowerCase().includes("zip");
    for (const ph of r.photos) {
      if (isZip || (ph && typeof ph === "object" && (ph.setId != null || /\.zip$/i.test(String(ph.key ?? ""))))) {
        const setId = ph && typeof ph === "object" ? String(ph.setId ?? "") : "";
        if (setId && SAFE_ID_RE.test(setId)) push({ date, kind: "set", setId });
        else {
          const url = cvS3ZipUrl(ph?.bucket, ph?.key);
          if (url) push({ date, kind: "zip", url });
        }
        continue;
      }
      const url = cvImageUrl(ph);
      if (url) push({ date, kind: "url", url });
    }
  }
  return { version, items };
}

/** Minimāls ZIP lasītājs (centrālais katalogs; stored / deflate). Atgriež Map(nosaukums -> Buffer). */
export function readZipEntries(buf, { maxEntries = 400, maxEntryBytes = 30 * 1024 * 1024 } = {}) {
  const out = new Map();
  if (!Buffer.isBuffer(buf) || buf.length < 22) return out;
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66_000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return out;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count && n < maxEntries; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith("/") || size > maxEntryBytes) continue;
    if (local + 30 > buf.length || buf.readUInt32LE(local) !== 0x04034b50) continue;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + compSize);
    try {
      if (method === 0) out.set(name, Buffer.from(raw));
      else if (method === 8) out.set(name, inflateRawSync(raw, { maxOutputLength: maxEntryBytes }));
    } catch {
      /* bojāts ieraksts */
    }
  }
  return out;
}

export function imageContentType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return "";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.readUInt32BE(0) === 0x89504e47) return "image/png";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return "";
}

/** Komplekta ZIP -> attēli manifest.json secībā (rank), bez manifesta - visi attēli pēc nosaukuma. */
export function photosFromSetZip(buf) {
  const entries = readZipEntries(buf);
  let order = [];
  const manifest = entries.get("manifest.json");
  if (manifest) {
    try {
      const m = JSON.parse(manifest.toString("utf8"));
      const list = Array.isArray(m) ? m : Array.isArray(m?.photos) ? m.photos : [];
      order = list
        .filter((e) => e && typeof e.file === "string")
        .map((e, i) => ({ file: e.file, rank: typeof e.rank === "number" ? e.rank : i }))
        .sort((a, b) => a.rank - b.rank)
        .map((e) => e.file);
    } catch {
      order = [];
    }
  }
  if (!order.length) order = [...entries.keys()].filter((n) => n !== "manifest.json").sort();
  const out = [];
  for (const file of order) {
    const b = entries.get(file);
    const contentType = b ? imageContentType(b) : "";
    if (contentType) out.push({ buf: b, contentType, file });
  }
  return out;
}

const PHOTO_KEY_RE = /photo|image|media|picture|gallery|url|thumb|set|bucket|key|file/i;
const SHOWABLE_VALUE_RE = /^(https:\/\/\S+|\/[\w./-]+|(?=[\w-]*\d)[A-Za-z0-9_-]{8,80}|[a-z0-9.-]+\.(zip|jpe?g|png|webp)|\d+\.\d+(\.\d+)?|application\/zip|image\/jpeg)$/i;

/**
 * Debug: dataDict atslēgu ceļi (bez vērtībām) + līdz 3 paraugi laukiem, kuru nosaukumā ir photo/image/url u.c.,
 * TIKAI ja vērtība ir saite / id / faila nosaukums / versija (personas dati nekad).
 */
export function summarizeDataDict(dataDict, { maxPaths = 400 } = {}) {
  const paths = new Map();
  const samples = new Map();
  const walk = (node, p, depth) => {
    if (depth > 12 || paths.size >= maxPaths) return;
    if (Array.isArray(node)) {
      for (const v of node.slice(0, 50)) walk(v, `${p}[]`, depth + 1);
      return;
    }
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) walk(v, p ? `${p}.${k}` : k, depth + 1);
      return;
    }
    const type = node === null ? "null" : typeof node;
    if (!paths.has(p)) paths.set(p, type);
    // Ceļā ir photo/image/... (piem. photo.records[].sets[].id) un vērtība ir saite / id / versija - drīkst rādīt.
    if (PHOTO_KEY_RE.test(p) && typeof node === "string" && SHOWABLE_VALUE_RE.test(node)) {
      const list = samples.get(p) ?? [];
      if (list.length < 3 && !list.includes(node)) list.push(node.slice(0, 160));
      samples.set(p, list);
    }
  };
  walk(dataDict, "", 0);
  return {
    topKeys: dataDict && typeof dataDict === "object" ? Object.keys(dataDict).slice(0, 60) : [],
    paths: [...paths.entries()].map(([k, t]) => `${k}: ${t}`),
    samples: Object.fromEntries(samples),
  };
}
