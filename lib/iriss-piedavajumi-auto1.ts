/**
 * j70: Auto1 detaļu lapa (releja `POST /listings/detail`) -> 5 kompakti bloki piedāvājumam (maketi 05/06).
 * Bold/nemainīgās etiķetes latviski, mainīgās vērtības paliek kā avotā (Nila brief 26.10).
 * Tīra loģika: ievade ir releja atbilde, izvade - bloku dati. Nekas netiek tulkots ar AI.
 */

import type { IrissRelayAuctionDetail } from "@/lib/iriss-auction-detail";

export type IrissPdKv = { label: string; value: string };

export const IRISS_PD_PAINT_ZONES = ["front", "roof", "rear", "left", "right"] as const;
export type IrissPdPaintZoneId = (typeof IRISS_PD_PAINT_ZONES)[number];

export const IRISS_PD_PAINT_ZONE_LV: Record<IrissPdPaintZoneId, string> = {
  front: "Priekšpuse",
  roof: "Jumts",
  rear: "Aizmugure",
  left: "Kreisā puse",
  right: "Labā puse",
};

/** Pārkrāsots, ja slānis ≥ 250 µm (Auto1 «Repaint: Thickness ≥250µm»). */
export const IRISS_PD_REPAINT_UM = 250;

export type IrissPdPaintZone = { id: IrissPdPaintZoneId; readings: number[]; warning: boolean };

export type IrissPdDamageRow = {
  area: "exterior" | "interior" | "other";
  damage: string;
  severity: string;
  description: string;
  quantity: string;
  parts: string;
};

export type IrissPdEquipmentRow = { name: string; detail: string };

export type IrissPdAuto1Blocks = {
  paint: { zones: IrissPdPaintZone[]; unassigned: number[] } | null;
  tech: IrissPdKv[];
  equipment: IrissPdEquipmentRow[];
  service: IrissPdKv[];
  inspection: IrissPdKv[];
  damage: IrissPdDamageRow[];
  vinData: string[];
};

export const IRISS_PD_DAMAGE_AREA_LV: Record<IrissPdDamageRow["area"], string> = {
  exterior: "Ārpuse",
  interior: "Salons",
  other: "Cits",
};

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

const clean = (s: unknown): string =>
  typeof s === "string" ? s.replace(/\s+/g, " ").trim() : typeof s === "number" && Number.isFinite(s) ? String(s) : "";

/** Tehniskie dati: Auto1 etiķete (normalizēta) -> LV. Secība kā Auto1 lapā. */
const TECH_LABELS: Array<[string, string]> = [
  ["buildyear", "Izlaiduma gads"],
  ["firstregistration", "Pirmā reģistrācija"],
  ["odometerreading", "Odometra rādījums"],
  ["fueltype", "Degvielas tips"],
  ["horsepower", "Jauda"],
  ["cylindercapacity", "Tilpums"],
  ["gearbox", "Ātrumkārba"],
  ["inspectionexpires", "TA līdz"],
  ["bodytype", "Virsbūves tips"],
  ["totalnumberofowners", "Īpašnieku skaits"],
  ["keys", "Atslēgas"],
  ["priordamage", "Iepriekšējie bojājumi / avārija (pēc iepr. īpašnieka)"],
  ["countryoforigin", "Izcelsmes valsts"],
  ["countryoflastregistration", "Pēdējās reģ. valsts"],
  ["environmentalclass", "Vides klase"],
  ["cocpapers", "COC dokumenti"],
  ["seats", "Sēdvietas"],
  ["color", "Krāsa"],
  ["upholstery", "Salons"],
  ["doorcount", "Durvju skaits"],
  ["co2emissions", "CO2 izmeši"],
];

const SERVICE_LABELS: Array<[string, string]> = [
  ["servicebookdetails", "Servisa grāmata"],
  ["serviceappointment", "Servisa apmeklējumi"],
  ["lastserviceon", "Pēdējais serviss"],
  ["lastservicemileage", "Pēdējā servisa km"],
  ["drivebeltchangeon", "Siksnas maiņa"],
  ["drivebeltchangemileage", "Siksnas maiņas km"],
];

const INSPECTION_LABELS: Array<[string, string]> = [
  ["dateoflatesttechnicalinspection", "Pēdējās TA datums"],
  ["mileageatlatesttechnicalinspection", "Nobraukums pēdējā TA"],
];

/** Auto1 «CAR EQUIPMENT» kategorijas -> LV (bold). Nezināmās paliek kā avotā. */
const EQUIPMENT_LV: Record<string, string> = {
  towbar: "Āķis",
  xenonlights: "Ksenona lukturi",
  ledlights: "LED lukturi",
  heatedseats: "Sēdekļu apsilde",
  parkdistancecontrol: "Parkošanās sensori",
  powersteering: "Stūres pastiprinātājs",
  handsfreesystem: "Brīvroku sistēma",
  navigationsystem: "Navigācija",
  airbag: "Drošības spilveni",
  acsystem: "Kondicionieris",
  dpffap: "DPF / FAP",
  powerwindows: "Elektriskie logi",
  esp: "ESP",
  immobilizer: "Imobilaizers",
  allwheeldrive: "Pilnpiedziņa",
  onboardcomputer: "Borta dators",
  entertainmentsystem: "Audio sistēma",
  abs: "ABS",
  cruisecontrol: "Kruīza kontrole",
  leatherseats: "Ādas sēdekļi",
  sunroof: "Lūka",
  panoramicroof: "Panorāmas jumts",
  alloywheels: "Vieglmetāla diski",
  rearviewcamera: "Atpakaļskata kamera",
  auxiliaryheating: "Papildapsilde",
  startstop: "Start-Stop",
  centrallocking: "Centrālā atslēga",
  electricmirrors: "Elektriskie spoguļi",
  rainsensor: "Lietus sensors",
  lightsensor: "Gaismas sensors",
  multifunctionsteeringwheel: "Daudzfunkciju stūre",
  bluetooth: "Bluetooth",
};

export function irissPdEquipmentLv(name: string): string {
  return EQUIPMENT_LV[norm(name)] ?? clean(name);
}

function pickKv(fields: ReadonlyArray<[string, string]>, labels: ReadonlyArray<[string, string]>): IrissPdKv[] {
  const out: IrissPdKv[] = [];
  for (const [key, lv] of labels) {
    const hit = fields.find(([l]) => {
      const n = norm(l);
      return n === key || (key === "priordamage" && n.startsWith(key));
    });
    if (!hit) continue;
    const value = clean(hit[1]);
    if (value) out.push({ label: lv, value });
  }
  return out;
}

const DAMAGE_COLS: Array<[keyof Omit<IrissPdDamageRow, "area"> | "area", RegExp]> = [
  ["area", /^(area|zone|zona|bereich)$/],
  ["damage", /^(damage|bojajums|schaden)$/],
  ["severity", /^(severity|nopietniba|schwere)$/],
  ["description", /^(description|apraksts|beschreibung)$/],
  ["quantity", /^(quantity|daudzums|anzahl|qty)$/],
  ["parts", /^(partsaffected|parts|ietekmetasdalas|betroffeneteile)$/],
];

function damageArea(raw: string): IrissPdDamageRow["area"] {
  const n = norm(raw);
  if (/^(exterior|arpuse|aussen|exterieur)/.test(n)) return "exterior";
  if (/^(interior|salons|innen|interieur)/.test(n)) return "interior";
  return "other";
}

/** DAMAGE SUMMARY tabula. Apvienotās šūnas (rowspan) relejā pazūd - trūkstošās ir rindas sākumā. */
export function parseIrissPdDamageTable(tables: ReadonlyArray<ReadonlyArray<ReadonlyArray<string>>>): IrissPdDamageRow[] {
  for (const table of tables) {
    const head = (table[0] ?? []).map((c) => norm(clean(c)));
    const idx = DAMAGE_COLS.map(([, re]) => head.findIndex((h) => re.test(h)));
    if (idx[0] < 0 || idx[1] < 0) continue;
    const width = head.length;
    const out: IrissPdDamageRow[] = [];
    let area: IrissPdDamageRow["area"] = "other";
    let damage = "";
    for (const rawRow of table.slice(1, 120)) {
      const cells = rawRow.map(clean);
      if (cells.every((c) => !c)) continue;
      const row = cells.length < width ? [...Array(width - cells.length).fill(""), ...cells] : cells.slice(0, width);
      const at = (i: number) => (i >= 0 ? (row[i] ?? "") : "");
      if (at(idx[0])) area = damageArea(at(idx[0]));
      if (at(idx[1])) damage = at(idx[1]);
      out.push({
        area,
        damage,
        severity: at(idx[2]),
        description: at(idx[3]),
        quantity: at(idx[4]),
        parts: at(idx[5]),
      });
    }
    if (out.length) return out;
  }
  return [];
}

const ZONE_WORDS: Array<[IrissPdPaintZoneId, RegExp]> = [
  ["left", /\b(left|kreis|links)\b/i],
  ["right", /\b(right|lab|rechts)\b/i],
  ["roof", /\b(roof|jumt|dach)\b/i],
  ["rear", /\b(rear|tailgate|trunk|boot|aizmug|heck)\b/i],
  ["front", /\b(front|hood|bonnet|priek|motorhaube|windscreen)\b/i],
];

/**
 * Detaļa -> krāsas kartes zona. Sānu daļas (durvis, spārni) pieder sānam, ne priekšai/aizmugurei:
 * «Front left fender» = kreisā puse, «Front bumper» = priekšpuse.
 */
export function irissPdPaintZoneOf(part: string): IrissPdPaintZoneId | null {
  const t = part.toLowerCase();
  const side = /\b(door|fender|wing|sill|pillar|mirror|quarter|durv|sparn)/i.test(t);
  if (side || /\b(left|right)\s+body\b/i.test(t)) {
    if (/\b(left|kreis|links)\b/i.test(t)) return "left";
    if (/\b(right|lab|rechts)\b/i.test(t)) return "right";
  }
  for (const [zone, re] of ZONE_WORDS) {
    if (zone === "left" || zone === "right") continue;
    if (re.test(t)) return zone;
  }
  if (/\b(left|kreis|links)\b/i.test(t)) return "left";
  if (/\b(right|lab|rechts)\b/i.test(t)) return "right";
  return null;
}

const UM_RE = /(\d{2,4})\s*(?:µm|μm|um|mikr)/i;

function umOf(raw: string): number | null {
  const m = clean(raw).match(UM_RE);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 20 && n <= 3000 ? n : null;
}

/** Krāsas biezums: DOM lauki «Front body: 276 µm», JSON grupas {area/position, thickness}, teksts kā rezerve. */
function parsePaint(detail: IrissRelayAuctionDetail, damage: IrissPdDamageRow[]): IrissPdAuto1Blocks["paint"] {
  const zones = new Map<IrissPdPaintZoneId, IrissPdPaintZone>(
    IRISS_PD_PAINT_ZONES.map((id) => [id, { id, readings: [], warning: false }]),
  );
  let assigned = 0;
  for (const [label, value] of detail.fields ?? []) {
    const um = umOf(value);
    const zone = um != null ? irissPdPaintZoneOf(label) : null;
    if (um != null && zone) {
      zones.get(zone)!.readings.push(um);
      assigned += 1;
    }
  }
  const groups = new Map<string, { zone: IrissPdPaintZoneId | null; um: number | null }>();
  for (const [p, v] of detail.jsonFields ?? []) {
    if (!/paint|thickness|layer|coating/i.test(p)) continue;
    const m = p.match(/^(.*\[\d+\])\.([^.]+)$/);
    if (!m) continue;
    const g = groups.get(m[1]) ?? { zone: null, um: null };
    const key = m[2].toLowerCase();
    if (/thick|value|micro|um$|layer/.test(key)) {
      const n = Number(String(v).replace(",", "."));
      if (Number.isFinite(n) && n >= 20 && n <= 3000) g.um = Math.round(n);
    } else if (/area|position|part|zone|name|label|location/.test(key)) {
      g.zone = irissPdPaintZoneOf(String(v)) ?? g.zone;
    }
    groups.set(m[1], g);
  }
  for (const g of groups.values()) {
    if (g.zone && g.um != null) {
      zones.get(g.zone)!.readings.push(g.um);
      assigned += 1;
    }
  }
  const unassigned: number[] = [];
  if (assigned === 0 && detail.text) {
    const re = new RegExp(UM_RE.source, "gi");
    for (const m of detail.text.matchAll(re)) {
      const n = Number(m[1]);
      if (n >= 20 && n <= 3000 && unassigned.length < 40) unassigned.push(n);
    }
  }
  for (const row of damage) {
    if (row.area !== "exterior") continue;
    for (const part of row.parts.split(/,\s*/)) {
      const zone = irissPdPaintZoneOf(part);
      if (zone) zones.get(zone)!.warning = true;
    }
  }
  const list = [...zones.values()];
  if (assigned === 0 && unassigned.length === 0 && !list.some((z) => z.warning)) return null;
  return { zones: list, unassigned };
}

function parseEquipment(detail: IrissRelayAuctionDetail): IrissPdEquipmentRow[] {
  const out: IrissPdEquipmentRow[] = [];
  const seen = new Set<string>();
  const add = (name: string, d: string) => {
    const k = norm(name);
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push({ name: irissPdEquipmentLv(name), detail: clean(d) });
  };
  for (const [label, value] of detail.fields ?? []) {
    if (EQUIPMENT_LV[norm(label)]) add(label, value);
  }
  for (const l of detail.lists ?? []) {
    if (!/equipment|aprikojum|ausstattung/i.test(norm(l.heading)) || /identification|vin/i.test(l.heading)) continue;
    for (const item of l.items.slice(0, 80)) {
      const t = clean(item);
      // «Towbar Detachable tow hitch» -> kategorija + apraksts (īsākais vārdu sākums, kas ir zināma kategorija).
      const words = t.split(" ");
      let split = 0;
      for (let i = 1; i <= Math.min(words.length, 4); i += 1) {
        if (EQUIPMENT_LV[norm(words.slice(0, i).join(" "))]) {
          split = i;
          break;
        }
      }
      if (split > 0) add(words.slice(0, split).join(" "), words.slice(split).join(" ").replace(/^[:\s-]+/, ""));
      else if (t) add(t, "");
    }
  }
  return out.slice(0, 80);
}

function parseVinData(detail: IrissRelayAuctionDetail): string[] {
  // Nils 30.10: pēc «Show more +» tas pats saraksts var būt divreiz - ņem garāko (pilno).
  let best: string[] = [];
  for (const l of detail.lists ?? []) {
    if (!/according to (the )?(identification number|vin)|car data/i.test(l.heading)) continue;
    const items = l.items.map(clean).filter(Boolean);
    if (items.length > best.length) best = items;
  }
  return best.slice(0, 200);
}

export function irissPdAuto1BlocksFromDetail(detail: IrissRelayAuctionDetail): IrissPdAuto1Blocks {
  const fields = (detail.fields ?? []).map(([l, v]) => [clean(l).replace(/:$/, ""), clean(v)] as [string, string]);
  const damage = parseIrissPdDamageTable(detail.tables ?? []);
  return {
    paint: parsePaint({ ...detail, fields }, damage),
    tech: pickKv(fields, TECH_LABELS),
    equipment: parseEquipment({ ...detail, fields }),
    service: pickKv(fields, SERVICE_LABELS),
    inspection: pickKv(fields, INSPECTION_LABELS),
    damage,
    vinData: parseVinData(detail),
  };
}

/** Cik lauku ielasīts (vēsturei «Izveidots no Auto1 saites · 22 lauki»). */
export function irissPdAuto1FieldCount(b: IrissPdAuto1Blocks | null): number {
  if (!b) return 0;
  const paint = b.paint ? b.paint.zones.reduce((n, z) => n + z.readings.length, 0) + b.paint.unassigned.length : 0;
  return paint + b.tech.length + b.equipment.length + b.service.length + b.inspection.length + b.damage.length + b.vinData.length;
}

export function irissPdAuto1BlockCount(b: IrissPdAuto1Blocks | null, id: "paint" | "tech" | "equipment" | "damage" | "vin"): number {
  if (!b) return 0;
  if (id === "paint") return b.paint ? b.paint.zones.reduce((n, z) => n + z.readings.length, 0) + b.paint.unassigned.length : 0;
  if (id === "tech") return b.tech.length;
  if (id === "equipment") return b.equipment.length + b.service.length + b.inspection.length;
  if (id === "damage") return b.damage.length;
  return b.vinData.length;
}

/** Bojājumu kopsavilkums īsi (priekšskatījums): zona -> bojājumu veidi + kopējais daudzums. */
export function irissPdDamageSummary(rows: readonly IrissPdDamageRow[]): Array<{ area: IrissPdDamageRow["area"]; kinds: string[]; total: number }> {
  const by = new Map<IrissPdDamageRow["area"], { kinds: string[]; total: number }>();
  for (const r of rows) {
    const cur = by.get(r.area) ?? { kinds: [], total: 0 };
    const kind = r.damage.split(",")[0]!.trim();
    if (kind && !cur.kinds.includes(kind)) cur.kinds.push(kind);
    const q = Number.parseInt(r.quantity, 10);
    cur.total += Number.isFinite(q) ? q : 0;
    by.set(r.area, cur);
  }
  return [...by.entries()].map(([area, v]) => ({ area, ...v }));
}

/* ---- Normalizēšana lasot (JSON krātuve) ---- */

function str(v: unknown, max = 400): string {
  return clean(v).slice(0, max);
}

function kvList(raw: unknown, max: number): IrissPdKv[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, max)
    .map((r) => (r && typeof r === "object" ? { label: str((r as IrissPdKv).label, 120), value: str((r as IrissPdKv).value, 400) } : null))
    .filter((r): r is IrissPdKv => Boolean(r && r.label && r.value));
}

export function normalizeIrissPdAuto1Blocks(raw: unknown): IrissPdAuto1Blocks | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  let paint: IrissPdAuto1Blocks["paint"] = null;
  if (o.paint && typeof o.paint === "object") {
    const p = o.paint as Record<string, unknown>;
    const zonesRaw = Array.isArray(p.zones) ? p.zones : [];
    const zones = IRISS_PD_PAINT_ZONES.map((id) => {
      const z = zonesRaw.find((x) => x && typeof x === "object" && (x as IrissPdPaintZone).id === id) as IrissPdPaintZone | undefined;
      const readings = Array.isArray(z?.readings) ? z!.readings.filter((n) => typeof n === "number" && Number.isFinite(n)).slice(0, 12) : [];
      return { id, readings, warning: z?.warning === true };
    });
    const unassigned = Array.isArray(p.unassigned) ? p.unassigned.filter((n): n is number => typeof n === "number" && Number.isFinite(n)).slice(0, 40) : [];
    paint = { zones, unassigned };
  }
  const damage: IrissPdDamageRow[] = Array.isArray(o.damage)
    ? o.damage.slice(0, 120).flatMap((r) => {
        if (!r || typeof r !== "object") return [];
        const d = r as Record<string, unknown>;
        const area = d.area === "exterior" || d.area === "interior" ? d.area : "other";
        return [{ area, damage: str(d.damage), severity: str(d.severity), description: str(d.description), quantity: str(d.quantity, 12), parts: str(d.parts, 800) }];
      })
    : [];
  const equipment: IrissPdEquipmentRow[] = Array.isArray(o.equipment)
    ? o.equipment.slice(0, 80).flatMap((r) => {
        if (!r || typeof r !== "object") return [];
        const e = r as Record<string, unknown>;
        const name = str(e.name, 120);
        return name ? [{ name, detail: str(e.detail) }] : [];
      })
    : [];
  return {
    paint,
    tech: kvList(o.tech, 60),
    equipment,
    service: kvList(o.service, 20),
    inspection: kvList(o.inspection, 20),
    damage,
    vinData: Array.isArray(o.vinData) ? o.vinData.map((x) => str(x, 200)).filter(Boolean).slice(0, 200) : [],
  };
}

/* ---- j75: kompakts kopsavilkums redaktorā (pilnā atskaite zemāk) ---- */

function kvValue(rows: readonly IrissPdKv[], label: string): string {
  return rows.find((r) => r.label === label)?.value ?? "";
}

function damageTotal(rows: readonly IrissPdDamageRow[], area: IrissPdDamageRow["area"]): number | null {
  const own = rows.filter((r) => r.area === area);
  if (!own.length) return null;
  return own.reduce((n, r) => {
    const q = Number.parseInt(r.quantity, 10);
    return n + (Number.isFinite(q) && q > 0 ? q : 1);
  }, 0);
}

const WARNING_RE = /warning|kontroll|control lamp|error|fehler|kļūd/i;

/**
 * Maketa «Auto1 dati» kartīte: 2 kolonnas (auto / bojājumi). Tikai rindas ar datiem.
 */
export function irissPdAuto1Brief(b: IrissPdAuto1Blocks | null): { car: IrissPdKv[]; damage: IrissPdKv[] } {
  if (!b) return { car: [], damage: [] };
  const service = [kvValue(b.service, "Servisa grāmata"), kvValue(b.service, "Pēdējais serviss")].filter(Boolean).join(" · ");
  const car: IrissPdKv[] = [
    { label: "Jauda", value: kvValue(b.tech, "Jauda") },
    { label: "Pēdējā TA", value: kvValue(b.inspection, "Pēdējās TA datums") || kvValue(b.tech, "TA līdz") },
    { label: "Serviss", value: service },
  ].filter((r) => r.value);
  const ext = damageTotal(b.damage, "exterior");
  const int = damageTotal(b.damage, "interior");
  const warnings = b.damage.filter((r) => WARNING_RE.test(`${r.damage} ${r.description}`)).length;
  const repainted = b.paint ? b.paint.zones.filter((z) => z.warning).length : 0;
  const damage: IrissPdKv[] = [
    ...(ext != null ? [{ label: "Bojājumi ārpusē", value: String(ext) }] : []),
    ...(int != null ? [{ label: "Salonā", value: String(int) }] : []),
    ...(warnings ? [{ label: "Kļūdas paziņojumi", value: String(warnings) }] : []),
    ...(repainted ? [{ label: "Pārkrāsotas zonas", value: String(repainted) }] : []),
  ];
  return { car, damage };
}
