// iriss-waybill-worker loģika (bez IO), testi: lib/iriss-waybill-auto.test.ts, lib/iriss-waybill-csdd-sync.test.ts.
// STINGRI: worker pats NEKAD nepārtrauc ("Pārtraukt") un neanulē ("Anulēt") aktīvu pavadzīmi.
// Vienīgais izņēmums - annul.js: TIKAI ja (1) lietotājs apstiprināja "anulēt iepriekšējo un izveidot jaunu" tieši šim
// numuram (serveris: auto.replace), (2) Hetzner IRISS_WAYBILL_ANNUL_LIVE=1 un (3) CSDD šim numuram ir tieši šī viena pavadzīme.
// Citi skripti tiek atteikti pirms spawn.

export const ALLOWED_SCRIPTS = Object.freeze({ fill: "refill.js", save: "save.js", sync: "sync.js" });
/** Atsevišķi: tikai ar opts.annulEnabled (IRISS_WAYBILL_ANNUL_LIVE=1). */
export const ANNUL_SCRIPT = "annul.js";
const FORBIDDEN_SCRIPT_RE = /(p[aā]rtrauk|anul|annul|cancel|terminat|stop|beigt|x\.sh|run\.sh)/i;

/** Soļa nosaukums -> skripta fails. Met kļūdu jebkam ārpus allowlist ("annul" - tikai ar annulEnabled). */
export function resolveWorkerScript(step, opts = {}) {
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
  return `Numurs ${plate} CSDD aizņemts (${list}). Jaunā pavadzīme nav izveidota. Ja vajag jaunu - nosūti vēlreiz un apstiprini anulēšanu.`;
}

const PLATES = { B1937: "iriss", B7627: "iriss", B1927: "dzintarzeme" };
const ROUTE_FROM = "Tukums, Rīgas iela";
const ROUTE_TO = "Tukuma CSDD";
const MAX_HOURS = 2160;
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
/** Komersanta pārstāvis pēc firmas (kā lib/iriss-waybill-create.ts WAYBILL_REPRESENTATIVES). "Cits" -> Aivars. */
const REPRESENTATIVES = { iriss: ["nils valainis"], dzintarzeme: ["taivo batiņš"] };

function compact(plate) {
  return String(plate || "").toUpperCase().replace(/[\s-]/g, "");
}

function norm(s) {
  return String(s || "").toLocaleLowerCase("lv").replace(/\s+/g, " ").trim();
}

/**
 * Lokāla (otrā) pārbaude pēc servera klasifikācijas (lib/iriss-waybill-auto.ts): ja kaut kas neatbilst, darbu neaiztiek.
 * Plūsmas: "tradeAct" (pieņemts auto, VIN + pārstāvis, bez maršruta) vai "new" (noklusējuma maršruts). Laiks 1..2160 h.
 */
export function localStandardCheck(job, nowMs = Date.now(), opts = {}) {
  if (!job || job.action !== "create_waybill") return { ok: false, reason: "nav create_waybill" };
  if (!job.auto || job.auto.standard !== true) return { ok: false, reason: "serveris: nestandarta" };
  const replace = job.auto.replace;
  if (replace) {
    // "Anulēt iepriekšējo un izveidot jaunu": tikai ar Hetzner slēdzi un tikai konkrētam numuram.
    if (opts.annulEnabled !== true) return { ok: false, reason: "anulēšana izslēgta" };
    if (!/^P\d{5,6}$/.test(String(replace.waybillNo || ""))) return { ok: false, reason: "nav anulējamās pavadzīmes numura" };
  } else if (job.plateBusy === true || job.confirmBusy === true) return { ok: false, reason: "numurs aizņemts" };
  const plate = compact(job.vehicle?.plate);
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
    if (!REPRESENTATIVES[company].includes(norm(job.representative))) return { ok: false, reason: "cits pārstāvis" };
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
    representative: flow === "tradeAct" ? String(job.representative || "") : "",
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
  return { stepsSec: out, totalSec: total };
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

/** IRISS_CSDD_SYNC_MIN -> minūtes 2-15 (noklusējums 5); "0" - periodiskā sinhronizācija izslēgta. */
export function csddSyncMinutes(raw) {
  const v = String(raw ?? "").trim();
  if (v === "0") return 0;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return 5;
  return Math.min(15, Math.max(2, n));
}

/**
 * Periodiska CSDD numuru sinhronizācija (tikai lasa), kamēr VPN jau ir ieslēgts. Pati VPN NEKAD neieslēdz.
 * deps: { vpnStatus, runScript, api, now, log }, known: {ctx1:[], ctx2:[]}. Atgriež {outcome, plates?}.
 */
export async function periodicPlateSync(deps, known = {}) {
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
 * Viena darba apstrāde. deps: { api, vpnStatus, vpnLease, vpnRelease, runScript, readPdfBase64, now, log, dryRun, annulEnabled }.
 * UI redz reālos soļus: claim (serveris: "claimed") -> stage vpn -> checking -> [annulling] -> filling -> saving -> pdf -> result.
 * - checking: numura statuss no CSDD (sync.js, arī ar roku izrakstītās) tieši pirms darba; momentuzņēmums uz Vercel.
 *   Aizņemts un nav apstiprināta anulēšana -> result ok:false ar skaidru tekstu (jaunā nav izveidota).
 * - annulling: tikai auto.replace + annulEnabled + CSDD aizņem tieši apstiprinātā pavadzīme.
 * Kļūda pirms Saglabāt -> event + release Aivaram (serveris viņu pamodina).
 * Kļūda Saglabāt laikā vai pēc -> result ok:false; ja CSDD sarakstā pārbaudīts, ka pavadzīme nav izveidota - to arī saka.
 * VPN lease vienmēr tiek atbrīvots (finally).
 */
export async function processJob(job, deps) {
  const marks = { created: Date.parse(job.createdAt) };
  const check = localStandardCheck(job, deps.now(), { annulEnabled: deps.annulEnabled === true });
  if (!check.ok) {
    deps.log("skip_nonstandard", { id: job.id, reason: check.reason });
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
      deps.log("vpn_busy_skip", { id: job.id });
      return { outcome: "vpn_busy" };
    }
  }
  const claimed = await deps.api.claim(job.id);
  if (!claimed) return { outcome: "not_claimed" };
  marks.claim = deps.now();
  const stage = (name) => deps.api.event(job.id, { kind: "message", stage: name, by: "auto" }).catch(() => {});
  const plate = String(job.vehicle.plate || "").toUpperCase();
  const replaceNo = job.auto.replace ? String(job.auto.replace.waybillNo).toUpperCase() : "";
  let saveStarted = false;
  let annulDone = false;
  let leased = false;
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
        await deps.api.result(job.id, { ok: false, errorReason: text, by: "auto" }).catch(() => {});
        return { outcome: "plate_busy", active: active.map((a) => a.waybillNo) };
      }
      if (active.length !== 1 || active[0].waybillNo !== replaceNo) {
        const text = `Numuru ${displayPlate(plate)} CSDD aizņem ${active.map((a) => a.waybillNo).join(", ")}, nevis apstiprinātā ${replaceNo}. Neko neanulēju, jaunā pavadzīme nav izveidota.`;
        await deps.api.result(job.id, { ok: false, errorReason: text, by: "auto" }).catch(() => {});
        return { outcome: "plate_busy_other", active: active.map((a) => a.waybillNo) };
      }
      await stage("annulling");
      const input = { ...scriptInput(job), replaceWaybillNo: replaceNo };
      const annulled = await deps.runScript("annul", input);
      if (!annulled?.ok) throw new Error(`${replaceNo} anulēt neizdevās: ${annulled?.error || "kļūda"}`);
      annulDone = true;
      marks.annulled = deps.now();
      await deps.api.event(job.id, { kind: "message", text: `Iepriekšējā pavadzīme ${replaceNo} CSDD anulēta.`, by: "auto" }).catch(() => {});
      active = await syncPlate();
      if (active.length) throw new Error(`pēc anulēšanas numurs joprojām aizņemts (${active.map((a) => a.waybillNo).join(", ")})`);
    }
    await stage("filling");
    const input = scriptInput(job);
    const filled = await deps.runScript("fill", input);
    if (filled?.busy?.waybillNo && !annulDone) {
      const text = plateBusyText(displayPlate(plate), [filled.busy]);
      await deps.api.result(job.id, { ok: false, errorReason: text, by: "auto" }).catch(() => {});
      return { outcome: "plate_busy", active: [filled.busy.waybillNo] };
    }
    if (!filled?.ok) throw new Error(filled?.error || "forma netika aizpildīta");
    const verified = verifyFilledFields(job, filled.fields);
    if (!verified.ok) throw new Error(verified.reason);
    marks.filled = deps.now();
    await stage("saving");
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
    await deps.api.event(job.id, { kind: "message", text: `Automātiski izrakstīta ${timings.totalSec ?? "?"} s laikā.`, by: "auto" }).catch(() => {});
    // Numurs tagad aizņemts: momentuzņēmums uzreiz (UI nerāda "brīvs").
    await syncPlate().catch(() => {});
    return { outcome: "issued", waybillNo: saved.waybillNo, timings };
  } catch (err) {
    const reason = (err instanceof Error ? err.message : String(err)).slice(0, 200);
    deps.log("job_failed", { id: job.id, reason, saveStarted, annulDone, ...formatTimings(marks) });
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
    const prefix = annulDone ? `Iepriekšējā ${replaceNo} anulēta, jauno izraksta Aivars. ` : "";
    await deps.api.event(job.id, { kind: "message", text: `${prefix}Automātikas kļūda: ${reason}`, by: "auto" }).catch(() => {});
    await deps.api.release(job.id, `${prefix}${reason}`.slice(0, 200)).catch(() => {});
    return { outcome: "released", reason };
  } finally {
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
