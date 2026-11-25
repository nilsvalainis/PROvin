/**
 * Arhīva foto no JAU NOPIRKTAS atskaites (2. fāze, 25.11) - tīrā loģika bez pārlūka (testējama).
 * Identisks fails ir abos relejos: relay/provin-carvertical/lib/ un relay/provin-autodna/lib/ (katrs relejs izvietojas atsevišķi).
 *
 * Relejs NEKAD nepērk šajā ceļā: tikai lasa atskaites datus (GET) un lejupielādē bildes (GET, tikai https, tikai image/*).
 */

export const ARCHIVE_PHOTO_MAX = 60;
export const ARCHIVE_PHOTO_MAX_BYTES = 3 * 1024 * 1024;
export const ARCHIVE_PHOTOS_TOTAL_MAX_BYTES = 40 * 1024 * 1024;

const IMG_EXT_RE = /\.(jpe?g|png|webp)(\?|#|$)/i;
const IMG_PATH_RE = /\/(images?|photos?|img|pictures?|media|gallery)\//i;

/** Tikai https publisks hosts (bez IP, localhost, iekšējiem domēniem). */
export function isAllowedPhotoUrl(raw) {
  let u;
  try {
    u = new URL(String(raw ?? ""));
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  const h = u.hostname.toLowerCase();
  if (!h.includes(".") || h.startsWith("[") || /^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return false;
  if (h === "localhost" || /\.(local|internal|localhost|lan)$/.test(h)) return false;
  return true;
}

export function looksLikeImageUrl(raw) {
  if (!isAllowedPhotoUrl(raw)) return false;
  const u = new URL(raw);
  return IMG_EXT_RE.test(u.pathname) || IMG_PATH_RE.test(u.pathname);
}

const pad = (n) => String(n).padStart(2, "0");

/**
 * Datums grupai: `month` -> «07.2020» (CarVertical), `day` -> «15.07.2020» (AutoDNA).
 * Pieņem ISO, «YYYY-MM», «DD.MM.YYYY», «MM.YYYY»; cits -> "".
 */
export function archiveDateLabel(raw, style = "month") {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  let m = /^(\d{2})\.(\d{2})\.(\d{4})\.?$/.exec(t);
  if (m) return style === "day" ? `${m[1]}.${m[2]}.${m[3]}` : `${m[2]}.${m[3]}`;
  m = /^(\d{2})\.(\d{4})\.?$/.exec(t);
  if (m) return `${m[1]}.${m[2]}`;
  m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(t);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
    if (style === "day" && m[3]) return `${m[3]}.${m[2]}.${m[1]}`;
    return `${m[2]}.${m[1]}`;
  }
  if (/^\d{10,13}$/.test(t)) {
    const d = new Date(t.length === 10 ? Number(t) * 1000 : Number(t));
    if (!Number.isNaN(d.getTime()) && d.getUTCFullYear() > 1990) {
      return style === "day"
        ? `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`
        : `${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
    }
  }
  return "";
}

/** Lielākais variants no `srcset` («a.jpg 400w, b.jpg 1600w»). */
export function largestFromSrcset(srcset) {
  let best = "";
  let bestW = -1;
  for (const part of String(srcset ?? "").split(",")) {
    const [url, size] = part.trim().split(/\s+/);
    if (!url) continue;
    const w = Number.parseFloat(size ?? "") || 1;
    if (w > bestW) {
      best = url;
      bestW = w;
    }
  }
  return best;
}

const SIZE_KEY_RANK = [
  /orig/i,
  /full/i,
  /(^|_)(xx?l|xxl|huge)$/i,
  /large|big|max|hi(gh)?res/i,
  /medium|^md$/i,
  /^(url|src|href|link|image|photo|picture|path)$/i,
  /small|^sm$/i,
  /thumb|preview|tiny|mini/i,
];
const DATE_KEY_RE = /(^|_)(date|datetime|createdat|created_at|listedat|listed_at|publishedat|published_at|addate|ad_date|time|timestamp|period|month)$/i;

function keyRank(key) {
  const i = SIZE_KEY_RANK.findIndex((re) => re.test(key));
  return i < 0 ? 5.5 : i;
}

/**
 * Atskaites JSON (forma nav zināma) -> [{url, date}]: katram objektam, kurā ir bildes saites, ņem lielāko variantu
 * un tuvāko datumu (pašā objektā vai vecākos). Saites tikai https.
 */
export function collectJsonPhotoEntries(json, { dateStyle = "month", max = ARCHIVE_PHOTO_MAX } = {}) {
  const out = [];
  const seen = new Set();
  const push = (url, date) => {
    if (out.length >= max || seen.has(url)) return;
    seen.add(url);
    out.push({ url, date });
  };
  const walk = (node, ctxDate, depth) => {
    if (depth > 14 || out.length >= max || node == null) return;
    if (Array.isArray(node)) {
      for (const v of node) {
        if (typeof v === "string") {
          if (looksLikeImageUrl(v)) push(v, ctxDate);
        } else walk(v, ctxDate, depth + 1);
      }
      return;
    }
    if (typeof node !== "object") return;
    let date = ctxDate;
    for (const [k, v] of Object.entries(node)) {
      if (DATE_KEY_RE.test(k) && (typeof v === "string" || typeof v === "number")) {
        const d = archiveDateLabel(v, dateStyle);
        if (d) {
          date = d;
          break;
        }
      }
    }
    const imgs = Object.entries(node)
      .filter(([, v]) => typeof v === "string" && looksLikeImageUrl(v))
      .sort((a, b) => keyRank(a[0]) - keyRank(b[0]));
    if (imgs.length) push(imgs[0][1], date);
    for (const [, v] of Object.entries(node)) {
      if (v && typeof v === "object") walk(v, date, depth + 1);
    }
  };
  walk(json, "", 0);
  return out;
}

/**
 * AutoDNA lapas DOM secībā: [{type:"date", text} | {type:"img", href, dataFull, dataSrc, srcset, src}] -> [{url, date}].
 * Bilde pieder pēdējam datumam virs tās. Lielākais variants: saite uz bildi > data-full > srcset > data-src > src.
 */
export function collectDomPhotoEntries(items, { dateStyle = "day", max = ARCHIVE_PHOTO_MAX } = {}) {
  const out = [];
  const seen = new Set();
  let date = "";
  for (const it of Array.isArray(items) ? items : []) {
    if (out.length >= max) break;
    if (it?.type === "date") {
      const m = /(\d{2}\.\d{2}\.\d{4}|\d{2}\.\d{4})/.exec(String(it.text ?? ""));
      const d = m ? archiveDateLabel(m[1], dateStyle) : "";
      if (d) date = d;
      continue;
    }
    if (it?.type !== "img") continue;
    const candidates = [it.href, it.dataFull, largestFromSrcset(it.srcset), it.dataSrc, it.src];
    const url = candidates.find((c) => typeof c === "string" && looksLikeImageUrl(c));
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, date });
  }
  return out;
}

/** [{url, date}] -> [{date, urls}] secībā, vienāds datums -> viena grupa. */
export function groupPhotoEntries(entries) {
  const groups = [];
  for (const e of entries) {
    let g = groups.find((x) => x.date === e.date);
    if (!g) {
      g = { date: e.date, urls: [] };
      groups.push(g);
    }
    g.urls.push(e.url);
  }
  return groups;
}

/** Lejupielādēta bilde der: image/* (ne SVG), ne tukša, ≤ limits. */
export function acceptDownloadedPhoto({ contentType, size }) {
  const ct = String(contentType ?? "").toLowerCase();
  return /^image\/(jpeg|jpg|png|webp)/.test(ct) && size > 1000 && size <= ARCHIVE_PHOTO_MAX_BYTES;
}

/**
 * Lejupielāde lapas kontekstā (tās pašas sīkdatnes / sesija kā lapā), pa vienai, GET.
 * `authHeader` sūta tikai uz `authHost` (piem. CarVertical API), nekad uz svešiem hostiem.
 * Atgriež [{date, photos:[{base64, contentType, url}]}].
 */
export async function downloadArchivePhotos(page, entries, { authHeader = "", authHost = "", log = () => undefined } = {}) {
  const groups = [];
  let total = 0;
  let failed = 0;
  for (const e of entries.slice(0, ARCHIVE_PHOTO_MAX)) {
    if (!isAllowedPhotoUrl(e.url)) continue;
    if (total >= ARCHIVE_PHOTOS_TOTAL_MAX_BYTES) break;
    let host = "";
    try {
      host = new URL(e.url).hostname;
    } catch {
      continue;
    }
    const out = await page
      .evaluate(
        async ({ url, auth, maxBytes }) => {
          try {
            const r = await fetch(url, { method: "GET", credentials: "include", ...(auth ? { headers: { Authorization: auth } } : {}) });
            if (!r.ok) return { ok: false, status: r.status };
            const contentType = r.headers.get("content-type") || "";
            const buf = new Uint8Array(await r.arrayBuffer());
            if (buf.length > maxBytes) return { ok: false, status: 413 };
            let bin = "";
            for (let k = 0; k < buf.length; k += 0x8000) bin += String.fromCharCode(...buf.subarray(k, k + 0x8000));
            return { ok: true, contentType, size: buf.length, base64: btoa(bin) };
          } catch {
            return { ok: false, status: 0 };
          }
        },
        { url: e.url, auth: authHeader && host === authHost ? authHeader : "", maxBytes: ARCHIVE_PHOTO_MAX_BYTES },
      )
      .catch(() => ({ ok: false, status: -1 }));
    if (!out.ok || !acceptDownloadedPhoto(out)) {
      failed++;
      continue;
    }
    total += out.size;
    let g = groups.find((x) => x.date === e.date);
    if (!g) {
      g = { date: e.date, photos: [] };
      groups.push(g);
    }
    g.photos.push({ base64: out.base64, contentType: out.contentType, url: e.url });
  }
  log(`arhīva foto: ${groups.reduce((n, g) => n + g.photos.length, 0)} lejupielādēti, ${failed} neizdevās`);
  return groups;
}
