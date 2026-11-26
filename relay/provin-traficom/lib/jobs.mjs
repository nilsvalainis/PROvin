/**
 * Traficom uzdevumu rinda: viens uzdevums vienlaikus (viens Chrome, viena sesija), ne biežāk kā 1 vaicājums ik
 * `minIntervalMs` (30 s), stundas limits, rezultāts uz PROVIN caur `notify`. Rinda saglabājas failā (bez PDF),
 * lai pēc restarta neizgaistu. Atslēga ir VIN + pasūtījuma atsauce.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";

export function createJobQueue({
  run,
  notify,
  log = () => undefined,
  now = () => new Date(),
  maxQueue = 30,
  maxPerHour = 30,
  minIntervalMs = 30_000,
  stateFile = "",
}) {
  /** @type {Array<{jobId:string, ref:string, vin:string, trigger:string, force:boolean, vehicleType?:string, state:string, createdAt:string, code?:string}>} */
  let jobs = [];
  let running = null;
  let lastStartAt = 0;
  const startedAt = [];

  async function persist() {
    if (!stateFile) return;
    // Arī "running": pēc restarta tas jāpalaiž vēlreiz, citādi PROVIN paliek "rindā" uz visiem laikiem.
    const pending = jobs
      .filter((j) => j.state === "queued" || j.state === "running")
      .map(({ jobId, ref, vin, trigger, force, vehicleType, createdAt }) => ({ jobId, ref, vin, trigger, force, vehicleType, state: "queued", createdAt }));
    try {
      await fs.writeFile(`${stateFile}.tmp`, JSON.stringify({ jobs: pending }), { mode: 0o600 });
      await fs.rename(`${stateFile}.tmp`, stateFile);
    } catch (e) {
      log(`rindas fails netika saglabāts: ${e instanceof Error ? e.message : "?"}`);
    }
  }

  async function load() {
    if (!stateFile) return;
    try {
      const raw = JSON.parse(await fs.readFile(stateFile, "utf8"));
      jobs = (Array.isArray(raw.jobs) ? raw.jobs : []).filter((j) => j && j.jobId && j.ref && j.vin).map((j) => ({ ...j, state: "queued" }));
    } catch {
      jobs = [];
    }
  }

  async function send(job, state, extra = {}) {
    const body = { jobId: job.jobId, ref: job.ref, vin: job.vin, state, at: now().toISOString(), ...extra };
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await notify(body);
        return true;
      } catch (e) {
        log(`PROVIN atzvans neizdevās (${state}, mēģinājums ${attempt + 1}): ${e instanceof Error ? e.message : "?"}`);
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
    return false;
  }

  function enqueue({ ref, vin, trigger, force = false, vehicleType = "car" }) {
    const active = jobs.find((j) => j.ref === ref && j.vin === vin && (j.state === "queued" || j.state === "running"));
    if (active) return { jobId: active.jobId, state: active.state === "running" ? "running" : "queued", duplicate: true };
    if (jobs.filter((j) => j.state === "queued").length >= maxQueue) {
      const err = new Error("queue_full");
      err.code = "queue_full";
      throw err;
    }
    const job = {
      jobId: randomUUID(),
      ref,
      vin,
      trigger: trigger === "manual" ? "manual" : "auto",
      force: Boolean(force),
      vehicleType: String(vehicleType || "car"),
      state: "queued",
      createdAt: now().toISOString(),
    };
    jobs.push(job);
    void persist();
    return { jobId: job.jobId, state: "queued", duplicate: false };
  }

  function nextRunnable() {
    const t = now().getTime();
    while (startedAt.length && t - startedAt[0] > 3_600_000) startedAt.shift();
    if (startedAt.length >= maxPerHour) return null;
    // Ne vairāk kā 1 vaicājums ik `minIntervalMs` (Traficom nedrīkst just kā robots).
    if (lastStartAt && t - lastStartAt < minIntervalMs) return null;
    const queued = jobs.filter((j) => j.state === "queued");
    // Manuālie (Nils pats nospieda) pirms automātiskajiem.
    return queued.find((j) => j.trigger === "manual") ?? queued[0] ?? null;
  }

  /** Cik ms līdz nākamajam atļautajam startam (0 = var tūlīt). */
  function waitMs() {
    if (!lastStartAt) return 0;
    return Math.max(0, minIntervalMs - (now().getTime() - lastStartAt));
  }

  async function tick() {
    if (running) return false;
    const job = nextRunnable();
    if (!job) return false;
    job.state = "running";
    running = job;
    lastStartAt = now().getTime();
    startedAt.push(lastStartAt);
    void persist();
    try {
      const result = await run(job, (state, extra) => send(job, state, extra));
      await send(job, "result", {
        found: Boolean(result.found),
        ...(result.rawText ? { rawText: result.rawText } : {}),
        ...(result.data ? { data: result.data } : {}),
        ...(result.cached ? { cached: true, cachedAt: result.cachedAt } : {}),
        ...(result.pdf ? { pdfBase64: Buffer.from(result.pdf).toString("base64") } : {}),
      });
      job.state = "done";
      log(`uzdevums ${job.jobId.slice(0, 8)}: ${result.found ? "dati nolasīti" : "auto nav atrasts"}${result.pdf ? " + PDF" : ""}${result.cached ? " (kešs)" : ""}`);
    } catch (e) {
      const code = (e && e.code) || "error";
      job.state = "failed";
      job.code = code;
      log(`uzdevums ${job.jobId.slice(0, 8)}: kļūda ${code}`);
      await send(job, "error", { code, message: String(e?.message ?? code).slice(0, 200) });
    } finally {
      running = null;
      // Pabeigtos glabā tikai īsu brīdi stāvokļa skatam.
      jobs = jobs.filter((j) => j.state === "queued" || j.state === "running" || Date.parse(j.createdAt) > now().getTime() - 6 * 3_600_000);
      void persist();
    }
    return true;
  }

  return {
    load,
    enqueue,
    tick,
    waitMs,
    get: (jobId) => jobs.find((j) => j.jobId === jobId) ?? null,
    stats: () => ({
      queued: jobs.filter((j) => j.state === "queued").length,
      running: running ? running.jobId : null,
      lastHour: startedAt.length,
    }),
  };
}
