/**
 * Reģistra tabulas -> PROVIN JSON `iriss-csdd-tirdzn-registrs/v1` (tā pati shēma, ko lieto Aivara rokas faili
 * un importētājs lib/iriss-autoparks-registry.ts) + `owner` un `snapshot` (pilns nolasījums).
 * Personas datus (vārds, personas kods, adrese, tālrunis) nekad neliek failā: tiek paņemtas tikai zināmās kolonnas.
 */

export const REGISTRY_SCHEMA_ID = "iriss-csdd-tirdzn-registrs/v1";

const VIN_RE = /\b[A-HJ-NPR-Z0-9]{11,17}\b/;

/** Kolonnas virsraksts -> lauks. Secība svarīga (akta nr. pirms reģ. nr.). */
const HEADER_RULES = [
  ["vin", /\bvin\b|identifikācijas|identifikacijas|šasij|sasij/],
  ["tradeActNo", /akt[as]?\b.*(nr|numur)|(nr|numur).*akt/],
  ["tradeActDate", /akt[as]?\b.*datum|pieņemš.*datum|pienems.*datum|pieņemts|pienemts/],
  ["make", /^marka$/],
  ["model", /^modelis$/],
  ["makeModel", /marka|modelis/],
  ["firstRegDate", /1\.?\s*reģ|1\.?\s*reg|pirmā|pirma|pirmreģ|izlaid/],
  ["odometerKm", /odometr|nobraukum/],
  ["vehicleType", /veids|kategorij/],
  ["fuel", /degviel|dzinēj.*tips|dzinej.*tips/],
  ["gearbox", /ātrumk|atrumk|transmisij/],
  ["status", /statuss|stāvoklis|stavoklis/],
  ["owner", /tirgotāj|tirgotaj|komersant|uzņēmum|uznemum|īpašniek|ipasniek|turētāj|turetaj|valdītāj|valditaj/],
];

/** @param {string} h */
export function normalizeHeader(h) {
  return String(h || "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Virsrakstu rinda -> kolonnu indeksi pa laukiem. Pirmā atbilstošā kolonna uzvar. */
export function mapHeaders(headers) {
  /** @type {Record<string, number>} */
  const out = {};
  headers.forEach((raw, i) => {
    const h = normalizeHeader(raw);
    if (!h) return;
    for (const [key, re] of HEADER_RULES) {
      if (re.test(h)) {
        if (out[key] === undefined) out[key] = i;
        break;
      }
    }
  });
  return out;
}

/** Firmas teksts no reģistra -> IRISS | DZA | undefined. Pats teksts failā nenonāk. */
export function ownerFromText(text) {
  const t = String(text || "").toUpperCase().replace(/\s+/g, " ");
  if (/DZINTARZEME/.test(t)) return "DZA";
  if (/ĪRISS|IRISS/.test(t)) return "IRISS";
  return undefined;
}

function cell(row, idx) {
  return idx === undefined ? "" : String(row[idx] ?? "").replace(/\s+/g, " ").trim();
}

function num(s) {
  const n = Number(String(s).replace(/[\s ]/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * Viena tabula -> auto saraksts. `defaultOwner` - ja tabulā nav firmas kolonnas (katrai firmai sava lapa).
 * @param {{ headers: string[], rows: string[][] }} table
 * @param {"IRISS" | "DZA" | undefined} defaultOwner
 */
export function tableToVehicles(table, defaultOwner) {
  const map = mapHeaders(table.headers);
  const out = [];
  for (const row of table.rows) {
    let vin = cell(row, map.vin).replace(/[\s-]/g, "").toUpperCase();
    if (!vin) vin = (row.join(" ").toUpperCase().match(VIN_RE) || [""])[0];
    if (vin.length < 11) continue;
    const owner = map.owner !== undefined ? ownerFromText(cell(row, map.owner)) ?? defaultOwner : defaultOwner;
    const makeModel = cell(row, map.makeModel) || [cell(row, map.make), cell(row, map.model)].filter(Boolean).join(" ");
    /** @type {Record<string, unknown>} */
    const v = { vin };
    if (owner) v.owner = owner;
    if (makeModel) v.makeModel = makeModel;
    const firstReg = cell(row, map.firstRegDate);
    if (firstReg) v.firstRegistrationDate = firstReg;
    const odo = num(cell(row, map.odometerKm));
    if (odo !== undefined && cell(row, map.odometerKm)) v.odometerKm = odo;
    for (const k of ["vehicleType", "fuel", "gearbox", "status"]) {
      const s = cell(row, map[k]);
      if (s) v[k] = s;
    }
    const actNo = cell(row, map.tradeActNo);
    const actDate = cell(row, map.tradeActDate);
    if (actNo || actDate) v.tradeAct = { ...(actNo ? { number: actNo } : {}), ...(actDate ? { date: actDate } : {}) };
    out.push(v);
  }
  return out;
}

/**
 * Visu lapu tabulas -> viens fails. Dublikāti pēc VIN apvienoti (vēlākā rinda papildina iepriekšējo).
 * @param {{ owner?: "IRISS" | "DZA", tables: { headers: string[], rows: string[][] }[] }[]} pages
 * @param {{ owners: ("IRISS" | "DZA")[], generatedAt: string }} meta
 */
export function buildRegistryFile(pages, meta) {
  /** @type {Map<string, Record<string, unknown>>} */
  const byVin = new Map();
  for (const page of pages) {
    for (const table of page.tables) {
      for (const v of tableToVehicles(table, page.owner)) {
        const prev = byVin.get(/** @type {string} */ (v.vin));
        byVin.set(/** @type {string} */ (v.vin), prev ? { ...prev, ...v } : v);
      }
    }
  }
  return {
    schema: REGISTRY_SCHEMA_ID,
    generatedAt: meta.generatedAt,
    snapshot: { complete: true, owners: [...meta.owners] },
    vehicles: [...byVin.values()],
  };
}

/** Skaiti atskaitei: pa firmām un statusiem. */
export function summarizeRegistryFile(file) {
  /** @type {Record<string, number>} */
  const byOwner = {};
  /** @type {Record<string, number>} */
  const byStatus = {};
  for (const v of file.vehicles) {
    const o = String(v.owner || "?");
    byOwner[o] = (byOwner[o] || 0) + 1;
    const s = String(v.status || "-");
    byStatus[s] = (byStatus[s] || 0) + 1;
  }
  return { total: file.vehicles.length, byOwner, byStatus };
}
