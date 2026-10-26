/**
 * j56 B variants: releja `POST /listings/detail` (viena Auto1/Openlane auto detaļu lapa) -> piedāvājuma sākuma dati.
 * Lauku karte pēc IRISS kartes (~/j41-auto1-karte: AUTO1 + OPENLANE). Etiķetes tiek salīdzinātas normalizētas
 * (mazie burti, bez atstarpēm/pieturzīmēm), lai der gan lapas teksts ("Gear box"), gan JSON atslēgas ("Gearbox").
 * Brīvais teksts (bojājumi, kontrollampas) šeit netiek tulkots - to dara klients ar esošo translate-damage ceļu.
 */

import { IRISS_LISTING_PLATFORM_LABEL } from "@/lib/iriss-listings-platform";
import { isPlausibleListingVin } from "@/lib/iriss-listings-extract";
import type { IrissOrderRoomHit } from "@/lib/iriss-order-room";
import type { IrissAuctionLink } from "@/lib/iriss-auction-link";

export type IrissRelayAuctionDetail = {
  platform: string;
  key: string;
  url: string;
  finalUrl?: string;
  title: string;
  fields: Array<[string, string]>;
  tables: string[][][];
  lists: Array<{ heading: string; items: string[] }>;
  photos: string[];
  text?: string;
  jsonFields: Array<[string, string]>;
  item: Record<string, unknown> | null;
};

/** Lauki, kuru nav IrissOrderRoomHit, bet ir piedāvājumā. */
export type IrissAuctionDetailExtras = {
  keyCount: string;
  emissionClass: string;
  engineDisplacement: string;
  equipmentHighlights: string;
  /** "TA derīga līdz ..., Īpašnieku skaits ..." - jau LV, bez tulkošanas. */
  technicalFacts: string;
  /** Kontrollampas / testa brauciens -> Tehniskais novērtējums (jātulko). */
  technicalIssueText: string;
  hasFullServiceHistory: boolean;
};

type Rec = Record<string, unknown>;

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

const clean = (s: unknown): string => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : typeof s === "number" && Number.isFinite(s) ? String(s) : "");

/** Normalizētas etiķetes (EN lapa, EN JSON atslēgas, LV/DE gadījumam, ja lapa nav EN). */
const LABELS = {
  vin: ["vin", "chassisnumber", "vehicleidentificationnumber", "vinnumber", "sasijasnumurs", "fahrgestellnummer"],
  mileage: ["odometer", "mileage", "odometerreading", "kilometers", "km", "nobraukums", "kilometerstand"],
  firstRegistration: ["firstregistration", "firstregistrationdate", "dateoffirstregistration", "pirmaregistracija", "pirmareg", "erstzulassung"],
  year: ["buildyear", "yearofmanufacture", "modelyear", "constructionyear", "izlaidumagads", "baujahr"],
  fuel: ["fueltype", "fuel", "degviela", "kraftstoff", "kraftstoffart"],
  transmission: ["gearbox", "geartype", "transmission", "atrumkarba", "getriebe"],
  power: ["horsepower", "power", "enginepower", "powerkw", "kw", "jauda", "leistung"],
  engine: ["cylindercapacity", "cubiccapacity", "enginesize", "enginecapacity", "displacement", "capacity", "tilpums", "dzinejatilpums", "hubraum"],
  body: ["bodytype", "body", "bodystyle", "virsbuve", "karosserie", "karosserieform"],
  color: ["colororiginal", "color", "colour", "exteriorcolor", "exteriorcolour", "krasa", "farbe"],
  doors: ["doors", "doorcount", "numberofdoors", "durvis", "turen"],
  seats: ["seats", "numberofseats", "seatcount", "sedvietas", "sitzplatze"],
  keys: ["keys", "numberofkeys", "keycount", "atslegas", "atslegasskaits", "atslegaskaits", "schlussel"],
  emission: ["environmentalclass", "emissionclass", "emissionstandard", "euronorm", "emissionnorm", "pollutionclass", "emisijunorma", "emisijasklase", "schadstoffklasse"],
  origin: ["countryoforigin", "countryoflastregistration", "registrationcountry", "originalcountry", "izcelsmesvalsts", "registracijasvalsts", "herkunftsland"],
  location: ["carlocation", "location", "pickuplocation", "pickupaddress", "sanemsanasvieta", "standort"],
  vat: ["vat", "vatregime", "vattype", "pvnrezims", "pvn", "mwst"],
  inspection: ["inspectionexpires", "technicalinspection", "technicalinspectionvaliduntil", "mot", "tuv", "hu", "tadergalidz", "tadergiga"],
  owners: ["totalnumberofowners", "numberofowners", "owners", "previousowners", "ipasniekuskaits", "vorbesitzer"],
  serviceBook: ["servicebook", "servicehistory", "servicedocumentation", "servicedocuments", "servisagramata", "scheckheft"],
  title: ["title", "makemodel", "model", "markamodelis"],
} as const;

type LabelKey = keyof typeof LABELS;

function buildLookup(detail: IrissRelayAuctionDetail): (k: LabelKey) => string {
  const dom = new Map<string, string>();
  for (const [l, v] of detail.fields ?? []) {
    const n = norm(l);
    if (n && !dom.has(n) && clean(v)) dom.set(n, clean(v));
  }
  const json = new Map<string, string>();
  for (const [path, v] of detail.jsonFields ?? []) {
    if (path.includes("[")) continue;
    const last = norm(path.split(".").pop() ?? "");
    if (last && !json.has(last) && clean(v)) json.set(last, clean(v));
  }
  return (k) => {
    for (const label of LABELS[k]) {
      const v = dom.get(label);
      if (v) return v;
    }
    for (const label of LABELS[k]) {
      const v = json.get(label);
      if (v) return v;
    }
    return "";
  };
}

const LV_WORDS: Array<[RegExp, string]> = [
  [/^diesel$/i, "Dīzelis"],
  [/^(petrol|gasoline|benzin)$/i, "Benzīns"],
  [/^(plug-?in hybrid|phev)\b.*$/i, "Uzlādējams hibrīds"],
  [/^hybrid\b.*$/i, "Hibrīds"],
  [/^(electric|electro|ev)$/i, "Elektriskais"],
  [/^(lpg|cng)$/i, "Gāze"],
  [/^automatic\b(.*)$/i, "Automātiskā$1"],
  [/^(duplex|dual[- ]clutch|dsg|dct)$/i, "Automātiskā (divsajūgu)"],
  [/^manual\b(.*)$/i, "Manuālā$1"],
  [/^(station wagon|estate|touring|kombi|wagon)$/i, "Universālis"],
  [/^(sedan|saloon|limousine)$/i, "Sedans"],
  [/^hatchback$/i, "Hečbeks"],
  [/^(suv|off-?road|all-terrain)\b.*$/i, "Apvidus (SUV)"],
  [/^coupe$/i, "Kupeja"],
  [/^(convertible|cabrio(let)?)$/i, "Kabriolets"],
  [/^(van|mpv|minivan)$/i, "Minivens"],
  [/^black$/i, "Melna"],
  [/^white$/i, "Balta"],
  [/^(grey|gray)$/i, "Pelēka"],
  [/^silver$/i, "Sudraba"],
  [/^blue$/i, "Zila"],
  [/^red$/i, "Sarkana"],
  [/^green$/i, "Zaļa"],
  [/^brown$/i, "Brūna"],
  [/^beige$/i, "Bēša"],
  [/^yellow$/i, "Dzeltena"],
  [/^orange$/i, "Oranža"],
];

/** Bieži vienvārda tehniskie termini -> LV; nezināms paliek kā avotā. */
const PAINT_SUFFIX_LV: Array<[RegExp, string]> = [
  [/^original$/i, ""],
  [/^(metallic|metallic paint)$/i, "metāliks"],
  [/^(pearl|pearlescent|mother of pearl)$/i, "perlamutra"],
  [/^matt?e?$/i, "matēta"],
];

export function lvTerm(raw: string): string {
  const t = clean(raw);
  for (const [re, lv] of LV_WORDS) if (re.test(t)) return t.replace(re, lv).trim();
  // Auto1: «Brown (Original)», «Grey (Metallic)».
  const paint = t.match(/^(.+?)\s*\(([^)]+)\)$/);
  if (paint) {
    const base = lvTerm(paint[1]);
    const suffix = PAINT_SUFFIX_LV.find(([re]) => re.test(paint[2].trim()));
    if (base !== clean(paint[1]) && suffix) return suffix[1] ? `${base} (${suffix[1]})` : base;
  }
  return t;
}

/** «1,968 ccm» / «1.968 ccm» / «1968 cc» → «1968 cm³». Citādi bez izmaiņām. */
export function lvEngineDisplacement(raw: string): string {
  const t = clean(raw);
  const m = t.match(/^(\d{1,2})[.,\s]?(\d{3})\s*(ccm|cc|cm3|cm³)$/i) ?? t.match(/^(\d{3,4})()\s*(ccm|cc|cm3|cm³)$/i);
  return m ? `${m[1]}${m[2]} cm³` : t;
}

/**
 * Releja `mileageKm` no Auto1 detaļu lapas «319.377 km» nāk kā 319.377 (tūkstošu punkts nolasīts
 * kā decimāldaļa) - klienta piedāvājumā bija «319 km». Nobraukums vienmēr ir vesels km skaits.
 */
export function irissDetailMileageKm(itemValue: number | null, labelValue: string): number | null {
  if (itemValue != null && Number.isFinite(itemValue) && itemValue > 0) {
    if (Number.isInteger(itemValue)) return itemValue;
    const thousands = Math.round(itemValue * 1000);
    if (Math.abs(thousands - itemValue * 1000) < 1e-6) return thousands;
  }
  const fromLabel = labelValue ? digits(labelValue) : null;
  if (fromLabel != null && fromLabel > 0) return fromLabel;
  return itemValue != null && itemValue > 0 ? Math.round(itemValue) : null;
}

function digits(raw: string): number | null {
  const m = raw.replace(/[\s.,'](?=\d{3}\b)/g, "").match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** "140 kW (190 HP)" -> "140"; tikai HP -> kW. */
function powerKw(raw: string): string {
  const kw = raw.match(/(\d{2,4})\s*kw/i);
  if (kw) return kw[1];
  const hp = raw.match(/(\d{2,4})\s*(?:hp|ps|zs|ch)\b/i);
  if (hp) return String(Math.round(Number(hp[1]) * 0.7355));
  return /^\d{2,4}$/.test(raw.trim()) ? raw.trim() : "";
}

/** "03/2021", "2021-03-01", "01.03.2021" -> MM.YYYY / DD.MM.YYYY (kā kartē: Pirmā reģ. MM.YYYY). */
export function lvRegistrationDate(raw: string): string {
  const t = clean(raw);
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-]((?:19|20)\d{2})$/);
  if (m) return `${m[1].padStart(2, "0")}.${m[2].padStart(2, "0")}.${m[3]}`;
  m = t.match(/^(\d{1,2})[./-]((?:19|20)\d{2})$/);
  if (m) return `${m[1].padStart(2, "0")}.${m[2]}`;
  return t;
}

const VIN_RE = /\b[A-HJ-NPR-Z0-9]{17}\b/;

const EQUIPMENT_LV: Array<[RegExp, string]> = [
  [/4x4|all[- ]wheel|awd|quattro|xdrive|4matic|4motion/i, "4x4"],
  [/leather|nappa/i, "āda"],
  [/navigat/i, "navigācija"],
  [/xenon|led headl|matrix|laser light/i, "LED/ksenona lukturi"],
  [/heated (front )?seats|seat heating/i, "sēdekļu apsilde"],
  [/parking (sensor|aid|distance)|pdc|park assist/i, "PDC"],
  [/camera|360/i, "kamera"],
  [/tow(ing)? (bar|hitch|hook)|trailer hitch/i, "āķis"],
  [/auxiliary heat|parking heat|webasto|standheizung/i, "papildapsilde"],
  [/panoram|sunroof|sliding roof/i, "panorāmas jumts"],
  [/adaptive cruise|acc\b|distronic/i, "adaptīvais kruīzs"],
  [/head[- ]up/i, "HUD"],
  [/keyless/i, "keyless"],
];

function equipmentHighlights(detail: IrissRelayAuctionDetail): string {
  const items: string[] = [];
  for (const l of detail.lists ?? []) {
    if (/equipment|aprīkojum|ausstattung|options|features|extras|top/i.test(l.heading)) items.push(...l.items);
  }
  for (const [path, v] of detail.jsonFields ?? []) if (/equipment|option|feature/i.test(path)) items.push(...v.split(/,\s*/));
  const out: string[] = [];
  for (const [re, lv] of EQUIPMENT_LV) if (items.some((i) => re.test(i)) && !out.includes(lv)) out.push(lv);
  return out.join(", ");
}

/**
 * Auto1 vienu testa brauciena tekstu atkārto 3-4 reizes ar citiem burtiem/atstarpēm vai kā daļu
 * no garāka teksta. Atstāj pirmo garāko; rindas, kas ir citas rindas daļa, izmet.
 */
export function dedupeDamageLines(lines: string[]): string[] {
  const keyOf = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const keys = lines.map(keyOf);
  return lines.filter((_, i) => {
    const k = keys[i];
    if (!k) return false;
    return !keys.some((other, j) => j !== i && (other === k ? j < i : other.length > k.length && other.includes(k)));
  });
}

const TECH_ISSUE_RE = /control light|warning light|engine light|check engine|error|fault|test drive|kontrollampe|kontrollampa/i;

/** Bojājumu tabula / saraksts -> īss teksts tulkošanai ("Front door right: Scratch (Minor)"). */
function damageTexts(detail: IrissRelayAuctionDetail): { visual: string; technical: string } {
  const visual: string[] = [];
  const technical: string[] = [];
  const add = (line: string) => {
    const t = clean(line);
    if (!t || t.length > 300) return;
    const bucket = TECH_ISSUE_RE.test(t) ? technical : visual;
    if (!bucket.includes(t)) bucket.push(t);
  };
  for (const table of detail.tables ?? []) {
    const head = (table[0] ?? []).join(" ");
    if (!/damage|bojāj|schaden|area|zone|defect/i.test(head)) continue;
    for (const row of table.slice(1, 60)) {
      const cells = row.map(clean).filter(Boolean);
      if (cells.length === 0) continue;
      const [first, ...rest] = cells;
      add(rest.length ? `${first}: ${rest.join(", ")}` : first);
    }
  }
  for (const l of detail.lists ?? []) {
    if (/damage|bojāj|condition|stāvokl|schäden|defect/i.test(l.heading)) for (const i of l.items.slice(0, 60)) add(i);
  }
  const rows = new Map<string, string[]>();
  for (const [path, v] of detail.jsonFields ?? []) {
    const m = path.match(/^(.*damage[^.[]*\[\d+\])\.([^.]+)$/i);
    if (!m) continue;
    if (/id$|url|image|photo|uuid/i.test(m[2])) continue;
    rows.set(m[1], [...(rows.get(m[1]) ?? []), v]);
  }
  if (visual.length === 0) for (const vals of rows.values()) add(vals.join(", "));
  for (const [l, v] of detail.fields ?? []) if (TECH_ISSUE_RE.test(l) && !/^(no|none|nē|0)$/i.test(v)) add(`${l}: ${v}`);
  return { visual: dedupeDamageLines(visual).slice(0, 40).join("; "), technical: dedupeDamageLines(technical).slice(0, 20).join("; ") };
}

const yes = (v: string) => /^(yes|ja|jā|available|present|complete|full|ir|vorhanden)\b/i.test(v.trim());

export function irissAuctionDetailToSeed(
  detail: IrissRelayAuctionDetail,
  link: IrissAuctionLink,
): { hit: IrissOrderRoomHit; extras: IrissAuctionDetailExtras } {
  const get = buildLookup(detail);
  const item: Rec = detail.item ?? {};
  const itemStr = (k: string) => clean(item[k]);
  const itemNum = (k: string) => (typeof item[k] === "number" && Number.isFinite(item[k] as number) ? (item[k] as number) : null);

  const vinRaw = itemStr("vin") || get("vin");
  const vinMatch = (vinRaw.toUpperCase().match(VIN_RE)?.[0] ?? "").trim();
  const vin = isPlausibleListingVin(vinMatch) ? vinMatch : "";
  const mileage = irissDetailMileageKm(itemNum("mileageKm"), get("mileage"));
  const firstRegRaw = get("firstRegistration") || itemStr("firstRegistration");
  const firstRegistration = lvRegistrationDate(firstRegRaw);
  const year = get("year").match(/(?:19|20)\d{2}/)?.[0] || itemStr("year") || (firstRegRaw.match(/(?:19|20)\d{2}/)?.[0] ?? "");
  const doors = get("doors").match(/\d+/)?.[0] ?? "";
  const seats = get("seats").match(/\d+/)?.[0] ?? "";
  const photos = (detail.photos ?? []).filter((u) => /^https:\/\//i.test(u));
  const { visual, technical } = damageTexts(detail);
  const title = itemStr("title") || clean(detail.title).replace(/\s*[|-]\s*(auto1|openlane).*$/i, "");
  const priceOf = (k: string) => itemNum(k);

  const inspection = get("inspection");
  const owners = get("owners");
  const serviceBook = get("serviceBook");
  const facts = [
    inspection ? `TA derīga līdz: ${lvRegistrationDate(inspection)}` : "",
    owners ? `Īpašnieku skaits: ${owners}` : "",
    serviceBook ? `Servisa grāmatiņa: ${yes(serviceBook) ? "ir" : serviceBook}` : "",
  ].filter(Boolean);

  const hit: IrissOrderRoomHit = {
    id: `link:${link.platform}:${link.key}`,
    platform: link.platform === "openline" ? "openline" : "auto1",
    externalId: itemStr("externalId") || link.key,
    detailUrl: link.url,
    orderIds: [],
    title,
    year: year || "",
    firstRegistration,
    mileageKm: mileage && mileage > 0 ? mileage : null,
    fuel: lvTerm(get("fuel") || itemStr("fuel")),
    transmission: lvTerm(get("transmission") || itemStr("transmission")),
    powerKw: powerKw(get("power")) || itemStr("powerKw"),
    color: lvTerm(get("color") || itemStr("color")),
    bodyType: lvTerm(get("body") || itemStr("bodyType")),
    ...(doors ? { doorCount: seats ? `${doors}/${seats}` : doors } : {}),
    ...(visual ? { damageRaw: visual } : {}),
    imageUrl: photos[0] ?? "",
    imageUrls: photos,
    imageCount: photos.length,
    vin,
    price: priceOf("priceCurrent") ?? priceOf("priceBuyNow") ?? priceOf("priceStart"),
    priceStart: priceOf("priceStart"),
    priceMinimal: priceOf("priceMinimal"),
    priceCurrent: priceOf("priceCurrent"),
    priceBuyNow: priceOf("priceBuyNow"),
    priceEstimate: null,
    priceTotal: null,
    stockNumber: link.platform === "auto1" ? link.key : "",
    auctionId: link.platform === "openline" ? link.key : itemStr("auctionId"),
    auctionStage: itemStr("auctionStage"),
    auctionStartAt: itemStr("auctionStartAt"),
    auctionEndAt: itemStr("auctionEndAt"),
    countryCode: get("origin") || itemStr("countryCode"),
    vatNote: get("vat") || "",
    change: "unchanged",
    firstSeenAt: "",
    lastSeenAt: "",
    location: get("location") || itemStr("location"),
    priceHistory: [],
  };
  const extras: IrissAuctionDetailExtras = {
    keyCount: get("keys").match(/\d+/)?.[0] ?? "",
    emissionClass: get("emission"),
    engineDisplacement: lvEngineDisplacement(get("engine")),
    equipmentHighlights: equipmentHighlights(detail),
    technicalFacts: facts.join(". "),
    technicalIssueText: technical,
    hasFullServiceHistory: Boolean(serviceBook && yes(serviceBook) && !/some|partial|daļ/i.test(serviceBook)),
  };
  return { hit, extras };
}

export function irissAuctionDetailPlatformLabel(link: IrissAuctionLink): string {
  return IRISS_LISTING_PLATFORM_LABEL[link.platform] ?? link.platform;
}

/** Releja atbilde -> detaļas vai LV kļūdas teksts. */
export function mapRelayDetailResponse(
  httpStatus: number,
  body: unknown,
): { ok: true; detail: IrissRelayAuctionDetail } | { ok: false; error: string; note: string } {
  const rec = body && typeof body === "object" ? (body as Rec) : {};
  if (httpStatus === 404 && /nezināms ceļš/i.test(clean(rec.error))) {
    return { ok: false, error: "relay_detail_missing", note: "Relejā vēl nav izvietots detaļu lapas lasītājs - aizpildi ar roku." };
  }
  if (httpStatus === 401 || httpStatus === 403) return { ok: false, error: "relay_auth", note: "Relejs noraidīja tokenu." };
  if (httpStatus === 429) return { ok: false, error: "relay_limit", note: "Releja dienas limits detaļu lapām sasniegts." };
  if (httpStatus === 503) return { ok: false, error: "relay_busy", note: "Relejs aizņemts - mēģini pēc brīža." };
  const status = clean(rec.status);
  if (status === "login_required") return { ok: false, error: "login_required", note: "Sesija beigusies - jāielogojas (IRISS Sludinājumi > Ielogoties)." };
  if (status === "blocked") return { ok: false, error: "blocked", note: "Izsoles lapa bloķēja pārlūku (captcha) - mēģini vēlāk." };
  if (status === "not_found") return { ok: false, error: "not_found", note: "Auto nav atrasts - izsole beigusies vai saite nederīga." };
  const d = rec.detail && typeof rec.detail === "object" ? (rec.detail as Rec) : null;
  if (httpStatus >= 400 || rec.ok !== true || !d) {
    return { ok: false, error: "relay_error", note: clean(rec.note) || clean(rec.error) || "Neizdevās nolasīt izsoles lapu - aizpildi ar roku." };
  }
  const pairs = (v: unknown): Array<[string, string]> =>
    Array.isArray(v) ? v.filter((p): p is [string, string] => Array.isArray(p) && typeof p[0] === "string" && typeof p[1] === "string") : [];
  return {
    ok: true,
    detail: {
      platform: clean(d.platform),
      key: clean(d.key),
      url: clean(d.url),
      finalUrl: clean(d.finalUrl),
      title: clean(d.title),
      fields: pairs(d.fields),
      tables: Array.isArray(d.tables) ? (d.tables as string[][][]) : [],
      lists: Array.isArray(d.lists) ? (d.lists as Array<{ heading: string; items: string[] }>).filter((l) => l && Array.isArray(l.items)) : [],
      photos: Array.isArray(d.photos) ? d.photos.filter((u): u is string => typeof u === "string") : [],
      jsonFields: pairs(d.jsonFields),
      item: d.item && typeof d.item === "object" ? (d.item as Rec) : null,
    },
  };
}

/** Detaļu lapa ir galvenā; saraksta hit aizpilda tikai tukšo (cenas, izsoles beigas, PVN). */
export function mergeListedIntoDetailHit(detail: IrissOrderRoomHit, listed: IrissOrderRoomHit): IrissOrderRoomHit {
  const out: IrissOrderRoomHit = { ...detail };
  for (const [k, v] of Object.entries(listed) as Array<[keyof IrissOrderRoomHit, unknown]>) {
    const cur = out[k];
    const empty = cur == null || cur === "" || (Array.isArray(cur) && cur.length === 0);
    if (empty && v != null && v !== "" && !(Array.isArray(v) && v.length === 0)) (out as Record<string, unknown>)[k] = v;
  }
  // Detaļu lapas virsraksts bez markas («Sharan 2.0 TDI ...»), saraksts ar («Volkswagen Sharan ...»).
  const dt = (detail.title ?? "").trim();
  const lt = (listed.title ?? "").trim();
  if (dt && lt.length > dt.length && lt.toLowerCase().endsWith(dt.toLowerCase())) out.title = lt;
  if (out.vin && !isPlausibleListingVin(out.vin)) out.vin = "";
  out.id = listed.id;
  return out;
}
