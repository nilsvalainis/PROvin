/**
 * j56: vienas izsoles auto DETAĻU lapa (Auto1 / Openlane), ne saraksts.
 * Pārlūks ar platformas ielogoto profilu atver saiti, iziet cauri cilnēm (Overview/Condition/Documents,
 * Profile/Equipment/Condition) un atdod:
 *   fields  [[etiķete, vērtība]] no DOM (dl, 2 kolonnu tabulas, "Etiķete: vērtība", divu bērnu bloki)
 *   tables  pārējās tabulas (piem. Damage summary) kā rindu masīvi
 *   lists   saraksti ar tuvāko virsrakstu (aprīkojums)
 *   photos  foto izsoles secībā: JSON images[] (ja ir), citādi DOM secība
 *   jsonFields  plakani [ceļš, vērtība] no tā JSON objekta, kurā ir šī auto id (bez konta laukiem)
 *   item    Auto1: tas pats mapAuto1Car kā sarakstā, ja SPA JSON iedod auto objektu
 * Neapstrādāts JSON un HTML netiek atdoti (konta dati, izmērs). Paroles / tokeni netiek žurnālēti.
 */
import { DETAIL_PLATFORMS } from "./detail-platforms.mjs";

const MAX_FIELDS = 600;
const MAX_PHOTOS = 60;
const MAX_JSON_FIELDS = 800;

/** https detaļu saite uz atļauto hostu, citādi "". Openlane vienmēr /en/. */
export function validDetailUrl(platform, raw) {
  const cfg = DETAIL_PLATFORMS[platform];
  if (!cfg) return "";
  try {
    const u = new URL(String(raw ?? "").trim());
    if (u.protocol !== "https:") return "";
    if (!cfg.hostRe.test(u.hostname.toLowerCase())) return "";
    u.hash = "";
    const url = cfg.normalizeUrl ? cfg.normalizeUrl(u.toString()) : u.toString();
    return cfg.detailKey(url) ? url : "";
  } catch {
    return "";
  }
}

const clean = (t) => String(t ?? "").replace(/\s+/g, " ").trim();

/** Konta / sesijas lauki, kas nekad neiziet no releja. */
const SECRET_KEY_RE = /token|jwt|bearer|password|passwd|secret|cookie|session|e-?mail|phone|iban|viban|firstname|lastname|username|fullname|address(?!.*car)|merchant(?:id|name|uuid)|userid|accountid|buyerid|dealerid/i;

/** Plakans [ceļš, vērtība] no objekta (primitīvi), bez slepenajiem laukiem. */
export function flattenJsonFields(obj, prefix = "", out = [], depth = 0) {
  if (out.length >= MAX_JSON_FIELDS || depth > 5 || obj == null) return out;
  if (Array.isArray(obj)) {
    if (obj.every((x) => x == null || typeof x !== "object")) {
      const joined = obj.map((x) => clean(x)).filter(Boolean).join(", ");
      if (joined && prefix) out.push([prefix, joined.slice(0, 500)]);
      return out;
    }
    obj.slice(0, 40).forEach((x, i) => flattenJsonFields(x, `${prefix}[${i}]`, out, depth + 1));
    return out;
  }
  if (typeof obj !== "object") {
    const v = typeof obj === "boolean" ? String(obj) : clean(obj);
    if (prefix && v) out.push([prefix, v.slice(0, 500)]);
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET_KEY_RE.test(k)) continue;
    flattenJsonFields(v, prefix ? `${prefix}.${k}` : k, out, depth + 1);
    if (out.length >= MAX_JSON_FIELDS) break;
  }
  return out;
}

/** Lielākais objekts JSON kokā, kura kāda primitīvā vērtība ir šī auto id (stockNumber / auctionId). */
export function findDetailObject(json, key, depth = 0) {
  if (!json || typeof json !== "object" || depth > 8 || !key) return null;
  const want = String(key).toLowerCase();
  let best = null;
  const visit = (o, d) => {
    if (!o || typeof o !== "object" || d > 8) return;
    if (Array.isArray(o)) {
      for (const x of o.slice(0, 200)) visit(x, d + 1);
      return;
    }
    const own = Object.values(o).some((v) => (typeof v === "string" || typeof v === "number") && String(v).trim().toLowerCase() === want);
    if (own && (!best || Object.keys(o).length > Object.keys(best).length)) best = o;
    for (const v of Object.values(o)) visit(v, d + 1);
  };
  visit(json, depth);
  return best;
}

const IMG_EXT_RE = /\.(?:jpe?g|webp|png|avif)(?:[?#]|$)/i;
const NOT_PHOTO_RE = /logo|icon|sprite|flag|avatar|placeholder|badge|banner|favicon|pixel|tracking|\.svg(?:[?#]|$)|^data:/i;

/** Foto URL saraksts no JSON: garākais attēlu URL masīvs (secība kā avotā). */
export function findJsonPhotoList(json) {
  let best = [];
  const urlOf = (x) => {
    if (typeof x === "string") return x;
    if (x && typeof x === "object") {
      for (const k of ["fullUrl", "url", "Url", "imageUrl", "ImageUrl", "src", "large", "Large", "original", "Original", "href", "uri"]) {
        if (typeof x[k] === "string") return x[k];
      }
    }
    return "";
  };
  const visit = (o, d) => {
    if (!o || typeof o !== "object" || d > 8) return;
    if (Array.isArray(o)) {
      const urls = o.map(urlOf).filter((u) => /^https:\/\//i.test(u) && (IMG_EXT_RE.test(u) || /\/img|image|photo|picture|media/i.test(u)) && !NOT_PHOTO_RE.test(u));
      if (urls.length >= 2 && urls.length > best.length && urls.length >= o.length * 0.6) best = urls;
      for (const x of o.slice(0, 200)) visit(x, d + 1);
      return;
    }
    for (const v of Object.values(o)) visit(v, d + 1);
  };
  visit(json, 0);
  return best;
}

/** Tas pats foto citā izmērā (?w=, /thumb/, _small) skaitās viens. */
export function photoIdentity(url) {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) {
      if (/^(w|h|width|height|size|q|quality|fit|format|fm|auto|dpr|resize|rs)$/i.test(k)) u.searchParams.delete(k);
    }
    return `${u.hostname}${u.pathname}`
      .toLowerCase()
      .replace(/\/(?:thumb|thumbs|thumbnail|small|medium|large|xl|xxl|\d{2,4}x\d{2,4})\//g, "/")
      .replace(/[-_](?:thumb|small|medium|large|\d{2,4}x\d{2,4})(?=\.\w+$)/, "")
      + (u.search || "");
  } catch {
    return String(url);
  }
}

/** DOM foto filtrs: platformas attēlu hosts, ne ikonas, bez dublikātiem; secība saglabāta. */
export function filterDetailPhotos(platform, candidates) {
  const cfg = DETAIL_PLATFORMS[platform];
  const out = [];
  const seen = new Set();
  for (const c of candidates) {
    const url = typeof c === "string" ? c : c?.url;
    const w = typeof c === "object" && c ? Number(c.w) || 0 : 0;
    if (!url || !/^https:\/\//i.test(url) || NOT_PHOTO_RE.test(url)) continue;
    if (w > 0 && w < 160) continue;
    if (cfg?.photoHostRe ? !cfg.photoHostRe.test(url) : !(IMG_EXT_RE.test(url) || /\/(?:img|image|images|photo|photos|picture|media)\b/i.test(url))) continue;
    const id = photoIdentity(url);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(url);
    if (out.length >= MAX_PHOTOS) break;
  }
  return out;
}

/** Vairāku ciļņu DOM izvilkumi -> viens (lauki bez dublikātiem, foto pirmās parādīšanās secībā). */
export function mergeDetailExtracts(extracts) {
  const fields = [];
  const fieldSeen = new Set();
  const tables = [];
  const tableSeen = new Set();
  const lists = [];
  const listSeen = new Set();
  const photos = [];
  let title = "";
  let text = "";
  for (const e of extracts) {
    if (!e) continue;
    if (!title && e.title) title = clean(e.title);
    for (const [l, v] of e.fields ?? []) {
      const k = `${clean(l).toLowerCase()}|${clean(v).toLowerCase()}`;
      if (fieldSeen.has(k) || fields.length >= MAX_FIELDS) continue;
      fieldSeen.add(k);
      fields.push([clean(l), clean(v)]);
    }
    for (const t of e.tables ?? []) {
      const k = JSON.stringify(t).slice(0, 400);
      if (tableSeen.has(k) || tables.length >= 12) continue;
      tableSeen.add(k);
      tables.push(t);
    }
    for (const l of e.lists ?? []) {
      const k = `${l.heading}|${(l.items ?? []).join("|")}`.slice(0, 400);
      if (listSeen.has(k)) continue;
      // Tas pats virsraksts pēc «Show more +» - paliek garākais saraksts (lietotne ņem pirmo atbilstošo).
      const same = l.heading ? lists.findIndex((x) => x.heading === l.heading) : -1;
      if (same >= 0) {
        if ((l.items ?? []).length > (lists[same].items ?? []).length) lists[same] = l;
        listSeen.add(k);
        continue;
      }
      if (lists.length >= 24) continue;
      listSeen.add(k);
      lists.push(l);
    }
    photos.push(...(e.photos ?? []));
    if (e.text && e.text.length > text.length) text = e.text;
  }
  return { title, fields, tables, lists, photos, text: text.slice(0, 40_000) };
}

/**
 * Pārlūkā izpildāms (page.evaluate). Pašpietiekams: nedrīkst atsaukties uz moduļa mainīgajiem.
 */
export function extractDetailDom() {
  const clean = (t) => String(t ?? "").replace(/\s+/g, " ").trim();
  const txt = (el) => clean(el ? el.innerText || el.textContent : "");
  const fields = [];
  const push = (l, v) => {
    const label = clean(l).replace(/[:：]\s*$/, "");
    const value = clean(v);
    if (!label || !value || label === value) return;
    if (label.length > 60 || value.length > 300) return;
    if (/^\d+([.,]\d+)?$/.test(label)) return;
    fields.push([label, value]);
  };
  document.querySelectorAll("dl").forEach((dl) => {
    dl.querySelectorAll("dt").forEach((dt) => {
      const dd = dt.nextElementSibling;
      if (dd && dd.tagName === "DD") push(txt(dt), txt(dd));
    });
  });
  const tables = [];
  document.querySelectorAll("table").forEach((t) => {
    const rows = [...t.querySelectorAll("tr")]
      .map((tr) => [...tr.children].map((c) => txt(c)))
      .filter((r) => r.some(Boolean));
    if (!rows.length) return;
    if (rows.every((r) => r.length === 2)) rows.forEach((r) => push(r[0], r[1]));
    else tables.push(rows.slice(0, 80));
  });
  // ARIA / div tabulas (Auto1 Damage summary var būt div režģis)
  document.querySelectorAll('[role="table"], [role="grid"]').forEach((t) => {
    const rows = [...t.querySelectorAll('[role="row"]')]
      .map((r) => [...r.querySelectorAll('[role="cell"], [role="gridcell"], [role="columnheader"]')].map((c) => txt(c)))
      .filter((r) => r.some(Boolean));
    if (rows.length) tables.push(rows.slice(0, 80));
  });
  document.querySelectorAll("div, li, p, span, section").forEach((el) => {
    if (el.children.length !== 2) return;
    const [a, b] = el.children;
    if (a.querySelector("img, svg + svg") || a.children.length > 2 || b.children.length > 4) return;
    const ta = txt(a);
    const tb = txt(b);
    if (!ta || !tb || ta.length > 50 || tb.length > 200) return;
    push(ta, tb);
  });
  document.querySelectorAll("li, p, span, div, td").forEach((el) => {
    if (el.children.length > 1) return;
    const m = clean(el.textContent).match(/^([^:]{2,50}):\s*(.{1,200})$/);
    if (m) push(m[1], m[2]);
  });
  const lists = [];
  document.querySelectorAll("ul, ol").forEach((ul) => {
    const items = [...ul.children].filter((li) => li.tagName === "LI").map((li) => txt(li)).filter((t) => t && t.length <= 120);
    if (items.length < 2) return;
    let heading = "";
    let el = ul;
    for (let i = 0; i < 6 && el && !heading; i += 1) {
      let prev = el.previousElementSibling;
      while (prev && !heading) {
        if (/^H[1-6]$/.test(prev.tagName) || prev.getAttribute("role") === "heading") heading = txt(prev);
        else {
          const h = prev.querySelector("h1, h2, h3, h4, h5, h6, [role=heading]");
          if (h) heading = txt(h);
        }
        prev = prev.previousElementSibling;
      }
      el = el.parentElement;
    }
    lists.push({ heading: heading.slice(0, 80), items: items.slice(0, 120) });
  });
  const photos = [];
  const addImg = (u, w) => {
    if (!u) return;
    try {
      const abs = new URL(u, location.href).toString();
      if (abs.startsWith("https:")) photos.push({ url: abs, w: w || 0 });
    } catch {
      /* ignore */
    }
  };
  document.querySelectorAll("img, source").forEach((img) => {
    const srcset = img.getAttribute("srcset") || img.getAttribute("data-srcset") || "";
    let best = "";
    if (srcset) {
      const parts = srcset
        .split(",")
        .map((s) => s.trim().split(/\s+/))
        .filter((p) => p[0]);
      parts.sort((x, y) => parseFloat(y[1] || "0") - parseFloat(x[1] || "0"));
      best = parts[0] ? parts[0][0] : "";
    }
    const w = img.tagName === "IMG" ? img.naturalWidth || img.width || 0 : 0;
    addImg(best || img.getAttribute("data-src") || img.getAttribute("data-lazy") || img.currentSrc || img.getAttribute("src"), w);
  });
  document.querySelectorAll('[style*="background-image"]').forEach((el) => {
    const m = (el.getAttribute("style") || "").match(/url\(["']?([^"')]+)/);
    if (m) addImg(m[1], 0);
  });
  const h1 = document.querySelector("h1");
  return {
    title: txt(h1) || clean(document.title),
    fields: fields.slice(0, 600),
    tables: tables.slice(0, 12),
    lists: lists.slice(0, 24),
    photos,
    text: clean(document.body ? document.body.innerText : "").slice(0, 40000),
  };
}

const sleepDefault = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Atver detaļu lapu jau ielogotā profilā (sesiju pārbauda izsaucējs) un atdod izvilkumu.
 * `page` - Playwright Page; `opts.sleep` testiem.
 */
export async function fetchAuctionDetail(page, platform, url, opts = {}) {
  const cfg = DETAIL_PLATFORMS[platform];
  const sleep = opts.sleep ?? sleepDefault;
  const log = opts.log ?? (() => undefined);
  const key = cfg.detailKey(url);
  const jsonBodies = [];
  const apis = new Set();
  const onResponse = async (res) => {
    try {
      const rurl = res.url();
      if (!cfg.apiHostRe.test(rurl)) return;
      const ct = res.headers()["content-type"] ?? "";
      if (!/json/i.test(ct)) return;
      apis.add(cfg.apiTemplate ? cfg.apiTemplate(rurl) : rurl.split("?")[0]);
      if (cfg.skipApiRe && cfg.skipApiRe.test(rurl)) return;
      if (jsonBodies.length >= 30) return;
      const json = await res.json();
      jsonBodies.push(json);
    } catch {
      /* ne JSON vai lapa aizvērta */
    }
  };
  page.on("response", onResponse);
  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const httpStatus = resp && typeof resp.status === "function" ? resp.status() : 0;
    await sleep(2_500);
    if (cfg.loggedOutUrlRe.test(page.url())) return detailFail("login_required", `${cfg.label}: sesija beigusies, jāielogojas no jauna.`);
    if (opts.hasChallenge && (await opts.hasChallenge(page))) return detailFail("blocked", `${cfg.label}: Cloudflare / captcha.`);
    if (httpStatus === 404 || httpStatus === 410) return detailFail("not_found", `${cfg.label}: auto nav atrasts (izsole beigusies vai saite nederīga).`);

    const extracts = [];
    const grab = async () => {
      const e = await page.evaluate(extractDetailDom).catch(() => null);
      if (e) extracts.push(e);
      return e;
    };
    // SPA: gaida, līdz parādās lauki (līdz ~15 s)
    for (let i = 0; i < 10; i += 1) {
      const e = await grab();
      if (e && e.fields.length >= 8) break;
      await sleep(1_500);
    }
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => undefined);
    await sleep(1_200);
    await grab();
    for (const re of cfg.tabTexts) {
      const tab = page.locator('[role="tab"], button, a').filter({ hasText: re }).first();
      if (!(await tab.count().catch(() => 0))) continue;
      if (!(await tab.isVisible().catch(() => false))) continue;
      await tab.click({ timeout: 5_000 }).catch(() => undefined);
      await sleep(1_800);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => undefined);
      await sleep(800);
      await grab();
    }
    // Nils 30.10: Auto1 «DATI PĒC VIN» u.c. saraksti daļēji paslēpti zem «Show more +» - atver visus un nolasa vēlreiz.
    for (let round = 0; round < 3; round += 1) {
      const more = page.locator("button, a, [role=button]").filter({ hasText: /^\s*(show more|mehr anzeigen|rādīt vairāk|meer tonen|voir plus)\s*\+?\s*$/i });
      const n = typeof more.count === "function" ? Math.min(await more.count().catch(() => 0), 12) : 0;
      if (n === 0) break;
      let clicked = 0;
      for (let i = 0; i < n; i += 1) {
        const btn = more.nth(i);
        if (!(await btn.isVisible().catch(() => false))) continue;
        await btn.click({ timeout: 3_000 }).catch(() => undefined);
        clicked += 1;
        await sleep(400);
      }
      if (clicked === 0) break;
      await sleep(900);
      await grab();
    }
    const merged = mergeDetailExtracts(extracts);
    if (merged.fields.length === 0 && /sign in|log ?in|password/i.test(merged.text.slice(0, 2_000))) {
      return detailFail("login_required", `${cfg.label}: sesija beigusies, jāielogojas no jauna.`);
    }

    let detailObj = null;
    let jsonPhotos = [];
    for (const json of jsonBodies) {
      const o = findDetailObject(json, key);
      if (o && (!detailObj || Object.keys(o).length > Object.keys(detailObj).length)) detailObj = o;
    }
    if (detailObj) jsonPhotos = findJsonPhotoList(detailObj);
    if (jsonPhotos.length < 2) {
      for (const json of jsonBodies) {
        const p = findJsonPhotoList(json);
        if (p.length > jsonPhotos.length) jsonPhotos = p;
      }
    }
    const domPhotos = filterDetailPhotos(platform, merged.photos);
    const photos = filterDetailPhotos(platform, jsonPhotos.length >= 2 ? [...jsonPhotos, ...domPhotos] : domPhotos);
    const item = detailObj && cfg.mapItem ? cfg.mapItem(detailObj) : null;
    log(`${platform} detail ${merged.fields.length} lauki, ${photos.length} foto, json ${jsonBodies.length}${detailObj ? " (auto objekts)" : ""}`);
    if (merged.fields.length === 0 && !detailObj) return detailFail("error", `${cfg.label}: detaļu lapā neatradu auto datus.`);
    return {
      status: "ok",
      note: "",
      detail: {
        platform,
        key,
        url,
        finalUrl: page.url(),
        title: merged.title,
        fields: merged.fields,
        tables: merged.tables,
        lists: merged.lists,
        photos,
        text: merged.text,
        jsonFields: detailObj ? flattenJsonFields(detailObj) : [],
        item,
      },
      apis: [...apis].slice(0, 30),
    };
  } finally {
    page.off("response", onResponse);
  }
}

function detailFail(status, note) {
  return { status, note, detail: null, apis: [] };
}
