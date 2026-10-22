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

function compact(plate) {
  return String(plate || "").toUpperCase().replace(/[\s-]/g, "");
}

function norm(s) {
  return String(s || "").toLocaleLowerCase("lv").replace(/\s+/g, " ").trim();
}

/** Lokāla (otrā) pārbaude pēc servera klasifikācijas: ja kaut kas neatbilst, darbu neaiztiek. */
export function localStandardCheck(job) {
  if (!job || job.action !== "create_waybill") return { ok: false, reason: "nav create_waybill" };
  if (!job.auto || job.auto.standard !== true) return { ok: false, reason: "serveris: nestandarta" };
  if (job.plateBusy === true || job.confirmBusy === true) return { ok: false, reason: "numurs aizņemts" };
  const plate = compact(job.vehicle?.plate);
  if (!PLATES[plate]) return { ok: false, reason: "numurs nav sarakstā" };
  if (compact(job.auto.plate) !== plate) return { ok: false, reason: "numurs nesakrīt" };
  if (job.validHours !== 48) return { ok: false, reason: "nav 48 h" };
  if (job.routeFrom !== ROUTE_FROM || job.routeTo !== ROUTE_TO) return { ok: false, reason: "cits maršruts" };
  const brand = String(job.vehicle?.brandModel || "").trim();
  if (!brand) return { ok: false, reason: "nav auto" };
  const c = norm(job.comment_untrusted);
  if (c && c !== "tukums") {
    const m = /^b?\s?(\d{3})(?:\s?-\s?7)?\s+uz\s+(.+)$/u.exec(c);
    if (!m || m[1] !== plate.slice(1, 4) || m[2] !== norm(brand)) return { ok: false, reason: "komentārs" };
  }
  return { ok: true, company: PLATES[plate] };
}

/** Ko skripts saņem (bez komentāra teksta: tas nav vajadzīgs standarta darbam). */
export function scriptInput(job) {
  return {
    jobId: job.id,
    plate: job.vehicle.plate,
    brandModel: job.vehicle.brandModel,
    vin: job.vehicle.vin || "",
    company: job.auto.company,
    ctx: job.auto.ctx,
    routeFrom: job.routeFrom,
    routeTo: job.routeTo,
    validFrom: job.validFrom,
    validUntil: job.validUntil,
    validHours: job.validHours,
    // Ja VIN pieņemts tirdzniecībā: akts -> "Noformēt pavadzīmi" (1); citādi jauna pavadzīme (2). Skripts izvēlas pēc VIN.
    preferTradeAct: Boolean(job.vehicle.vin),
  };
}

/** Aizpildītie lauki pirms Saglabāt sakrīt ar darbu (save.js pārbauda vēlreiz). */
export function verifyFilledFields(job, fields) {
  const want = { plate: compact(job.vehicle.plate), validHours: 48 };
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
 * Viena darba apstrāde. deps: { api, vpnLease, runScript, readPdfBase64, now, log, dryRun }.
 * Kļūda pirms Saglabāt -> event error + release Aivaram (serveris viņu pamodina).
 * Kļūda Saglabāt laikā vai pēc -> result ok:false (CSDD jāpārbauda cilvēkam), nekāda atkārtošana.
 */
export async function processJob(job, deps) {
  const marks = { created: Date.parse(job.createdAt) };
  const check = localStandardCheck(job);
  if (!check.ok) {
    deps.log("skip_nonstandard", { id: job.id, reason: check.reason });
    return { outcome: "skipped", reason: check.reason };
  }
  if (deps.dryRun) {
    deps.log("dry_run_would_process", { id: job.id, plate: job.vehicle.plate });
    return { outcome: "dry_run" };
  }
  const claimed = await deps.api.claim(job.id);
  if (!claimed) return { outcome: "not_claimed" };
  marks.claim = deps.now();
  let saveStarted = false;
  try {
    await deps.vpnLease();
    marks.vpnUp = deps.now();
    const input = scriptInput(job);
    const filled = await deps.runScript("fill", input);
    if (!filled?.ok) throw new Error(filled?.error || "forma netika aizpildīta");
    const verified = verifyFilledFields(job, filled.fields);
    if (!verified.ok) throw new Error(verified.reason);
    marks.filled = deps.now();
    saveStarted = true;
    const saved = await deps.runScript("save", input);
    if (!saved?.ok || !saved.waybillNo) throw new Error(saved?.error || "Saglabāt neizdevās");
    marks.saved = deps.now();
    const pdfBase64 = saved.pdfPath ? await deps.readPdfBase64(saved.pdfPath) : "";
    marks.pdf = deps.now();
    await deps.api.result(job.id, { ok: true, waybillNo: saved.waybillNo, pdfBase64, by: "auto" });
    marks.result = deps.now();
    const timings = formatTimings(marks);
    deps.log("issued", { id: job.id, waybillNo: saved.waybillNo, ...timings });
    await deps.api.event(job.id, { kind: "message", text: `Automātiski izrakstīta ${timings.totalSec ?? "?"} s laikā.`, by: "auto" }).catch(() => {});
    return { outcome: "issued", waybillNo: saved.waybillNo, timings };
  } catch (err) {
    const reason = (err instanceof Error ? err.message : String(err)).slice(0, 200);
    deps.log("job_failed", { id: job.id, reason, saveStarted, ...formatTimings(marks) });
    if (saveStarted) {
      await deps.api
        .result(job.id, { ok: false, errorReason: `Automātika: ${reason}. Pārbaudi CSDD, vai pavadzīme izveidota.`, by: "auto" })
        .catch(() => {});
      return { outcome: "error_after_save", reason };
    }
    await deps.api.event(job.id, { kind: "message", text: `Automātikas kļūda: ${reason}`, by: "auto" }).catch(() => {});
    await deps.api.release(job.id, reason).catch(() => {});
    return { outcome: "released", reason };
  }
}
