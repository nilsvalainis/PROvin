/**
 * e.csdd maksas izziņa (1,50 € ar SMS): lapu atpazīšana un teksta formatēšana bez pārlūka.
 * Tīras funkcijas; testi: lib/ecsdd-paid.test.ts repo saknē.
 *
 * Nila ceļš (CSDD lietotne / e.csdd telefonā, 23.11.2026):
 *  1. `tadati` rezultāts -> poga "Pieprasīt maksas izziņu"
 *  2. "Vai vēlaties nosūtīt maksas īsziņu EUR 1,50 ..." -> poga "Sagatavot īsziņu" = saite `sms:<numurs>...body=CSDD <konta kods> <numurs>`
 *     Relejs saiti tikai NOLASA (nekad nespiež, nekad nesūta SMS, nekad nemaksā).
 *  3. Izvēlne -> Maksas Izziņas -> "Apmaksātās izziņas": "Atjaunot sarakstu", tabula Reģistrācijas nr | Statuss | Datums
 *  4. Izziņa: akordeoni (Aizliegumi, Būtiski bojājumi CSNg, Reģistrācijas dati, ..., Tehnisko apskašu vēsture),
 *     poga "Nosūtīt uz reģistrēto epastu" (relejs nespiež).
 * Datorā šīs sadaļas var nebūt redzamas - relejs mēģina arī ar iPhone UA + 390 px skatu (tikai šiem soļiem).
 * Lapas pēc pieteikšanās nav redzētas no servera - atpazīšana pēc teksta, nevis klasēm.
 */

const fold = (t) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const PAID_REQUEST_RE = /piepras[iī]t\s+maksas\s+izzi[ņn]u/i;
export const PAID_PREPARE_SMS_RE = /sagatavot\s+[iī]szi[ņn]u/i;
export const PAID_LIST_LINK_RE = /apmaks[aā]t[aā]s\s+izzi[ņn]as/i;
export const PAID_MENU_RE = /^\s*maksas\s+izzi[ņn]as\s*$/i;
export const PAID_REFRESH_RE = /atjaunot\s+sarakstu/i;
/** Pogas, ko relejs nekad nespiež izziņas lapās. */
export const PAID_FORBIDDEN_RE = /nos[uū]t[iī]t|e-?past|sagatavot\s+[iī]szi|dz[eē]st|anul|apmaks[aā]t(?!\p{L})|samaks|^\s*iziet\s*$/iu;

/** Izziņas akordeonu virsraksti (secība kā lietotnē). */
export const PAID_REPORT_TITLES = [
  "Aizliegumi",
  "Būtiski bojājumi CSNg",
  "Reģistrācijas dati",
  "Transportlīdzekļa reģistrācija",
  "Transportlīdzekļa ekspluatācijas nodoklis",
  "Uzņēmuma vieglo transportlīdzekļu nodokļa likme",
  "Civiltiesiskā apdrošināšana",
  "Nobraukuma vēsture",
  "Pēdējā tehniskā apskate",
  "Tehnisko apskašu vēsture",
];
const TITLE_FOLDED = new Set(PAID_REPORT_TITLES.map(fold));

export function isPaidReportTitle(text) {
  return TITLE_FOLDED.has(fold(text).replace(/:$/, ""));
}

/**
 * `sms:` saite -> { number, body }. Formāti: `sms:1888?body=..`, `sms:1888&body=..`, `sms://1888;?&body=..`,
 * `sms:+3711888?body=..`. Atgriež null, ja nav numura vai teksta.
 */
export function parseSmsHref(href) {
  const raw = String(href ?? "").trim();
  const m = raw.match(/^sms:(?:\/\/)?([^?&;]*)[;]?[?&]?(.*)$/i);
  if (!m) return null;
  const number = decodeURIComponent(m[1] || "").replace(/[\s()-]/g, "");
  if (!/^\+?\d{3,15}$/.test(number)) return null;
  let body = "";
  for (const part of String(m[2] || "").split("&")) {
    const [k, ...v] = part.split("=");
    if (/^body$/i.test(k.replace(/^\?/, ""))) {
      try {
        body = decodeURIComponent(v.join("=").replace(/\+/g, " "));
      } catch {
        body = v.join("=");
      }
    }
  }
  body = body.replace(/\s+/g, " ").trim();
  if (!body) return null;
  return { number, body };
}

/** Vai SMS teksts ir CSDD maksas izziņas pieprasījums tieši šim numuram ("CSDD <kods> <numurs>"). */
export function smsBodyMatchesPlate(body, plate) {
  const p = String(plate ?? "").toUpperCase().replace(/[\s-]/g, "");
  const m = String(body ?? "").trim().toUpperCase().match(/^CSDD\s+\d{1,10}\s+([A-Z0-9-]{2,10})$/);
  return Boolean(m && p && m[1].replace(/-/g, "") === p);
}

/** Lapas "Vai vēlaties nosūtīt maksas īsziņu EUR 1,50 ... transportlīdzekli X ar valsts reģistrācijas numuru AB1234?" dati. */
export function parsePaidConfirmText(text) {
  const t = String(text ?? "").replace(/\s+/g, " ");
  const price = t.match(/maksas\s+[iī]szi[ņn]u\s+EUR\s*([\d]+[.,]\d{2})/i)?.[1]?.replace(".", ",") ?? "";
  const m = t.match(/transportl[iī]dzekli\s+(.{2,80}?)\s+ar\s+valsts\s+re[gģ]istr[aā]cijas\s+numuru\s+([A-Z0-9-]{2,10})\s*\?/i);
  return { price, vehicle: m?.[1]?.trim() ?? "", plate: (m?.[2] ?? "").toUpperCase().replace(/-/g, "") };
}

/** Visas `sms:` saites lapas HTML/atribūtos (pogai var būt href, onclick vai data-*). */
export function findSmsHrefs(html) {
  const out = [];
  const re = /sms:(?:\/\/)?\+?[\d\s()-]{3,20}[^"'<>\s]*/gi;
  for (const m of String(html ?? "").matchAll(re)) {
    const v = m[0].replace(/&amp;/g, "&");
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

/**
 * Lapas veids maksas izziņas plūsmā (pēc teksta):
 * paid_confirm | paid_list | paid_report | tadati_with_paid | unknown
 */
export function classifyPaidPage(snap) {
  const text = String(snap?.text ?? "");
  const controls = [...(snap?.buttons ?? []), ...(snap?.links ?? [])].map((b) => String(b.text ?? ""));
  if (/maksas\s+[iī]szi[ņn]u\s+EUR/i.test(text) || controls.some((c) => PAID_PREPARE_SMS_RE.test(c))) return "paid_confirm";
  if (/atgriezties\s+uz\s+izzi[ņn]u\s+sarakstu/i.test(text) || controls.some((c) => /nos[uū]t[iī]t\s+uz\s+re[gģ]istr[eē]to\s+e-?pastu/i.test(c)))
    return "paid_report";
  if (controls.some((c) => PAID_REFRESH_RE.test(c)) || (/re[gģ]istr[aā]cijas\s+nr/i.test(text) && /apmaks[aā]ts/i.test(text))) return "paid_list";
  if (controls.some((c) => PAID_REQUEST_RE.test(c))) return "tadati_with_paid";
  return "unknown";
}

/** "23.11.2026 15:31:52" (Rīga) -> ISO UTC. Bez laika - dienas sākums Rīgā. */
export function rigaDateTimeToIso(text) {
  const m = String(text ?? "").match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return "";
  const [, d, mo, y, h = "0", mi = "0", s = "0"] = m;
  const local = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  // Rīgas nobīde tajā brīdī (UTC+2 / UTC+3).
  const probe = new Date(local);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(probe);
  const g = (t) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asRiga = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  const offset = asRiga - local;
  return new Date(local - offset).toISOString();
}

/**
 * "Apmaksātās izziņas" tabulas rindas (šūnu teksti) -> [{ plate, status, paidAt, dateText, index }].
 * Galvenes rinda un tukšās rindas izlaistas. Kolonnas atpazīst pēc satura (numurs, statuss, datums).
 */
export function parsePaidListRows(rows) {
  const out = [];
  (rows ?? []).forEach((cells, index) => {
    const c = (cells ?? []).map((x) => String(x ?? "").replace(/\s+/g, " ").trim()).filter(Boolean);
    if (c.length < 2) return;
    if (c.some((x) => /^re[gģ]istr[aā]cijas\s+nr/i.test(x))) return;
    const dateText = c.find((x) => /\d{2}\.\d{2}\.\d{4}/.test(x)) ?? "";
    const plateCell = c.find((x) => x !== dateText && /^[A-Z0-9-]{2,10}$/i.test(x) && /[A-Z]/i.test(x)) ?? "";
    if (!plateCell || !dateText) return;
    const status = c.find((x) => x !== dateText && x !== plateCell) ?? "";
    out.push({ plate: plateCell.toUpperCase().replace(/-/g, ""), status, paidAt: rigaDateTimeToIso(dateText), dateText, index });
  });
  return out;
}

/**
 * Jaunākā apmaksātā izziņa šim numuram, ne vecāka par `sinceIso` (mīnus 10 min rezerve pulksteņiem).
 * Bez `sinceIso` - jaunākā jebkura. null, ja nav.
 */
export function pickPaidReport(list, plate, sinceIso = "") {
  const p = String(plate ?? "").toUpperCase().replace(/[\s-]/g, "");
  const since = sinceIso ? Date.parse(sinceIso) - 10 * 60_000 : Number.NEGATIVE_INFINITY;
  const hits = (list ?? [])
    .filter((r) => r.plate === p && !/neapmaks|atcel|kļūd|kluda|gaida/i.test(r.status))
    .filter((r) => !r.paidAt || Date.parse(r.paidAt) >= since)
    .sort((a, b) => Date.parse(b.paidAt || 0) - Date.parse(a.paidAt || 0));
  return hits[0] ?? null;
}

/** Tālruņi, personu vārdi pie "tel.", CSDD konta kods SMS tekstā -> `***`. */
export function redactPaidText(text) {
  return String(text ?? "")
    .replace(/(ZTI|policij\w*|iecirk\w*|registr[eē]ja|re[gģ]istr[eē]ja)(\s*:?\s*)([A-ZĀČĒĢĪĶĻŅŠŪŽ][\p{L}-]+(?:\s+[A-ZĀČĒĢĪĶĻŅŠŪŽ][\p{L}-]+){1,2})(?=\s*[.,]?\s*(?:tel|t\.|$))/gmu, "$1$2***")
    .replace(/\b(tel\.?|t\.|tālr\.?|talr\.?)\s*\+?\d[\d\s-]{6,14}\d/gi, "$1 ***")
    .replace(/(?<![\p{L}\d.,])(?:\+371\s?)?[26]\d{7}(?![\p{L}\d.,])/gu, "***")
    .replace(/\bCSDD\s+\d{2,10}\b/g, "CSDD ***")
    .replace(/sms:[^\s"'<>]+/gi, "sms:***");
}

/** Personu rindas (īpašnieks, adrese, personas kods) -> `Etiķete ***` (tāpat kā tadati). */
const PERSON_LINE_RE =
  /^(\s*)(Īpašnieks|Ipasnieks|Turētājs|Turetajs|Valdītājs|Lietotājs|Pilnvarotā\s+persona|Pilnvarotais|Adrese|Deklarētā\s+adrese|Personas\s+kods|Vārds,?\s+uzvārds)\b(?!\s*(skaits|maiņ|main))(.*)$/i;

const MILEAGE_KM_RE = /^\d{3,7}$/;
const DATE_RE = /^\d{2}\.\d{2}\.\d{4}$/;

/** Viena tabulas rinda -> teksta rinda tādā formā, kādu dod e.csdd PDF (pēc normalizācijas). */
function rowToLine(cells) {
  const c = cells.map((x) => String(x ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim()).filter((x, i, a) => x || i < a.length - 1);
  const nonEmpty = c.filter(Boolean);
  if (!nonEmpty.length) return "";
  // Nobraukums: "366058" | "22.11.2024" (vai "- 22.11.2024") -> "366058- 22.11.2024" (kā PDF).
  if (nonEmpty.length === 2 && MILEAGE_KM_RE.test(nonEmpty[0].replace(/\s/g, ""))) {
    const d = nonEmpty[1].replace(/^[-–]\s*/, "");
    if (DATE_RE.test(d)) return `${nonEmpty[0].replace(/\s/g, "")}- ${d}`;
  }
  const one = nonEmpty.join(" ");
  const m = one.match(/^(\d{3,7})\s*[-–]\s*(\d{2}\.\d{2}\.\d{4})$/);
  if (m) return `${m[1]}- ${m[2]}`;
  return one;
}

/**
 * Izziņas akordeoni [{ title, rows: [[šūna, ...]], lines?: [teksts] }] -> teksts CSDD blokam tādā pašā formā kā
 * e.csdd maksas PDF teksts ("Reģistrācijas dati\nReģistrācijas numurs AB1234\n..."), ko saprot esošais parsers
 * (csdd-pdf-ingest / csdd-paste-parse). Personu dati -> `***`.
 */
export function formatPaidReportPanels(panels, footer = "", redact = (t) => t) {
  const out = [];
  for (const p of panels ?? []) {
    const title = String(p?.title ?? "").replace(/\s+/g, " ").trim().replace(/:$/, "");
    const rows = [];
    for (const r of p?.rows ?? []) {
      const line = rowToLine(r ?? []);
      if (line && line !== title) rows.push(line);
    }
    for (const l of p?.lines ?? []) {
      const line = String(l ?? "").replace(/\s+/g, " ").trim();
      if (line && line !== title) rows.push(line);
    }
    if (!title && !rows.length) continue;
    if (title) out.push(title);
    out.push(...rows);
  }
  if (!out.length) return "";
  const foot = String(footer ?? "").replace(/\s+/g, " ").trim();
  if (foot) out.push(foot);
  const lines = out.map((l) => {
    const m = l.match(PERSON_LINE_RE);
    return m && m[4].trim() ? `${m[1]}${m[2]} ***` : l;
  });
  return redact(redactPaidText(lines.join("\n"))).slice(0, 80_000);
}

/** Vai izziņas teksts ir pietiekami pilns (citādi jāatver akordeoni / jāmēģina vēlreiz). */
export function paidReportLooksComplete(text) {
  const t = String(text ?? "");
  const hasReg = /re[gģ]istr[aā]cijas\s+numurs/i.test(t) && /\bVIN\b/.test(t);
  const hasHistory = /nobraukuma\s+v[eē]sture/i.test(t) || /apskat/i.test(t);
  return hasReg && hasHistory;
}

/** "Informācija sagatavota elektroniski 22.11.2026 12:49:40. ..." lapas tekstā. */
export function findPreparedFooter(text) {
  return String(text ?? "").match(/Inform[aā]cija\s+sagatavota\s+elektroniski[^\n]{0,160}/i)?.[0]?.trim() ?? "";
}

export const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
