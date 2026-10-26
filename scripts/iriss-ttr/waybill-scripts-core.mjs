// refill.js / save.js loģika (bez Playwright), testi: lib/iriss-waybill-scripts.test.ts.
// STINGRI: tikai pavadzīmes aizpilde un saglabāšana (jauna vai no tirdzniecības akta "Noformēt pavadzīmi"). Nekādas pārtraukšanas, anulēšanas vai beigšanas:
// - pogas/saites ar tādu nozīmi netiek spiestas nekad (isClickAllowed), dialogi ar tādu tekstu tiek noraidīti;
// - tīklā pieprasījumi ar tādiem vārdiem adresē/saturā tiek pārtraukti (isRequestForbidden);
// - "Saglabāt" drīkst spiest tikai save.js, vienreiz uz darbu (atomisks ledger lock), nekad refill.js.

import fs from "node:fs";
import path from "node:path";

/** Pārtraukt / anulēt / beigt / dzēst / atcelt. Elementu ar tādu tekstu, value, id, name, title vai onclick nespiež nekad. */
export const FORBIDDEN_ACTION_RE =
  /p[aā]rtrauk|partrauk|anul|annul|beigt|beidz|termin[aā]t|terminat|dz[eē]s|delete|remove|cancel|atcel|nonem|noņem|izbeig|stop|pazi[nņ]ot|notify/i;

/** Tīklā: pieprasījums ar šiem vārdiem adresē vai saturā nekad netiek sūtīts. */
export const FORBIDDEN_REQUEST_RE = /p[aā]rtrauk|partrauk|anul|annul|termin[aā]t|terminat|izbeig|beigt/i;

/** Saglabāšanas nozīmes vadīklas. refill.js tās nespiež nekad; save.js - tikai vienu reizi. */
export const SAVE_ACTION_RE = /saglab|save|apstiprin|iesniegt|iesūt|iesut|submit|confirm/i;

/** Vienīgā poga pārtraukšanas fāzē (CSDD pavadzīmes kartīte -> lapv_par -> "Pārtraukt!"). */
export const ANNUL_BUTTON_RE = /^p[aā]rtraukt!?$/i;
/** Arī pārtraukšanas fāzē nekad: dzēšana, akta anulēšana u.c. */
export const ANNUL_NEVER_RE = /anul|annul|dz[eē]s|delete|remove|lapt_|pazi[nņ]ot|notify/i;

/** PDF/drukas vadīklas (tikai pēc saglabāšanas). */
export const PDF_ACTION_RE = /druk|pdf|lejupiel|izdruk|print|download/i;

const JOB_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
/** Tāpat kā serverī (WAYBILL_VALID_MAX_HOURS, CSDD max). */
const MAX_VALID_HOURS = 48;
const SAME_PLATE_WINDOW_MS = 30 * 60 * 1000;

function decodeSafe(s) {
  try {
    return decodeURIComponent(String(s).replace(/\+/g, " "));
  } catch {
    return String(s);
  }
}

/**
 * Vai elementu drīkst spiest dotajā fāzē.
 * @param {{ text?: string, value?: string, id?: string, name?: string, title?: string, ariaLabel?: string, onclick?: string, href?: string }} el
 * @param {"login" | "fill" | "save" | "pdf" | "annul"} phase
 */
export function isClickAllowed(el, phase) {
  const parts = [el.text, el.value, el.id, el.name, el.title, el.ariaLabel, el.onclick, el.href].filter(Boolean).join(" ");
  // Pārtraukšanas fāze (tikai annul.js, sk. ANNUL_BUTTON_RE): drīkst TIKAI CSDD pogu "Pārtraukt!", nekas cits.
  if (phase === "annul") {
    const label = String(el.text || el.value || "").trim();
    return ANNUL_BUTTON_RE.test(label) && !ANNUL_NEVER_RE.test(parts)
      ? { allowed: true, reason: "annul" }
      : { allowed: false, reason: "annul_phase_not_annul" };
  }
  if (FORBIDDEN_ACTION_RE.test(parts)) return { allowed: false, reason: "forbidden_label" };
  // Pieslēgšanās poga var saukties arī "Apstiprināt"; šajā fāzē cita klikšķa nav.
  if (phase === "login") return { allowed: true, reason: "login" };
  const isSave = SAVE_ACTION_RE.test(parts);
  if (phase === "save") return isSave ? { allowed: true, reason: "save" } : { allowed: false, reason: "save_phase_not_save" };
  if (phase === "pdf") return PDF_ACTION_RE.test(parts) && !isSave ? { allowed: true, reason: "pdf" } : { allowed: false, reason: "pdf_phase_not_pdf" };
  if (isSave) return { allowed: false, reason: "save_outside_save_phase" };
  return { allowed: true, reason: phase };
}

/**
 * Vai tīkla pieprasījums nedrīkst iziet (pārtraukšana/anulēšana adresē vai saturā).
 * Izņēmums tikai pārtraukšanas fāzē (annul.js) un tikai uz CSDD adresi (`allowAnnulOrigin`).
 */
export function isRequestForbidden(req, phase = "", allowAnnulOrigin = "") {
  const url = decodeSafe(req.url || "");
  const body = decodeSafe(req.postData || "");
  const hit = FORBIDDEN_REQUEST_RE.test(url) || FORBIDDEN_REQUEST_RE.test(body);
  if (!hit) return false;
  if (phase === "annul" && allowAnnulOrigin && url.startsWith(allowAnnulOrigin) && !/dz[eē]s|delete/i.test(`${url} ${body}`)) return false;
  return true;
}

/** Pārlūka dialogs: apstiprina tikai save fāzē un tikai, ja tekstā nav pārtraukšanas/anulēšanas; pārtraukšanas fāzē - CSDD apstiprinājumu. */
export function dialogDecision(message, phase) {
  if (phase === "annul") return /dz[eē]s|delete/i.test(String(message || "")) ? "dismiss" : "accept";
  if (FORBIDDEN_ACTION_RE.test(String(message || ""))) return "dismiss";
  return phase === "save" ? "accept" : "dismiss";
}

export function compactPlate(plate) {
  return String(plate || "").toUpperCase().replace(/[\s-]/g, "");
}

function normText(s) {
  return String(s || "").toLocaleLowerCase("lv").replace(/\s+/g, " ").trim();
}

/** IRISS_JOB_JSON -> pārbaudīts darbs. Met kļūdu, ja kaut kas trūkst (pirms jebkādas pārlūka darbības). */
export function parseJobInput(raw) {
  let j;
  try {
    j = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new Error("IRISS_JOB_JSON nav derīgs JSON");
  }
  if (!j || typeof j !== "object") throw new Error("IRISS_JOB_JSON trūkst");
  if (!JOB_ID_RE.test(String(j.jobId || ""))) throw new Error("jobId nederīgs");
  const plate = compactPlate(j.plate);
  if (!/^[A-Z]\d{3,4}\d$/.test(plate)) throw new Error("numurs nederīgs");
  const brandModel = String(j.brandModel || "").trim();
  if (!brandModel) throw new Error("nav auto");
  const validHours = Number(j.validHours);
  if (!Number.isInteger(validHours) || validHours <= 0 || validHours > MAX_VALID_HOURS) throw new Error("derīgums nederīgs");
  const from = Date.parse(j.validFrom);
  const until = Date.parse(j.validUntil);
  if (!Number.isFinite(from) || !Number.isFinite(until) || until <= from) throw new Error("datumi nederīgi");
  if (Math.abs((until - from) / 3_600_000 - validHours) > 0.5) throw new Error("datumi nesakrīt ar derīgumu");
  // Serveris sūta "ctx1"/"ctx2" (lib/iriss-waybill-auto.ts), vecāka ievade - 1/2.
  const ctx = Number(String(j.ctx ?? "").replace(/^ctx/i, ""));
  if (ctx !== 1 && ctx !== 2) throw new Error("ctx nederīgs");
  const flow = j.flow === "tradeAct" ? "tradeAct" : "new";
  const vin = String(j.vin || "").trim().toUpperCase();
  const representative = String(j.representative || "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (flow === "tradeAct" && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) throw new Error("aktam vajag VIN");
  if (flow === "tradeAct" && !representative) throw new Error("aktam vajag pārstāvi");
  return {
    jobId: String(j.jobId),
    plate: String(j.plate).trim(),
    brandModel,
    vin,
    company: String(j.company || ""),
    ctx,
    routeFrom: String(j.routeFrom || "").trim(),
    routeTo: String(j.routeTo || "").trim(),
    validFrom: new Date(from).toISOString(),
    validUntil: new Date(until).toISOString(),
    validHours,
    flow,
    representative: flow === "tradeAct" ? representative : "",
    preferTradeAct: flow === "tradeAct" || (Boolean(j.preferTradeAct) && Boolean(vin)),
    // Lietotājs apstiprināja: "anulēt iepriekšējo un izveidot jaunu" - TIKAI šis numurs (annul.js).
    replaceWaybillNo: /^P\d{5,6}$/.test(String(j.replaceWaybillNo || "").toUpperCase()) ? String(j.replaceWaybillNo).toUpperCase() : "",
    // Iepriekš zināmie CSDD numuri (sinhronizācija), lai pārbaudītu arī tos.
    knownWaybills: Array.isArray(j.knownWaybills) ? j.knownWaybills.map((x) => String(x).toUpperCase()).filter((x) => /^P\d{5,6}$/.test(x)).slice(0, 12) : [],
  };
}

/** sync.js ievade: {ctx, plates?, known?} -> šīs firmas numuri (tikai lasa CSDD). */
export function parseSyncInput(raw, platesForCtx) {
  let j;
  try {
    j = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new Error("IRISS_JOB_JSON nav derīgs JSON");
  }
  const ctx = Number(String(j?.ctx ?? "").replace(/^ctx/i, ""));
  if (ctx !== 1 && ctx !== 2) throw new Error("ctx nederīgs");
  const own = platesForCtx(ctx);
  const want = Array.isArray(j.plates) && j.plates.length ? j.plates.map(compactPlate) : own.map(compactPlate);
  const plates = own.filter((p) => want.includes(compactPlate(p)));
  if (!plates.length) throw new Error("nav numuru sinhronizācijai");
  const known = Array.isArray(j.known) ? j.known.map((x) => String(x).toUpperCase()).filter((x) => /^P\d{5,6}$/.test(x)).slice(0, 12) : [];
  const jobId = JOB_ID_RE.test(String(j.jobId || "")) ? String(j.jobId) : `sync-${ctx}`;
  return { jobId, ctx, plates, known, plate: plates[0], brandModel: "-", flow: "new", representative: "" };
}

/** Datums Rīgas laikā formā "dd.MM.yyyy HH:mm" (vai cits formāts ar tiem pašiem marķieriem). */
export function formatRigaDate(iso, format = "dd.MM.yyyy HH:mm") {
  const d = new Date(iso);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Riga",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return format
    .replace("yyyy", parts.year)
    .replace("MM", parts.month)
    .replace("dd", parts.day)
    .replace("HH", parts.hour)
    .replace("mm", parts.minute);
}

/** "dd.MM.yyyy HH:mm" Rīgas laikā -> ms (lai no formas datumiem aprēķinātu derīgumu). */
export function parseRigaDate(s) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(String(s || "").trim());
  if (!m) return Number.NaN;
  const [, dd, mm, yyyy, hh = "00", mi = "00"] = m;
  const guessUtc = Date.UTC(+yyyy, +mm - 1, +dd, +hh, +mi);
  // Rīgas nobīde (2 vai 3 h) konkrētajā brīdī.
  const shown = formatRigaDate(new Date(guessUtc).toISOString());
  const back = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})$/.exec(shown);
  const shownUtc = Date.UTC(+back[3], +back[2] - 1, +back[1], +back[4], +back[5]);
  return guessUtc - (shownUtc - guessUtc);
}

/** Vērtības, ko ievadīt formā. */
export function formValues(input, dateFormat) {
  return {
    plate: input.plate,
    brandModel: input.brandModel,
    vin: input.vin,
    routeFrom: input.routeFrom,
    routeTo: input.routeTo,
    validFrom: formatRigaDate(input.validFrom, dateFormat),
    validUntil: formatRigaDate(input.validUntil, dateFormat),
    validHours: String(input.validHours),
  };
}

/** No formas nolasītie lauki -> {plate, validHours, ...}. Derīgums no lauka vai no datumiem. */
export function normalizeFields(raw, mode) {
  const r = raw || {};
  let validHours = Number(String(r.validHours ?? "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(validHours) || validHours <= 0) {
    const from = parseRigaDate(r.validFrom);
    const until = parseRigaDate(r.validUntil);
    validHours = Number.isFinite(from) && Number.isFinite(until) ? Math.round((until - from) / 3_600_000) : 0;
  }
  return {
    plate: compactPlate(r.plate),
    validHours,
    brandModel: String(r.brandModel || "").trim(),
    vin: String(r.vin || "").trim().toUpperCase(),
    routeFrom: String(r.routeFrom || "").trim(),
    routeTo: String(r.routeTo || "").trim(),
    validFrom: String(r.validFrom || "").trim(),
    validUntil: String(r.validUntil || "").trim(),
    mode,
  };
}

/** Formā nolasītais pret darbu. Tukšs lauks (forma to nerāda) netiek salīdzināts, izņemot numuru un derīgumu. */
export function compareFields(input, fields) {
  const bad = [];
  if (fields.plate !== compactPlate(input.plate)) bad.push("plate");
  if (fields.validHours !== input.validHours) bad.push("validHours");
  if (fields.vin && input.vin && fields.vin !== input.vin) bad.push("vin");
  if (fields.brandModel && !normText(fields.brandModel).includes(normText(input.brandModel).split(" ")[0])) bad.push("brandModel");
  if (fields.routeFrom && input.routeFrom && normText(fields.routeFrom) !== normText(input.routeFrom)) bad.push("routeFrom");
  if (fields.routeTo && input.routeTo && normText(fields.routeTo) !== normText(input.routeTo)) bad.push("routeTo");
  return bad;
}

/** Pavadzīmes numurs no teksta pēc saglabāšanas. */
export function extractWaybillNo(text, re) {
  const rx = re || /pavadz[iī]m[eē]s?\s*(?:nr\.?|numurs)\s*[:.]?\s*([A-Z0-9][A-Z0-9/-]{2,})/i;
  const m = rx.exec(String(text || ""));
  return m ? m[1].trim() : "";
}

/**
 * Darbu žurnāls (idempotence). Viens fails uz darbu `<dir>/<jobId>.json` + atomisks lock `<jobId>.save.lock` (open "wx").
 * Stāvokļi: filled -> saving (clicked:false) -> saving (clicked:true) -> saved. Ja Saglabāt nospiests un rezultāts nav
 * zināms, lock paliek: atkārtota save.js atsakās (cilvēks pārbauda CSDD un dzēš lock).
 */
export function createLedger(dir, fsImpl = fs, now = () => Date.now()) {
  fsImpl.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = (id) => path.join(dir, `${id}.json`);
  const lock = (id) => path.join(dir, `${id}.save.lock`);
  const read = (id) => {
    try {
      return JSON.parse(fsImpl.readFileSync(file(id), "utf8"));
    } catch {
      return null;
    }
  };
  const write = (id, rec) => {
    const tmp = `${file(id)}.tmp`;
    fsImpl.writeFileSync(tmp, JSON.stringify({ ...rec, jobId: id, at: new Date(now()).toISOString() }), { mode: 0o600 });
    fsImpl.renameSync(tmp, file(id));
  };
  const hasLock = (id) => fsImpl.existsSync(lock(id));

  return {
    read,
    hasLock,
    markFilled(id, data) {
      const prev = read(id);
      if (prev && (prev.state === "saving" || prev.state === "saved")) throw new Error("darbs jau saglabāšanā");
      write(id, { ...data, state: "filled" });
    },
    /** Cits darbs ar to pašu numuru saglabāts pēdējās 30 min -> nesaglabājam (dublikāta aizsardzība). */
    recentSameplate(id, plate) {
      const want = compactPlate(plate);
      for (const name of fsImpl.readdirSync(dir)) {
        if (!name.endsWith(".json") || name.endsWith(".annul.json") || name === `${id}.json`) continue;
        const rec = read(name.slice(0, -5));
        if (!rec || compactPlate(rec.plate) !== want) continue;
        if (rec.state !== "saved" && !(rec.state === "saving" && rec.clicked)) continue;
        if (now() - Date.parse(rec.at) < SAME_PLATE_WINDOW_MS) return rec;
      }
      return null;
    },
    /** Atomiski: tikai viens save.js uz darbu. Met kļūdu, ja lock jau ir. */
    beginSave(id, data) {
      let fd;
      try {
        fd = fsImpl.openSync(lock(id), "wx", 0o600);
      } catch {
        throw new Error("saglabāšana šim darbam jau sākta");
      }
      fsImpl.writeSync(fd, String(now()));
      fsImpl.closeSync(fd);
      write(id, { ...(read(id) || {}), ...data, state: "saving", clicked: false });
    },
    /** Tieši pirms klikšķa uz Saglabāt (sinhroni uz diska). */
    markClicking(id) {
      write(id, { ...read(id), state: "saving", clicked: true });
    },
    markSaved(id, data) {
      write(id, { ...read(id), ...data, state: "saved" });
    },
    readAnnul(id) {
      try {
        return JSON.parse(fsImpl.readFileSync(path.join(dir, `${id}.annul.json`), "utf8"));
      } catch {
        return null;
      }
    },
    writeAnnul(id, rec) {
      const f = path.join(dir, `${id}.annul.json`);
      fsImpl.writeFileSync(`${f}.tmp`, JSON.stringify({ ...rec, jobId: id, at: new Date(now()).toISOString() }), { mode: 0o600 });
      fsImpl.renameSync(`${f}.tmp`, f);
    },
    /** Kļūda pirms klikšķa: drīkst mēģināt vēlreiz (lock noņem). Pēc klikšķa lock paliek. */
    abortSave(id, error) {
      const rec = read(id) || {};
      if (rec.clicked) {
        write(id, { ...rec, error });
        return;
      }
      write(id, { ...rec, state: "filled", error });
      try {
        fsImpl.unlinkSync(lock(id));
      } catch {
        // nav lock
      }
    },
  };
}

/**
 * Draivera līgums (waybill-driver.mjs vai adapteris uz main.js):
 *   open(input)                          pieslēdzas, izvēlas firmu (ctx), atgriež lapu darbam
 *   findActiveWaybill(input)  (neobl.)   TIKAI LASA: vai šim numuram jau ir aktīva pavadzīme -> {waybillNo} | null
 *   openFromTradeAct(input) -> boolean   akts pēc VIN -> "Noformēt pavadzīmi"; false, ja akta nav
 *   openNewWaybill(input)                "Jauna pavadzīme"
 *   fillForm(values)                     ievada laukus, NESPIEŽ Saglabāt
 *   readForm() -> raw lauki
 *   formMode() -> "trade_act" | "new" | "" (vai atvērta aizpildīta forma)
 *   clickSave()                          vienīgais Saglabāt klikšķis
 *   readWaybillNo() -> string
 *   downloadPdf(name) -> relatīvs ceļš | ""
 *   close({ keepPage })
 */
async function fillSteps(input, driver, dateFormat) {
  let mode = "new";
  if (input.preferTradeAct && (await driver.openFromTradeAct(input))) mode = "trade_act";
  // Pieņemtam auto nekad neveido jaunu pavadzīmi akta vietā.
  else if (input.flow === "tradeAct") throw new Error("tirdzniecības akts nav atrasts");
  else await driver.openNewWaybill(input);
  await driver.fillForm(formValues(input, dateFormat));
  return mode;
}

/** refill.js: aizpilda jaunu pavadzīmi, NESPIEŽ Saglabāt. */
export async function runRefill({ input, ledger, driver, dateFormat = undefined, log = () => {} }) {
  const prev = ledger.read(input.jobId);
  if (ledger.hasLock(input.jobId) || prev?.state === "saved") {
    return { ok: false, error: "darbs jau saglabāts vai saglabāšana sākta - vēlreiz nepildu" };
  }
  try {
    await driver.open(input);
    const active = driver.findActiveWaybill ? await driver.findActiveWaybill(input) : null;
    if (active) {
      return {
        ok: false,
        busy: { waybillNo: active.waybillNo || "", validUntil: active.validUntil || "" },
        error: `numuram jau ir aktīva pavadzīme ${active.waybillNo || ""}`.trim(),
      };
    }
    const mode = await fillSteps(input, driver, dateFormat);
    const fields = normalizeFields(await driver.readForm(), mode);
    const bad = compareFields(input, fields);
    if (bad.length) return { ok: false, error: `lauki nesakrīt: ${bad.join(", ")}`, fields };
    ledger.markFilled(input.jobId, { plate: input.plate, mode });
    log("filled", { jobId: input.jobId, mode });
    return { ok: true, fields };
  } finally {
    await driver.close({ keepPage: true }).catch(() => {});
  }
}

/** save.js: pārbauda formu (vajadzības gadījumā aizpilda vēlreiz), vienreiz spiež Saglabāt, nolasa numuru un PDF. */
export async function runSave({ input, ledger, driver, dateFormat = undefined, log = () => {} }) {
  const prev = ledger.read(input.jobId);
  if (prev?.state === "saved" && prev.waybillNo) {
    log("already_saved", { jobId: input.jobId, waybillNo: prev.waybillNo });
    return { ok: true, waybillNo: prev.waybillNo, pdfPath: prev.pdfPath || "", repeated: true };
  }
  const other = ledger.recentSameplate(input.jobId, input.plate);
  if (other) return { ok: false, error: `numuram nesen saglabāta cita pavadzīme (${other.jobId}) - pārbaudi CSDD` };
  try {
    ledger.beginSave(input.jobId, { plate: input.plate });
  } catch (err) {
    return { ok: false, error: `${err.message} - pārbaudi CSDD, vai pavadzīme izveidota` };
  }
  let clicked = false;
  let notCreated = false;
  try {
    await driver.open(input);
    const active = driver.findActiveWaybill ? await driver.findActiveWaybill(input) : null;
    if (active) throw new Error(`numuram jau ir aktīva pavadzīme ${active.waybillNo || ""}`.trim());
    let mode = await driver.formMode();
    let fields = normalizeFields(await driver.readForm(), mode);
    if (!mode || compareFields(input, fields).length) {
      mode = await fillSteps(input, driver, dateFormat);
      fields = normalizeFields(await driver.readForm(), mode);
    }
    const bad = compareFields(input, fields);
    if (bad.length) throw new Error(`lauki nesakrīt: ${bad.join(", ")}`);
    ledger.markClicking(input.jobId);
    clicked = true;
    await driver.clickSave();
    let waybillNo = await driver.readWaybillNo().catch(() => "");
    if (!waybillNo) {
      // Numurs lapā nav nolasīts (incidents 23.10): pārbauda CSDD pēc numuriem, vai jaunā pavadzīme tiešām ir.
      const v = driver.verifySavedWaybill ? await driver.verifySavedWaybill(input).catch(() => null) : null;
      log("save_verify", { jobId: input.jobId, found: Boolean(v?.found), checked: Boolean(v?.checked) });
      if (v?.found) waybillNo = v.waybillNo;
      else if (v?.checked) {
        notCreated = true;
        throw new Error(`CSDD pavadzīmi nesaglabāja${v.message ? `: ${v.message}` : ""}. CSDD sarakstā jaunas pavadzīmes nav`);
      } else throw new Error("Saglabāt nospiests, bet pavadzīmes numurs nav nolasīts");
    }
    let pdfPath = "";
    try {
      pdfPath = await driver.downloadPdf(`${input.jobId}-${waybillNo.replace(/[^A-Za-z0-9-]/g, "_")}`);
    } catch (err) {
      log("pdf_failed", { jobId: input.jobId, err: err instanceof Error ? err.message : String(err) });
    }
    ledger.markSaved(input.jobId, { waybillNo, pdfPath, mode });
    log("saved", { jobId: input.jobId, waybillNo, mode });
    return { ok: true, waybillNo, pdfPath };
  } catch (err) {
    const msg = (err instanceof Error ? err.message : String(err)).slice(0, 200);
    ledger.abortSave(input.jobId, msg);
    // notCreated: CSDD sarakstā pārbaudīts - pavadzīme nav izveidota (skaidrs statuss, nevis "pārbaudi CSDD").
    if (notCreated) return { ok: false, notCreated: true, error: msg };
    return { ok: false, error: clicked ? `${msg} - pārbaudi CSDD` : msg };
  } finally {
    await driver.close({ keepPage: false }).catch(() => {});
  }
}

/** sync.js: TIKAI LASA aktīvās pavadzīmes šīs firmas numuriem CSDD (arī ar roku izrakstītās). */
export async function runSync({ input, driver, log = () => {} }) {
  try {
    await driver.open(input);
    if (!driver.readActiveWaybills) return { ok: false, error: "draiverim nav readActiveWaybills", platesChecked: input.plates };
    const res = await driver.readActiveWaybills({ plates: input.plates, known: input.known });
    log("synced", { ctx: input.ctx, ok: res.ok, checked: res.checked, maxNumber: res.maxNumber });
    return { ...res, platesChecked: input.plates };
  } finally {
    await driver.close({ keepPage: false }).catch(() => {});
  }
}

/**
 * annul.js: pārtrauc TIKAI lietotāja apstiprināto pavadzīmi (input.replaceWaybillNo) uz input.plate.
 * Vienreiz uz darbu (ledger `<jobId>.annul.json`); atkārtojums atgriež iepriekšējo rezultātu. Saglabāt nespiež.
 */
export async function runAnnul({ input, ledger, driver, log = () => {} }) {
  if (!input.replaceWaybillNo) return { ok: false, error: "nav apstiprināta anulējamā pavadzīme" };
  const prev = ledger.readAnnul(input.jobId);
  if (prev?.done) return { ok: true, repeated: true, waybillNo: prev.waybillNo };
  if (prev?.started) return { ok: false, error: `${prev.waybillNo} pārtraukšana jau sākta - pārbaudi CSDD` };
  if (!driver.annulWaybill) return { ok: false, error: "draiverim nav annulWaybill" };
  try {
    await driver.open(input);
    ledger.writeAnnul(input.jobId, { waybillNo: input.replaceWaybillNo, plate: input.plate, started: true });
    const res = await driver.annulWaybill({ waybillNo: input.replaceWaybillNo, plate: input.plate });
    ledger.writeAnnul(input.jobId, { waybillNo: input.replaceWaybillNo, plate: input.plate, started: true, done: true, ...res });
    log("annulled", { jobId: input.jobId, waybillNo: input.replaceWaybillNo, already: Boolean(res.already) });
    return { ok: true, waybillNo: input.replaceWaybillNo, already: Boolean(res.already) };
  } catch (err) {
    const msg = (err instanceof Error ? err.message : String(err)).slice(0, 200);
    const rec = ledger.readAnnul(input.jobId);
    // Pirms klikšķa (nav atrasts / cits numurs) - drīkst mēģināt vēlreiz; citādi stāvoklis paliek "sākts".
    if (rec && /neko nepārtraucu/.test(msg)) ledger.writeAnnul(input.jobId, { ...rec, started: false, error: msg });
    return { ok: false, error: msg };
  } finally {
    await driver.close({ keepPage: false }).catch(() => {});
  }
}

/** Kopīgs CLI ietvars: rezultāts vienmēr pēdējā stdout rindā kā JSON; žurnāls uz stderr. */
export async function runCli(step, { env, makeDriver, ledgerDir, dateFormat = undefined, stdout, stderr, platesForCtx = null }) {
  const log = (msg, extra = {}) => stderr.write(`${JSON.stringify({ t: new Date().toISOString(), step, msg, ...extra })}\n`);
  let out;
  try {
    if (step === "sync") {
      if (!platesForCtx) throw new Error("sync: nav numuru saraksta");
      const input = parseSyncInput(env.IRISS_JOB_JSON, platesForCtx);
      out = await runSync({ input, driver: await makeDriver("sync"), log });
    } else if (step === "annul") {
      // Divi slēdži: worker (IRISS_WAYBILL_ANNUL_LIVE=1) un šis process (tā pati env). Bez tiem CSDD netiek aiztikts.
      if (env.IRISS_WAYBILL_ANNUL_LIVE !== "1") throw new Error("anulēšana izslēgta (IRISS_WAYBILL_ANNUL_LIVE)");
      const input = parseJobInput(env.IRISS_JOB_JSON);
      out = await runAnnul({ input, ledger: createLedger(ledgerDir), driver: await makeDriver("annul"), log });
    } else {
      const input = parseJobInput(env.IRISS_JOB_JSON);
      const ledger = createLedger(ledgerDir);
      const driver = await makeDriver(step === "save" ? "save" : "fill");
      out = step === "save" ? await runSave({ input, ledger, driver, dateFormat, log }) : await runRefill({ input, ledger, driver, dateFormat, log });
    }
  } catch (err) {
    out = { ok: false, error: (err instanceof Error ? err.message : String(err)).slice(0, 200) };
  }
  stdout.write(`${JSON.stringify(out)}\n`);
  // Vienmēr 0: worker (execFile) pie cita koda stdout nenolasa; rezultāts ir JSON laukā ok.
  return 0;
}
