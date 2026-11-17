/**
 * e.csdd uzziņu rinda (bez pārlūka): saglabājas failā, lai pēc restarta neizgaistu. Rezultātu teksts netiek glabāts.
 * Kārtība: Nila pogas (manual) pirms automātiskajām; stundas limits (CSDD noteikumi 7.3.4 "nepārslogot").
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";

export function createJobQueue({ now = () => new Date(), maxQueue = 30, maxPerHour = 20, stateFile = "", log = () => undefined }) {
  /** @type {Array<{jobId:string, ref:string, query:string, kind:string, trigger:string, state:string, createdAt:string, waitNotified?:string}>} */
  let jobs = [];
  const startedAt = [];

  async function persist() {
    if (!stateFile) return;
    const pending = jobs
      .filter((j) => j.state === "queued" || j.state === "running")
      .map(({ jobId, ref, query, kind, trigger, createdAt }) => ({ jobId, ref, query, kind, trigger, state: "queued", createdAt }));
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
      jobs = (Array.isArray(raw.jobs) ? raw.jobs : [])
        .filter((j) => j && j.jobId && j.ref && j.query)
        .map((j) => ({ ...j, state: "queued" }));
    } catch {
      jobs = [];
    }
  }

  function enqueue({ ref, query, kind, trigger }) {
    const active = jobs.find((j) => j.ref === ref && j.query === query && (j.state === "queued" || j.state === "running"));
    if (active) {
      // Nila poga paaugstina jau gaidošu automātisko uzdevumu.
      if (trigger === "manual" && active.trigger !== "manual") active.trigger = "manual";
      return { job: active, duplicate: true };
    }
    if (jobs.filter((j) => j.state === "queued").length >= maxQueue) {
      const err = new Error("queue_full");
      err.code = "queue_full";
      throw err;
    }
    const job = { jobId: randomUUID(), ref, query, kind, trigger: trigger === "manual" ? "manual" : "auto", state: "queued", createdAt: now().toISOString() };
    jobs.push(job);
    void persist();
    return { job, duplicate: false };
  }

  function queued() {
    const q = jobs.filter((j) => j.state === "queued");
    return [...q.filter((j) => j.trigger === "manual"), ...q.filter((j) => j.trigger !== "manual")];
  }

  function rateLimited() {
    const t = now().getTime();
    while (startedAt.length && t - startedAt[0] > 3_600_000) startedAt.shift();
    return startedAt.length >= maxPerHour;
  }

  function start(job) {
    job.state = "running";
    startedAt.push(now().getTime());
    void persist();
  }

  /** Atpakaļ rindā (piem. sesija izrādījās beigusies) - neskaita limitā otrreiz. */
  function requeue(job) {
    job.state = "queued";
    startedAt.pop();
    void persist();
  }

  function finish(job, state) {
    job.state = state;
    const cutoff = now().getTime() - 6 * 3_600_000;
    jobs = jobs.filter((j) => j.state === "queued" || j.state === "running" || Date.parse(j.createdAt) > cutoff);
    void persist();
  }

  return {
    load,
    enqueue,
    queued,
    rateLimited,
    start,
    requeue,
    finish,
    get: (jobId) => jobs.find((j) => j.jobId === jobId) ?? null,
    stats: () => ({
      queued: jobs.filter((j) => j.state === "queued").length,
      running: jobs.find((j) => j.state === "running")?.jobId ?? null,
      lastHour: startedAt.length,
    }),
  };
}
