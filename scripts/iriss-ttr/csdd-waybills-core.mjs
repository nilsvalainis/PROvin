// CSDD TTR pavadzīmju stāvoklis pa numuriem (bez pārlūka), testi: lib/iriss-waybill-csdd-sync.test.ts.
// Avots ir CSDD reģistrs (arī Nila ar roku izrakstītās pavadzīmes), nevis mūsu ieraksti.
// Pavadzīmes kartīte (kā Aivara lookup-p02779.js): "Pavadzīmes numurs: P02806" ... "Statuss: Derīgs" ... datumi dd.mm.yyyy hh:mm.

import { parseRigaDate } from "./waybill-scripts-core.mjs";

export const DEALER_PLATES = Object.freeze({ "B193-7": 1, "B762-7": 1, "B192-7": 2 });
/** Cik secīgus neatrastus numurus pēc lielākā zināmā pārbauda (Nils var izrakstīt ar roku vairākas pēc kārtas). */
export const PROBE_MISSES = 3;
/** Augšējā robeža kartīšu atvēršanai vienā sinhronizācijā (CSDD slodze). */
export const MAX_LOOKUPS = 24;

const WAYBILL_NO_RE = /\bP\d{5,6}\b/g;

export function compactPlate(plate) {
  return String(plate || "").toUpperCase().replace(/[\s-]/g, "");
}

/** "B1937" / "b193-7" -> "B193-7" (tikai mūsu tirdzniecības numuri). */
export function dealerPlate(raw) {
  const c = compactPlate(raw);
  return Object.keys(DEALER_PLATES).find((p) => compactPlate(p) === c) || "";
}

export function platesForCtx(ctx) {
  return Object.keys(DEALER_PLATES).filter((p) => DEALER_PLATES[p] === Number(ctx));
}

/** Visi P-numuri tekstā (unikāli, augošā secībā). */
export function waybillNumbersIn(text) {
  const all = String(text || "").toUpperCase().match(WAYBILL_NO_RE) || [];
  return [...new Set(all)].sort(compareWaybillNo);
}

function seq(no) {
  const m = /^P(\d{5,6})$/.exec(String(no || "").toUpperCase());
  return m ? { n: Number(m[1]), width: m[1].length } : null;
}

export function compareWaybillNo(a, b) {
  return (seq(a)?.n ?? -1) - (seq(b)?.n ?? -1);
}

export function maxWaybillNo(list) {
  return [...list].filter((x) => seq(x)).sort(compareWaybillNo).pop() || "";
}

/** P02812 -> P02813 (tas pats platums). */
export function nextWaybillNo(no, step = 1) {
  const s = seq(no);
  if (!s) return "";
  return `P${String(s.n + step).padStart(s.width, "0")}`;
}

/** Statuss "Derīgs" (ne "Nederīgs", ne "Pārtraukts"/"Anulēts"/"Beidzies"). */
export function isActiveStatus(status) {
  const s = String(status || "").trim();
  return /^der[iī]g/i.test(s) && !/p[aā]rtrauk|anul|beidz|nederīg/i.test(s);
}

/**
 * Visi datumi kartītē (Rīgas laiks) -> {ms, dateOnly}. Laiks var būt aiz datuma ar atstarpi, komatu, "plkst." vai lauka
 * vērtībā (p1Card): "25.10.2026 07:35", "25.10.2026, plkst. 07:35". Bez laika - dienas beigas (dateOnly).
 */
function datesIn(text) {
  const out = [];
  const re = /\b(\d{2}\.\d{2}\.\d{4})(?:\.?[^\d\n]{0,16}?\b(\d{1,2})[:.](\d{2})\b(?!\.\d))?/g;
  for (const m of String(text || "").matchAll(re)) {
    const timed = Boolean(m[2]) && Number(m[2]) < 24 && Number(m[3]) < 60;
    const ms = parseRigaDate(`${m[1]} ${timed ? m[2].padStart(2, "0") : "23"}:${timed ? m[3] : "59"}`);
    if (Number.isFinite(ms)) out.push({ ms, dateOnly: !timed });
  }
  return out;
}

function latest(dates) {
  return dates.reduce((a, b) => (!a || b.ms > a.ms ? b : a), null);
}

function field(text, labelRe) {
  const m = new RegExp(`${labelRe.source}\\s*[:.]?\\s*([^\\n]+)`, "i").exec(String(text || ""));
  return m ? m[1].trim() : "";
}

/**
 * Pavadzīmes kartīte -> {waybillNo, status, active, plate, validUntil, vin, brandModel}. null, ja tā nav šī numura kartīte.
 * Derīguma beigas: lauks "Derīga līdz" / "Derīguma termiņš" (ja ir), citādi vēlākais datums kartītē (izdošana ir agrāk).
 */
export function parseWaybillDetail(text, expectedNo = "") {
  const t = String(text || "");
  const m = /Pavadz[iī]mes\s+(?:numurs|nr\.?)\s*:?\s*(P\d{5,6})/i.exec(t);
  if (!m) return null;
  const waybillNo = m[1].toUpperCase();
  if (expectedNo && waybillNo !== String(expectedNo).toUpperCase()) return null;
  const status = field(t, /Statuss/);
  const untilField = field(t, /(?:Der[iī]g[a-zāē]*\s+l[iī]dz|Der[iī]guma\s+(?:termi[nņ][sš]|beigas))/);
  const until = latest(datesIn(untilField)) || latest(datesIn(t));
  // Numurzīme: vispirms pie lauka "Tirdzniecības numurs" / "Numura zīme", citādi pirmā tāda formas zīme kartītē.
  const plateField = field(t, /(?:Tirdzniec[iī]bas\s+numurs|Numura\s+z[iī]me|Reģistrācijas\s+numurs)/).toUpperCase();
  const plateM = /\b([A-Z]\d{3})\s?-\s?(\d)\b/.exec(plateField) || /\b([A-Z]\d{3})\s?-\s?(\d)\b/.exec(t.toUpperCase());
  const vinM = /\b([A-HJ-NPR-Z0-9]{17})\b/.exec(t.toUpperCase());
  const brandModel = field(t, /(?:Marka(?:,?\s*modelis)?|Transportl[iī]dzek[lļ]a\s+marka)/).slice(0, 80);
  return {
    waybillNo,
    status: status.slice(0, 40),
    active: isActiveStatus(status),
    plate: plateM ? `${plateM[1]}-${plateM[2]}` : "",
    validUntil: until ? new Date(until.ms).toISOString() : "",
    // Tikai datums (laiks nav nolasīts): beigas = dienas beigas, salīdzināšanā pielaide līdz dienai.
    validUntilDateOnly: Boolean(until && until.dateOnly),
    vin: vinM ? vinM[1] : "",
    brandModel,
  };
}

/** Vai pavadzīme šobrīd aizņem numuru: derīga un (beigas nav zināmas vai vēl nav pienākušas). */
export function occupiesPlate(detail, nowMs) {
  if (!detail || !detail.active) return false;
  const until = Date.parse(detail.validUntil);
  return !Number.isFinite(until) || until > nowMs;
}

/**
 * Kuras kartītes atvērt: numuri no sarakstiem (rindas ar mūsu numuriem) un iepriekš zināmie.
 * Secīgi pēc lielākā zināmā numura (Nila ar roku izrakstītās) meklē collectActiveWaybills.
 * @param {{ listRows?: string[], plates?: string[], known?: string[] }} args
 * @returns {{ candidates: string[], maxSeen: string }}
 */
export function lookupCandidates({ listRows = [], plates = [], known = [] }) {
  const want = new Set(plates.map(compactPlate));
  const fromRows = [];
  const seen = [];
  for (const row of listRows) {
    const nums = waybillNumbersIn(row);
    seen.push(...nums);
    const rowPlates = (String(row).toUpperCase().match(/\b[A-Z]\d{3}\s?-\s?\d\b/g) || []).map(compactPlate);
    if (rowPlates.some((p) => want.has(p))) fromRows.push(...nums);
  }
  const all = [...new Set([...seen, ...known.filter((n) => seq(n))])];
  return {
    candidates: [...new Set([...fromRows, ...known.filter((n) => seq(n))])].sort(compareWaybillNo),
    maxSeen: maxWaybillNo(all),
  };
}

/**
 * @typedef {{ waybillNo: string, status: string, active: boolean, plate: string, validUntil: string, validUntilDateOnly?: boolean, vin: string, brandModel: string, lapvId?: string }} WaybillDetail
 * @typedef {{ waybillNo: string, validUntil: string, brandModel: string, vin: string, status: string }} ActiveWaybill
 */

/**
 * Viena CSDD sinhronizācija (lookup = numurs -> kartīte | null, tikai lasa).
 * Atgriež {ok, plates:{"B193-7":[...]}, maxNumber, checked}. ok:false, ja nav neviena atskaites punkta (nevar zināt).
 * @param {{ plates: string[], listRows?: string[], known?: string[], lookup: (no: string) => Promise<WaybillDetail | null>, nowMs?: number, maxLookups?: number }} args
 * @returns {Promise<{ ok: boolean, error?: string, plates: Record<string, ActiveWaybill[]>, maxNumber: string, checked: number, details?: Partial<WaybillDetail>[] }>}
 */
export async function collectActiveWaybills({ plates, listRows = [], known = [], lookup, nowMs = Date.now(), maxLookups = MAX_LOOKUPS }) {
  const { candidates, maxSeen } = lookupCandidates({ listRows, plates, known });
  if (!maxSeen) return { ok: false, error: "CSDD sarakstā nav neviena pavadzīmes numura - statusu nevar noteikt", plates: {}, maxNumber: "", checked: 0 };
  const details = new Map();
  let checked = 0;
  for (const no of candidates) {
    if (checked >= maxLookups) break;
    checked += 1;
    const d = await lookup(no);
    if (d) details.set(no, d);
  }
  // Secīgi pēc lielākā zināmā: līdz PROBE_MISSES neatrastiem pēc kārtas.
  let maxNumber = maxWaybillNo([maxSeen, ...details.keys()]);
  let misses = 0;
  let probe = nextWaybillNo(maxNumber);
  while (probe && misses < PROBE_MISSES && checked < maxLookups) {
    checked += 1;
    const d = details.get(probe) || (await lookup(probe));
    if (d) {
      details.set(probe, d);
      maxNumber = probe;
      misses = 0;
    } else {
      misses += 1;
    }
    probe = nextWaybillNo(probe);
  }
  /** @type {Record<string, ActiveWaybill[]>} */
  const out = {};
  for (const p of plates) out[p] = [];
  for (const d of details.values()) {
    const p = dealerPlate(d.plate);
    if (!p || !(p in out) || !occupiesPlate(d, nowMs)) continue;
    out[p].push({ waybillNo: d.waybillNo, validUntil: d.validUntil, brandModel: d.brandModel, vin: d.vin, status: d.status });
  }
  for (const p of Object.keys(out)) out[p].sort((a, b) => compareWaybillNo(a.waybillNo, b.waybillNo));
  // Visas atvērtās kartītes (pārbaudei ar roku, csdd-check.mjs); uz Vercel netiek sūtītas.
  const seen = [...details.values()].map((d) => ({ waybillNo: d.waybillNo, plate: d.plate, status: d.status, validUntil: d.validUntil, vin: d.vin }));
  return { ok: true, plates: out, maxNumber, checked, details: seen };
}

/**
 * Pēc Saglabāt numurs nav nolasīts: meklē jaunu pavadzīmi pēc numura, kas bija lielākais pirms saglabāšanas.
 * - {found:true, waybillNo}: jauna derīga pavadzīme uz šī numura ar to pašu VIN (ja abi zināmi) un derīgumu ~ now + validHours;
 * - {found:false, checked:true}: CSDD pēc beforeMax šim numuram jaunas pavadzīmes NAV (droši: nav izveidota);
 * - {found:false, checked:false}: nevar pateikt (nav atskaites punkta vai ir jauna, bet neatbilst) - cilvēkam jāpārbauda.
 * @param {{ input: { plate: string, vin?: string, validHours?: number }, beforeMax: string, lookup: (no: string) => Promise<WaybillDetail | null>, nowMs?: number, maxProbe?: number }} args
 * @returns {Promise<{ found: boolean, checked: boolean, waybillNo?: string }>}
 */
export async function findNewWaybillAfterSave({ input, beforeMax, lookup, nowMs = Date.now(), maxProbe = 6 }) {
  if (!seq(beforeMax)) return { found: false, checked: false };
  const plate = compactPlate(input.plate);
  const vin = String(input.vin || "").toUpperCase();
  const wantUntil = nowMs + Number(input.validHours || 0) * 3_600_000;
  let probe = nextWaybillNo(beforeMax);
  let misses = 0;
  let samePlate = 0;
  for (let i = 0; i < maxProbe && misses < 2; i++, probe = nextWaybillNo(probe)) {
    const d = await lookup(probe);
    if (!d) {
      misses += 1;
      continue;
    }
    misses = 0;
    if (compactPlate(d.plate) !== plate) continue;
    samePlate += 1;
    if (!occupiesPlate(d, nowMs)) continue;
    const vinOk = !vin || !d.vin || d.vin === vin;
    const until = Date.parse(d.validUntil);
    const slack = d.validUntilDateOnly ? 26 * 3_600_000 : 2 * 3_600_000;
    const hoursOk = !Number.isFinite(until) || Math.abs(until - wantUntil) <= slack;
    if (vinOk && hoursOk) return { found: true, waybillNo: d.waybillNo };
  }
  return samePlate ? { found: false, checked: false } : { found: false, checked: true };
}

/** CSDD kļūdas/brīdinājuma teksts lapā pēc Saglabāt (īss, bez personas datiem). */
export function csddMessageSnippet(text) {
  const lines = String(text || "")
    .split(/\n+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const hit = lines.find((l) => /aizņemt|aiznemt|jau\s+(ir|tiek)|kļūd|kluda|nav\s+iespējams|nevar|nepareiz|obligāt|neder/i.test(l));
  return hit ? hit.slice(0, 160) : "";
}
