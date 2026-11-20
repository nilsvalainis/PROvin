// iriss-waybill-worker loģika (bez IO), testi: lib/iriss-waybill-auto.test.ts, lib/iriss-waybill-csdd-sync.test.ts.
// STINGRI: worker NEKAD neanulē ("Anulēt") un nespiež "Paziņot klientam". Pats nepārtrauc ("Pārtraukt") aktīvu pavadzīmi,
// izņemot aizstāšanu (Nils 20.11, A): stop.js - TIKAI ja (1) lietotājs apstiprināja aizstāt tieši šo pavadzīmi
// (serveris: auto.replace + replaceWaybillNo), (2) tā ir zināma šīs firmas numuriem un (3) CSDD šim numuram ir tieši šī
// viena aktīva pavadzīme. Vispirms «Pārtraukt» vecajai, pārbaude CSDD, ka tā vairs nav aktīva, tikai tad jaunā.
// annul.js aizstāšanā netiek lietots nekad (arī ar IRISS_WAYBILL_ANNUL_LIVE=1). Citi skripti tiek atteikti pirms spawn.

import { isCsddSyncWindow } from "./csdd-sync-schedule.mjs";

export const ALLOWED_SCRIPTS = Object.freeze({ fill: "refill.js", save: "save.js", sync: "sync.js" });
/** Atsevišķi: tikai ar opts.annulEnabled (IRISS_WAYBILL_ANNUL_LIVE=1). processJob to NElieto. */
export const ANNUL_SCRIPT = "annul.js";
/** Aizstāšana (20.11): CSDD «Pārtraukt» vecajai pavadzīmei. Tikai ar opts.replaceStopEnabled === true. */
export const STOP_SCRIPT = "stop.js";
const FORBIDDEN_SCRIPT_RE = /(p[aā]rtrauk|anul|annul|cancel|terminat|stop|beigt|x\.sh|run\.sh)/i;

/** Soļa nosaukums -> skripta fails. Met kļūdu jebkam ārpus allowlist ("annul" - tikai ar annulEnabled). */
export function resolveWorkerScript(step, opts = {}) {
  if (step === "stop") {
    if (opts.replaceStopEnabled !== true) throw new Error("script_not_allowed:stop");
    return STOP_SCRIPT;
  }
  if (step === "annul") {
    if (opts.annulEnabled !== true) throw new Error("script_not_allowed:annul");
    return ANNUL_SCRIPT;
  }
  if (!Object.prototype.hasOwnProperty.call(ALLOWED_SCRIPTS, step)) throw new Error(`script_not_allowed:${step}`);
  const file = ALLOWED_SCRIPTS[step];
  if (FORBIDDEN_SCRIPT_RE.test(file)) throw new Error(`script_forbidden:${file}`);
  return file;
}

/** Firmas numuri (CSDD sinhronizācijai vienā pieslēgšanās reizē). */
export function platesOfCtx(ctx) {
  const n = Number(String(ctx ?? "").replace(/^ctx/i, ""));
  return Object.keys(PLATE_CTX).filter((p) => PLATE_CTX[p] === n);
}
const PLATE_CTX = { "B193-7": 1, "B762-7": 1, "B192-7": 2 };

function formatRiga(iso) {
  const ms = Date.parse(iso || "");
  if (!Number.isFinite(ms)) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Riga", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

/** Skaidrs teksts lietotājam: numurs CSDD aizņemts, jaunā nav izveidota. */
export function plateBusyText(plate, active) {
  const list = active
    .map((a) => `${a.waybillNo}${a.brandModel ? ` ${a.brandModel}` : ""}${a.validUntil ? `, līdz ${formatRiga(a.validUntil)}` : ""}`)
    .join("; ");
  return `Numurs ${plate} CSDD aizņemts (${list}). Jaunā pavadzīme nav izveidota. Ja vajag jaunu - nosūti vēlreiz un apstiprini aizstāšanu.`;
}

const PLATES = { B1937: "iriss", B7627: "iriss", B1927: "dzintarzeme" };
const ROUTE_FROM = "Tukums, Rīgas iela";
const ROUTE_TO = "Tukuma CSDD";
const MAX_HOURS = 48; // CSDD max
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
const WAYBILL_NO_RE = /^P\d{5,6}$/;
/** Komersanta pārstāvis pēc firmas (kā lib/iriss-waybill-create.ts WAYBILL_REPRESENTATIVES). "Cits" -> Aivars. */
/** Salīdzina bez diakritikas (normName): "Taivo Batiņš" (vecie pieprasījumi) = "Taivo Batins" (CSDD saraksts). */
const REPRESENTATIVES = { iriss: ["nils valainis"], dzintarzeme: ["taivo batins"] };
/** Noklusējuma pārstāvis, ja darbā tas nav norādīts (Nils 23.10): ĪRISS - Nils Valainis, Dzintarzeme Auto - Taivo Batins. */
export const DEFAULT_REPRESENTATIVE = Object.freeze({ iriss: "Nils Valainis", dzintarzeme: "Taivo Batins" });

/** Darba pārstāvis vai firmas (pēc numura) noklusējums. */
export function jobRepresentative(job) {
  const own = String(job?.representative || "").replace(/\s+/g, " ").trim();
  if (own) return own;
  return DEFAULT_REPRESENTATIVE[PLATES[compact(job?.vehicle?.plate)]] || "";
}

function compact(plate) {
  return String(plate || "").toUpperCase().replace(/[\s-]/g, "");
}

function norm(s) {
  return String(s || "").toLocaleLowerCase("lv").replace(/\s+/g, " ").trim();
}

function normName(s) {
  return norm(String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
}

/**
 * Lokāla (otrā) pārbaude pēc servera klasifikācijas (lib/iriss-waybill-auto.ts): ja kaut kas neatbilst, darbu neaiztiek.
 * Plūsmas: "tradeAct" (pieņemts auto, VIN + pārstāvis, bez maršruta) vai "new" (noklusējuma maršruts). Laiks 1..48 h (CSDD max).
 */
export function localStandardCheck(job, nowMs = Date.now(), opts = {}) {
  if (!job || job.action !== "create_waybill") return { ok: false, reason: "nav create_waybill" };
  if (!job.auto || job.auto.standard !== true) return { ok: false, reason: "serveris: nestandarta" };
  const replace = job.auto.replace;
  if (replace) {
    // Aizstāšana (Nils 20.11): «Pārtraukt» vecajai, tad jaunā. NEatkarīgi no annulEnabled (annul.js netiek lietots).
    if (opts.replaceStopEnabled !== true) return { ok: false, reason: "aizstāšana izslēgta" };
    const no = String(replace.waybillNo || "").toUpperCase();
    if (!WAYBILL_NO_RE.test(no)) return { ok: false, reason: "nav pārtraucamās pavadzīmes numura" };
    // Lietotāja apstiprinātais numurs (pieprasījumā) un servera klasifikācija sakrīt.
    if (String(job.replaceWaybillNo || "").toUpperCase() !== no) return { ok: false, reason: "aizstājamā pavadzīme nesakrīt" };
    // Vecā pavadzīme zināma šīs firmas numuriem (CSDD momentuzņēmums + indekss). Numurzīmi pārbauda CSDD sync un stop.js.
    const known = Array.isArray(job.knownWaybills) ? job.knownWaybills.map((x) => String(x).toUpperCase()) : [];
    if (!known.includes(no)) return { ok: false, reason: "aizstājamā pavadzīme nav zināma" };
  } else if (job.plateBusy === true || job.confirmBusy === true) return { ok: false, reason: "numurs aizņemts" };
  const plate = compact(job.vehicle?.plate);
  // j31: B192-7 (SIA Dzintarzeme Auto, ne ĪRISS) nekad automātiski - otrā pārbaude, pat ja serveris kļūdaini atzīmētu standarta.
  if (plate === "B1927") return { ok: false, reason: "B192 - tikai ar roku" };
  if (!PLATES[plate]) return { ok: false, reason: "numurs nav sarakstā" };
  if (compact(job.auto.plate) !== plate) return { ok: false, reason: "numurs nesakrīt" };
  const hours = job.validHours;
  if (!Number.isInteger(hours) || hours < 1 || hours > MAX_HOURS) return { ok: false, reason: "nederīgs laiks" };
  const until = Date.parse(job.validUntil || "");
  if (Number.isFinite(until) && until <= nowMs) return { ok: false, reason: "termiņš beidzies" };
  const brand = String(job.vehicle?.brandModel || "").trim();
  if (!brand) return { ok: false, reason: "nav auto" };
  const c = norm(job.comment_untrusted);
  if (c && c !== "tukums") {
    const m = /^b?\s?(\d{3})(?:\s?-\s?7)?\s+uz\s+(.+)$/u.exec(c);
    if (!m || m[1] !== plate.slice(1, 4) || m[2] !== norm(brand)) return { ok: false, reason: "komentārs" };
  }
  const company = PLATES[plate];
  if (job.tradeAct === true) {
    if (job.auto.flow !== "tradeAct") return { ok: false, reason: "plūsma nesakrīt" };
    if (!VIN_RE.test(String(job.vehicle?.vin || "").trim().toUpperCase())) return { ok: false, reason: "aktam vajag VIN" };
    if (!REPRESENTATIVES[company].includes(normName(jobRepresentative(job)))) return { ok: false, reason: "cits pārstāvis" };
    return { ok: true, company, flow: "tradeAct" };
  }
  if (job.auto.flow !== "new") return { ok: false, reason: "plūsma nesakrīt" };
  if (job.routeFrom !== ROUTE_FROM || job.routeTo !== ROUTE_TO) return { ok: false, reason: "cits maršruts" };
  return { ok: true, company, flow: "new" };
}

/** Ko skripts saņem (bez komentāra teksta: tas nav vajadzīgs standarta darbam). */
export function scriptInput(job) {
  const flow = job.tradeAct === true ? "tradeAct" : "new";
  return {
    jobId: job.id,
    plate: job.vehicle.plate,
    brandModel: job.vehicle.brandModel,
    vin: job.vehicle.vin || "",
    company: job.auto.company,
    ctx: job.auto.ctx,
    // Akta pavadzīmei maršruta/pilsētas nav (Nils 23.10): tikai laiks + pārstāvis. Ja akta forma tomēr prasa adresi,
    // adapteris atsakās pirms Saglabāt (darbs Aivaram), nevis liek fiksētu maršrutu.
    routeFrom: flow === "tradeAct" ? "" : job.routeFrom,
    routeTo: flow === "tradeAct" ? "" : job.routeTo,
    validFrom: job.validFrom,
    validUntil: job.validUntil,
    validHours: job.validHours,
    flow,
    representative: flow === "tradeAct" ? jobRepresentative(job) : "",
    // "tradeAct": akts pēc VIN -> "Noformēt pavadzīmi" (ja akta nav - kļūda pirms Saglabāt, darbs Aivaram).
    // "new": jauna pavadzīme; ja VIN tomēr ir tirdzniecības aktā - kļūda (Aivaram).
    preferTradeAct: flow === "tradeAct",
    // Iepriekš zināmie CSDD numuri (serveris), lai pārbaude CSDD sāktos no tiem.
    knownWaybills: Array.isArray(job.knownWaybills) ? job.knownWaybills.slice(0, 12) : [],
  };
}

/** sync.js ievade vienai firmai. */
export function syncInput(ctx, known = []) {
  const n = Number(String(ctx ?? "").replace(/^ctx/i, ""));
  return { jobId: `sync-ctx${n}`, ctx: n, plates: platesOfCtx(n), known: known.slice(0, 12) };
}

/** sync.js rezultāti -> Vercel momentuzņēmums (POST /api/iriss/aivars/waybill-plates). */
export function plateSnapshot(results, nowIso = new Date().toISOString()) {
  const plates = [];
  for (const r of results) {
    for (const p of r?.platesChecked || []) {
      plates.push({
        plate: p,
        ok: r.ok === true,
        checkedAt: nowIso,
        active: r.ok === true ? (r.plates?.[p] || []).map((a) => ({
          waybillNo: String(a.waybillNo || ""),
          validUntil: String(a.validUntil || ""),
          brandModel: String(a.brandModel || "").slice(0, 80),
        })) : [],
        error: r.ok === true ? "" : String(r.error || "").slice(0, 160),
      });
    }
  }
  return { source: "csdd", syncedAt: nowIso, plates };
}

/** Aizpildītie lauki pirms Saglabāt sakrīt ar darbu (save.js pārbauda vēlreiz). */
export function verifyFilledFields(job, fields) {
  const want = { plate: compact(job.vehicle.plate), validHours: Number(job.validHours) };
  const got = { plate: compact(fields?.plate), validHours: Number(fields?.validHours) };
  const bad = Object.keys(want).filter((k) => want[k] !== got[k]);
  return bad.length ? { ok: false, reason: `lauki nesakrīt: ${bad.join(", ")}` } : { ok: true };
}

export function formatTimings(marks) {
  const order = ["created", "claim", "vpnUp", "filled", "saved", "pdf", "result"];
  const out = {};
  let prev = null;
  for (const key of order) {
    if (!Number.isFinite(marks[key])) continue;
    out[key] = prev == null ? 0 : Math.round((marks[key] - prev) / 1000);
    prev = marks[key];
  }
  const total = Number.isFinite(marks.result) && Number.isFinite(marks.created) ? Math.round((marks.result - marks.created) / 1000) : null;
  // queuedSec (20.11): cik ilgi pieprasījums gaidīja rindā (izveide -> claim); null, ja darbs nav paņemts.
  const queued = Number.isFinite(marks.claim) && Number.isFinite(marks.created) ? Math.round((marks.claim - marks.created) / 1000) : null;
  return { stepsSec: out, totalSec: total, queuedSec: queued };
}

/**
 * VPN aizņemts cilvēkam: Nils nospieda "Man vajag VPN" / pieslēdzās ar to pašu kontu (vpn-ctl /status blocked)
 * vai stop pieprasījums vēl tiek apstrādāts. Tad worker darbu NEŅEM (bez claim) un VPN neaiztiek.
 */
export function vpnBusyForHuman(status) {
  if (!status || typeof status !== "object") return true;
  // Hold režīmā (Nils 23.10) pavadzīmes pieprasījums pieslēdzas arī pēc atslēgšanas/izmešanas: vpn-ctl dod blockedForWaybill.
  const blocked = typeof status.blockedForWaybill === "boolean" ? status.blockedForWaybill : status.blocked === true;
  return blocked || status.stopPending === true;
}

/** IRISS_WAYBILL_REPLACE_STOP: aizstāšana ar «Pārtraukt» ieslēgta pēc noklusējuma (Nils 20.11, A); "0" - izslēgta (darbs Aivaram). */
export function replaceStopEnabled(raw) {
  const v = String(raw ?? "").trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "no");
}

/** IRISS_CSDD_SYNC_PERIODIC: periodiskā (dienas) sinhronizācija ieslēgta pēc noklusējuma; "0" - izslēgta. */
export function csddPeriodicSyncEnabled(raw) {
  const v = String(raw ?? "").trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "no");
}

/**
 * Periodiska CSDD numuru sinhronizācija (tikai lasa), kamēr VPN jau ir ieslēgts. Pati VPN NEKAD neieslēdz.
 * Tikai dienā 08:00-19:00 Rīgas laikā (csdd-sync-schedule.mjs); naktī neko nedara.
 * deps: { vpnStatus, runScript, api, now, log }, known: {ctx1:[], ctx2:[]}. Atgriež {outcome, plates?}.
 */
export async function periodicPlateSync(deps, known = {}) {
  if (!isCsddSyncWindow(deps.now())) return { outcome: "night" };
  const vpn = await deps.vpnStatus().catch(() => null);
  if (!vpn || vpn.vpn !== "up") return { outcome: "vpn_down" };
  const results = [];
  for (const ctx of [1, 2]) {
    try {
      results.push(await deps.runScript("sync", syncInput(ctx, known[`ctx${ctx}`] || [])));
    } catch (err) {
      results.push({ ok: false, error: err instanceof Error ? err.message.slice(0, 120) : "sync", platesChecked: platesOfCtx(ctx) });
    }
  }
  const snapshot = plateSnapshot(results, new Date(deps.now()).toISOString());
  await deps.api.plates(snapshot);
  deps.log("plates_synced", { ok: results.map((r) => r?.ok === true), busy: snapshot.plates.filter((p) => p.active.length).map((p) => p.plate) });
  return { outcome: "synced", plates: snapshot.plates };
}

/**
 * Viena darba apstrāde. deps: { api, vpnStatus, vpnLease, vpnRelease, runScript, readPdfBase64, now, log, dryRun, replaceStopEnabled }.
 * UI redz reālos soļus: claim (serveris: "claimed") -> stage vpn -> checking -> [annulling] -> filling -> saving -> pdf -> result.
 * - checking: numura statuss no CSDD (sync.js, arī ar roku izrakstītās) tieši pirms darba; momentuzņēmums uz Vercel.
 *   Aizņemts un nav apstiprināta aizstāšana -> result ok:false ar skaidru tekstu (jaunā nav izveidota).
 * - annulling (UI: «Pārtrauc iepriekšējo pavadzīmi CSDD»): tikai auto.replace + replaceStopEnabled + CSDD aizņem tieši
 *   apstiprinātā pavadzīme -> stop.js («Pārtraukt», nekad annul.js / «Anulēt») -> sync: vecā vairs nav aktīva -> jaunā.
 *   Pārtraukt neizdodas vai pēc tā numurs nav pārbaudīti brīvs -> jauno NEizraksta, darbs Aivaram ar iemeslu.
 * - pēc rezultāta (izdota, kļūda, arī pēc pārtraukšanas): vēlreiz sync, ja darbs CSDD kaut ko darīja (stop/fill/save) -
 *   UI uzreiz redz patieso numura stāvokli. Tas notiek pirms VPN release.
 * Kļūda pirms Saglabāt -> event + release Aivaram (serveris viņu pamodina).
 * Kļūda Saglabāt laikā vai pēc -> result ok:false; ja CSDD sarakstā pārbaudīts, ka pavadzīme nav izveidota - to arī saka.
 * VPN lease vienmēr tiek atbrīvots (finally).
 */
export async function processJob(job, deps) {
  const marks = { created: Date.parse(job.createdAt) };
  // annulEnabled processJob nelieto nekad: aizstāšana vienmēr ir «Pārtraukt» (stop.js).
  const check = localStandardCheck(job, deps.now(), { replaceStopEnabled: deps.replaceStopEnabled === true });
  // j16: nekad kluss "Gaida" - ja automātika darbu neņem, pieprasījumā paliek iemesls (darbs paliek rindā Aivaram).
  const tellQueued = (text) => deps.api.event(job.id, { kind: "message", text, by: "auto" }).catch(() => {});
  if (!check.ok) {
    deps.log("skip_nonstandard", { id: job.id, reason: check.reason });
    if (!deps.dryRun) await tellQueued(`Automātika darbu neņēma (${check.reason}). Izraksta Aivars.`);
    return { outcome: "skipped", reason: check.reason };
  }
  if (deps.dryRun) {
    deps.log("dry_run_would_process", { id: job.id, plate: job.vehicle.plate, flow: check.flow });
    return { outcome: "dry_run" };
  }
  // Ja Nils lieto VPN - neko nedara: neņem darbu un neieslēdz VPN (nākamajā reizē mēģinās vēlreiz).
  if (deps.vpnStatus) {
    const vpn = await deps.vpnStatus().catch(() => null);
    if (vpnBusyForHuman(vpn)) {
      deps.log("vpn_busy_skip", { id: job.id, vpnCtl: vpn ? "ok" : "unreachable" });
      // Tikai vienreiz uz darbu (worker atkārto ik 10 s); pēc 2 min UI saka "nodots Aivaram".
      if (deps.vpnBusyNotified && !deps.vpnBusyNotified.has(job.id)) {
        deps.vpnBusyNotified.add(job.id);
        await tellQueued(vpn ? "Automātika gaida: CSDD VPN šobrīd lieto Nils." : "Automātika gaida: CSDD VPN vadība neatbild.");
      }
      return { outcome: "vpn_busy" };
    }
  }
  const claimed = await deps.api.claim(job.id);
  if (!claimed) {
    deps.log("not_claimed", { id: job.id });
    return { outcome: "not_claimed" };
  }
  marks.claim = deps.now();
  deps.log("claimed", { id: job.id, queuedSec: formatTimings(marks).queuedSec });
  const stage = (name) => deps.api.event(job.id, { kind: "message", stage: name, by: "auto" }).catch(() => "");
  /** 07.11: lietotājs darbu atcēla (Atcelt pieprasījumu) - pirms CSDD Saglabāt neturpinām. */
  const cancelledError = () => {
    const err = new Error("lietotājs atcēla pieprasījumu");
    err.cancelled = true;
    return err;
  };
  const plate = String(job.vehicle.plate || "").toUpperCase();
  const replaceNo = job.auto.replace ? String(job.auto.replace.waybillNo).toUpperCase() : "";
  let saveStarted = false;
  /** Vecā pavadzīme CSDD pārtraukta (aizstāšana). */
  let stopDone = false;
  let leased = false;
  /** CSDD darbība (stop/fill/save) sākta: pēc rezultāta numuru sinhronizē vēlreiz. */
  let touchedCsdd = false;
  /** CSDD numura statuss (tikai lasa) + momentuzņēmums Vercel. Kļūda -> null. */
  const syncPlate = async () => {
    const res = await deps.runScript("sync", syncInput(job.auto.ctx, job.knownWaybills || []));
    if (deps.api.plates) await deps.api.plates(plateSnapshot([res], new Date(deps.now()).toISOString())).catch(() => {});
    if (!res?.ok) throw new Error(`CSDD numura statusu nevarēja nolasīt${res?.error ? `: ${res.error}` : ""}`);
    return res.plates?.[displayPlate(plate)] || [];
  };
  try {
    await stage("vpn");
    leased = true;
    await deps.vpnLease();
    marks.vpnUp = deps.now();
    await stage("checking");
    let active = await syncPlate();
    if (active.length) {
      if (!replaceNo) {
        const text = plateBusyText(displayPlate(plate), active);
        deps.log("plate_busy", { id: job.id, plate, active: active.map((a) => a.waybillNo) });
        // activeWaybillNo: serveris piedāvā «Pārrakstīt» («Pārtraukt» darbs Aivaram, tad jauna) - worker pats neko nepārtrauc.
        await deps.api.result(job.id, { ok: false, errorReason: text, activeWaybillNo: active[0].waybillNo, by: "auto" }).catch(() => {});
        return { outcome: "plate_busy", active: active.map((a) => a.waybillNo) };
      }
      if (active.length !== 1 || active[0].waybillNo !== replaceNo) {
        const text = `Numuru ${displayPlate(plate)} CSDD aizņem ${active.map((a) => a.waybillNo).join(", ")}, nevis apstiprinātā ${replaceNo}. Neko nepārtraucu, jaunā pavadzīme nav izveidota.`;
        await deps.api.result(job.id, { ok: false, errorReason: text, activeWaybillNo: active[0].waybillNo, by: "auto" }).catch(() => {});
        return { outcome: "plate_busy_other", active: active.map((a) => a.waybillNo) };
      }
      // 1. solis: «Pārtraukt» vecajai (tas pats CSDD solis kā Aivara «Pārtraukt» darbam), nekad «Anulēt».
      if ((await stage("annulling")) === "cancelled") throw cancelledError();
      touchedCsdd = true;
      const stopped = await deps.runScript("stop", { ...scriptInput(job), replaceWaybillNo: replaceNo });
      if (!stopped?.ok) throw new Error(`${replaceNo} pārtraukt neizdevās: ${stopped?.error || "kļūda"}`);
      if (String(stopped.waybillNo || replaceNo).toUpperCase() !== replaceNo) throw new Error(`pārtraukta nav ${replaceNo} - pārbaudi CSDD`);
      stopDone = true;
      marks.stopped = deps.now();
      // 2. solis: CSDD pārbaude - vecā vairs nav aktīva (momentuzņēmums uz Vercel: vecā atzīmēta kā pārtraukta).
      active = await syncPlate();
      if (active.length) throw new Error(`pēc pārtraukšanas numurs joprojām aizņemts (${active.map((a) => a.waybillNo).join(", ")})`);
      await deps.api.event(job.id, { kind: "message", text: `Iepriekšējā pavadzīme ${replaceNo} CSDD pārtraukta. Izraksta jauno.`, by: "auto" }).catch(() => {});
    }
    if ((await stage("filling")) === "cancelled") throw cancelledError();
    const input = scriptInput(job);
    touchedCsdd = true;
    const filled = await deps.runScript("fill", input);
    if (filled?.busy?.waybillNo && !stopDone) {
      const text = plateBusyText(displayPlate(plate), [filled.busy]);
      await deps.api.result(job.id, { ok: false, errorReason: text, activeWaybillNo: filled.busy.waybillNo, by: "auto" }).catch(() => {});
      return { outcome: "plate_busy", active: [filled.busy.waybillNo] };
    }
    if (!filled?.ok) throw new Error(filled?.error || "forma netika aizpildīta");
    const verified = verifyFilledFields(job, filled.fields);
    if (!verified.ok) throw new Error(verified.reason);
    marks.filled = deps.now();
    if ((await stage("saving")) === "cancelled") throw cancelledError();
    saveStarted = true;
    const saved = await deps.runScript("save", input);
    if (saved && saved.ok === false && saved.notCreated === true) {
      const err = new Error(saved.error || "CSDD pavadzīmi nesaglabāja");
      err.notCreated = true;
      throw err;
    }
    if (!saved?.ok || !saved.waybillNo) throw new Error(saved?.error || "Saglabāt neizdevās");
    marks.saved = deps.now();
    await stage("pdf");
    const pdfBase64 = saved.pdfPath ? await deps.readPdfBase64(saved.pdfPath) : "";
    marks.pdf = deps.now();
    await deps.api.result(job.id, { ok: true, waybillNo: saved.waybillNo, pdfBase64, by: "auto" });
    marks.result = deps.now();
    const timings = formatTimings(marks);
    deps.log("issued", { id: job.id, waybillNo: saved.waybillNo, flow: check.flow, ...timings });
    const doneText = stopDone
      ? `Aizstāta: ${replaceNo} pārtraukta, jaunā ${saved.waybillNo} automātiski izrakstīta ${timings.totalSec ?? "?"} s laikā.`
      : `Automātiski izrakstīta ${timings.totalSec ?? "?"} s laikā.`;
    await deps.api.event(job.id, { kind: "message", text: doneText, by: "auto" }).catch(() => {});
    return { outcome: "issued", waybillNo: saved.waybillNo, timings, stoppedWaybillNo: stopDone ? replaceNo : "" };
  } catch (err) {
    const reason = (err instanceof Error ? err.message : String(err)).slice(0, 200);
    deps.log("job_failed", { id: job.id, reason, saveStarted, stopDone, ...formatTimings(marks) });
    if (err && err.cancelled && !saveStarted) {
      // Atcelts: neko vairs nesūta (statuss jau "cancelled"); VPN atbrīvo finally.
      const text = stopDone ? `Atcelts. Iepriekšējā ${replaceNo} CSDD jau pārtraukta, jaunā NAV izveidota.` : "Atcelts. Pavadzīme NAV izveidota.";
      await deps.api.event(job.id, { kind: "message", text, by: "auto" }).catch(() => {});
      return { outcome: "cancelled" };
    }
    if (saveStarted && err && err.notCreated) {
      await deps.api
        .result(job.id, { ok: false, errorReason: `Automātika: ${reason}. Pavadzīme NAV izveidota.`, by: "auto" })
        .catch(() => {});
      return { outcome: "not_created", reason };
    }
    if (saveStarted) {
      await deps.api
        .result(job.id, { ok: false, errorReason: `Automātika: ${reason}. Pārbaudi CSDD, vai pavadzīme jau ir izveidota.`, by: "auto" })
        .catch(() => {});
      return { outcome: "error_after_save", reason };
    }
    // Pārtraukt neizdevās / nav pārliecības -> jaunā NAV izrakstīta; skaidrs iemesls Aivaram.
    const prefix = stopDone
      ? `Iepriekšējā ${replaceNo} pārtraukta, jauno izraksta Aivars. `
      : replaceNo
        ? `Aizstāšana apturēta: jaunā NAV izrakstīta (${replaceNo} pārtraukšana nav apstiprināta). `
        : "";
    await deps.api.event(job.id, { kind: "message", text: `${prefix}Automātikas kļūda: ${reason}`, by: "auto" }).catch(() => {});
    await deps.api.release(job.id, `${prefix}${reason}`.slice(0, 200)).catch(() => {});
    return { outcome: "released", reason };
  } finally {
    // Sync pēc rezultāta (numurs tagad aizņemts / pārtraukts / nemainīts) - kamēr VPN vēl ir mūsu.
    if (touchedCsdd && Number.isFinite(marks.vpnUp)) {
      await syncPlate().catch((e) => deps.log("post_sync_failed", { id: job.id, err: e instanceof Error ? e.message : "error" }));
    }
    if (leased && deps.vpnRelease) {
      await deps.vpnRelease().catch((e) => deps.log("vpn_release_failed", { id: job.id, err: e instanceof Error ? e.message : "error" }));
    }
  }
}

/** "B1937" -> "B193-7". */
function displayPlate(raw) {
  const c = String(raw || "").toUpperCase().replace(/[\s-]/g, "");
  return Object.keys(PLATE_CTX).find((p) => p.replace("-", "") === c) || String(raw || "");
}

/** Vai API atbilde/kļūda ir pārejoša (5xx vai tīkla kļūda/timeout) - tādu drīkst atkārtot vienreiz. */
export function isTransientApiFailure(result, err) {
  if (err) return true;
  const s = Number(result?.status);
  return Number.isFinite(s) && s >= 500 && s <= 599;
}

/**
 * Tikai LASOŠIEM API izsaukumiem (piem. pending): 5xx vai tīkla kļūda -> pagaida delayMs (nokl. 2 s) un mēģina VIENREIZ vēl.
 * Otrā mēģinājuma rezultāts (vai kļūda) tiek atgriezts/mests kā ir. 2xx/4xx netiek atkārtoti.
 * doCall: () => Promise<{status, data}>.
 */
export async function callWithOneRetry(doCall, opts = {}) {
  const delayMs = Number.isFinite(opts.delayMs) ? opts.delayMs : 2_000;
  const sleep = opts.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  let first;
  let firstErr = null;
  try {
    first = await doCall();
  } catch (err) {
    firstErr = err || new Error("network_error");
  }
  if (!isTransientApiFailure(first, firstErr)) return first;
  opts.onRetry?.({ status: first?.status, err: firstErr instanceof Error ? firstErr.message : firstErr ? String(firstErr) : "" });
  await sleep(delayMs);
  return doCall();
}
