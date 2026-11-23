/**
 * Izsoļu portāla ieraksta strukturēts modelis klienta PDF.
 *
 * Avots ir `record.raw` (history + detail + images sapludināti). Vecajiem ierakstiem bez `raw`
 * objektu atpakaļ saliek no `fields[]` atslēgu ceļiem. Katrs lapas lauks (leaf) nonāk vienā no:
 * sadaļa, «Citi dati», dublikāts (tā pati nozīme un vērtība jau parādīta) vai izslēgts
 * (saites, bilžu tehniskie lauki, iekšējie id/laiki, valūtu kursi, tukšas vērtības).
 * Ārējā pakalpojuma nosaukums modelī neparādās.
 */
import {
  countryName,
  equipmentCategory,
  EQUIPMENT_CATEGORY_ORDER,
  humanizeToken,
  i18nFamily,
  isGenericEquipmentGroup,
  isI18nKey,
  isSignificantMissingFeature,
  keyLabel,
  knownDamageType,
  looksLikeEnum,
  noteThecarapiUntranslated,
  normKey,
  THECARAPI_ZONE_ORDER,
  translateDamageDescription,
  translateDamageType,
  translateEnum,
  translateEquipment,
  translateI18n,
  translatePart,
  translatePosition,
  translateZone,
  zoneFromPart,
} from "@/lib/thecarapi-i18n-lv";
import { thecarapiSiteLabel } from "@/lib/vin-scan/parse-thecarapi";
import type { ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";

export type ThecarapiPdfKv = { label: string; value: string; highlight?: boolean };

/** Lakas mērījums: `area` ir avota detaļas nosaukums (shēmas vietai), `label` - latviski. */
export type ThecarapiPdfPaint = ThecarapiPdfKv & { area: string };

export type ThecarapiPdfGrid = { columns: string[]; rows: string[][] };

export type ThecarapiPdfDamage = {
  zone: string;
  part: string;
  type: string;
  size: string;
  quantity: string;
  repair: string;
  notes: string;
};

export type ThecarapiPdfWheelSet = { title: string; grid: ThecarapiPdfGrid };

export type ThecarapiPdfEquipmentGroup = { group: string; items: string[] };

export type ThecarapiPdfLeafStatus = "section" | "other" | "duplicate" | "excluded";

export type ThecarapiPdfModel = {
  header: string;
  basics: ThecarapiPdfKv[];
  prices: ThecarapiPdfKv[];
  mileage: ThecarapiPdfKv[];
  dates: ThecarapiPdfKv[];
  damages: ThecarapiPdfDamage[];
  damagesTotal: number | null;
  paint: ThecarapiPdfPaint[];
  brakes: ThecarapiPdfGrid | null;
  wheels: ThecarapiPdfWheelSet[];
  equipment: ThecarapiPdfEquipmentGroup[];
  service: { summary: string; rows: ThecarapiPdfKv[]; entries: ThecarapiPdfGrid | null };
  documents: string[];
  other: ThecarapiPdfKv[];
  /** Bildes saite -> paraksta kategorija (Bojājums: ..., Serviss, Dokuments). Tikai galerijai, PDF tekstā saites nav. */
  photoCategories: Record<string, string>;
  /** Katra lapas lauka ceļš un kur tas nonāca. Testiem: «nekas nepazūd». */
  coverage: { path: string; status: ThecarapiPdfLeafStatus }[];
};

type Seg = string | number;
type Leaf = { segs: Seg[]; path: string; value: unknown };

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function pathOf(segs: readonly Seg[]): string {
  let out = "";
  for (const seg of segs) {
    if (typeof seg === "number") out += `[${seg}]`;
    else out += out ? `.${seg}` : seg;
  }
  return out;
}

function isPrimitive(v: unknown): boolean {
  return v == null || typeof v !== "object";
}

function flatten(value: unknown, segs: Seg[], out: Leaf[], depth: number): void {
  if (depth > 12) return;
  if (Array.isArray(value)) {
    if (value.length === 0 || value.every(isPrimitive)) {
      if (segs.length) out.push({ segs, path: pathOf(segs), value });
      return;
    }
    value.forEach((item, i) => flatten(item, [...segs, i], out, depth + 1));
    return;
  }
  const rec = asRecord(value);
  if (!rec) {
    if (segs.length) out.push({ segs, path: pathOf(segs), value });
    return;
  }
  const keys = Object.keys(rec);
  if (keys.length === 0) {
    if (segs.length) out.push({ segs, path: pathOf(segs), value: {} });
    return;
  }
  for (const key of keys) flatten(rec[key], [...segs, key], out, depth + 1);
}

/** `a.b[0].c` -> segmenti. i18n atslēgas (`global.x.y`) ceļā paliek kopā tikai, ja tās neatdala punkti - vecajiem ierakstiem pietiek. */
function parsePath(path: string): Seg[] {
  const segs: Seg[] = [];
  const re = /([^.[\]]+)|\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path))) {
    if (m[2] != null) segs.push(Number(m[2]));
    else if (m[1] != null) segs.push(m[1]);
  }
  return segs;
}

function parseFieldValue(value: string): unknown {
  if (value === "null") return null;
  if (value === "jā") return true;
  if (value === "nē") return false;
  return value;
}

/** Vecie ieraksti: `fields[]` -> objekts pēc ceļiem. */
export function thecarapiRawFromFields(fields: readonly { key: string; value: string }[]): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const field of fields) {
    const segs = parsePath(field.key);
    if (segs.length === 0 || typeof segs[0] !== "string") continue;
    let node: unknown = root;
    for (let i = 0; i < segs.length; i += 1) {
      const seg = segs[i]!;
      const last = i === segs.length - 1;
      const nextIsIndex = typeof segs[i + 1] === "number";
      const container = node as Record<string | number, unknown>;
      if (last) {
        container[seg] = parseFieldValue(field.value);
        break;
      }
      if (container[seg] == null || typeof container[seg] !== "object") container[seg] = nextIsIndex ? [] : {};
      node = container[seg];
    }
  }
  return root;
}

// ---------- Izslēgšana (spec 5. p.) ----------

const EXCLUDED_KEYS = new Set(
  [
    "servedUrl",
    "served_url",
    "remote_url",
    "remoteUrl",
    "thumbnail",
    "thumbnail_url",
    "thumbnailUrl",
    "fullUrl",
    "absoluteUrl",
    "url",
    "href",
    "src",
    "offer_link",
    "detail_path",
    "index",
    "image_index",
    "image_status",
    "image_source",
    "is_primary",
    "isPrimary",
    "source_order",
    "sourceOrder",
    "vault_gallery",
    "Auto1GalleryV2",
    "specification_provenance",
    "meta",
    "server_time",
    "success",
    "request_id",
    "contract_version",
    "auction_sec_left",
    "details_pending",
    "created_at",
    "updated_at",
    "archived_at",
    "data_updated_at",
    "VinOcr",
    "ZrtLabel",
    "eur_rates",
    "currency_code_id",
    "auction_batch_id",
    "source_auction_id",
    "auction_id_str",
    "contentHash",
    "content_hash",
    "hash",
    "picture_count",
    "pictureCount",
    "image_url",
    "imageUrl",
    "ImageUrls",
    "image_urls",
    "imageUrls",
    "DamageImageUrls",
    "damage_image_urls",
    "ServiceImageUrls",
    "service_image_urls",
    "ImageVaultImages",
    "image_vault_images",
    "subAreaImages",
    "sub_area_images",
    "DocumentPhotos",
    "document_photos",
    "VideoUrls",
    "video_urls",
    "gallery",
    "images",
    "photos",
    "auction_images",
    "AuctionImages",
    // TheCarApi v1: iekšējie kodi un tehniskie karogi.
    "type_id",
    "typeId",
    "live_price_pending",
    "poll_after_seconds",
    "videos",
    // Remontu un servisa EUR summas atskaitēs neraksta (Nila likums).
    "estimated_repair_costs",
    "estimatedRepairCosts",
    "estimated_repair_cost",
    "repair_cost",
    "repair_costs",
    "repairCost",
    "price_eur",
  ].map(normKey),
);

function isUrlString(v: string): boolean {
  const s = v.trim();
  return /^https?:\/\//i.test(s) || /^\/(auction-photo|report-vault|api)\//i.test(s) || /[?&]sig=/.test(s);
}

function isEmptyValue(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") {
    const s = v.trim();
    return s === "" || s === "-" || s === "null" || s === "undefined";
  }
  if (Array.isArray(v)) return v.length === 0 || v.every(isEmptyValue);
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  if (typeof v === "number") return !Number.isFinite(v);
  return false;
}

function stringSegs(segs: readonly Seg[]): string[] {
  return segs.filter((s): s is string => typeof s === "string");
}

function isStateKey(key: string): boolean {
  return /State$/.test(key) && key.length > 5;
}

function isExcludedLeaf(leaf: Leaf): boolean {
  if (isEmptyValue(leaf.value)) return true;
  const names = stringSegs(leaf.segs);
  for (const name of names) {
    if (EXCLUDED_KEYS.has(normKey(name))) return true;
    if (/(^|_)hash$/i.test(name)) return true;
  }
  const leafName = names[names.length - 1] ?? "";
  if (names.some((n) => normKey(n) === "specenrichment") && /^(path|method)$/i.test(leafName)) return true;
  if (typeof leaf.value === "string" && isUrlString(leaf.value)) return true;
  if (Array.isArray(leaf.value) && leaf.value.every((v) => typeof v !== "string" || isUrlString(v) || isEmptyValue(v))) {
    return leaf.value.some((v) => typeof v === "string" && isUrlString(v));
  }
  if (isStateKey(leafName) && typeof leaf.value === "string" && /^(ok|unknown|)$/i.test(leaf.value.trim())) return true;
  return false;
}

// ---------- Formatēšana ----------

function groupInt(n: number): string {
  const sign = n < 0 ? "-" : "";
  const digits = Math.abs(Math.round(n)).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function numberText(n: number): string {
  if (Number.isInteger(n)) return groupInt(n);
  const fixed = Math.round(n * 100) / 100;
  const [int, dec] = fixed.toFixed(2).split(".");
  const d = (dec ?? "").replace(/0+$/, "");
  return d ? `${groupInt(Number(int))},${d}` : groupInt(Number(int));
}

function toNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return null;
  const s = raw.trim().replace(/[\s ]/g, "");
  if (!/^-?\d+(?:[.,]\d+)?$/.test(s)) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/;

const RIGA_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Riga",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function isIsoDate(raw: unknown): raw is string {
  return typeof raw === "string" && ISO_RE.test(raw.trim());
}

/** ISO -> DD.MM.YYYY vai DD.MM.YYYY HH:MM (Europe/Riga). */
export function thecarapiPdfDate(raw: string, withTime = true): string {
  const m = ISO_RE.exec(raw.trim());
  if (!m) return raw.trim();
  const [, y, mo, d, hh, mi, ss, zone] = m;
  if (hh == null || !withTime) {
    if (hh == null || zone == null) return `${d}.${mo}.${y}`;
  }
  // Tikai-datuma lauks («2020-12-09T00:00:00» bez zonas) - laiku nerāda (citādi Rīgā «02:00»).
  if (zone == null && hh === "00" && (mi ?? "00") === "00" && /^0*$/.test(ss ?? "00")) return `${d}.${mo}.${y}`;
  let z = zone ?? "Z";
  if (/^[+-]\d{4}$/.test(z)) z = `${z.slice(0, 3)}:${z.slice(3)}`;
  const date = new Date(`${y}-${mo}-${d}T${hh ?? "00"}:${mi ?? "00"}:${ss ?? "00"}${z}`);
  if (Number.isNaN(date.getTime())) return `${d}.${mo}.${y}`;
  const parts = Object.fromEntries(RIGA_FMT.formatToParts(date).map((p) => [p.type, p.value]));
  const day = `${parts.day}.${parts.month}.${parts.year}`;
  return withTime ? `${day} ${parts.hour}:${parts.minute}` : day;
}

const PLAIN_NUMBER_KEY = /(year|id$|code|nr$|number|zip|postal|count$|count[A-Z_]|doors?$|seats?$|kw$|hp$|ps$|cylinders|gears|owners|quantity|dot|plate)/i;

function formatScalar(key: string, raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "boolean") return raw ? "jā" : "nē";
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return "";
    return PLAIN_NUMBER_KEY.test(key) || (raw >= 1900 && raw <= 2100 && Number.isInteger(raw)) ? String(raw) : numberText(raw);
  }
  if (typeof raw !== "string") return "";
  const s = raw.trim();
  if (!s) return "";
  if (isI18nKey(s)) return translateI18n(s);
  if (isIsoDate(s)) return thecarapiPdfDate(s);
  // Tikai valstu kodu lauki - ne «CountryMessages» atbildes («NO» = nē, nevis Norvēģija).
  if (/country/i.test(key) && !/message|value$/i.test(key) && /^[A-Za-z]{2}$/.test(s)) return countryName(s);
  const n = toNumber(s);
  if (n != null && !PLAIN_NUMBER_KEY.test(key) && !/^0\d/.test(s)) return numberText(n);
  if (/damage/i.test(key)) {
    const dmg = knownDamageType(s);
    if (dmg) return dmg;
  }
  const en = translateEnum(s);
  if (en) return en;
  if (looksLikeEnum(s)) {
    const shown = humanizeToken(s);
    noteThecarapiUntranslated("vērtība", s, shown);
    return shown;
  }
  // Viens angļu vārds (enum bez atdalītāja) - rāda kā ir, bet reģistrē vārdnīcai. Brīvo tekstu neaiztiek.
  if (/^[a-z]{3,24}$/.test(s) && !FREE_TEXT_KEY.test(key)) noteThecarapiUntranslated("vērtība", s, s);
  return s;
}

const FREE_TEXT_KEY = /(comment|remark|note|description|text|title|name|city|location|seller|company|model|make|brand|variant|trim|version|street|address)/i;

function formatValue(key: string, raw: unknown): string {
  if (Array.isArray(raw)) {
    const parts = raw.map((v) => formatScalar(key, v)).filter(Boolean);
    return [...new Set(parts)].join(", ");
  }
  return formatScalar(key, raw);
}

function priceText(raw: unknown, currency: string): string {
  const n = toNumber(raw);
  if (n == null || n <= 0) return "";
  const cur = currency.trim().toUpperCase();
  return `${numberText(n)} ${!cur || cur === "EUR" ? "€" : cur}`;
}

function kmText(raw: unknown): string {
  const n = toNumber(raw);
  if (n == null || n <= 0) return "";
  return `${groupInt(n)} km`;
}

function dotText(raw: unknown): string {
  const s = String(raw ?? "").trim();
  const m = /^(\d{2})(\d{2})$/.exec(s);
  if (!m) return s;
  const week = Number(m[1]);
  if (week < 1 || week > 53) return s;
  return `${s} (${week}. ned. 20${m[2]})`;
}

// ---------- Koka palīgi ----------

type Node = { segs: Seg[]; path: string; value: unknown };

function findNodes(root: unknown, match: (key: string, value: unknown, segs: Seg[]) => boolean): Node[] {
  const out: Node[] = [];
  const walk = (value: unknown, segs: Seg[], depth: number): void => {
    if (depth > 12 || value == null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, [...segs, i], depth + 1));
      return;
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const next = [...segs, key];
      if (match(key, child, next)) {
        out.push({ segs: next, path: pathOf(next), value: child });
        continue;
      }
      walk(child, next, depth + 1);
    }
  };
  walk(root, [], 0);
  return out;
}

function underPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}.`) || path.startsWith(`${prefix}[`);
}

/** Lauka nozīmes nosaukums: pēdējais teksta segments; `value` -> vecāka nosaukums (SpecEnrichment.co2.value -> co2). */
function meaningName(segs: readonly Seg[]): string {
  const names = stringSegs(segs);
  const last = names[names.length - 1] ?? "";
  if (/^(value|amount)$/i.test(last) && names.length >= 2) return names[names.length - 2]!;
  return last;
}

function inArray(segs: readonly Seg[]): boolean {
  return segs.some((s) => typeof s === "number");
}

function isHistoryLeaf(leaf: Leaf, history: Record<string, unknown> | null, detail: Record<string, unknown> | null): boolean {
  const first = leaf.segs[0];
  if (typeof first === "string" && first.startsWith("history_")) return true;
  if (leaf.segs.length !== 1 || typeof first !== "string" || !history) return false;
  return Object.prototype.hasOwnProperty.call(history, first) && !(detail && Object.prototype.hasOwnProperty.call(detail, first));
}

// ---------- Modelis ----------

type Ctx = {
  leaves: Leaf[];
  status: Map<string, ThecarapiPdfLeafStatus>;
  shown: Set<string>;
  currency: string;
  history: Record<string, unknown> | null;
  detail: Record<string, unknown> | null;
};

function mark(ctx: Ctx, prefix: string, status: ThecarapiPdfLeafStatus = "section"): void {
  for (const leaf of ctx.leaves) {
    if (ctx.status.has(leaf.path)) continue;
    if (underPrefix(leaf.path, prefix)) ctx.status.set(leaf.path, status);
  }
}

function remember(ctx: Ctx, name: string, value: string): void {
  if (value) ctx.shown.add(`${normKey(name)}=${value}`);
}

function openLeaves(ctx: Ctx): Leaf[] {
  return ctx.leaves.filter((leaf) => !ctx.status.has(leaf.path));
}

/** Lauki ar nozīmi `names`, ārpus masīviem. */
function leavesNamed(ctx: Ctx, names: readonly string[]): Leaf[] {
  const want = new Set(names.map(normKey));
  return openLeaves(ctx).filter((leaf) => !inArray(leaf.segs) && want.has(normKey(meaningName(leaf.segs))));
}

function relativeLeaves(value: unknown, skipImages = true): Leaf[] {
  const out: Leaf[] = [];
  flatten(value, [], out, 0);
  return out.filter((leaf) => !(skipImages && isExcludedLeaf(leaf)));
}

// --- Bojājumi ---

type DamageDraft = ThecarapiPdfDamage & { baseType: string; rawPart: string; qty: number | null };

const DAMAGE_TECH_KEYS = /^(id|uuid|index|sort|sortorder|position_index|quantitytype|imageid|damageid|areaid|partid|order)$/i;

function parseDamage(value: unknown, inheritedZone: string): DamageDraft | null {
  const d: DamageDraft = {
    zone: inheritedZone,
    part: "",
    type: "",
    size: "",
    quantity: "",
    repair: "",
    notes: "",
    baseType: "",
    rawPart: "",
    qty: null,
  };
  let desc = "";
  const notes: string[] = [];
  if (typeof value === "string") {
    if (isI18nKey(value)) {
      const fam = i18nFamily(value);
      if (fam?.family === "type") d.baseType = translateI18n(value);
      else if (fam?.family === "part") d.part = translateI18n(value);
      else d.baseType = translateI18n(value);
    } else d.baseType = translateDamageType(value);
  }
  for (const leaf of relativeLeaves(value)) {
    const key = meaningName(leaf.segs);
    const nk = normKey(key);
    const raw = Array.isArray(leaf.value) ? leaf.value.join(", ") : leaf.value;
    if (typeof raw === "string" && isI18nKey(raw)) {
      const fam = i18nFamily(raw);
      const text = translateI18n(raw);
      const family = fam?.family ?? "";
      if (family === "area" || family === "zone") d.zone = d.zone && nk !== "area" ? d.zone : text;
      else if (family === "part" || family === "sub-area" || family === "subarea") {
        if (!d.part) {
          d.part = text;
          d.rawPart = (fam?.rest ?? "").split(".").pop() ?? "";
        }
      } else if (family === "type") d.baseType = d.baseType || text;
      else if (family === "description") desc = desc ? `${desc}, ${text}` : text;
      else if (family === "size") d.size = d.size || text;
      else if (family === "quantity") {
        d.quantity = d.quantity || text;
        d.qty = d.qty ?? toNumber(text);
      } else notes.push(text);
      continue;
    }
    if (isStateKey(key) || DAMAGE_TECH_KEYS.test(nk)) continue;
    const str = typeof raw === "string" ? raw.trim() : raw;
    if (/^(area|zone|region|section|areaname)$/.test(nk)) {
      d.zone = d.zone || translateZone(String(str));
    } else if (/^(part|partname|subarea|component|location|position|partkey)$/.test(nk)) {
      if (!d.part) {
        d.part = translatePart(String(str));
        d.rawPart = String(str);
      }
    } else if (/^(type|damagetype|kind|damage|damagename)$/.test(nk)) {
      d.baseType = d.baseType || translateDamageType(String(str));
    } else if (/^(description|depth|severity|desc|details)$/.test(nk)) {
      // BCA u.c.: `description: "Dent"` ir bojājuma veids, nevis apraksts.
      const asType = typeof str === "string" && !d.baseType ? knownDamageType(str) : "";
      if (asType) {
        d.baseType = asType;
        continue;
      }
      const t = (typeof str === "string" ? translateDamageDescription(str) : "") || formatScalar(key, str).toLowerCase();
      if (t) desc = desc ? `${desc}, ${t}` : t;
    } else if (/^(size|length|dimension|sizecategory)$/.test(nk)) {
      d.size = d.size || formatScalar(key, str);
    } else if (/^(quantity|count|qty|amount)$/.test(nk)) {
      const n = toNumber(str);
      if (n != null && d.qty == null) {
        d.qty = n;
        d.quantity = String(n);
      }
    } else if (/^(repairmethod|repair|repairtype)$/.test(nk)) {
      d.repair = d.repair || formatScalar(key, str);
    } else {
      const text = formatScalar(key, str);
      if (text) notes.push(`${keyLabel(key)}: ${text}`);
    }
  }
  d.type = [d.baseType, desc].filter(Boolean).join(" ");
  d.notes = [...new Set(notes)].join("; ");
  if (!d.zone && d.rawPart) d.zone = zoneFromPart(d.rawPart);
  if (!d.part && !d.baseType && !d.notes) return null;
  return d;
}

function damageItems(value: unknown, inheritedZone = ""): DamageDraft[] {
  if (!Array.isArray(value)) return [];
  const out: DamageDraft[] = [];
  for (const item of value) {
    const rec = asRecord(item);
    const nested = rec ? Object.entries(rec).find(([k, v]) => /^damages$/i.test(k) && Array.isArray(v)) : null;
    if (rec && nested) {
      const zoneRaw = rec.area ?? rec.zone ?? "";
      const zone = typeof zoneRaw === "string" && zoneRaw ? (isI18nKey(zoneRaw) ? translateI18n(zoneRaw) : translateZone(zoneRaw)) : inheritedZone;
      out.push(...damageItems(nested[1], zone));
      continue;
    }
    const d = parseDamage(item, inheritedZone);
    if (d) out.push(d);
  }
  return out;
}

function looksLikeDamageArray(value: unknown): boolean {
  return Array.isArray(value) && JSON.stringify(value).includes("global.damages");
}

function extractDamages(ctx: Ctx, root: unknown): { rows: ThecarapiPdfDamage[]; total: number | null; partByUrl: Map<string, string> } {
  const nodes = findNodes(root, (key, value) => {
    const k = normKey(key);
    if (k === "damagesv3" || k === "damagesstructured" || k === "damagessummaryv3") return Array.isArray(value);
    if (k === "damages") return Array.isArray(value);
    if (k === "highlights") return looksLikeDamageArray(value);
    return false;
  });
  const rank = (n: Node): number => {
    const k = normKey(String(n.segs[n.segs.length - 1]));
    if (k === "damagesv3") return 0;
    if (k === "damagesstructured") return 1;
    if (k === "damages") return 2;
    if (k === "damagessummaryv3") return 3;
    return 4;
  };
  const sorted = [...nodes].sort((a, b) => rank(a) - rank(b));
  const rows: DamageDraft[] = [];
  const partByUrl = new Map<string, string>();
  let canonicalDone = false;
  for (const node of sorted) {
    const items = damageItems(node.value);
    if (!canonicalDone && items.length > 0) {
      canonicalDone = true;
      const seen = new Set<string>();
      for (const item of items) {
        const key = [item.zone, item.part, item.type, item.size].join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push(item);
      }
      if (Array.isArray(node.value)) {
        for (const raw of node.value) {
          const item = parseDamage(raw, "");
          for (const url of collectUrls(raw)) partByUrl.set(url, item?.part || "");
        }
      }
    } else {
      for (const item of items) {
        const match = rows.find(
          (row) => (!item.part || row.part === item.part) && (!item.baseType || row.baseType === item.baseType) && (!item.size || !row.size || row.size === item.size),
        );
        if (!match) {
          // Papildu avots ar bojājumu, kura kanoniskajā avotā nav: nepazaudējam.
          if (!rows.some((row) => row.part === item.part && row.baseType === item.baseType)) rows.push(item);
          continue;
        }
        if (!match.size && item.size) match.size = item.size;
        if (!match.quantity && item.quantity) {
          match.quantity = item.quantity;
          match.qty = item.qty;
        }
        if (!match.repair && item.repair) match.repair = item.repair;
        if (!match.zone && item.zone) match.zone = item.zone;
      }
      if (Array.isArray(node.value)) for (const raw of node.value) for (const url of collectUrls(raw)) if (!partByUrl.has(url)) partByUrl.set(url, "");
    }
    mark(ctx, node.path);
  }
  let total: number | null = null;
  for (const leaf of leavesNamed(ctx, ["DamagesTotalCount", "damages_total_count", "totalDamages", "damage_count", "damagesCount"])) {
    const n = toNumber(leaf.value);
    if (n != null && total == null) total = n;
    ctx.status.set(leaf.path, "section");
  }
  if (total == null && rows.length) total = rows.reduce((sum, row) => sum + (row.qty ?? 1), 0);
  const zoneIndex = (z: string): number => {
    const i = THECARAPI_ZONE_ORDER.indexOf(z);
    return i < 0 ? THECARAPI_ZONE_ORDER.length : i;
  };
  const ordered = rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => zoneIndex(a.row.zone) - zoneIndex(b.row.zone) || a.i - b.i)
    .map(({ row }) => ({
      zone: row.zone,
      part: row.part,
      type: row.type,
      size: row.size,
      quantity: row.quantity || (row.qty != null ? String(row.qty) : ""),
      repair: row.repair,
      notes: row.notes,
    }));
  return { rows: ordered, total, partByUrl };
}

function collectUrls(raw: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown, depth: number): void => {
    if (depth > 8 || v == null) return;
    if (typeof v === "string") {
      if (/^https?:\/\//i.test(v.trim())) out.push(v.trim());
      return;
    }
    if (Array.isArray(v)) v.forEach((x) => walk(x, depth + 1));
    else if (typeof v === "object") Object.values(v as object).forEach((x) => walk(x, depth + 1));
  };
  walk(raw, 0);
  return out;
}

// --- Laka ---

function extractPaint(ctx: Ctx, root: unknown): ThecarapiPdfPaint[] {
  const nodes = findNodes(root, (key) => /^(paintthicknesses|paintthickness|paintthicknessmeasurements|paintmeasurements)$/.test(normKey(key)));
  const rows: { label: string; n: number; area: string }[] = [];
  for (const node of nodes) {
    const add = (labelRaw: string, num: unknown): void => {
      const n = toNumber(num);
      if (n == null) return;
      const label = isI18nKey(labelRaw) ? translateI18n(labelRaw) : translatePart(labelRaw);
      if (!rows.some((r) => r.label === label && r.n === n)) rows.push({ label, n, area: labelRaw });
    };
    if (Array.isArray(node.value)) {
      for (const item of node.value) {
        const rec = asRecord(item);
        if (!rec) continue;
        const labelKey = Object.keys(rec).find((k) => /^(area|part|position|name|location|zone|panel)$/i.test(k));
        const numKey = Object.keys(rec).find((k) => /^(value|thickness|microns|um|measurement|paintthickness)$/i.test(normKey(k)));
        if (labelKey && numKey) add(String(rec[labelKey]), rec[numKey]);
      }
    } else if (asRecord(node.value)) {
      for (const [k, v] of Object.entries(node.value as Record<string, unknown>)) {
        const rec = asRecord(v);
        add(k, rec ? (rec.value ?? rec.thickness) : v);
      }
    }
    mark(ctx, node.path);
  }
  if (!rows.length) return [];
  const sorted = [...rows.map((r) => r.n)].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  return rows.map((r) => ({ label: r.label, value: String(r.n), highlight: r.n > 300 || r.n > 2 * median, area: r.area }));
}

// --- Režģa tabulas (bremzes, riteņi) ---

const GRID_LABELS: Record<string, string> = {
  type: "Tips",
  padthickness: "Kluču biezums",
  padcondition: "Kluču stāvoklis",
  disccondition: "Diska stāvoklis",
  discthickness: "Diska biezums",
  tiretype: "Riepa",
  tirecondition: "Stāvoklis",
  profiledepth: "Protektors",
  treaddepth: "Protektors",
  dot: "DOT",
  rimtype: "Disks",
  rim: "Disks",
  tiresize: "Izmērs",
  size: "Izmērs",
  dimension: "Izmērs",
  brand: "Ražotājs",
  manufacturer: "Ražotājs",
  tirebrand: "Ražotājs",
};

const GRID_ORDER = ["type", "tiretype", "tirecondition", "profiledepth", "treaddepth", "dot", "rimtype", "rim", "tiresize", "size", "brand", "tirebrand", "padthickness", "padcondition", "disccondition", "discthickness"];

const POSITION_KEYS = /^(position|wheel|wheelposition|location|axle|side|tireposition)$/i;

function gridCell(key: string, value: unknown): string {
  const nk = normKey(key);
  if (nk === "dot") return dotText(value);
  if ((nk === "profiledepth" || nk === "treaddepth") && toNumber(value) != null) return `${numberText(toNumber(value)!)} mm`;
  return formatValue(key, value);
}

function buildGrid(items: readonly unknown[], firstColumn: string): { grid: ThecarapiPdfGrid; states: boolean } {
  const recs = items.map(asRecord).filter((r): r is Record<string, unknown> => Boolean(r));
  const keys: string[] = [];
  let posKey = "";
  for (const rec of recs) {
    for (const [k, v] of Object.entries(rec)) {
      if (isEmptyValue(v) || EXCLUDED_KEYS.has(normKey(k)) || isStateKey(k)) continue;
      if (typeof v === "string" && isUrlString(v)) continue;
      if (typeof v === "object" && !Array.isArray(v)) continue;
      if (!posKey && POSITION_KEYS.test(k)) {
        posKey = k;
        continue;
      }
      if (k !== posKey && !keys.includes(k)) keys.push(k);
    }
  }
  keys.sort((a, b) => {
    const ia = GRID_ORDER.indexOf(normKey(a));
    const ib = GRID_ORDER.indexOf(normKey(b));
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const hasStates = recs.some((rec) => Object.keys(rec).some((k) => isStateKey(k) && !isEmptyValue(rec[k])));
  const columns = [firstColumn, ...keys.map((k) => GRID_LABELS[normKey(k)] ?? keyLabel(k))];
  if (hasStates) columns.push("Novērtējums");
  const rows = recs.map((rec, i) => {
    const cells = [posKey ? translatePosition(String(rec[posKey] ?? "")) : `${i + 1}.`];
    for (const k of keys) cells.push(gridCell(k, rec[k]));
    if (hasStates) {
      const bad = Object.entries(rec)
        .filter(([k, v]) => isStateKey(k) && typeof v === "string" && !/^(ok|unknown|)$/i.test(v.trim()))
        .map(([k, v]) => `${keyLabel(k.replace(/State$/, ""))}: ${formatScalar(k, v)}`);
      const anyOk = Object.entries(rec).some(([k, v]) => isStateKey(k) && typeof v === "string" && /^ok$/i.test(v.trim()));
      cells.push(bad.length ? bad.join("; ") : anyOk ? "OK" : "");
    }
    return cells;
  });
  return { grid: { columns, rows }, states: hasStates };
}

function extractBrakes(ctx: Ctx, root: unknown): ThecarapiPdfGrid | null {
  const nodes = findNodes(root, (key, value, segs) => {
    if (normKey(key) !== "brakes" || !Array.isArray(value)) return false;
    if (stringSegs(segs).some((s) => /equipment|feature/i.test(s))) return false;
    return value.some((v) => asRecord(v));
  });
  let grid: ThecarapiPdfGrid | null = null;
  for (const node of nodes) {
    const built = buildGrid(node.value as unknown[], "Ritenis").grid;
    if (!grid) grid = built;
    else grid.rows.push(...built.rows.filter((r) => !grid!.rows.some((x) => x.join("|") === r.join("|"))));
    mark(ctx, node.path);
  }
  return grid && grid.rows.length ? grid : null;
}

function extractWheels(ctx: Ctx, root: unknown): ThecarapiPdfWheelSet[] {
  const nodes = findNodes(root, (key, value) => /^(wheelsets|tiresets|tyresets)$/.test(normKey(key)) && Array.isArray(value));
  const out: ThecarapiPdfWheelSet[] = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    (node.value as unknown[]).forEach((set, i) => {
      const rec = asRecord(set);
      if (!rec) return;
      const detailsEntry = Object.entries(rec).find(([, v]) => Array.isArray(v) && v.some((x) => asRecord(x)));
      const details = (detailsEntry?.[1] as unknown[] | undefined) ?? [];
      const main = Object.entries(rec).find(([k]) => /^(ismainset|ismain|main|primary|isprimary)$/.test(normKey(k)));
      const isMain = main ? main[1] === true : i === 0;
      const bits: string[] = [];
      for (const [k, v] of Object.entries(rec)) {
        if (k === detailsEntry?.[0] || k === main?.[0] || isEmptyValue(v) || isStateKey(k) || EXCLUDED_KEYS.has(normKey(k))) continue;
        if (typeof v === "object") continue;
        const text = formatValue(k, v);
        if (text) bits.push(`${keyLabel(k)}: ${text}`);
      }
      const title = [isMain ? "Galvenais komplekts" : `${i + 1}. komplekts`, details.length ? `${details.length} riteņi` : "", ...bits]
        .filter(Boolean)
        .join(", ");
      const grid = buildGrid(details, "Ritenis").grid;
      const sig = JSON.stringify(grid.rows);
      if (seen.has(sig)) return;
      seen.add(sig);
      if (grid.rows.length || bits.length) out.push({ title, grid });
    });
    mark(ctx, node.path);
  }
  return out;
}

// --- Aprīkojums ---

function tokensOf(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9āčēģīķļņšūž]+/)
    .filter((t) => t.length > 1);
}

function extractEquipment(ctx: Ctx, root: unknown): ThecarapiPdfEquipmentGroup[] {
  const priority = [
    "datequipmentgroupstranslated",
    "equipmentgroupstranslated",
    "equipmentgroups",
    "equipment",
    "equipmentlist",
    "options",
    "extras",
    "features",
    "vehiclefeatures",
  ];
  const nodes = findNodes(root, (key) => priority.includes(normKey(key)));
  nodes.sort((a, b) => priority.indexOf(normKey(String(a.segs.at(-1)))) - priority.indexOf(normKey(String(b.segs.at(-1)))));
  const items: { category: string; text: string; tokens: string[] }[] = [];
  const has = (text: string): boolean => {
    const t = tokensOf(text);
    if (!t.length) return true;
    return items.some((it) => t.every((x) => it.tokens.includes(x)));
  };
  const push = (text: string, source: string, categoryHint = ""): void => {
    const clean = text.trim();
    if (!clean || isUrlString(clean)) return;
    const n = normKey(clean);
    if (items.some((it) => normKey(it.text) === n)) return;
    items.push({ category: equipmentCategory(`${categoryHint} ${source} ${clean}`), text: clean, tokens: tokensOf(`${source} ${clean}`) });
  };
  const missing: string[] = [];
  const walkGroups = (value: unknown, group: string, depth: number): void => {
    if (depth > 5 || value == null) return;
    if (typeof value === "string") {
      if (!isUrlString(value)) {
        const t = isI18nKey(value) ? translateI18n(value) : translateEquipment(value);
        const plain = !group || isGenericEquipmentGroup(group) || tokensOf(group).every((x) => tokensOf(t).includes(x));
        push(plain ? t : `${group}: ${t}`, `${group} ${value}`, group);
      }
      return;
    }
    if (typeof value === "boolean") {
      if (value && group) push(translateEquipment(group), group);
      return;
    }
    if (Array.isArray(value)) {
      const strings = value.filter((v): v is string => typeof v === "string" && !isUrlString(v));
      if (strings.length && strings.length === value.length && group) {
        for (const raw of strings) {
          const shown = isI18nKey(raw) ? translateI18n(raw) : translateEquipment(raw);
          const groupTokens = tokensOf(group);
          const covers = groupTokens.every((t) => tokensOf(shown).includes(t));
          const label = isGenericEquipmentGroup(group) || covers ? shown : `${group}: ${shown}`;
          push(label, `${group} ${raw}`, group);
        }
        return;
      }
      for (const v of value) {
        const rec = asRecord(v);
        if (rec) {
          const name = rec.name ?? rec.title ?? rec.label ?? rec.group ?? rec.groupName;
          const vals = rec.items ?? rec.values ?? rec.options ?? rec.equipment;
          if (typeof name === "string" && vals != null) {
            walkGroups(vals, isI18nKey(name) ? translateI18n(name) : name, depth + 1);
            continue;
          }
          if (typeof name === "string") {
            walkGroups(name, group, depth + 1);
            continue;
          }
        }
        walkGroups(v, group, depth + 1);
      }
      return;
    }
    const rec = asRecord(value);
    if (!rec) return;
    for (const [k, v] of Object.entries(rec)) {
      if (EXCLUDED_KEYS.has(normKey(k))) continue;
      const g = isI18nKey(k) ? translateI18n(k) : /^(global|equipment_groups|equipmentgroups)$/i.test(k) ? group : k;
      walkGroups(v, g, depth + 1);
    }
  };
  for (const node of nodes) {
    const k = normKey(String(node.segs.at(-1)));
    if (k === "vehiclefeatures" && asRecord(node.value)) {
      for (const [fk, fv] of Object.entries(node.value as Record<string, unknown>)) {
        const name = fk.replace(/^(has|is)(?=[A-Z_])/, "").replace(/^_/, "");
        const lv = translateEquipment(name);
        if (fv === true) {
          if (!has(humanizeToken(name)) && !has(lv)) push(lv, humanizeToken(name));
        } else if (fv === false && isSignificantMissingFeature(name)) {
          if (!missing.includes(lv)) missing.push(lv);
        } else if (typeof fv === "string" || typeof fv === "number") {
          push(`${lv}: ${formatScalar(fk, fv)}`, humanizeToken(name));
        }
      }
    } else {
      walkGroups(node.value, "", 0);
    }
    // Aprīkojums modelī paliek, bet PDF to nedrukā (Nils 19.11) - apzināti izslēgts, nevis pazudis.
    mark(ctx, node.path, "excluded");
  }
  // Openlane aprīkojuma atskaites (`option_reports`, type_id 4) - arī aprīkojums.
  for (const node of findNodes(root, (key) => normKey(key) === "optionreports")) mark(ctx, node.path, "excluded");
  for (const m of missing) items.push({ category: "Citi", text: `${m}: nav`, tokens: [] });
  const groups: ThecarapiPdfEquipmentGroup[] = [];
  for (const cat of EQUIPMENT_CATEGORY_ORDER) {
    const list = items.filter((it) => it.category === cat).map((it) => it.text);
    if (list.length) groups.push({ group: cat, items: list });
  }
  return groups;
}

// --- Serviss un dokumenti ---

function extractService(ctx: Ctx, root: unknown): ThecarapiPdfModel["service"] & { lastKm: string; lastDate: string } {
  const nodes = findNodes(root, (key, value) => /^(servicehistory|servicehistorysummary|maintenancehistory|servicebookinfo|service)$/.test(normKey(key)) && value != null && typeof value === "object");
  const kv: ThecarapiPdfKv[] = [];
  let entries: ThecarapiPdfGrid | null = null;
  let lastDate = "";
  let lastKm = "";
  let book = "";
  let records = "";
  const seen = new Set<string>();
  for (const node of nodes) {
    const rec = asRecord(node.value);
    if (Array.isArray(node.value)) {
      const g = buildGrid(node.value, "Nr.").grid;
      if (g.rows.length && !entries) entries = g;
    } else if (rec) {
      for (const [k, v] of Object.entries(rec)) {
        if (isEmptyValue(v) || EXCLUDED_KEYS.has(normKey(k))) continue;
        const nk = normKey(k);
        if (Array.isArray(v) && v.some((x) => asRecord(x))) {
          const g = buildGrid(v, "Nr.").grid;
          if (g.rows.length && !entries) entries = g;
          continue;
        }
        if (/^(lastservicedate|lastservice|lastserviceat)$/.test(nk) && typeof v === "string") {
          lastDate = lastDate || thecarapiPdfDate(v, false);
          continue;
        }
        if (/^(lastservicemileage|lastservicekm|lastserviceodometer)$/.test(nk)) {
          lastKm = lastKm || kmText(v);
          continue;
        }
        if (/^(servicebooktype|servicebook|hasservicebook)$/.test(nk)) {
          book = book || formatValue(k, v).toLowerCase();
          continue;
        }
        if (/^(servicerecords|servicerecordsavailability|servicehistoryavailable|servicehistorytype)$/.test(nk)) {
          records = records || formatValue(k, v).toLowerCase();
          continue;
        }
        const text = formatValue(k, v);
        const sig = `${nk}=${text}`;
        if (!text || seen.has(sig)) continue;
        seen.add(sig);
        kv.push({ label: keyLabel(k), value: text });
      }
    }
    mark(ctx, node.path);
  }
  const bits: string[] = [];
  if (lastDate || lastKm) bits.push(["Pēdējais serviss", lastDate, lastKm ? `pie ${lastKm}` : ""].filter(Boolean).join(" "));
  if (book) bits.push(`Servisa grāmata: ${book}`);
  if (records) bits.push(`Servisa ieraksti: ${records}`);
  return { summary: bits.join(" · "), rows: kv, entries, lastKm, lastDate };
}

function extractDocuments(ctx: Ctx, root: unknown): { names: string[]; urlNames: Map<string, string> } {
  const nodes = findNodes(
    root,
    (key, value) => /^(documents|vehicledocuments|inspectionreports|carreports)$/.test(normKey(key)) && Array.isArray(value),
  );
  const names: string[] = [];
  const urlNames = new Map<string, string>();
  // Openlane `paperwork` karogi: «jā» -> dokumentu sarakstā; «nē» paliek «Citos datos» ar latvisku nosaukumu.
  const PAPERWORK: Record<string, string> = {
    cocavailable: "COC",
    registrationdocsavailable: "Reģistrācijas dokumenti",
    isv5present: "V5 dokuments",
    licenseplate: "Numura zīme",
  };
  for (const node of findNodes(root, (key, value) => normKey(key) === "paperwork" && asRecord(value) != null)) {
    for (const [k, v] of Object.entries(node.value as Record<string, unknown>)) {
      const name = PAPERWORK[normKey(k)];
      if (v === true && name) {
        if (!names.includes(name)) names.push(name);
        mark(ctx, `${node.path}.${k}`);
      }
    }
  }
  for (const node of nodes) {
    for (const item of node.value as unknown[]) {
      let name = "";
      if (typeof item === "string") {
        if (!isUrlString(item)) name = isI18nKey(item) ? translateI18n(item) : translateEnum(item) || item;
      } else {
        const rec = asRecord(item);
        if (!rec) continue;
        const raw = rec.name ?? rec.title ?? rec.type ?? rec.documentType ?? rec.category ?? rec.label;
        if (typeof raw === "string") name = isI18nKey(raw) ? translateI18n(raw) : translateEnum(raw) || (looksLikeEnum(raw) ? humanizeToken(raw) : raw);
        for (const url of collectUrls(rec)) urlNames.set(url, name);
      }
      if (name && !names.includes(name)) names.push(name);
    }
    mark(ctx, node.path);
  }
  return { names, urlNames };
}

// --- Nozīmes (pamatdati, cenas, nobraukums, datumi) ---

type Meaning = { label: string; keys: string[]; kind?: "date" | "day" | "country" | "plain" };

const BASIC_MEANINGS: Meaning[] = [
  { label: "VIN", keys: ["vin", "chassis_number", "fin"] },
  { label: "Pirmā reģistrācija", keys: ["firstRegistrationDate", "first_registration", "firstRegistration", "registrationDate", "initialRegistration"], kind: "day" },
  { label: "Izlaiduma gads", keys: ["builtYear", "year", "manufactureYear", "productionYear", "constructionYear"], kind: "plain" },
  { label: "Virsbūve", keys: ["bodyType", "body", "bodyStyle", "body_type"] },
  { label: "Degviela", keys: ["fuelType", "fuel", "fuel_type", "fuel_group"] },
  { label: "Ātrumkārba", keys: ["gearType", "transmission", "gearbox", "gear_type", "gearbox_group"] },
  { label: "Krāsa", keys: ["color", "colour", "bodyColor", "exteriorColor", "body_color"] },
  { label: "Durvis", keys: ["doorCount", "doors", "door_count"], kind: "plain" },
  { label: "Sēdvietas", keys: ["seatCount", "seats", "seat_count"], kind: "plain" },
  { label: "Izcelsmes valsts", keys: ["countryOfOrigin", "country_of_origin", "originCountry"], kind: "country" },
  { label: "Reģistrācijas valsts", keys: ["car_country_extended", "countryOfRegistration", "car_country", "registrationCountry"], kind: "country" },
  { label: "Iepriekšējā lietošana", keys: ["commercialTypes", "usageType", "previousUsage", "commercial_types"] },
  { label: "Komerclietošana", keys: ["hasBeenCommercial", "commercialUse", "has_been_commercial"] },
  { label: "Auto statuss", keys: ["carStatus", "vehicleStatus", "car_status"] },
  { label: "Īpašnieku skaits", keys: ["totalOwnerCalculated", "owners", "ownerCount", "numberOfOwners", "previousOwners"], kind: "plain" },
  { label: "Atslēgu skaits", keys: ["handoverKeyCount", "keyCount", "keys"], kind: "plain" },
  { label: "Tehniskā apskate derīga līdz", keys: ["inspectionExpiryDate", "nextInspection", "tuvUntil", "inspection_expiry_date"], kind: "day" },
  { label: "Negadījumi", keys: ["accidents", "hadAccident", "accident"] },
  { label: "Oriģinālais dzinējs", keys: ["originalEngine"] },
  { label: "Emisiju klase", keys: ["euroNorm", "emissionClass", "emissionStandard", "euro_norm"] },
  { label: "Pārdevēja auto ID", keys: ["car_id", "carId", "stockNumber", "stock_number"], kind: "plain" },
  { label: "Pārdevējs", keys: ["seller", "seller_name", "sellerName"] },
  { label: "Atrašanās vieta", keys: ["location", "city"] },
  // TheCarApi v1 un citas platformas (Openlane, BCA, Copart, ...).
  { label: "Reģistrācijas gads", keys: ["registration_year", "registrationYear"], kind: "plain" },
  { label: "Stūre", keys: ["steering", "steering_side", "steeringSide"] },
  { label: "Piedziņa", keys: ["drivetrain", "drive_type", "driveType"] },
  { label: "Piedziņas sistēma", keys: ["drivetrain_system", "drivetrainSystem"] },
  { label: "Stāvokļa vērtējums", keys: ["condition_grade", "conditionGrade", "grade"], kind: "plain" },
  { label: "Galvenais bojājums", keys: ["primary_damage", "primaryDamage"] },
  { label: "Papildu bojājums", keys: ["secondary_damage", "secondaryDamage"] },
  { label: "Iedarbojas un brauc", keys: ["run_and_drive", "runAndDrive", "run_drive"] },
  { label: "Dokumentu statuss", keys: ["title_type", "titleType", "sale_title"] },
  { label: "PVN režīms", keys: ["vat_type", "vatType", "vat_status", "tax_type"] },
];

const PRICE_MEANINGS: Meaning[] = [
  { label: "Sākuma cena", keys: ["start_price", "start", "startPrice", "starting_price"] },
  { label: "Pēdējā cena", keys: ["current_price", "current_bid", "highest_bid", "currentPrice", "currentBid"] },
  // `final_price` = uzvarējušais solījums; `current_final`/`public_price_eur` - portāla publiskā cena ar papildu
  // izmaksām (Openlane: mainās neatkarīgi no solījumiem), sk. `thecarapi-sale-price.ts`.
  { label: "Noslēguma cena", keys: ["final_price", "sold_price", "sale_price", "finalPrice"] },
  { label: "Publiskā cena", keys: ["current_final", "public_price_eur"] },
  { label: "Pirkt tūlīt cena", keys: ["buy_now_price", "buyNowPrice"] },
  { label: "Mazumtirdzniecības cena", keys: ["consumer_price", "consumerPrice", "retail_price"] },
  { label: "Īpašā cena", keys: ["special_price", "specialPrice"] },
  { label: "Pārdevēja prasītā cena", keys: ["sellerPrice", "seller_price", "asking_price", "askingPrice", "minimum_price", "minimumPrice"] },
  { label: "Rezerves cena", keys: ["reserve_price", "reservePrice"] },
];

const DATE_MEANINGS: Meaning[] = [
  { label: "Pirmoreiz redzēta", keys: ["first_seen", "first_seen_at", "firstSeen"] },
  { label: "Partijas sākums", keys: ["batch_start_date", "batchStartDate"] },
  { label: "Izsoles sākums", keys: ["start_date", "auction_start", "auctionStart"] },
  { label: "Izsoles datums", keys: ["auction_date", "sale_date", "auctionDate"] },
  { label: "Izsoles beigas", keys: ["auction_end_at", "end_date", "auction_end", "auctionEnd"] },
  { label: "Pēdējo reizi redzēta", keys: ["last_seen", "last_seen_at", "lastSeen"] },
  { label: "Pēdējās izmaiņas", keys: ["last_changed_at", "lastChangedAt"] },
];

function meaningRows(ctx: Ctx, meanings: readonly Meaning[], fmt: (m: Meaning, leaf: Leaf) => string): ThecarapiPdfKv[] {
  const out: ThecarapiPdfKv[] = [];
  for (const m of meanings) {
    const leaves = leavesNamed(ctx, m.keys);
    const values: { text: string; history: boolean }[] = [];
    for (const leaf of leaves) {
      const text = fmt(m, leaf);
      if (!text) {
        ctx.status.set(leaf.path, isEmptyValue(leaf.value) ? "excluded" : "duplicate");
        continue;
      }
      const dup = values.some((v) => v.text === text);
      ctx.status.set(leaf.path, dup ? "duplicate" : "section");
      remember(ctx, meaningName(leaf.segs), text);
      if (!dup) values.push({ text, history: isHistoryLeaf(leaf, ctx.history, ctx.detail) });
    }
    values.forEach((v, i) => {
      out.push({ label: i > 0 || (v.history && values.length > 1) ? `${m.label}${v.history ? " (vēstures dati)" : " (cits avots)"}` : m.label, value: v.text });
    });
  }
  return out;
}

function basicFormat(m: Meaning, leaf: Leaf): string {
  const name = meaningName(leaf.segs);
  if (m.kind === "day" && typeof leaf.value === "string") return thecarapiPdfDate(leaf.value, false);
  if (m.kind === "country" && typeof leaf.value === "string") return countryName(leaf.value);
  if (m.kind === "plain") return Array.isArray(leaf.value) ? leaf.value.join(", ") : String(leaf.value ?? "").trim();
  return formatValue(name, leaf.value);
}

function extractBasics(ctx: Ctx, title: string): ThecarapiPdfKv[] {
  const out: ThecarapiPdfKv[] = [];
  // Auto nosaukums: title, citādi marka + modelis + versija.
  const titleLeaves = leavesNamed(ctx, ["title", "car_title", "vehicle_title", "name_full"]);
  const make = leavesNamed(ctx, ["make", "brand", "manufacturer", "manufacturerName", "clean_make"]);
  const model = leavesNamed(ctx, ["model", "modelName", "model_name", "clean_model"]);
  const variant = leavesNamed(ctx, ["variant", "trim", "version", "subModel", "modelVersion"]);
  const t = title || (typeof titleLeaves[0]?.value === "string" ? String(titleLeaves[0]!.value).trim() : "");
  const parts = [make, model, variant].map((ls) => (typeof ls[0]?.value === "string" ? String(ls[0]!.value).trim() : ""));
  const composed = parts.filter(Boolean).join(" ");
  const carName = t && parts.every((p) => !p || t.toLowerCase().includes(p.toLowerCase())) ? t : t ? `${composed} ${t}`.trim() : composed;
  for (const leaf of [...titleLeaves, ...make, ...model, ...variant]) {
    const v = String(leaf.value ?? "").trim();
    // Ja vērtība nav nosaukumā, tā paliek «Citiem datiem».
    if (carName.toLowerCase().includes(v.toLowerCase())) ctx.status.set(leaf.path, "section");
  }
  if (carName) out.push({ label: "Marka, modelis", value: carName });
  out.push(...meaningRows(ctx, BASIC_MEANINGS.slice(0, 7), basicFormat));
  // Dzinējs: tilpums + jauda vienā rindā; CO2 atsevišķi.
  const ccm = leavesNamed(ctx, ["ccm", "engineSize", "displacement", "cubicCapacity", "engine_size"]);
  const kw = leavesNamed(ctx, ["kw", "powerKw", "power_kw"]);
  const hp = leavesNamed(ctx, ["hp", "ps", "powerHp", "power_hp"]);
  const co2 = leavesNamed(ctx, ["co2Value", "co2", "co2Emission", "co2Emissions", "co2_emission"]);
  const ccmN = ccm.map((l) => toNumber(l.value)).find((n) => n != null);
  const kwN = kw.map((l) => toNumber(l.value)).find((n) => n != null);
  const hpN = hp.map((l) => toNumber(l.value)).find((n) => n != null);
  const engine = [ccmN ? `${groupInt(ccmN)} cm³` : "", kwN || hpN ? [kwN ? `${kwN} kW` : "", hpN ? `${hpN} ZS` : ""].filter(Boolean).join(" / ") : ""]
    .filter(Boolean)
    .join(", ");
  if (engine) out.push({ label: "Dzinējs", value: engine });
  for (const [leaves, n] of [
    [ccm, ccmN],
    [kw, kwN],
    [hp, hpN],
  ] as const) {
    for (const leaf of leaves) if (toNumber(leaf.value) === n) ctx.status.set(leaf.path, "section");
  }
  const co2Values = [...new Set(co2.map((l) => toNumber(l.value)).filter((n): n is number => n != null))];
  if (co2Values.length) out.push({ label: "CO₂", value: co2Values.map((n) => `${n} g/km`).join(" / ") });
  for (const leaf of co2) if (toNumber(leaf.value) != null) ctx.status.set(leaf.path, "section");
  out.push(...meaningRows(ctx, BASIC_MEANINGS.slice(7), basicFormat));
  return out;
}

/** TheCarApi v1 `prices.{start,current,...}` = `{ amount, currency }` (publiskā dokumentācija 11.2026). */
const V1_PRICE_LABELS: [string, string][] = [
  ["start", "Sākuma cena"],
  ["current", "Pēdējā cena"],
  ["final", "Noslēguma cena"],
  ["buy_now", "Pirkt tūlīt cena"],
  ["public", "Publiskā cena"],
  ["current_tax", "Pēdējā cena ar nodokļiem"],
  ["current_tax_delivery", "Pēdējā cena ar nodokļiem un piegādi"],
  ["buy_now_tax", "Pirkt tūlīt ar nodokļiem"],
  ["buy_now_tax_delivery", "Pirkt tūlīt ar nodokļiem un piegādi"],
  ["landed_current", "Pēdējā cena ar piegādi"],
  ["landed_buy_now", "Pirkt tūlīt ar piegādi"],
  ["estimated_value", "Aplēstā vērtība (nav pirkšanas cena)"],
  ["native", "Cena avota valūtā"],
];

function v1PriceRows(ctx: Ctx, root: Record<string, unknown>): ThecarapiPdfKv[] {
  const out: ThecarapiPdfKv[] = [];
  const prices = asRecord(root.prices);
  if (prices) {
    for (const [key, label] of V1_PRICE_LABELS) {
      const raw = prices[key];
      if (raw == null) continue;
      const rec = asRecord(raw);
      const cur = typeof rec?.currency === "string" ? rec.currency : ctx.currency;
      const text = priceText(rec ? rec.amount : raw, cur);
      const path = `prices.${key}`;
      // `native` tajā pašā valūtā un summā ir dublikāts.
      const dup = !text || out.some((r) => r.value === text && (key === "native" || r.label === label));
      if (!dup) out.push({ label, value: text });
      mark(ctx, path, text && !dup ? "section" : "duplicate");
    }
  }
  const live = asRecord(root.live_price);
  if (live) {
    const cur = typeof live.currency === "string" ? live.currency : ctx.currency;
    const text = priceText(live.price ?? live.amount, cur);
    const at = typeof live.fetched_at === "string" && isIsoDate(live.fetched_at) ? thecarapiPdfDate(live.fetched_at) : "";
    if (text && !out.some((r) => r.value === text)) {
      out.push({ label: "Tiešsaistes cena", value: at ? `${text} (${at})` : text });
      mark(ctx, "live_price", "section");
    } else mark(ctx, "live_price", "duplicate");
  }
  return out;
}

function extractPrices(ctx: Ctx, root: Record<string, unknown>): ThecarapiPdfKv[] {
  const fmt = (m: Meaning, leaf: Leaf): string => {
    const name = normKey(meaningName(leaf.segs));
    return priceText(leaf.value, name.includes("eur") ? "EUR" : ctx.currency);
  };
  const v1 = v1PriceRows(ctx, root);
  const rows = [...v1, ...meaningRows(ctx, PRICE_MEANINGS, fmt).filter((r) => !v1.some((v) => v.label === r.label && v.value === r.value))];
  // Bez `final_price` publiskā cena ir vienīgā noslēguma cena (kā līdz šim); ar to - atsevišķa «Publiskā cena».
  const hasFinal = rows.some((r) => r.label.startsWith("Noslēguma"));
  const relabeled = hasFinal ? rows : rows.map((r) => (r.label.startsWith("Publiskā cena") ? { ...r, label: r.label.replace("Publiskā cena", "Noslēguma cena") } : r));
  // Pēdējā cena / publiskā cena = noslēguma cena -> viena rinda.
  const finals = new Set(relabeled.filter((r) => r.label.startsWith("Noslēguma")).map((r) => r.value));
  const out = relabeled.filter((r) => !((r.label.startsWith("Pēdējā cena") || r.label.startsWith("Publiskā cena")) && finals.has(r.value)));
  for (const node of findNodes(root, (key, value) => /^(marketpricesbycountry|marketprices)$/.test(normKey(key)) && asRecord(value) != null)) {
    for (const [code, v] of Object.entries(node.value as Record<string, unknown>)) {
      const text = priceText(asRecord(v)?.value ?? v, ctx.currency);
      if (text) out.push({ label: `Tirgus cena (${countryName(code)})`, value: text });
    }
    mark(ctx, node.path);
  }
  for (const leaf of leavesNamed(ctx, ["currency"])) {
    if (String(leaf.value).trim().toUpperCase() === "EUR") ctx.status.set(leaf.path, "section");
  }
  return out;
}

function extractMileage(ctx: Ctx, headerDay: string, service: { lastKm: string; lastDate: string }): ThecarapiPdfKv[] {
  const leaves = leavesNamed(ctx, ["mileage", "odometer", "km", "mileage_km", "kilometers", "kilometerstand", "odometer_km"]);
  const values: { km: string; history: boolean }[] = [];
  for (const leaf of leaves) {
    const km = kmText(leaf.value);
    if (!km) continue;
    const dup = values.some((v) => v.km === km);
    ctx.status.set(leaf.path, dup ? "duplicate" : "section");
    remember(ctx, meaningName(leaf.segs), km);
    if (!dup) values.push({ km, history: isHistoryLeaf(leaf, ctx.history, ctx.detail) });
  }
  const out: ThecarapiPdfKv[] = [];
  values.forEach((v, i) => {
    if (i === 0) out.push({ label: "Nobraukums", value: headerDay ? `${v.km} (izsolē ${headerDay})` : v.km });
    else out.push({ label: v.history ? "Nobraukums (vēstures dati)" : "Nobraukums (cits avots)", value: v.km });
  });
  if (service.lastKm && !values.some((v) => v.km === service.lastKm)) {
    out.push({ label: "Servisa grāmatā pēdējais", value: [service.lastKm, service.lastDate].filter(Boolean).join(", ") });
  }
  return out;
}

function extractDates(ctx: Ctx): ThecarapiPdfKv[] {
  const fmt = (_m: Meaning, leaf: Leaf): string => (typeof leaf.value === "string" && isIsoDate(leaf.value) ? thecarapiPdfDate(leaf.value) : "");
  const all = meaningRows(ctx, DATE_MEANINGS, fmt);
  // Tikai datums bez laika, ja tai pašai nozīmei ir precīzāks laiks tajā pašā dienā.
  const base = (label: string): string => label.replace(/ \((cits avots|vēstures dati)\)$/, "");
  const rows = all.filter(
    (row) => !(/^\d{2}\.\d{2}\.\d{4}$/.test(row.value) && all.some((o) => o !== row && base(o.label) === base(row.label) && o.value.startsWith(`${row.value} `))),
  );
  const firstOf = new Set<string>();
  for (const row of rows) {
    if (firstOf.has(base(row.label))) continue;
    firstOf.add(base(row.label));
    row.label = base(row.label);
  }
  // Katrai nozīmei sava rinda (audits 23.11: saplūdušas «Pirmoreiz / pēdējo reizi redzēta / pēdējās izmaiņas» maldina).
  return rows.map((row) => ({ ...row }));
}

// --- Citi dati ---

const GENERIC_NAMES = /^(value|name|text|type|label|code|title|key|amount|description)$/i;

function otherLabel(leaf: Leaf): string {
  const names = stringSegs(leaf.segs).map((n) => (isI18nKey(n) ? translateI18n(n) : n));
  const last = names[names.length - 1] ?? "";
  const parent = names[names.length - 2] ?? "";
  const history = /^history_/.test(String(leaf.segs[0] ?? ""));
  let label: string;
  if (parent && (GENERIC_NAMES.test(last) || /^[A-Z]{2,3}$/.test(last))) {
    const sub = /^[A-Z]{2}$/.test(last) ? countryName(last) : keyLabel(last);
    label = GENERIC_NAMES.test(last) && !/^[A-Z]{2,3}$/.test(last) ? keyLabel(parent) : `${keyLabel(parent)} (${sub})`;
  } else {
    label = keyLabel(last);
  }
  return history ? `${label} (vēstures dati)` : label;
}

function extractOther(ctx: Ctx): ThecarapiPdfKv[] {
  const grouped = new Map<string, string[]>();
  for (const leaf of openLeaves(ctx)) {
    const name = meaningName(leaf.segs);
    const text = formatValue(name, leaf.value);
    if (!text) {
      ctx.status.set(leaf.path, "excluded");
      continue;
    }
    if (ctx.shown.has(`${normKey(name)}=${text}`)) {
      ctx.status.set(leaf.path, "duplicate");
      continue;
    }
    const label = otherLabel(leaf);
    const list = grouped.get(label) ?? [];
    if (list.includes(text)) ctx.status.set(leaf.path, "duplicate");
    else {
      list.push(text);
      ctx.status.set(leaf.path, "other");
      remember(ctx, name, text);
    }
    grouped.set(label, list);
  }
  return [...grouped.entries()]
    .map(([label, values]) => ({ label, value: values.join(" · ") }))
    .sort((a, b) => a.label.localeCompare(b.label, "lv"));
}

// --- Bilžu kategorijas ---

function photoCategories(root: unknown, damageParts: Map<string, string>, documentNames: Map<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (value: unknown, category: string, depth: number): void => {
    if (depth > 10 || value == null) return;
    if (typeof value === "string") {
      const url = value.trim();
      if (/^https?:\/\//i.test(url) && category && !out[url]) out[url] = category;
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v) => walk(v, category, depth + 1));
      return;
    }
    const rec = asRecord(value);
    if (!rec) return;
    const own = typeof rec.category === "string" ? rec.category : typeof rec.image_source === "string" ? rec.image_source : "";
    const ownCat = /interior|salon/i.test(own) ? "Salons" : /exterior/i.test(own) ? "Ārpuse" : /damage/i.test(own) ? "Bojājums" : /service/i.test(own) ? "Serviss" : /document/i.test(own) ? "Dokuments" : "";
    for (const [k, v] of Object.entries(rec)) {
      const nk = normKey(k);
      let cat = ownCat || category;
      if (/damageimage|subareaimages/.test(nk)) cat = "Bojājums";
      else if (/serviceimage/.test(nk)) cat = "Serviss";
      else if (/documentphoto/.test(nk)) cat = "Dokuments";
      else if (/interiorimage/.test(nk)) cat = "Salons";
      walk(v, cat, depth + 1);
    }
  };
  walk(root, "", 0);
  for (const [url, part] of damageParts) out[url] = part ? `Bojājums: ${part.toLowerCase()}` : "Bojājums";
  for (const [url, name] of documentNames) out[url] = name ? `Dokuments: ${name}` : "Dokuments";
  return out;
}

export function thecarapiPdfSourceObject(record: Pick<ThecarapiAdminRecord, "raw" | "rawHistory" | "rawDetail" | "fields">): Record<string, unknown> {
  const raw = asRecord(record.raw);
  if (raw && Object.keys(raw).length) return raw;
  const history = asRecord(record.rawHistory);
  const detail = asRecord(record.rawDetail);
  if (history || detail) return { ...(history ?? {}), ...(detail ?? {}) };
  return thecarapiRawFromFields(record.fields ?? []);
}

export function buildThecarapiPdfModel(record: ThecarapiAdminRecord): ThecarapiPdfModel {
  const root = thecarapiPdfSourceObject(record);
  const leaves: Leaf[] = [];
  flatten(root, [], leaves, 0);
  const ctx: Ctx = {
    leaves,
    status: new Map(),
    shown: new Set(),
    currency: typeof root.currency === "string" ? root.currency : "EUR",
    history: asRecord(record.rawHistory),
    detail: asRecord(record.rawDetail),
  };
  for (const leaf of leaves) if (isExcludedLeaf(leaf)) ctx.status.set(leaf.path, "excluded");

  // Galvene.
  const siteRaw = [root.site_name, root.site, root.platform].find((v) => typeof v === "string" && v.trim()) as string | undefined;
  const venue = record.venue || (siteRaw ? thecarapiSiteLabel(siteRaw) : "");
  const idRaw = record.id || String(root.auction_id ?? root.id ?? root.auctionId ?? "");
  for (const leaf of leaves) {
    if (leaf.segs.length !== 1) continue;
    const k = normKey(String(leaf.segs[0]));
    if (["sitename", "site", "platform", "auctionid", "id"].includes(k)) {
      const v = String(leaf.value ?? "").trim().toLowerCase();
      if (v === idRaw.toLowerCase() || v === String(record.site ?? "").toLowerCase() || v === (siteRaw ?? "").toLowerCase()) ctx.status.set(leaf.path, "section");
    }
  }
  const dayRaw = [root.auction_end_at, root.end_date, root.auction_date, root.sale_date, root.last_seen_at, root.last_seen, record.date].find(
    (v) => typeof v === "string" && isIsoDate(v),
  ) as string | undefined;
  const headerDay = dayRaw ? thecarapiPdfDate(dayRaw, false) : "";
  const countryRaw = [root.car_country_extended, root.countryOfRegistration, root.car_country].find((v) => typeof v === "string" && v.trim()) as
    | string
    | undefined;
  const header = [venue, idRaw ? `Izsole ${idRaw}` : "", headerDay, countryRaw ? countryName(countryRaw) : ""].filter(Boolean).join(" · ");

  const damages = extractDamages(ctx, root);
  const paint = extractPaint(ctx, root);
  const brakes = extractBrakes(ctx, root);
  const wheels = extractWheels(ctx, root);
  const equipment = extractEquipment(ctx, root);
  const service = extractService(ctx, root);
  const documents = extractDocuments(ctx, root);
  const basics = extractBasics(ctx, "");
  const prices = extractPrices(ctx, root);
  const mileage = extractMileage(ctx, headerDay, service);
  const dates = extractDates(ctx);
  const other = extractOther(ctx);

  return {
    header: header || "Izsole",
    basics,
    prices,
    mileage,
    dates,
    damages: damages.rows,
    damagesTotal: damages.total,
    paint,
    brakes,
    wheels,
    equipment,
    service: { summary: service.summary, rows: service.rows, entries: service.entries },
    documents: documents.names,
    other,
    photoCategories: photoCategories(root, damages.partByUrl, documents.urlNames),
    coverage: leaves.map((leaf) => ({ path: leaf.path, status: ctx.status.get(leaf.path) ?? "other" })),
  };
}

/** Vai šis lapas lauks pēc spec 5. p. netiek rādīts. Testiem. */
export function thecarapiPdfLeafExcluded(path: string, value: unknown): boolean {
  return isExcludedLeaf({ segs: parsePath(path), path, value });
}

/** Visi lapas lauki (ceļš -> vērtība) tajā pašā secībā kā `coverage`. Adminam: izslēgtie tehniskie lauki arī redzami. */
export function thecarapiLeafValues(record: ThecarapiAdminRecord): { path: string; value: unknown }[] {
  const leaves: Leaf[] = [];
  flatten(thecarapiPdfSourceObject(record), [], leaves, 0);
  return leaves.map((leaf) => ({ path: leaf.path, value: leaf.value }));
}
