/**
 * «Izsoļu arhīvs» PDF v2: no TheCarApi izsoles ierakstiem (Openlane, BCA, Autobid, …) izvelk TIKAI klientam
 * būtiskos faktus latviski - bez tehniskajiem ID, valūtu kursiem, karodziņiem un dublikātiem (Nils 23.11:
 * «dati dublējas, līdz galam neiztulkots»). Katrs fakts vienreiz, īstajā vietā:
 *   - transportlīdzekļa dati (kopīgi visām izsolēm) → `auctionArchiveVehicleRows`
 *   - izsoles fakti (vieta, laiks, pārdevējs, stāvoklis, dokumenti, cenas) → `auctionArchiveLotFacts`
 *   - aprīkojums (apvienots no visām izsolēm, tulkots, bez sīkumiem) → `auctionArchiveEquipment`
 *   - starp izsolēm salīdzināmie fakti (nobraukums, atslēgas, bojājumi) → `auctionArchiveKeyFindings`
 * Tīrs modulis, bez AI: nezināmos aprīkojuma nosaukumus atdod `untranslated`, tos tulko PDF ceļš (Gemini, rindu
 * skaita pārbaude) un padod atpakaļ `translations` kartē.
 */
import { countryName, equipmentCategory, EQUIPMENT_CATEGORY_ORDER, normKey, translateEquipment } from "@/lib/thecarapi-i18n-lv";
import { thecarapiSalePriceFromFields } from "@/lib/thecarapi-sale-price";
import type { ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";

export type ArchiveKv = { k: string; v: string; missing?: boolean; alert?: boolean };

/* ---------- lauku lasīšana ---------- */

type FieldGet = {
  /** Pirmā netukšā vērtība pēc precīzām atslēgām. */
  exact: (...keys: string[]) => string;
  /** Pirmā netukšā vērtība, kuras atslēgas pēdējais segments (bez simboliem, mazie burti) sakrīt. */
  tail: (...names: string[]) => string;
};

const EMPTY_VALUE = /^(null|undefined|none|n\/a|-|&shy;|unknown|nezināms)$/i;

function clean(v: string | undefined | null): string {
  const s = (v ?? "").replace(/&shy;/g, "").replace(/\s+/g, " ").trim();
  return s && !EMPTY_VALUE.test(s) ? s : "";
}

function tailName(key: string): string {
  const last = key.split(".").pop() ?? key;
  return last.replace(/\[\d+\]$/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function archiveFieldGetter(r: ThecarapiAdminRecord): FieldGet {
  const byKey = new Map<string, string>();
  const byTail = new Map<string, string>();
  for (const f of r.fields) {
    const v = clean(f.value);
    if (!v) continue;
    if (!byKey.has(f.key)) byKey.set(f.key, v);
    const t = tailName(f.key);
    if (t && !byTail.has(t)) byTail.set(t, v);
  }
  return {
    exact: (...keys) => {
      for (const k of keys) {
        const v = byKey.get(k);
        if (v) return v;
      }
      return "";
    },
    tail: (...names) => {
      for (const n of names) {
        const v = byTail.get(n.toLowerCase().replace(/[^a-z0-9]/g, ""));
        if (v) return v;
      }
      return "";
    },
  };
}

function yesNo(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (/^(yes|jā|ja|true|1|present|ir|available|si|sì|oui)$/.test(v)) return true;
  if (/^(no|nē|ne|false|0|absent|nav|not present|non|nein)$/.test(v)) return false;
  return null;
}

function num(raw: string): number | null {
  const s = raw.replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const NBSP_GROUP = /\B(?=(\d{3})+(?!\d))/g;

export function fmtInt(n: number): string {
  return String(Math.round(n)).replace(NBSP_GROUP, " ");
}

function fmtEur(n: number): string {
  const whole = Math.abs(n - Math.round(n)) < 0.005;
  if (whole) return `${fmtInt(n)} €`;
  const [i, d] = n.toFixed(2).split(".");
  return `${fmtInt(Number(i))},${d} €`;
}

/* ---------- datumi ---------- */

/** «2022-10-25T00:00:00» → «25.10.2022» (bez laika joslas nobīdes), «20260710» → «10.07.2026», «10/2022» → «10.2022». */
export function archiveDay(raw: string): string {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  m = /^(20\d{2}|19\d{2})(\d{2})(\d{2})$/.exec(s);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(s);
  if (m) return `${m[1]}.${m[2]}.${m[3]}`;
  m = /^(\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) return `${m[1]!.padStart(2, "0")}.${m[2]}`;
  return "";
}

const RIGA = new Intl.DateTimeFormat("lv-LV", {
  timeZone: "Europe/Riga",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Izsoles laiks Rīgas laikā. Avota laiks bez zonas TheCarApi ir UTC. */
export function archiveDateTime(raw: string): string {
  const s = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return archiveDay(s);
  const iso = /(Z|[+-]\d{2}:?\d{2})$/.test(s) ? s : `${s}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return archiveDay(s);
  const p = Object.fromEntries(RIGA.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

/* ---------- vārdnīcas (EN / DE / IT / FR → LV) ---------- */

const BODY_LV: Record<string, string> = {
  wagon: "Universālis",
  stationwagon: "Universālis",
  estate: "Universālis",
  break: "Universālis",
  kombi: "Universālis",
  avant: "Universālis",
  touring: "Universālis",
  stationwagonestate: "Universālis",
  sedan: "Sedans",
  saloon: "Sedans",
  limousine: "Sedans",
  berlina: "Sedans",
  hatchback: "Hečbeks",
  schraegheck: "Hečbeks",
  coupe: "Kupeja",
  convertible: "Kabriolets",
  cabrio: "Kabriolets",
  cabriolet: "Kabriolets",
  suv: "Apvidus (SUV)",
  offroad: "Apvidus (SUV)",
  geländewagen: "Apvidus (SUV)",
  mpv: "Minivens",
  minivan: "Minivens",
  van: "Furgons",
  pickup: "Pikaps",
  lighttruck: "Vieglais kravas furgons",
  lightcommercial: "Vieglais kravas furgons",
  lcv: "Vieglais kravas furgons",
};

const COLOR_LV: Record<string, string> = {
  grey: "pelēka",
  gray: "pelēka",
  grau: "pelēka",
  grigio: "pelēka",
  gris: "pelēka",
  black: "melna",
  schwarz: "melna",
  nero: "melna",
  noir: "melna",
  white: "balta",
  weiss: "balta",
  weiß: "balta",
  bianco: "balta",
  blanc: "balta",
  silver: "sudraba",
  silber: "sudraba",
  argento: "sudraba",
  blue: "zila",
  blau: "zila",
  blu: "zila",
  bleu: "zila",
  red: "sarkana",
  rot: "sarkana",
  rosso: "sarkana",
  rouge: "sarkana",
  green: "zaļa",
  grün: "zaļa",
  verde: "zaļa",
  brown: "brūna",
  braun: "brūna",
  marrone: "brūna",
  beige: "bēša",
  yellow: "dzeltena",
  gelb: "dzeltena",
  orange: "oranža",
  gold: "zelta",
  purple: "violeta",
  violet: "violeta",
  bronze: "bronzas",
};

const FUEL_LV: Record<string, string> = {
  diesel: "dīzelis",
  dīzelis: "dīzelis",
  gasoline: "benzīns",
  petrol: "benzīns",
  benzin: "benzīns",
  benzina: "benzīns",
  benzīns: "benzīns",
  electric: "elektrība",
  elektro: "elektrība",
  hybrid: "hibrīds",
  hybriddiesel: "hibrīds (dīzelis)",
  hybridpetrol: "hibrīds (benzīns)",
  pluginhybrid: "spraudņa hibrīds",
  lpg: "benzīns + gāze (LPG)",
  cng: "dabasgāze (CNG)",
};

const DRIVE_LV: Record<string, string> = {
  front: "priekšējā",
  fwd: "priekšējā",
  frontwheeldrive: "priekšējā",
  rear: "aizmugurējā",
  rwd: "aizmugurējā",
  rearwheeldrive: "aizmugurējā",
  "4x4": "pilnpiedziņa",
  awd: "pilnpiedziņa",
  "4wd": "pilnpiedziņa",
  allwheeldrive: "pilnpiedziņa",
  quattro: "pilnpiedziņa (quattro)",
};

const ORIGIN_LV: Record<string, string> = {
  lease: "līzinga auto",
  leasing: "līzinga auto",
  companycar: "uzņēmuma auto",
  fleet: "uzņēmuma autoparka auto",
  rental: "nomas auto",
  rentalcar: "nomas auto",
  private: "privātpersonas auto",
  dealer: "dīlera auto",
  tradein: "maiņas auto (trade-in)",
};

/** Modeļa saīsinājumi izsoļu nosaukumos (IT/DE/EN) → lasāmi. */
const VERSION_WORDS: [RegExp, string][] = [
  [/\bBUSIN\.?\b/gi, "Business"],
  [/\bADVAN\.?(?=\s|$)/gi, "Advanced"],
  [/\bS[\s-]?TRONIC\b/gi, "S tronic"],
  [/\bTIPTR\.?\b/gi, "tiptronic"],
  [/\bQUATTRO\b/gi, "quattro"],
  [/\bSPORTB\.?\b/gi, "Sportback"],
  [/\bAUT\.?(?=\s|$)/gi, "automāts"],
];

function lookup(dict: Record<string, string>, raw: string): string {
  const v = raw.trim().toLowerCase();
  if (!v) return "";
  const k = v.replace(/^carcolor\.|^carsize\./, "").replace(/[^a-z0-9äöüß]/g, "");
  return dict[k] ?? dict[v] ?? "";
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** «2.0 40 TDI BUSIN ADVAN. S TRONIC» → «2.0 40 TDI Business Advanced S tronic». */
export function archiveVersionLabel(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim();
  if (!s) return "";
  for (const [re, lv] of VERSION_WORDS) s = s.replace(re, lv);
  return s;
}

/* ---------- aprīkojums ---------- */

type EquipDef = { lv: string; keep: boolean; cat?: (typeof EQUIPMENT_CATEGORY_ORDER)[number] };

const SAFETY = "Drošība un asistenti" as const;
const LIGHTS = "Gaismas" as const;
const COMFORT = "Komforts un salons" as const;
const MEDIA = "Multimēdijs" as const;
const WHEELS = "Diski un riepas" as const;
const ENGINE = "Dzinējs un transmisija" as const;

/** Atslēga - `normKey` (mazie burti, tikai burti/cipari). `keep: false` - sīkums, ko 2015+ auto ir vienmēr. */
const EQUIP: Record<string, EquipDef> = {
  satellitenavigation: { lv: "Navigācija", keep: true, cat: MEDIA },
  navigation: { lv: "Navigācija", keep: true, cat: MEDIA },
  navigationsystem: { lv: "Navigācija", keep: true, cat: MEDIA },
  navigatore: { lv: "Navigācija", keep: true, cat: MEDIA },
  alloyswheels: { lv: "Vieglmetāla diski", keep: true, cat: WHEELS },
  alloywheels: { lv: "Vieglmetāla diski", keep: true, cat: WHEELS },
  leichtmetallfelgen: { lv: "Vieglmetāla diski", keep: true, cat: WHEELS },
  cerchiinlega: { lv: "Vieglmetāla diski", keep: true, cat: WHEELS },
  frontfoglamps: { lv: "Priekšējie miglas lukturi", keep: true, cat: LIGHTS },
  foglights: { lv: "Miglas lukturi", keep: true, cat: LIGHTS },
  nebelscheinwerfer: { lv: "Miglas lukturi", keep: true, cat: LIGHTS },
  rearsunblind: { lv: "Aizmugurējā loga saulessargs", keep: true, cat: COMFORT },
  remoteadjustingwingmirrors: { lv: "Elektriski regulējami spoguļi", keep: true, cat: COMFORT },
  electricmirrors: { lv: "Elektriski regulējami spoguļi", keep: true, cat: COMFORT },
  heatedwingmirrors: { lv: "Apsildāmi spoguļi", keep: true, cat: COMFORT },
  heatedmirrors: { lv: "Apsildāmi spoguļi", keep: true, cat: COMFORT },
  mirrorscamerasheatedmirrors: { lv: "Apsildāmi spoguļi", keep: true, cat: COMFORT },
  cruisecontrol: { lv: "Kruīza kontrole", keep: true, cat: SAFETY },
  tempomat: { lv: "Kruīza kontrole", keep: true, cat: SAFETY },
  rainsensitivewindscreenwipers: { lv: "Lietus sensors", keep: true, cat: SAFETY },
  rainsensor: { lv: "Lietus sensors", keep: true, cat: SAFETY },
  safetysystemsrainsensor: { lv: "Lietus sensors", keep: true, cat: SAFETY },
  regensensor: { lv: "Lietus sensors", keep: true, cat: SAFETY },
  bluetoothtelephoneinterface: { lv: "Bluetooth brīvroku sistēma", keep: true, cat: MEDIA },
  bluetooth: { lv: "Bluetooth brīvroku sistēma", keep: true, cat: MEDIA },
  enhancedspeakersystem: { lv: "Uzlabota audiosistēma", keep: true, cat: MEDIA },
  roofrails: { lv: "Jumta reliņi", keep: true, cat: COMFORT },
  dieselparticulatefilter: { lv: "Dīzeļdzinēja daļiņu filtrs (DPF)", keep: true, cat: ENGINE },
  leathersteeringwheel: { lv: "Ādas stūre", keep: true, cat: COMFORT },
  seatcoveringcloth: { lv: "Auduma sēdekļu apdare", keep: true, cat: COMFORT },
  upholsterycloth: { lv: "Auduma sēdekļu apdare", keep: true, cat: COMFORT },
  seatsupholsterycloth: { lv: "Auduma sēdekļu apdare", keep: true, cat: COMFORT },
  seatcoveringleather: { lv: "Ādas sēdekļu apdare", keep: true, cat: COMFORT },
  upholsteryleather: { lv: "Ādas sēdekļu apdare", keep: true, cat: COMFORT },
  seatsupholsteryleather: { lv: "Ādas sēdekļu apdare", keep: true, cat: COMFORT },
  seatcoveringhalfleather: { lv: "Daļēji ādas sēdekļu apdare", keep: true, cat: COMFORT },
  seatcoveringalcantara: { lv: "Alcantara sēdekļu apdare", keep: true, cat: COMFORT },
  heatedseats: { lv: "Apsildāmi sēdekļi", keep: true, cat: COMFORT },
  parkingsensors: { lv: "Parkošanās sensori", keep: true, cat: SAFETY },
  reversingcamera: { lv: "Atpakaļskata kamera", keep: true, cat: SAFETY },
  climatecontrol: { lv: "Klimata kontrole", keep: true, cat: COMFORT },
  airconditioning: { lv: "Kondicionieris", keep: true, cat: COMFORT },
  panoramicroof: { lv: "Panorāmas jumts", keep: true, cat: COMFORT },
  sunroof: { lv: "Lūka", keep: true, cat: COMFORT },
  towbar: { lv: "Sakabe", keep: true, cat: ENGINE },
  // Sīkumi - mūsdienu auto vienmēr ir; PDF nerāda.
  airbagstatus: { lv: "", keep: false },
  airbags: { lv: "", keep: false },
  antilockbraking: { lv: "ABS", keep: false },
  abs: { lv: "ABS", keep: false },
  centrallocking: { lv: "Centrālā atslēga", keep: false },
  remotecentrallocking: { lv: "Centrālā atslēga ar pulti", keep: false },
  powerassistedsteering: { lv: "Stūres pastiprinātājs", keep: false },
  powersteering: { lv: "Stūres pastiprinātājs", keep: false },
  radio: { lv: "Radio", keep: false },
  tractioncontrol: { lv: "Vilces kontrole", keep: false },
  cabintriminlay: { lv: "", keep: false },
  upholstery: { lv: "", keep: false },
  seatsupholstery: { lv: "", keep: false },
  electricwindows: { lv: "Elektriskie logi", keep: false },
  immobilizer: { lv: "Imobilaizers", keep: false },
};

const NEGATIVE_VALUE = /^(no|nē|none|unknown|nezināms|0|false|n\/a)$/i;
const POSITIVE_VALUE = /^(yes|jā|true|present|standard|serie|serienmäßig|1)$/i;

/** Viens izsoles aprīkojuma ieraksts → { avota teksts, vārdnīcas atslēga } vai null (nav / sīkums nezināms). */
function equipCandidates(raw: string): { text: string; keys: string[] } | null {
  const s = raw.replace(/\s+/g, " ").trim();
  if (!s) return null;
  const colon = /^([^:]{2,80}):\s*(.+)$/.exec(s);
  if (colon) {
    const name = colon[1]!.trim();
    const val = colon[2]!.trim();
    if (NEGATIVE_VALUE.test(val)) return null;
    if (POSITIVE_VALUE.test(val)) return { text: name, keys: [normKey(name)] };
    if (/^\d+$/.test(val)) return { text: name, keys: [normKey(name)] };
    return { text: `${name}: ${val}`, keys: [normKey(`${name} ${val}`), normKey(name)] };
  }
  const parts = s.split(/\s+-\s+/);
  const keys = [normKey(s)];
  if (parts.length > 1) keys.push(normKey(parts.slice(-2).join(" ")), normKey(parts[parts.length - 1]!));
  return { text: s, keys };
}

/** Izsoļu aprīkojuma teksti no ieraksta (BCA «A: Yes, B: Cloth», Openlane «Grupa - Vienība», vispārīgi saraksti). */
export function archiveEquipmentSource(r: ThecarapiAdminRecord): string[] {
  const out: string[] = [];
  for (const f of r.fields) {
    const v = clean(f.value);
    if (!v || /^https?:/.test(v)) continue;
    const key = f.key;
    if (/(^|\.)(BCAEquipment|equipment)$/i.test(key)) {
      out.push(...v.split(/,\s*(?=[A-Z][^:,]{1,60}:)/));
    } else if (/(EtgOptionList|equipment|options?|features?)\[\d+\](\.(Name|name|label|title))?$/.test(key)) {
      if (!/^\d+$/.test(v) && !/^(jā|nē)$/.test(v)) out.push(v);
    }
  }
  return out;
}

export type ArchiveEquipment = { groups: { group: string; items: string[] }[]; untranslated: string[] };

/** Apvienots, tulkots aprīkojums no visām izsolēm. `translations` - AI tulkojumi nezināmajiem (avota teksts → LV). */
export function auctionArchiveEquipment(
  records: readonly ThecarapiAdminRecord[],
  translations: ReadonlyMap<string, string> = new Map(),
): ArchiveEquipment {
  const seen = new Set<string>();
  const byCat = new Map<string, string[]>();
  const untranslated: string[] = [];
  const add = (lv: string, cat: string) => {
    const k = lv.toLowerCase();
    if (!lv || seen.has(k)) return;
    seen.add(k);
    byCat.set(cat, [...(byCat.get(cat) ?? []), lv]);
  };
  for (const r of records) {
    for (const raw of archiveEquipmentSource(r)) {
      const c = equipCandidates(raw);
      if (!c) continue;
      const def = c.keys.map((k) => EQUIP[k]).find(Boolean);
      if (def) {
        if (def.keep) add(def.lv, def.cat ?? equipmentCategory(def.lv));
        continue;
      }
      const viaI18n = translateEquipment(c.text);
      if (viaI18n && viaI18n !== c.text) {
        add(viaI18n, equipmentCategory(c.text));
        continue;
      }
      const ai = translations.get(c.text)?.trim();
      if (ai) add(cap(ai), equipmentCategory(c.text));
      else {
        if (!untranslated.includes(c.text)) untranslated.push(c.text);
        add(c.text, equipmentCategory(c.text));
      }
    }
  }
  const groups = EQUIPMENT_CATEGORY_ORDER.filter((g) => byCat.has(g)).map((g) => ({ group: g, items: byCat.get(g)! }));
  return { groups, untranslated };
}

/* ---------- transportlīdzekļa dati (kopīgie) ---------- */

/** Jaunākā izsole ar vērtību uzvar. */
function pickNewest(records: readonly ThecarapiAdminRecord[], fn: (g: FieldGet, r: ThecarapiAdminRecord) => string): string {
  for (const r of [...records].reverse()) {
    const v = fn(archiveFieldGetter(r), r);
    if (v) return v;
  }
  return "";
}

/** Modelis klientam: «Audi A4 Avant 40 TDI» (marka + Openlane modeļa nosaukums vai modelis + dzinēja tips). */
export function auctionArchiveModelTitle(records: readonly ThecarapiAdminRecord[], fallback = ""): string {
  const make = pickNewest(records, (g) => g.exact("clean_make", "car_identification.Make", "make") || g.tail("make", "brand"));
  const model = pickNewest(records, (g) => g.exact("clean_model", "car_identification.Model", "model") || g.tail("model"));
  const displays = records.map((r) => archiveFieldGetter(r).exact("car_identification.ModelDisplay", "model_display")).filter(Boolean);
  const named = displays.find((d) => model && d.toLowerCase().startsWith(model.toLowerCase()) && d.length <= 40);
  const engine = pickNewest(records, (g) => g.exact("clean_type", "car_identification.EngineDescription"));
  const base = [make, named || model].filter(Boolean).join(" ");
  const title = engine && !base.toLowerCase().includes(engine.toLowerCase()) ? `${base} ${engine}` : base;
  return title.trim() || fallback.trim();
}

export function auctionArchiveVersion(records: readonly ThecarapiAdminRecord[]): string {
  const model = pickNewest(records, (g) => g.exact("clean_model"));
  const displays = records.map((r) => archiveFieldGetter(r).exact("model_display", "car_identification.ModelDisplay")).filter(Boolean);
  // Garākais nosaukums, kas NAV tikai modelis («A4 Avant») - tur ir komplektācija.
  const ver = displays.filter((d) => !(model && d.toLowerCase().startsWith(model.toLowerCase()))).sort((a, b) => b.length - a.length)[0] ?? "";
  return archiveVersionLabel(ver);
}

function gearboxLv(raw: string, version: string, gears: string): string {
  const v = raw.toLowerCase();
  let base = "";
  if (/s ?tronic|dsg|dct|pdk/i.test(version)) base = `automātiskā (${/s ?tronic/i.test(version) ? "S tronic" : "DSG"}, dubultsajūga)`;
  else if (/auto|tiptronic|steptronic|cvt/.test(v)) base = "automātiskā";
  else if (/sequential|robot/.test(v)) base = "robotizētā";
  else if (/manual|manuell|manuale|schalt/.test(v)) base = "manuālā";
  if (!base) return "";
  const n = num(gears);
  return cap(n && n > 1 && n < 12 ? `${base}, ${n} pārnesumi` : base);
}

/** Svarīgie lauki - ja trūkst, rāda sarkanā «Nav datu». Pārējos tukšos slēpj. */
const IMPORTANT = new Set(["Pirmā reģistrācija", "Dzinējs", "Jauda"]);

export function auctionArchiveVehicleRows(records: readonly ThecarapiAdminRecord[]): ArchiveKv[] {
  const rows: ArchiveKv[] = [];
  const push = (k: string, v: string) => {
    if (v) rows.push({ k, v });
    else if (IMPORTANT.has(k)) rows.push({ k, v: "Nav datu", missing: true });
  };
  const version = auctionArchiveVersion(records);
  const allVersions = records.map((r) => archiveFieldGetter(r).exact("model_display")).join(" ");

  push("Pirmā reģistrācija", archiveDay(pickNewest(records, (g) => g.exact("date_first_registration") || g.tail("firstregistration", "datefirstregistration", "registrationdate"))));
  const made = pickNewest(records, (g) => g.tail("manufacturedate", "manufactured"));
  const madeFallback = pickNewest(records, (g) => {
    const m = g.exact("production_month");
    const y = g.exact("production_year");
    return m && y ? `${m}/${y}` : "";
  });
  push("Ražots", archiveDay(made || madeFallback));
  const body = pickNewest(records, (g) => lookup(BODY_LV, g.exact("body_type")) || lookup(BODY_LV, g.tail("bodytype", "size")));
  const doors = pickNewest(records, (g) => g.tail("numberofdoors", "doors"));
  const seats = pickNewest(records, (g) => g.exact("places") || g.tail("seats", "places"));
  push("Virsbūve", [body, doors ? `${doors} durvis` : "", seats ? `${seats} sēdvietas` : ""].filter(Boolean).join(", "));

  const cc = num(pickNewest(records, (g) => g.exact("cylinder_capacity") || g.tail("cylindercapacity", "enginecc", "displacement")));
  const fuelRaw = pickNewest(records, (g) => g.exact("fuel_group", "car_identification.FuelTypeEn") || g.tail("fuel", "fueltype", "fuelraw"));
  const fuel = lookup(FUEL_LV, fuelRaw) || "";
  const engineType = pickNewest(records, (g) => g.exact("clean_type", "car_identification.EngineDescription"));
  // «2.0» u.tml. ir tikai tilpums - jau parādīts litros; dublikātu nerāda.
  const engineTypeShown = engineType && !/^\d[.,]\d$/.test(engineType.trim()) ? engineType : "";
  const engine = [
    cc && cc > 400 ? `${(cc / 1000).toFixed(1).replace(".", ",")} l (${fmtInt(cc)} cm³)` : "",
    fuel,
    engineTypeShown,
  ].filter(Boolean);
  push("Dzinējs", engine.join(", "));
  const kw = num(pickNewest(records, (g) => g.exact("kw") || g.tail("kw", "powerkw")));
  const hp = num(pickNewest(records, (g) => g.exact("hp") || g.tail("hp", "powerhp")));
  push("Jauda", kw ? `${fmtInt(kw)} kW (${fmtInt(hp ?? Math.round(kw * 1.35962))} ZS)` : hp ? `${fmtInt(hp)} ZS` : "");
  const gears = pickNewest(records, (g) => g.tail("numberofgears", "gears"));
  const gbRaw = pickNewest(records, (g) => g.exact("gearbox_group") || g.tail("transmissionen", "gearbox", "transmission"));
  push("Ātrumkārba", gearboxLv(gbRaw, `${version} ${allVersions}`, gears));
  const drive = cap(pickNewest(records, (g) => lookup(DRIVE_LV, g.tail("drive", "drivetrain", "drivetype"))));
  const awd = yesNo(pickNewest(records, (g) => g.tail("isfourwheeldrive")));
  push("Piedziņa", drive || (awd === true ? "Pilnpiedziņa" : awd === false ? "Viena ass (nav pilnpiedziņas)" : ""));
  const colorRaw = pickNewest(records, (g) => g.tail("coloren", "color", "bodycolor", "colour"));
  const colorType = pickNewest(records, (g) => g.tail("colortype", "painttype"));
  const color = lookup(COLOR_LV, colorRaw);
  push("Krāsa", color ? cap([color, /metal/i.test(colorType) ? "metālika" : /pearl|perl/i.test(colorType) ? "pērļu" : ""].filter(Boolean).join(", ")) : "");
  const co2 = num(pickNewest(records, (g) => g.exact("co2") || g.tail("co2")) || (/(\d{2,3})/.exec(pickNewest(records, (g) => g.tail("emissionclass")))?.[1] ?? ""));
  push("CO₂ izmeši", co2 ? `${fmtInt(co2)} g/km` : "");
  const euro = /(?:EU|Euro)\s*-?\s*(\d)\s*([a-z]{0,4})/i.exec(pickNewest(records, (g) => g.exact("effluent_standard_group_search") || g.tail("effluentstandard", "euronorm", "emissionstandard")));
  push("Emisiju standarts", euro ? `Euro ${euro[1]}${euro[2] ? euro[2].toUpperCase() : ""}` : "");
  const steering = pickNewest(records, (g) => g.exact("steering") || g.tail("steeringside"));
  push("Stūre", /^l(eft|hd)?$/i.test(steering) ? "Kreisajā pusē" : /^r(ight|hd)?$/i.test(steering) ? "Labajā pusē" : "");
  const regCountry = pickNewest(records, (g) => g.exact("country_code", "car_country_extended") || g.tail("registrationcountry"));
  push("Reģistrācijas valsts", archiveCountry(regCountry));
  return rows;
}

const COUNTRY_EN: Record<string, string> = {
  italy: "IT",
  germany: "DE",
  france: "FR",
  spain: "ES",
  netherlands: "NL",
  belgium: "BE",
  austria: "AT",
  poland: "PL",
  sweden: "SE",
  denmark: "DK",
  portugal: "PT",
  "united kingdom": "GB",
  czechia: "CZ",
  "czech republic": "CZ",
  lithuania: "LT",
  latvia: "LV",
  estonia: "EE",
  luxembourg: "LU",
  switzerland: "CH",
};

/** «IT» / «Italy» / «Itālija (IT)» → «Itālija». */
export function archiveCountry(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  const code = /^[A-Za-z]{2}$/.test(v) ? v.toUpperCase() : COUNTRY_EN[v.toLowerCase()] ?? "";
  const named = code ? countryName(code) : v;
  return named.replace(/\s*\([A-Z]{2}\)\s*$/, "").trim();
}

/* ---------- viena izsole ---------- */

export type ArchiveLotFacts = {
  country: string;
  location: string;
  lotNo: string;
  /** Izsoles dati: laiks, vieta, pārdevējs, izcelsme. */
  sale: ArchiveKv[];
  /** Stāvoklis un dokumenti (atslēgas, serviss, apskate, bojājumu deklarācija). */
  condition: ArchiveKv[];
  /** Tikai ja «Rādīt izsoļu cenas». */
  prices: ArchiveKv[];
  keys: number | null;
  /** true - izsole norādīja bojājumus; false - skaidri norādīja, ka nav; null - nav zināms. */
  damagesDeclared: boolean | null;
  lastServiceKm: number | null;
};

const REPORT_LV: [RegExp, string][] = [
  [/external.?damage/i, "Ārējo bojājumu atskaite"],
  [/basic.?inspection|inspectionbase|documentbaseinspection/i, "Pamata tehniskās pārbaudes atskaite"],
  [/technical/i, "Tehniskās pārbaudes atskaite"],
  [/condition|zustand/i, "Stāvokļa atskaite"],
  [/service|maintenance/i, "Servisa izraksts"],
];

function reportLv(raw: string): string {
  for (const [re, lv] of REPORT_LV) if (re.test(raw)) return lv;
  return "";
}

/**
 * Openlane «CountryMessages» - anketas jautājums (`description`) + atbilde (`value`) ar mašīnlasāmu `name`.
 * PDF rāda tikai atbildi kā datu rindu; jautājumu bez atbildes nerāda (Nils 23.11).
 */
export function archiveCountryMessages(r: ThecarapiAdminRecord): Map<string, string> {
  const names = new Map<string, string>();
  const values = new Map<string, string>();
  for (const f of r.fields) {
    const m = /CountryMessages\[(\d+)\]\.(name|value)$/.exec(f.key);
    if (!m) continue;
    const v = clean(f.value);
    if (!v) continue;
    (m[2] === "name" ? names : values).set(m[1]!, v);
  }
  const out = new Map<string, string>();
  for (const [i, name] of names) {
    const v = values.get(i);
    const k = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (v && !out.has(k)) out.set(k, v);
  }
  return out;
}

const DAMAGE_STATE_LV: Record<string, string> = { normal: "Normāls", good: "Labs", damaged: "Bojāts", heavydamage: "Smagi bojāts" };

export function auctionArchiveLotFacts(r: ThecarapiAdminRecord, opts: { showPrices?: boolean } = {}): ArchiveLotFacts {
  const g = archiveFieldGetter(r);
  const country = archiveCountry(g.exact("country_code", "car_country_extended", "car_identification.BCAListing.country") || g.tail("locationcountry", "country"));
  const locRaw = g.tail("lblphysicallocationvalue", "location", "city");
  const location = locRaw.replace(/\s*\(\[?[a-z]{2}\]?\)\s*$/i, "").trim();
  const lotNo = g.exact("auction_id", "source_auction_id", "vehicle_id");

  const sale: ArchiveKv[] = [];
  const start = g.exact("batch_start_date", "car_identification.BCAListing.start_at") || g.tail("startat");
  const end = g.exact("auction_end_at", "car_identification.BCAListing.end_at", "batch_end_date") || g.tail("endat", "lotendat");
  const startS = start ? archiveDateTime(start) : "";
  const endS = end ? archiveDateTime(end) : "";
  if (startS && endS && startS !== endS) sale.push({ k: "Izsoles laiks", v: `${startS} - ${endS}` });
  else if (endS) sale.push({ k: "Izsoles beigas", v: endS });
  // Valsts ir izsoles virsrakstā - rindu rāda tikai ar konkrētu vietu.
  if (location) sale.push({ k: "Auto atrašanās vieta", v: [location, country].filter(Boolean).join(", ") });
  const seller = g.tail("sellerbranding", "sellername", "seller");
  if (seller && !/^\d+$/.test(seller)) sale.push({ k: "Pārdevējs", v: seller });
  const origin = lookup(ORIGIN_LV, g.tail("vehiclesource", "origin", "sellertype"));
  if (origin) sale.push({ k: "Auto izcelsme", v: cap(origin) });
  const sellerCity = g.tail("sellermainaddressmunicipality");
  if (sellerCity && sellerCity.toLowerCase() !== location.toLowerCase()) sale.push({ k: "Pārdevēja atrašanās vieta", v: [sellerCity, country].filter(Boolean).join(", ") });
  const score = num(g.tail("globalscore") || g.exact("seller_score"));
  if (score != null && score > 0 && score <= 5) sale.push({ k: "Pārdevēja vērtējums", v: `${String(score).replace(".", ",")} no 5` });
  const asDescribed = num(g.tail("vehicleasdescribed"));
  if (asDescribed != null && asDescribed > 0 && asDescribed <= 5) sale.push({ k: "Auto atbilst aprakstam (pircēju vērtējums)", v: `${asDescribed} no 5` });
  const msgs = archiveCountryMessages(r);
  const delay = msgs.get("deliverydelay");
  if (delay && /^\d{1,3}(\s*-\s*\d{1,3})?$/.test(delay)) sale.push({ k: "Piegādes laiks pēc izsoles", v: `${delay.replace(/\s+/g, "")} dienas` });
  const firstSeen = g.exact("first_seen_at");
  if (firstSeen) sale.push({ k: "Pirmoreiz fiksēts arhīvā", v: archiveDateTime(firstSeen) });
  const lastAvail = g.exact("last_available_at", "last_seen_at");
  if (lastAvail && archiveDateTime(lastAvail) !== archiveDateTime(firstSeen)) sale.push({ k: "Pēdējoreiz redzēts portālā", v: archiveDateTime(lastAvail) });
  const views = num(g.tail("nbrviews"));
  if (views != null && views > 0) sale.push({ k: "Skatījumi izsolē", v: fmtInt(views) });
  if (lotNo) sale.push({ k: "Izsoles Nr.", v: lotNo });

  const condition: ArchiveKv[] = [];
  const keys = num(g.tail("numberofkeys", "keys"));
  if (keys != null) condition.push({ k: "Atslēgas", v: String(keys) });
  const driving = yesNo(g.tail("isdriving"));
  if (driving != null) condition.push({ k: "Auto brauc", v: driving ? "Jā" : "Nē", alert: !driving });
  const dmgState = DAMAGE_STATE_LV[g.exact("public_damage_state").toLowerCase().replace(/[^a-z]/g, "")];
  if (dmgState) condition.push({ k: "Virsbūves stāvoklis (izsoles vērtējums)", v: dmgState, alert: /Bojāts/.test(dmgState) });
  const dmgFlag = yesNo(g.tail("hasdamages"));
  if (dmgFlag != null) condition.push({ k: "Bojājumi izsoles datos", v: dmgFlag ? "Norādīti" : "Nav norādīti", alert: dmgFlag });
  // Citu platformu stāvokļa lauki (Copart, BCA, Openlane v1, AUTO1) - avota teksts, bez interpretācijas.
  const primaryDmg = g.tail("primarydamage");
  if (primaryDmg) condition.push({ k: "Galvenais bojājums", v: cap(primaryDmg.toLowerCase()), alert: true });
  const secondaryDmg = g.tail("secondarydamage");
  if (secondaryDmg) condition.push({ k: "Papildu bojājums", v: cap(secondaryDmg.toLowerCase()), alert: true });
  const runDrive = yesNo(g.tail("runanddrive", "rundrive"));
  if (runDrive != null) condition.push({ k: "Iedarbojas un brauc", v: runDrive ? "Jā" : "Nē", alert: !runDrive });
  const title = g.tail("titletype", "saletitle");
  if (title) condition.push({ k: "Dokumentu statuss (izsoles dati)", v: title, alert: /salvage|avārij|damage|parts/i.test(title) });
  const isDamaged = yesNo(g.tail("isdamaged"));
  if (isDamaged === true && dmgFlag !== true) condition.push({ k: "Bojājumi izsoles datos", v: "Norādīti", alert: true });
  const techIssues = yesNo(g.tail("hastechnicalissues"));
  const techText = g.tail("technicalissues");
  if (techText && !/^(jā|nē|yes|no|true|false)$/i.test(techText)) condition.push({ k: "Tehniskas problēmas", v: techText, alert: true });
  else if (techIssues != null) condition.push({ k: "Tehniskas problēmas", v: techIssues ? "Norādītas" : "Nav norādītas", alert: techIssues });
  const grade = g.tail("conditiongrade");
  if (grade) condition.push({ k: "Stāvokļa vērtējums (izsoles skala)", v: grade });
  const accidents = g.tail("accidents", "hadaccident");
  const accYn = yesNo(accidents);
  if (accYn != null) condition.push({ k: "Negadījumi (pārdevēja dati)", v: accYn ? "Bija" : "Nav norādīti", alert: accYn });
  const nonSmoker = yesNo(g.tail("nonsmoker"));
  if (nonSmoker != null) condition.push({ k: "Nesmēķētāja auto", v: nonSmoker ? "Jā" : "Nē" });
  const extraWheels = yesNo(g.tail("hasextrawheelsset"));
  if (extraWheels != null) condition.push({ k: "Otrs riepu komplekts", v: extraWheels ? "Ir" : "Nav" });
  const svcPresent = yesNo(g.tail("servicehistorypresent"));
  const maint = yesNo(g.tail("hasmaintenancerecord"));
  const logBook = yesNo(g.tail("logbookpresent", "servicebook"));
  const svcDate = archiveDay(g.tail("lasthistoryservicedate", "lastservicedate"));
  const svcKm = num(g.tail("lasthistoryserviceodometer", "lastservicemileage", "lastserviceodometer"));
  const svcAny = svcPresent ?? maint;
  if (svcAny != null || logBook != null) {
    const parts = [svcAny === true || logBook === true ? "ir" : "nav norādīta"];
    if (logBook === true) parts.push("servisa grāmata ir");
    condition.push({ k: "Servisa vēsture", v: cap(parts.join(", ")) });
  }
  if (svcDate || svcKm) condition.push({ k: "Pēdējais serviss", v: [svcDate, svcKm ? `${fmtInt(svcKm)} km` : ""].filter(Boolean).join(", ") });
  const mot = archiveDay(g.tail("motdate", "nextinspection", "inspectiondue"));
  if (mot) condition.push({ k: "Tehniskās apskates termiņš", v: mot });
  const odo = yesNo(g.tail("odometerwarranty"));
  if (odo != null) condition.push({ k: "Nobraukuma garantija", v: odo ? "Jā (pārdevējs apliecina)" : "Nē" });
  const hasDmg = yesNo(g.tail("hasdamages"));
  const damagedSale = yesNo(g.tail("damagedsale"));
  const damagesDeclared = hasDmg ?? (damagedSale === true ? true : damagedSale === false ? false : null);
  const techDmg = yesNo(g.tail("hastechnicaldamage"));
  if (techDmg != null) condition.push({ k: "Tehniski bojājumi", v: techDmg ? "Ir (pēc izsoles datiem)" : "Nav norādīti", alert: techDmg });
  const broken = yesNo(g.tail("isbroken"));
  if (broken === true) condition.push({ k: "Nav braucams", v: "Jā (pēc izsoles datiem)", alert: true });
  const reimp = yesNo(g.tail("iscarreimported", "imported"));
  if (reimp != null) condition.push({ k: "Ievests no citas valsts", v: reimp ? "Jā" : "Nē" });
  // Dokumenti: tikai skaidra anketas atbilde (Openlane skaitliskie kodi «2» ir pretrunīgi - COC «2» ar atbildi «NO»,
  // reģ. dokumenti «2» ar atbildi «Yes»), tāpēc kodus neinterpretē.
  // Kods «0» = nav (vienīgais viennozīmīgais); citus kodus neinterpretē.
  const zeroCode = (raw: string): boolean | null => (num(raw) === 0 ? false : null);
  const regDocs = yesNo(msgs.get("isregdocavailable") ?? "") ?? zeroCode(g.tail("registrationdocsavailable"));
  if (regDocs != null) condition.push({ k: "Reģistrācijas dokumenti", v: regDocs ? "Ir" : "Nav", alert: !regDocs });
  const coc = yesNo(msgs.get("iscocavailable") ?? "") ?? zeroCode(g.tail("cocavailable"));
  if (coc != null) condition.push({ k: "COC atbilstības sertifikāts", v: coc ? "Ir" : "Nav" });
  const docsWithCar = yesNo(msgs.get("isdocdeliverywithcar") ?? "");
  if (docsWithCar != null) condition.push({ k: "Dokumenti tiek nodoti kopā ar auto", v: docsWithCar ? "Jā" : "Nē" });
  const reports = new Set<string>();
  for (const f of r.fields) {
    if (/(reports|inspection_?reports|InspectionReports|Documents|documents)\[\d+\]\.(title|type|label)$/.test(f.key)) {
      const lv = reportLv(f.value);
      if (lv) reports.add(lv);
    }
  }
  if (reports.size) condition.push({ k: "Pārbaudes atskaites", v: [...reports].join(", ") });

  const prices: ArchiveKv[] = [];
  if (opts.showPrices) {
    const eur = (...keys: string[]) => {
      const n = num(g.exact(...keys));
      return n && n > 0 ? n : null;
    };
    const startP = eur("start_price", "car_identification.BCAListing.starting_bid");
    const reserve = eur("car_identification.BCAListing.reserve_price", "reserve_price");
    const sp = thecarapiSalePriceFromFields(r.fields);
    const lastBid = eur("current_price");
    if (startP) prices.push({ k: "Sākuma cena", v: fmtEur(startP) });
    if (reserve) prices.push({ k: "Minimālā (rezerves) cena", v: fmtEur(reserve) });
    // Pēdējais solījums tikai, ja tas atšķiras no noslēguma cenas (citādi tas pats skaitlis divreiz).
    if (lastBid && (sp.eur == null || Math.round(lastBid) !== Math.round(sp.eur))) prices.push({ k: "Pēdējais solījums", v: fmtEur(lastBid) });
    if (sp.eur != null) prices.push({ k: "Noslēguma cena", v: fmtEur(sp.eur) });
    const estimate = eur("estimated_value_eur");
    if (estimate) prices.push({ k: "Portāla aplēstā vērtība (nav pirkšanas cena)", v: fmtEur(estimate) });
    const buyerFee = num(g.tail("buyerfeenet"));
    if (buyerFee) prices.push({ k: "Pircēja komisija", v: `${fmtEur(buyerFee)} + PVN` });
    const exportFee = num(g.tail("exportfeenet"));
    if (exportFee) prices.push({ k: "Eksporta maksa", v: `${fmtEur(exportFee)} + PVN` });
    const vatType = g.tail("vattype");
    const vatPct = num(g.tail("vatpercent"));
    const margin = yesNo(g.exact("is_margin"));
    if (/qualif|deductible|net/i.test(vatType)) prices.push({ k: "PVN", v: `Atskaitāms${vatPct ? ` (${fmtInt(vatPct)} %)` : ""}` });
    else if (/margin/i.test(vatType) || margin === true) prices.push({ k: "PVN", v: "Peļņas daļas režīms (nav atskaitāms)" });
  }

  return { country, location, lotNo, sale, condition, prices, keys, damagesDeclared, lastServiceKm: svcKm };
}

/* ---------- galvenie fakti (salīdzinājums starp izsolēm) ---------- */

export type ArchiveFinding = { text: string; alert?: boolean };

export function auctionArchiveKeyFindings(
  lots: readonly { platform: string; date: string; km: number | null; facts: ArchiveLotFacts; damageCount: number }[],
): ArchiveFinding[] {
  const out: ArchiveFinding[] = [];
  const withKm = lots.filter((l) => l.km != null);
  if (withKm.length >= 2) {
    const kms = withKm.map((l) => l.km!);
    const decreasing = kms.some((k, i) => i > 0 && k < kms[i - 1]!);
    if (new Set(kms).size === 1) out.push({ text: `Nobraukums visās izsolēs vienāds - ${fmtInt(kms[0]!)} km.` });
    else if (decreasing)
      out.push({ text: `Nobraukums vēlākā izsolē ir MAZĀKS nekā agrākā (${kms.map((k) => `${fmtInt(k)} km`).join(" → ")}) - pārbaudiet odometru.`, alert: true });
    else out.push({ text: `Nobraukums pieaug hronoloģiski: ${kms.map((k) => `${fmtInt(k)} km`).join(" → ")}.` });
  } else if (withKm.length === 1) {
    out.push({ text: `Nobraukums izsolē (${withKm[0]!.platform}, ${archiveDay(withKm[0]!.date)}): ${fmtInt(withKm[0]!.km!)} km.` });
  }
  const byDay = new Map<string, string[]>();
  for (const l of lots) if (l.date) byDay.set(l.date, [...(byDay.get(l.date) ?? []), l.platform]);
  for (const [day, platforms] of byDay) {
    if (platforms.length > 1) out.push({ text: `${archiveDay(day)} auto vienlaikus piedāvāts ${platforms.length} izsoļu portālos (${platforms.join(", ")}).` });
  }
  const keyed = lots.filter((l) => l.facts.keys != null);
  if (keyed.length >= 2 && new Set(keyed.map((l) => l.facts.keys)).size > 1) {
    out.push({ text: `Atslēgu skaits izsolēs atšķiras: ${keyed.map((l) => `${l.platform} - ${l.facts.keys}`).join(", ")}.`, alert: true });
  }
  const dmg = lots.reduce((s, l) => s + l.damageCount, 0);
  if (dmg > 0) out.push({ text: `Izsolēs norādīti ${dmg} bojājumi - skatīt bojājumu kartītes un bildes.`, alert: true });
  else if (lots.length && lots.every((l) => l.facts.damagesDeclared !== true))
    out.push({ text: "Neviena izsole bojājumus nenorādīja. Virsbūves stāvokli vērtējiet pēc bildēm." });
  const svc = lots.find((l) => l.facts.lastServiceKm != null && l.km != null);
  if (svc && svc.km! >= svc.facts.lastServiceKm!) {
    out.push({ text: `Pēdējais serviss (${svc.platform} dati) ${fmtInt(svc.km! - svc.facts.lastServiceKm!)} km pirms izsoles.` });
  }
  return out;
}
