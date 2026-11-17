/**
 * LTAB uzdevumu rinda: viens uzdevums vienlaikus (viens Chrome, viena sesija), nakts aizliegums automātikai,
 * stundas limits, rezultāts uz PROVIN caur `notify`. Rinda saglabājas failā (bez PDF), lai pēc restarta neizgaistu.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";

export function createJobQueue({
  run,
  notify,
  log = () => undefined,
  now = () => new Date(),
  isNight = () => false,
  maxQueue = 20,
  maxPerHour = 20,
  stateFile = "",
}) {
  /** @type {Array<{jobId:string, ref:string, plate:string, trigger:string, state:string, createdAt:string, code?:string}>} */
  let jobs = [];
  let running = null;
  const startedAt = [];

  async function persist() {
    if (!stateFile) return;
    // Arī "running": pēc restarta tas jāpalaiž vēlreiz, citādi PROVIN paliek "rindā" uz visiem laikiem.
    const pending = jobs
      .filter((j) => j.state === "queued" || j.state === "running")
      .map(({ jobId, ref, plate, trigger, createdAt }) => ({ jobId, ref, plate, trigger, state: "queued", createdAt }));
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
      jobs = (Array.isArray(raw.jobs) ? raw.jobs : []).filter((j) => j && j.jobId && j.ref && j.plate).map((j) => ({ ...j, state: "queued" }));
    } catch {
      jobs = [];
    }
  }

  async function send(job, state, extra = {}) {
    const body = { jobId: job.jobId, ref: job.ref, plate: job.plate, state, at: now().toISOString(), ...extra };
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

  function waitsForMorning(job) {
    return job.trigger !== "manual" && isNight(now());
  }

  function enqueue({ ref, plate, trigger }) {
    const active = jobs.find((j) => j.ref === ref && j.plate === plate && (j.state === "queued" || j.state === "running"));
    if (active) return { jobId: active.jobId, state: active.state === "running" ? "running" : waitsForMorning(active) ? "deferred_night" : "queued", duplicate: true };
    if (jobs.filter((j) => j.state === "queued").length >= maxQueue) {
      const err = new Error("queue_full");
      err.code = "queue_full";
      throw err;
    }
    const job = { jobId: randomUUID(), ref, plate, trigger: trigger === "manual" ? "manual" : "auto", state: "queued", createdAt: now().toISOString() };
    jobs.push(job);
    void persist();
    return { jobId: job.jobId, state: waitsForMorning(job) ? "deferred_night" : "queued", duplicate: false };
  }

  function nextRunnable() {
    const t = now().getTime();
    while (startedAt.length && t - startedAt[0] > 3_600_000) startedAt.shift();
    if (startedAt.length >= maxPerHour) return null;
    // Manuālie (Nils pats nospieda) pirms automātiskajiem.
    const queued = jobs.filter((j) => j.state === "queued" && !waitsForMorning(j));
    return queued.find((j) => j.trigger === "manual") ?? queued[0] ?? null;
  }

  async function tick() {
    if (running) return false;
    const job = nextRunnable();
    if (!job) return false;
    job.state = "running";
    running = job;
    startedAt.push(now().getTime());
    void persist();
    try {
      const result = await run(job, (state, extra) => send(job, state, extra));
      await send(job, "result", {
        found: Boolean(result.found),
        ...(result.pdf ? { pdfBase64: Buffer.from(result.pdf).toString("base64") } : {}),
      });
      job.state = "done";
      log(`uzdevums ${job.jobId.slice(0, 8)}: ${result.found ? "ir ieraksti" : "nav ierakstu"}${result.pdf ? " + PDF" : ""}`);
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
    get: (jobId) => jobs.find((j) => j.jobId === jobId) ?? null,
    stats: () => ({
      queued: jobs.filter((j) => j.state === "queued").length,
      running: running ? running.jobId : null,
      lastHour: startedAt.length,
    }),
  };
}
