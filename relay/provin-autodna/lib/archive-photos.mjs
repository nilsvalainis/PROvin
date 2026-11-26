/**
 * Arhīva foto no JAU NOPIRKTAS atskaites (2. fāze, 25.11) - tīrā loģika bez pārlūka (testējama).
 * Identisks fails ir abos relejos: relay/provin-carvertical/lib/ un relay/provin-autodna/lib/ (katrs relejs izvietojas atsevišķi).
 *
 * Relejs NEKAD nepērk šajā ceļā: tikai lasa atskaites datus (GET) un lejupielādē bildes (GET, tikai https, tikai image/*).
 */

export const ARCHIVE_PHOTO_MAX = 100;
/** Viena bilde no releja (oriģināli mēdz būt 3-6 MB; lietotne pēc tam normalizē līdz 1600 px). */
export const ARCHIVE_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
/** Cik variantus (lielais -> sīktēls) mēģina vienai bildei. */
export const ARCHIVE_PHOTO_MAX_CANDIDATES = 6;
/** Lejupielādes laika budžets (lietotne releju gaida 180 s); pēc tā mēģina tikai vienu variantu. */
export const ARCHIVE_PHOTOS_BUDGET_MS = 110_000;
export const ARCHIVE_PHOTOS_TOTAL_MAX_BYTES = 60 * 1024 * 1024;

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

const IMG_KEY_HINT_RE = /photo|image|img|picture|pic$|thumb|gallery|original|large|full|^src$|media/i;
const IMG_HOST_HINT_RE = /(^|[.-])(img|imgs|image|images|photo|photos|media|cdn|static|assets|pictures)[.-]/i;

/**
 * Bildes saite: https + (paplašinājums / bilžu ceļš / bilžu hosts) vai - ja atslēga norāda uz bildi
 * («photo», «imageUrl», «original»...) - jebkura https saite (CDN bieži bez paplašinājuma).
 */
export function looksLikeImageUrl(raw, keyHint = "") {
  if (!isAllowedPhotoUrl(raw)) return false;
  const u = new URL(raw);
  if (/\.(pdf|html?|js|css|json|svg)(\?|#|$)/i.test(u.pathname)) return false;
  if (IMG_EXT_RE.test(u.pathname) || IMG_PATH_RE.test(u.pathname)) return true;
  if (IMG_HOST_HINT_RE.test(`${u.hostname}.`)) return true;
  return Boolean(keyHint) && IMG_KEY_HINT_RE.test(keyHint);
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
  const walk = (node, ctxDate, depth, keyHint) => {
    if (depth > 16 || out.length >= max || node == null) return;
    if (Array.isArray(node)) {
      for (const v of node) {
        if (typeof v === "string") {
          if (looksLikeImageUrl(v, keyHint)) push(v, ctxDate);
        } else walk(v, ctxDate, depth + 1, keyHint);
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
      .filter(([k, v]) => typeof v === "string" && looksLikeImageUrl(v, IMG_KEY_HINT_RE.test(k) ? k : keyHint))
      .sort((a, b) => keyRank(a[0]) - keyRank(b[0]));
    if (imgs.length) push(imgs[0][1], date);
    for (const [k, v] of Object.entries(node)) {
      if (v && typeof v === "object") walk(v, date, depth + 1, IMG_KEY_HINT_RE.test(k) ? k : keyHint);
    }
  };
  walk(json, "", 0, "");
  return out;
}

const SIZE_QUERY_KEY_RE = /^(w|h|width|height|size|s|resize|fit|q|quality|thumb|thumbnail|dpr|crop|max_?w|max_?h|maxwidth|maxheight|mw|mh)$/i;
const THUMB_DIR_RE = /\/(thumbs?|thumbnails?|small|mini|preview|min|medium|tn)\//i;
const THUMB_SUFFIX_RE = /([_-](thumb|thumbnail|small|mini|min|preview|tn|sm|md|s|t|m)|[_-]\d{2,4}x\d{2,4}|@\dx)(\.(jpe?g|png|webp))$/i;
const SIZE_DIR_RE = /\/(\d{2,4}x\d{2,4}|[wh]_?\d{2,4}(,[a-z]_?[a-z0-9]+)*)\//i;

/**
 * Sīktēla saite -> iespējamās lielā (oriģinālā) varianta saites, svarīgākā pirmā (bez pašas sākotnējās saites).
 * Izmēra parametri vaicājumā (?w=300&h=200), sīktēlu mapes (/thumb/, /small/), sufiksi (_thumb, -300x200), izmēra mapes (/300x200/).
 */
export function upgradedImageUrls(raw) {
  let u;
  try {
    u = new URL(String(raw ?? ""));
  } catch {
    return [];
  }
  if (!isAllowedPhotoUrl(u.href)) return [];
  const out = [];
  const add = (x) => {
    if (x.href !== u.href && !out.includes(x.href)) out.push(x.href);
  };
  const base = new URL(u.href);
  const sizeKeys = [...base.searchParams.keys()].filter((k) => SIZE_QUERY_KEY_RE.test(k));
  for (const k of sizeKeys) base.searchParams.delete(k);
  const pth = base.pathname;
  const p1 = pth.replace(THUMB_SUFFIX_RE, "$3");
  const paths = [];
  if (THUMB_DIR_RE.test(p1)) for (const rep of ["/original/", "/"]) paths.push(p1.replace(THUMB_DIR_RE, rep));
  if (SIZE_DIR_RE.test(p1)) paths.push(p1.replace(SIZE_DIR_RE, "/"));
  if (p1 !== pth) paths.push(p1);
  if (THUMB_DIR_RE.test(p1)) paths.push(p1.replace(THUMB_DIR_RE, "/large/"));
  for (const np of paths) {
    const x = new URL(base.href);
    x.pathname = np.replace(/\/{2,}/g, "/");
    add(x);
  }
  if (sizeKeys.length) add(base);
  return out.slice(0, ARCHIVE_PHOTO_MAX_CANDIDATES - 1);
}

/**
 * AutoDNA lapas DOM secībā: [{type:"date", text} | {type:"img", href, dataRemote, dataFull, dataSrc, srcset, src}] -> [{url, date, fallbacks}].
 * Bilde pieder pēdējam datumam virs tās. Kandidāti no lielākā: saite uz bildi > lightbox data-remote > data-full > srcset >
 * sīktēla «paaugstinātie» varianti > data-src > src. `url` - pirmais, `fallbacks` - pārējie (ja lielais nav pieejams).
 */
export function collectDomPhotoEntries(items, { dateStyle = "day", max = ARCHIVE_PHOTO_MAX } = {}) {
  const out = [];
  const seen = new Set();
  let date = "";
  for (const it of Array.isArray(items) ? items : []) {
    if (out.length >= max) break;
    if (it?.type === "date") {
      const m = /(\d{2}\.\d{2}\.\d{4}|\d{2}\.\d{4}|\d{4}-\d{2}(?:-\d{2})?)/.exec(String(it.text ?? ""));
      const d = m ? archiveDateLabel(m[1], dateStyle) : "";
      if (d) date = d;
      continue;
    }
    if (it?.type !== "img") continue;
    const small = [it.dataSrc, it.src].filter((c) => typeof c === "string" && looksLikeImageUrl(c, "src"));
    const raw = [
      [it.href, ""],
      [it.dataRemote, "src"],
      [it.dataFull, "src"],
      [largestFromSrcset(it.srcset), "src"],
      ...small.flatMap((c) => upgradedImageUrls(c).map((x) => [x, "src"])),
      ...small.map((c) => [c, "src"]),
    ];
    const cands = [];
    for (const [c, hint] of raw) {
      if (typeof c === "string" && !cands.includes(c) && looksLikeImageUrl(c, hint)) cands.push(c);
    }
    // Sākotnējā (mazā) bilde vienmēr paliek sarakstā kā pēdējā rezerve.
    const keep = cands.filter((c) => small.includes(c));
    const big = cands.filter((c) => !small.includes(c)).slice(0, Math.max(0, ARCHIVE_PHOTO_MAX_CANDIDATES - keep.length));
    const list = [...big, ...keep].slice(0, ARCHIVE_PHOTO_MAX_CANDIDATES);
    const url = list[0];
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, date, fallbacks: list.slice(1) });
  }
  return out;
}

/** Debug: saites forma bez vērtībām - hosts + ceļš (gari ID -> *), vaicājuma atslēgas. */
export function photoUrlShape(raw) {
  try {
    const u = new URL(String(raw ?? ""));
    const path = u.pathname
      .split("/")
      .map((seg) => (seg.length >= 12 && /[0-9]/.test(seg) ? seg.replace(/^[^.]*/, "*") : seg))
      .join("/");
    const keys = [...u.searchParams.keys()].join("&");
    return `${u.hostname}${path.slice(0, 120)}${keys ? `?${keys}` : ""}`;
  } catch {
    return String(raw ?? "").startsWith("data:") ? "data:" : "";
  }
}

/** Debug: DOM bilžu ierakstu formas (kuri atribūti aizpildīti un kā izskatās saites), lai redzētu, kur lielais variants. */
export function domPhotoShapesSummary(items, max = 12) {
  return (Array.isArray(items) ? items : [])
    .filter((it) => it?.type === "img")
    .slice(0, max)
    .map((it) =>
      ["href", "dataRemote", "dataFull", "srcset", "dataSrc", "src", "attrs"]
        .filter((k) => it[k])
        .map((k) => `${k}=${k === "srcset" ? String(it[k]).split(",").map((x) => photoUrlShape(x.trim().split(/\s+/)[0])).join(" | ") : k === "attrs" ? String(it[k]) : photoUrlShape(it[k])}`)
        .join(" ; "),
    );
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

/**
 * Nopirktās atskaites lapas saite no "Manas atskaites" (Priekšskatījums / Skatīt): tā pati vietne, satur reportId.
 */
export function pickReportPageHref(links, reportId, origin) {
  const id = String(reportId ?? "").trim();
  if (!id) return "";
  const ok = (l) => {
    try {
      const u = new URL(String(l?.href ?? ""), origin);
      return u.origin === new URL(origin).origin && u.href.includes(id) && !/checkout|pricing|billing|pdf/i.test(u.pathname);
    } catch {
      return false;
    }
  };
  const hits = (Array.isArray(links) ? links : []).filter(ok);
  const pref = hits.find((l) => /priek[sš]skat|preview|skat[iī]t|view|atv[eē]rt|open/i.test(String(l.text ?? "")));
  const pick = pref ?? hits[0];
  return pick ? new URL(pick.href, origin).href : "";
}

/** Debug: JSON atslēgu ceļi, kuros ir bilžu saites (bez vērtībām) - «sections.photos.groups[].images[]» × N. */
export function photoKeyPathsSummary(json, max = 40) {
  const counts = new Map();
  const walk = (node, p, depth, keyHint) => {
    if (depth > 16 || node == null) return;
    if (Array.isArray(node)) {
      for (const v of node) {
        if (typeof v === "string") {
          if (looksLikeImageUrl(v, keyHint)) counts.set(`${p}[]`, (counts.get(`${p}[]`) ?? 0) + 1);
        } else walk(v, `${p}[]`, depth + 1, keyHint);
      }
      return;
    }
    if (typeof node !== "object") return;
    for (const [k, v] of Object.entries(node)) {
      const kp = p ? `${p}.${k}` : k;
      if (typeof v === "string" && looksLikeImageUrl(v, IMG_KEY_HINT_RE.test(k) ? k : keyHint)) counts.set(kp, (counts.get(kp) ?? 0) + 1);
      else if (v && typeof v === "object") walk(v, kp, depth + 1, IMG_KEY_HINT_RE.test(k) ? k : keyHint);
    }
  };
  walk(json, "", 0, "");
  return [...counts.entries()].slice(0, max).map(([k, n]) => `${k} × ${n}`);
}

/** Lejupielādēta bilde der: image/* (ne SVG), ne tukša, ≤ limits. */
export function acceptDownloadedPhoto({ contentType, size }) {
  const ct = String(contentType ?? "").toLowerCase();
  return /^image\/(jpeg|jpg|png|webp)/.test(ct) && size > 1000 && size <= ARCHIVE_PHOTO_MAX_BYTES;
}

async function fetchInPage(page, url, auth) {
  return page
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
      { url, auth, maxBytes: ARCHIVE_PHOTO_MAX_BYTES },
    )
    .catch(() => ({ ok: false, status: -1 }));
}

/** Rezerve, ja lapas fetch neiet (CORS uz cita hosta bildēm): pārlūka konteksta pieprasījums ar tām pašām sīkdatnēm. */
async function fetchViaContext(page, url, auth) {
  const req = typeof page?.context === "function" ? page.context()?.request : null;
  if (!req || typeof req.get !== "function") return { ok: false, status: -2 };
  try {
    let referer = "";
    try {
      referer = page.url();
    } catch {
      /* nav */
    }
    const r = await req.get(url, {
      timeout: 30_000,
      maxRedirects: 5,
      headers: { ...(referer.startsWith("https://") ? { Referer: referer } : {}), ...(auth ? { Authorization: auth } : {}) },
    });
    if (!r.ok()) return { ok: false, status: r.status() };
    const contentType = r.headers()["content-type"] || "";
    const buf = await r.body();
    if (buf.length > ARCHIVE_PHOTO_MAX_BYTES) return { ok: false, status: 413 };
    return { ok: true, contentType, size: buf.length, base64: Buffer.from(buf).toString("base64") };
  } catch {
    return { ok: false, status: 0 };
  }
}

/**
 * Lejupielāde lapas kontekstā (tās pašas sīkdatnes / sesija kā lapā), pa vienai, GET.
 * Katram ierakstam mēģina `url`, tad `fallbacks` (lielais -> sīktēls); pirmā derīgā bilde paliek.
 * Ja lapas fetch neizdodas (CORS), mēģina caur pārlūka konteksta pieprasījumu.
 * `authHeader` sūta tikai uz `authHost` (piem. CarVertical API), nekad uz svešiem hostiem.
 * Atgriež [{date, photos:[{base64, contentType, url}]}].
 */
export async function downloadArchivePhotos(page, entries, { authHeader = "", authHost = "", log = () => undefined, budgetMs = ARCHIVE_PHOTOS_BUDGET_MS, now = Date.now } = {}) {
  const groups = [];
  let total = 0;
  let failed = 0;
  let viaFallback = 0;
  const deadline = now() + budgetMs;
  // Kandidātu saraksti vienā lapā ir vienādas formas: kas nostrādāja iepriekšējai bildei, to mēģina pirmo (ja tas nav mazākais).
  let okIndex = -1;
  for (const e of entries.slice(0, ARCHIVE_PHOTO_MAX)) {
    if (total >= ARCHIVE_PHOTOS_TOTAL_MAX_BYTES) break;
    const all = [e.url, ...(Array.isArray(e.fallbacks) ? e.fallbacks : [])].filter((c, i, a) => isAllowedPhotoUrl(c) && a.indexOf(c) === i).slice(0, ARCHIVE_PHOTO_MAX_CANDIDATES);
    let order = all.map((_, i) => i);
    if (okIndex > 0 && okIndex < all.length) order = [okIndex, ...order.filter((i) => i !== okIndex)];
    // Laiks beidzies -> tikai mazāk riskantie: iepriekš strādājušais vai pēdējais (sākotnējais) variants.
    if (now() > deadline) order = [...new Set([okIndex >= 0 && okIndex < all.length ? okIndex : all.length - 1])];
    let got = null;
    let gotUrl = "";
    for (const idx of order) {
      const url = all[idx];
      if (!url) continue;
      const auth = authHeader && new URL(url).hostname === authHost ? authHeader : "";
      let out = await fetchInPage(page, url, auth);
      if (!out.ok && out.status !== 404 && out.status !== 410 && out.status !== 413) out = await fetchViaContext(page, url, auth);
      if (out.ok && acceptDownloadedPhoto(out)) {
        got = out;
        gotUrl = url;
        if (idx < all.length - 1 || all.length === 1) okIndex = idx;
        break;
      }
    }
    if (!got) {
      failed++;
      continue;
    }
    if (gotUrl !== e.url) viaFallback++;
    total += got.size;
    let g = groups.find((x) => x.date === e.date);
    if (!g) {
      g = { date: e.date, photos: [] };
      groups.push(g);
    }
    g.photos.push({ base64: got.base64, contentType: got.contentType, url: gotUrl });
  }
  log(`arhīva foto: ${groups.reduce((n, g) => n + g.photos.length, 0)} lejupielādēti (${viaFallback} ar mazāku variantu), ${failed} neizdevās`);
  return groups;
}
