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

/** Kanoniskā bojājumu tabulas galva (PROVIN `parseIrissPdDamageTable` to atpazīst). */
export const DAMAGE_TABLE_HEAD = ["Area", "Damage", "Severity", "Description", "Quantity", "Parts affected"];
const DMG_COLS = [
  /^(area|zone|location|position|bereich|zona|vieta)$/i,
  /^(damage|damage type|type|schaden|schadensart|schadenart|art|bojājums|bojājuma veids)$/i,
  /^(severity|size|dimension|schwere|größe|grösse|schweregrad|nopietnība|izmērs)$/i,
  /^(description|details?|beschreibung|apraksts)$/i,
  /^(quantity|qty|count|amount|anzahl|menge|daudzums|skaits)$/i,
  /^(parts affected|affected parts|parts?|component|betroffene teile|bauteile?|ietekmētās daļas|detaļas)$/i,
];
const DMG_AREA_RE = /^(exterior|interior|technical|other|außen|aussen|innen|technik|sonstiges|ārpuse|salons|tehniskie)(\s+(damages?|schäden|bojājumi))?$/i;
const DMG_UI_RE = /^(show (more|less|all|photos?|images?|original)|hide|mehr anzeigen|weniger anzeigen|rādīt (vairāk|mazāk)|some content has been automatically translated\.?|\+|-|i)\s*[+-]?$/i;
const DMG_NONE_RE = /^(no damages?( (found|reported))?|keine schäden|bojājumu nav)\.?$/i;
const DMG_QTY_RE = /^(\d{1,3})\s*[x×]?$/i;
const DMG_PARTS_RE = /\(\s*\d{1,3}\s*\)\s*$/;
const DMG_SEV_RE = /[≥≤<>]|\d\s*(mm|cm|µm|μm|um)\b|^(minor|moderate|major|severe|light|heavy|small|medium|large|leicht|mittel|schwer|gering|stark)\b|\b(thickness|width|length|diameter|depth|size|breite|länge|tiefe|durchmesser)\b/i;

const dmgCol = (t) => DMG_COLS.findIndex((re) => re.test(clean(t)));

/** Šūnas (teksts + koordinātas) -> rindas pēc galvas kolonnu x un rindu y. null, ja galvas nav. */
function damageRowsFromCells(cells) {
  const list = (cells ?? []).filter((c) => c && typeof c.t === "string" && clean(c.t) && Number.isFinite(c.x) && Number.isFinite(c.y));
  // Galva: vienā y līnijā ≥3 atpazīti kolonnu nosaukumi, starp tiem Damage vai Quantity.
  let head = null;
  for (const c of list) {
    const col = dmgCol(c.t);
    if (col < 0) continue;
    const same = list.filter((o) => Math.abs(o.y - c.y) <= 6 && dmgCol(o.t) >= 0);
    const cols = new Map();
    for (const o of same) if (!cols.has(dmgCol(o.t))) cols.set(dmgCol(o.t), o.x);
    if (cols.size >= 3 && (cols.has(1) || cols.has(4)) && (!head || cols.size > head.cols.size)) head = { y: c.y, cols };
  }
  if (!head) return null;
  const xs = [...head.cols.entries()].sort((a, b) => a[1] - b[1]);
  const colOf = (c) => {
    const cx = c.x + (Number(c.w) || 0) / 2;
    let col = xs[0][0];
    for (const [k, x] of xs) if (cx >= x - 8) col = k;
    return col;
  };
  const body = list
    .filter((c) => c.y > head.y + 4 && !DMG_UI_RE.test(clean(c.t)) && dmgCol(c.t) < 0)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  for (const c of body) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(c.y - last.y) <= 6) last.cells.push(c);
    else lines.push({ y: c.y, cells: [c] });
  }
  const keyCols = [2, 3, 4].filter((k) => head.cols.has(k));
  const rows = [];
  let pending = ["", ""];
  // Vertikāli centrēta apvienotā šūna nonāk grupas vidū - iepriekšējās tukšās rindas pieder tai pašai grupai.
  const backfill = (has) => {
    for (const k of [0, 1]) {
      if (!has(k)) continue;
      for (let i = rows.length - 1; i >= 0 && !rows[i][k]; i -= 1) rows[i][k] = pending[k];
    }
  };
  for (const line of lines) {
    const byCol = new Map();
    for (const c of line.cells) {
      // Bez Area kolonnas «Exterior» / «Interior» ir grupas virsraksts.
      if (!head.cols.has(0) && DMG_AREA_RE.test(clean(c.t))) {
        pending = [clean(c.t), ""];
        continue;
      }
      const k = colOf(c);
      byCol.set(k, [...(byCol.get(k) ?? []), clean(c.t)]);
    }
    if (byCol.size === 0) continue;
    const has = (k) => byCol.has(k);
    const val = (k) => (byCol.get(k) ?? []).join(", ");
    if ([...byCol.keys()].every((k) => k <= 1)) {
      // Tikai zona / bojājuma veids (apvienota šūna savā rindā) - attiecas uz nākamajām rindām.
      pending = [has(0) ? val(0) : pending[0], has(1) ? val(1) : has(0) ? "" : pending[1]];
      backfill(has);
      continue;
    }
    const cur = rows[rows.length - 1];
    if (cur && !keyCols.some(has) && !has(0) && !has(1)) {
      // Daļu saraksts pāri vairākām līnijām - turpinājums.
      for (const [k, v] of byCol) cur[k] = cur[k] ? `${cur[k]}, ${v.join(", ")}` : v.join(", ");
      continue;
    }
    if (has(0)) pending = [val(0), ""];
    if (has(1)) pending[1] = val(1);
    backfill(has);
    rows.push([pending[0], pending[1], val(2), val(3), val(4), val(5)]);
  }
  return rows;
}

/** Teksta rindas (innerText) -> rindas pēc satura veida, ja koordinātu nav. */
function damageRowsFromLines(lines) {
  const ls = (lines ?? []).map(clean).filter((l) => l && !DMG_UI_RE.test(l));
  // Galva: pēc kārtas ≥3 kolonnu nosaukumi; citādi saturs sākas uzreiz.
  let start = 0;
  for (let i = 0; i < ls.length; i += 1) {
    let n = 0;
    while (i + n < ls.length && dmgCol(ls[i + n]) >= 0) n += 1;
    if (n >= 3) {
      start = i + n;
      break;
    }
  }
  const rows = [];
  let row = null;
  let next = 0;
  let area = "";
  let damage = "";
  for (const l of ls.slice(start)) {
    if (DMG_NONE_RE.test(l)) continue;
    let k;
    if (DMG_AREA_RE.test(l)) k = 0;
    else if (DMG_QTY_RE.test(l)) k = 4;
    else if (DMG_PARTS_RE.test(l)) k = 5;
    else if (DMG_SEV_RE.test(l)) k = 2;
    else k = next <= 1 || next > 5 ? 1 : 3;
    if (k === 0) {
      area = l;
      damage = "";
      row = null;
      next = 1;
      continue;
    }
    if (k === 1) {
      damage = l;
      row = null;
      next = 2;
      continue;
    }
    const partsMore = k === 5 && row && row[5];
    if (!partsMore && (!row || k < next)) {
      row = [area, damage, "", "", "", ""];
      rows.push(row);
    }
    row[k] = k === 4 ? l.match(DMG_QTY_RE)[1] : row[k] ? `${row[k]}, ${l}` : l;
    next = k + 1;
  }
  return rows.filter((r) => r[2] || r[3] || r[4] || r[5]);
}

/**
 * Nils 20.11: Auto1 «DAMAGE SUMMARY» div režģis -> tabula ar kanonisku galvu (DAMAGE_TABLE_HEAD), vai null.
 * Vispirms pēc koordinātām (kolonnas zem galvas), tad pēc teksta rindām.
 */
export function damageSectionTable(raw) {
  if (!raw || typeof raw !== "object") return null;
  let rows = damageRowsFromCells(raw.cells);
  if (!rows || rows.length === 0) rows = damageRowsFromLines(raw.lines);
  rows = rows.filter((r) => r.slice(1).some(Boolean)).slice(0, 80);
  return rows.length ? [DAMAGE_TABLE_HEAD, ...rows] : null;
}

const isDamageTable = (t) => {
  const head = (t?.[0] ?? []).map((c) => clean(c).toLowerCase());
  return head.some((h) => /^(damage|schaden|bojājums)$/.test(h)) && head.some((h) => /^(area|zone|bereich|quantity|anzahl)$/.test(h));
};

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
  let paint = [];
  let damageTable = null;
  for (const e of extracts) {
    if (!e) continue;
    if (!title && e.title) title = clean(e.title);
    // Mērījumi: dublikāti ir īsti (vairāki 110 µm vienā sānā), tāpēc ņem pilnāko sarakstu, nevis apvieno.
    if (Array.isArray(e.paint) && e.paint.length > paint.length) {
      paint = e.paint.filter((p) => Array.isArray(p) && typeof p[0] === "string" && typeof p[1] === "string").map((p) => [clean(p[0]), clean(p[1])]);
    }
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
    for (const raw of e.damageRaw ?? []) {
      const t = damageSectionTable(raw);
      if (t && (!damageTable || t.length > damageTable.length)) damageTable = t;
    }
    photos.push(...(e.photos ?? []));
    if (e.text && e.text.length > text.length) text = e.text;
  }
  // Sadaļas tabula pirmā (lietotne ņem pirmo bojājumu tabulu), ja lapā nav īstas <table> / ARIA bojājumu tabulas.
  if (damageTable && !tables.some(isDamageTable)) tables.unshift(damageTable);
  if (tables.length > 12) tables.length = 12;
  return { title, fields, tables, lists, photos, paint, text: text.slice(0, 40_000) };
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
    // 300: Auto1 «Airbag ...» aprīkojuma rinda ar visiem spilveniem ir garāka par 120 zīmēm (agrāk pazuda).
    const items = [...ul.children].filter((li) => li.tagName === "LI").map((li) => txt(li)).filter((t) => t && t.length <= 300);
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
  // Nils 20.11: Auto1 «CAR DATA ACCORDING TO IDENTIFICATION NUMBER (VIN)» - <ul> ir tikai pirmie 10, pārējie pēc
  // «Show more» ir citā elementā. Pilnais saraksts = sadaļas innerText rindas aiz virsraksta (bez pogām), konteinerā,
  // kurā vēl nav citas sadaļas virsraksta. Tas pats virsraksts -> mergeDetailExtracts paturēs garāko sarakstu.
  const HEAD_SEL = "h1, h2, h3, h4, h5, h6, [role=heading]";
  const UI_LINE = /^(\+\s*\d*|-|show (more|less|original|all)|mehr anzeigen|weniger anzeigen|alle anzeigen|rādīt (vairāk|mazāk|visu)|some content has been automatically translated\.?)\s*[+-]?$/i;
  document.querySelectorAll(HEAD_SEL).forEach((h) => {
    const heading = txt(h);
    if (!heading || heading.length > 100 || !/according to (the )?(identification number|vin)|dati pēc vin|(laut|gemäß) (fin|vin)/i.test(heading)) return;
    let best = [];
    let box = h.parentElement;
    for (let depth = 0; depth < 6 && box; depth += 1) {
      const other = [...box.querySelectorAll(HEAD_SEL)].some((x) => x !== h && !h.contains(x) && !x.contains(h) && txt(x));
      if (other) break;
      const lines = String(box.innerText || "").split("\n").map(clean).filter(Boolean);
      const start = lines.indexOf(heading);
      const items = lines.slice(start + 1).filter((l) => !UI_LINE.test(l) && l.length <= 300);
      if (items.length > best.length) best = items;
      box = box.parentElement;
    }
    if (best.length >= 2) lists.unshift({ heading: heading.slice(0, 80), items: best.slice(0, 300) });
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
  // Auto1 «Vehicle condition» shēma: mērījumi ir čipi virs zīmējuma (nav «etiķete: vērtība»), zonu dod data-testid
  // `vehicle-condition-widget-<zona>-pt`. Lapā ir divas shēmas (dators / telefons) - ņem to, kurā ir vairāk.
  const paintOf = (root) => {
    const out = [];
    root.querySelectorAll('[data-testid^="vehicle-condition-widget-"][data-testid$="-pt"]').forEach((el) => {
      const zone = el.getAttribute("data-testid").slice("vehicle-condition-widget-".length, -3).toLowerCase();
      const value = txt(el).slice(0, 60);
      if (/^[a-z]{3,10}$/.test(zone) && value) out.push([zone, value]);
    });
    return out;
  };
  let paint = [];
  const schemas = document.querySelectorAll('[class*="carSchema"]');
  (schemas.length ? [...schemas] : [document]).forEach((root) => {
    const p = paintOf(root);
    if (p.length > paint.length) paint = p;
  });
  // Nils 20.11: Auto1 «DAMAGE SUMMARY» nav <table> un nav ARIA (div režģis) - savāc sadaļas šūnas ar koordinātām
  // un teksta rindas; tabulu no tām uzbūvē Node pusē (damageSectionTable), lai loģiku var testēt.
  const DMG_HEAD = /^(damage summary|summary of damages|schadens?übersicht|schadenszusammenfassung|bojājumu kopsavilkums|résumé des dommages|riepilogo (dei )?danni|resumen de daños|schadeoverzicht)$/i;
  const damageRaw = [];
  const isHeadingEl = (el) => /^H[1-6]$/.test(el.tagName) || el.getAttribute("role") === "heading";
  [...document.querySelectorAll("h1, h2, h3, h4, h5, h6, [role=heading], div, span, p, strong, b, header, summary, button")]
    .filter((el) => (el.textContent || "").length <= 60 && DMG_HEAD.test(txt(el)) && ![...el.children].some((c) => DMG_HEAD.test(txt(c))))
    .map((el) => {
      // Virsraksta ārējais elements (span klases nav; .Title klase ir uz ietvara) - salīdzināšanai ar nākamo sadaļu.
      let h = el;
      while (h.parentElement && clean(h.parentElement.textContent) === clean(el.textContent)) h = h.parentElement;
      return h;
    })
    .filter((h, i, arr) => arr.indexOf(h) === i)
    .slice(0, 4)
    .forEach((h) => {
      // Paslēptā (telefona / datora) kopija: innerText = textContent vienā rindā, kastīte uzkāptu līdz <body>.
      const hr = h.getBoundingClientRect();
      if (!hr.width || !hr.height) return;
      let box = h.parentElement;
      for (let d = 0; d < 6 && box && box !== document.body; d += 1) {
        if (String(box.innerText || "").split("\n").map(clean).filter(Boolean).length >= 4) break;
        box = box.parentElement;
      }
      if (!box || box === document.body || box === document.documentElement) return;
      const br = box.getBoundingClientRect();
      if (!br.width || !br.height) return;
      const hClass = h.getAttribute("class") || "";
      const peer = (el) =>
        el !== h && el.tagName === h.tagName && (isHeadingEl(h) || hClass) && (el.getAttribute("class") || "") === hClass && (el.textContent || "").trim().length > 0;
      const cells = [];
      let after = false;
      for (const el of box.querySelectorAll("*")) {
        if (el === h) {
          after = true;
          continue;
        }
        if (!after || h.contains(el)) continue;
        if (peer(el)) break;
        if ([...el.children].some((c) => (c.textContent || "").trim())) continue;
        const t = txt(el);
        if (!t || t.length > 200) continue;
        let outer = el;
        while (outer.parentElement && outer.parentElement !== box && clean(outer.parentElement.textContent) === clean(el.textContent)) outer = outer.parentElement;
        const r = outer.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        cells.push({ t, x: Math.round(r.left), y: Math.round(r.top + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) });
        if (cells.length >= 500) break;
      }
      const all = String(box.innerText || "").split("\n").map(clean).filter(Boolean);
      const hi = all.findIndex((l) => DMG_HEAD.test(l));
      const lines = all.slice(hi + 1, hi + 401).filter((l) => l.length <= 200);
      if (cells.length || lines.length) damageRaw.push({ cells, lines });
    });
  const h1 = document.querySelector("h1");
  return {
    title: txt(h1) || clean(document.title),
    paint: paint.slice(0, 60),
    fields: fields.slice(0, 600),
    tables: tables.slice(0, 12),
    lists: lists.slice(0, 24),
    damageRaw: damageRaw.slice(0, 3),
    photos,
    text: clean(document.body ? document.body.innerText : "").slice(0, 40000),
  };
}

const sleepDefault = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Atver detaļu lapu jau ielogotā profilā (sesiju pārbauda izsaucējs) un atdod izvilkumu.
 * `page` - Playwright Page; `opts.sleep` testiem.
 */
// --- Izvēršanas pogas (Nils 20.11: Auto1 «Dati pēc VIN» tikai 10 pozīcijas) ---

/** Izvēršanas pogas teksts: «Show more», «+», «Mehr anzeigen», «Rādīt vairāk» u.c. (var būt ar skaitu / bultu). */
export const EXPAND_TEXT_RE =
  /^(?:\+\s*\d*|(?:show|see|view|load)\s+(?:more|all)(?:\s+\w+)?|(?:alle|mehr)(?:\s+\w+)?\s+anzeigen|weitere\s+anzeigen|mehr|rādīt\s+(?:vairāk|visu|visas)|vairāk|meer\s+(?:tonen|weergeven)|toon\s+meer|voir\s+plus|afficher\s+plus|mostra\s+(?:di\s+)?più|ver\s+más|mostrar\s+más|pokaż\s+więcej|zobrazit\s+více)\s*(?:\(?\+?\s*\d+\s*\)?)?\s*[+▾▼⌄›>]?$/i;

/** Nekad nespiest: solīšana, pirkšana, apmaksa, apstiprināšana, konts. Pārbauda tekstu, aria-label, title, data-testid, id. */
export const FORBIDDEN_CONTROL_RE =
  /(?:^|[^a-z])(?:bid|bids|bidding|gebot|gebote|bieten|biete|überbieten|höchstgebot|buy|kaufen|kauf|sofortkauf|purchase|checkout|cart|warenkorb|basket|order|bestellen|pay|payment|bezahlen|zahlen|zahlung|offer|angebot|submit|absenden|senden|confirm|bestätigen|accept|akzeptieren|reserve|reservieren|solīt|solījum|pirkt|nopirkt|pasūtīt|apmaksāt|maksāt|apstiprināt|watch|merken|favou?rit|delete|löschen|remove|entfernen|logout|log out|sign out|abmelden|download|print|drucken|share|teilen)/i;

/**
 * Tīra loģika: kuras lapas vadīklas drīkst nospiest, lai izvērstu sarakstus. Atgriež kandidātu id.
 * Kandidāts: { id, tag, text, label, title, testid, elId, href, type, expanded, haspopup, inChrome, inForm, disabled, parent, clicks }.
 * `aria`: vai spiest arī aria-expanded="false" vadīklas bez izvēršanas teksta (Auto1 akordeoni / «+» ikonas).
 */
export function pickExpandControls(cands, { aria = false, maxClicksPerControl = 3 } = {}) {
  const ok = new Set();
  for (const c of Array.isArray(cands) ? cands : []) {
    if (!c || typeof c.id !== "string") continue;
    const text = clean(c.text);
    const label = clean(c.label);
    const meta = [text, label, clean(c.title), clean(c.testid), clean(c.elId)].join(" | ");
    if (FORBIDDEN_CONTROL_RE.test(meta)) continue;
    if (c.disabled || c.inChrome || c.inForm) continue;
    if (c.type === "submit" || c.type === "reset") continue;
    if (c.haspopup && c.haspopup !== "false") continue;
    if (c.expanded === "true") continue;
    if (String(c.tag).toUpperCase() === "A" && c.href && !/^(#|javascript:)/i.test(c.href)) continue;
    if ((Number(c.clicks) || 0) >= maxClicksPerControl) continue;
    const byText = EXPAND_TEXT_RE.test(text) || (!text && EXPAND_TEXT_RE.test(label));
    const byAria = aria && c.expanded === "false" && text.length <= 80;
    if (byText || byAria) ok.add(c.id);
  }
  // Ligzdotas vadīklas: ja izvēlēts arī vecāks, bērnu nespiež (citādi divi klikšķi aizver atpakaļ).
  return [...ok].filter((id) => {
    const c = cands.find((x) => x && x.id === id);
    for (let p = c?.parent, guard = 0; p && guard < 50; guard += 1) {
      if (ok.has(p)) return false;
      p = cands.find((x) => x && x.id === p)?.parent;
    }
    return true;
  });
}

/** Lapā: atzīmē iespējamās vadīklas (data-provin-expand) un atgriež to aprakstus (spiež tikai Node pusē izvēlētās). */
export function collectExpandCandidatesDom() {
  const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const els = [...document.querySelectorAll('button, [role="button"], a, summary, [aria-expanded]')].slice(0, 600);
  const ids = new Map();
  els.forEach((el, i) => {
    el.setAttribute("data-provin-expand", String(i));
    ids.set(el, String(i));
  });
  return els.map((el, i) => {
    let parent = "";
    for (let p = el.parentElement; p && !parent; p = p.parentElement) parent = ids.get(p) || "";
    return {
      id: String(i),
      tag: el.tagName,
      text: clean(el.innerText || el.textContent).slice(0, 120),
      label: clean(el.getAttribute("aria-label")).slice(0, 120),
      title: clean(el.getAttribute("title")).slice(0, 120),
      testid: clean(el.getAttribute("data-testid")).slice(0, 120),
      elId: clean(el.id).slice(0, 120),
      href: el.tagName === "A" ? el.getAttribute("href") || "" : "",
      type: (el.getAttribute("type") || "").toLowerCase(),
      expanded: el.getAttribute("aria-expanded"),
      haspopup: el.getAttribute("aria-haspopup"),
      inChrome: Boolean(el.closest('header, nav, [role="navigation"], [role="menu"], [role="menubar"], [role="listbox"], [role="dialog"], dialog')),
      inForm: Boolean(el.closest("form")),
      disabled: Boolean(el.disabled) || el.getAttribute("aria-disabled") === "true",
      parent,
      clicks: Number(el.getAttribute("data-provin-expand-n")) || 0,
    };
  });
}

/** Lapā: nospiež tikai norādītās (jau pārbaudītās) vadīklas. */
export function clickExpandControlsDom(ids) {
  let n = 0;
  for (const id of Array.isArray(ids) ? ids : []) {
    if (!/^\d+$/.test(String(id))) continue;
    const el = document.querySelector(`[data-provin-expand="${id}"]`);
    if (!el) continue;
    el.setAttribute("data-provin-expand-n", String((Number(el.getAttribute("data-provin-expand-n")) || 0) + 1));
    try {
      el.click();
      n += 1;
    } catch {
      /* ignore */
    }
  }
  return n;
}

/** Lapā: satura apjoms (li skaits + teksta garums) - lai redzētu, kad saraksts pēc klikšķa beidz augt. */
export function detailContentSizeDom() {
  return document.querySelectorAll("li").length * 100_000 + String(document.body ? document.body.innerText || "" : "").length;
}

/**
 * Izvērš sadaļu sarakstus: līdz `maxRounds` kārtām - savāc vadīklas, izvēlas drošās, nospiež, gaida, kamēr saturs
 * pieaug un nostabilizējas (līdz `settleMs`). Atgriež nospiesto skaitu.
 */
export async function expandDetailSections(page, { sleep = (ms) => new Promise((r) => setTimeout(r, ms)), aria = false, maxRounds = 4, settleMs = 3_000 } = {}) {
  let total = 0;
  for (let round = 0; round < maxRounds; round += 1) {
    const cands = await page.evaluate(collectExpandCandidatesDom).catch(() => null);
    if (!Array.isArray(cands)) break;
    const ids = pickExpandControls(cands, { aria });
    if (!ids.length) break;
    const before = Number(await page.evaluate(detailContentSizeDom).catch(() => 0)) || 0;
    const n = Number(await page.evaluate(clickExpandControlsDom, ids).catch(() => 0)) || 0;
    if (!n) break;
    total += n;
    let last = before;
    let stable = 0;
    for (let t = 0; t < settleMs; t += 300) {
      await sleep(300);
      const size = Number(await page.evaluate(detailContentSizeDom).catch(() => last)) || last;
      if (size !== last) {
        last = size;
        stable = 0;
      } else if (size > before && (stable += 1) >= 2) break;
    }
  }
  return total;
}

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
    // Auto1 «Vehicle condition» ielādējas tikai tad, kad sadaļa nonāk ekrānā: ritina pa soļiem, ne uzreiz uz apakšu.
    await page
      .evaluate(async () => {
        const total = Math.min(document.documentElement.scrollHeight, 30_000);
        for (let y = 0; y < total; y += 700) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 200));
        }
        window.scrollTo(0, document.body.scrollHeight);
      })
      .catch(() => undefined);
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
      if (await expandDetailSections(page, { sleep, aria: Boolean(cfg.expandAria) })) await grab();
    }
    // Nils 30.10 / 20.11: Auto1 «Dati pēc VIN» u.c. saraksti paslēpti zem «Show more» / «+» / aria-expanded pogām,
    // un pārējās pozīcijas DOM parādās tikai PĒC klikšķa. Spiež tikai izvēršanas pogas (pickExpandControls), gaida pieaugumu.
    if (await expandDetailSections(page, { sleep, aria: Boolean(cfg.expandAria) })) await grab();
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
        paint: merged.paint,
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
