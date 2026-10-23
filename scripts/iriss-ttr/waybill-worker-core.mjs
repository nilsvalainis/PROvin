// iriss-waybill-worker loģika (bez IO), testi: lib/iriss-waybill-auto.test.ts.
// STINGRI: worker NEKAD nepārtrauc ("Pārtraukt") un neanulē ("Anulēt") aktīvu pavadzīmi.
// Tāpēc tas drīkst palaist tikai šos divus skriptus; jebkas cits tiek atteikts pirms spawn.

export const ALLOWED_SCRIPTS = Object.freeze({ fill: "refill.js", save: "save.js" });
const FORBIDDEN_SCRIPT_RE = /(p[aā]rtrauk|anul|annul|cancel|terminat|stop|beigt|x\.sh|run\.sh)/i;

/** Soļa nosaukums -> skripta fails. Met kļūdu jebkam ārpus allowlist. */
export function resolveWorkerScript(step) {
  if (!Object.prototype.hasOwnProperty.call(ALLOWED_SCRIPTS, step)) throw new Error(`script_not_allowed:${step}`);
  const file = ALLOWED_SCRIPTS[step];
  if (FORBIDDEN_SCRIPT_RE.test(file)) throw new Error(`script_forbidden:${file}`);
  return file;
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
export function localStandardCheck(job, nowMs = Date.now()) {
  if (!job || job.action !== "create_waybill") return { ok: false, reason: "nav create_waybill" };
  if (!job.auto || job.auto.standard !== true) return { ok: false, reason: "serveris: nestandarta" };
  if (job.plateBusy === true || job.confirmBusy === true) return { ok: false, reason: "numurs aizņemts" };
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
  };
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
  return status.blocked === true || status.stopPending === true;
}

/**
 * Viena darba apstrāde. deps: { api, vpnStatus, vpnLease, vpnRelease, runScript, readPdfBase64, now, log, dryRun }.
 * UI redz reālos soļus: claim (serveris: "claimed") -> stage vpn -> filling -> saving -> pdf -> result.
 * Kļūda pirms Saglabāt -> event + release Aivaram (serveris viņu pamodina).
 * Kļūda Saglabāt laikā vai pēc -> result ok:false (CSDD jāpārbauda cilvēkam), nekāda atkārtošana.
 * VPN lease vienmēr tiek atbrīvots (finally), lai serveris neturētu Nila VPN kontu.
 */
export async function processJob(job, deps) {
  const marks = { created: Date.parse(job.createdAt) };
  const check = localStandardCheck(job, deps.now());
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
  let saveStarted = false;
  let leased = false;
  try {
    await stage("vpn");
    leased = true;
    await deps.vpnLease();
    marks.vpnUp = deps.now();
    await stage("filling");
    const input = scriptInput(job);
    const filled = await deps.runScript("fill", input);
    if (!filled?.ok) throw new Error(filled?.error || "forma netika aizpildīta");
    const verified = verifyFilledFields(job, filled.fields);
    if (!verified.ok) throw new Error(verified.reason);
    marks.filled = deps.now();
    await stage("saving");
    saveStarted = true;
    const saved = await deps.runScript("save", input);
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
    return { outcome: "issued", waybillNo: saved.waybillNo, timings };
  } catch (err) {
    const reason = (err instanceof Error ? err.message : String(err)).slice(0, 200);
    deps.log("job_failed", { id: job.id, reason, saveStarted, ...formatTimings(marks) });
    if (saveStarted) {
      await deps.api
        .result(job.id, { ok: false, errorReason: `Automātika: ${reason}. Pārbaudi CSDD, vai pavadzīme jau ir izveidota.`, by: "auto" })
        .catch(() => {});
      return { outcome: "error_after_save", reason };
    }
    await deps.api.event(job.id, { kind: "message", text: `Automātikas kļūda: ${reason}`, by: "auto" }).catch(() => {});
    await deps.api.release(job.id, reason).catch(() => {});
    return { outcome: "released", reason };
  } finally {
    if (leased && deps.vpnRelease) {
      await deps.vpnRelease().catch((e) => deps.log("vpn_release_failed", { id: job.id, err: e instanceof Error ? e.message : "error" }));
    }
  }
}
