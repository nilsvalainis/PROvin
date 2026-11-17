/**
 * e.csdd releja kodols bez pārlūka: rinda + sesijas politika + atzvani uz PROVIN.
 * Pārlūka darbu dara `browser` (ecsdd-flow.mjs); testos to aizvieto viltojums (lib/ecsdd-relay.test.ts).
 *
 * browser:
 *   login({ onCode }) -> void              (throws { code }: smartid_timeout | smartid_refused | captcha | page_changed | ...)
 *   ping() -> "ok" | "logged_out"
 *   lookup(query) -> { status: "found", rawText } | { status: "not_found" } | { status: "logged_out" }
 *   logout() -> void
 *
 * Atzvani (`notify`):
 *   { kind: "session", session }                                        - sesijas stāvoklis (ar kodu, ja gaida Smart-ID)
 *   { kind: "job", jobId, ref, query, state, ... }                      - queued | awaiting_login | awaiting_smartid |
 *                                                                         searching | result | error
 */
import fs from "node:fs/promises";

import {
  autoLoginBlockReason,
  initialSession,
  keepAliveDue,
  onAwaitingSmartId,
  onLoggedOutDetected,
  onLoginFailed,
  onLoginOk,
  onLoginStarted,
  onReleased,
  onSessionOk,
  parseSession,
  publicSession,
} from "./session.mjs";

export function createRelayCore({ queue, browser, notify, cfg, now = () => new Date(), isWorkHours, sessionFile = "", log = () => undefined }) {
  let session = initialSession(now());
  let pendingManualLogin = false;
  let busy = 0;
  let lock = Promise.resolve();

  function exclusive(fn) {
    busy++;
    const p = lock.then(fn).finally(() => {
      busy--;
    });
    lock = p.catch(() => undefined);
    return p;
  }

  async function persistSession() {
    if (!sessionFile) return;
    const { verificationCode: _c, ...rest } = session;
    void _c;
    try {
      await fs.writeFile(`${sessionFile}.tmp`, JSON.stringify(rest), { mode: 0o600 });
      await fs.rename(`${sessionFile}.tmp`, sessionFile);
    } catch (e) {
      log(`sesijas fails netika saglabāts: ${e instanceof Error ? e.message : "?"}`);
    }
  }

  async function load() {
    await queue.load();
    if (!sessionFile) return;
    try {
      session = parseSession(JSON.parse(await fs.readFile(sessionFile, "utf8")), now());
    } catch {
      session = initialSession(now());
    }
  }

  async function send(body) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await notify({ ...body, at: now().toISOString() });
        return true;
      } catch (e) {
        log(`PROVIN atzvans neizdevās (${body.kind}/${body.state ?? body.session?.state}, mēģinājums ${attempt + 1}): ${e instanceof Error ? e.message : "?"}`);
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    return false;
  }

  const view = () => publicSession(session, now(), cfg, isWorkHours);

  async function setSession(next) {
    const changed = next.state !== session.state || next.verificationCode !== session.verificationCode;
    session = next;
    await persistSession();
    if (changed) await send({ kind: "session", session: view() });
  }

  const jobBody = (job, state, extra = {}) => ({ kind: "job", jobId: job.jobId, ref: job.ref, query: job.query, state, ...extra });

  async function doLogin(trigger) {
    await setSession(onLoginStarted(session, now(), trigger));
    log(`pieteikšanās sākta (${trigger === "manual" ? "Nila poga" : "automātika"})`);
    try {
      await browser.login({
        onCode: async (code) => {
          await setSession(onAwaitingSmartId(session, now(), code));
          for (const job of queue.queued()) await send(jobBody(job, "awaiting_smartid", { verificationCode: code }));
        },
      });
      await setSession(onLoginOk(session, now()));
      log("e.csdd sesija aktīva");
      return true;
    } catch (e) {
      const code = (e && e.code) || "error";
      await setSession(onLoginFailed(session, now(), code));
      log(`pieteikšanās neizdevās: ${code}`);
      // Gaidošie uzdevumi beidzas ar kļūdu (PROVIN rāda "Pieprasīt vēlreiz"), lai neprasītu Smart-ID atkal un atkal.
      for (const job of queue.queued()) {
        queue.finish(job, "failed");
        await send(jobBody(job, "error", { code }));
      }
      return false;
    }
  }

  async function runLookup(job) {
    queue.start(job);
    await send(jobBody(job, "searching"));
    let r;
    try {
      r = await browser.lookup(job.query);
    } catch (e) {
      const code = (e && e.code) || "error";
      queue.finish(job, "failed");
      await send(jobBody(job, "error", { code, message: String(e?.message ?? code).slice(0, 200) }));
      log(`uzdevums ${job.jobId.slice(0, 8)}: kļūda ${code}`);
      return;
    }
    if (r.status === "logged_out") {
      queue.requeue(job);
      await setSession(onLoggedOutDetected(session, now(), cfg));
      log(`uzdevums ${job.jobId.slice(0, 8)}: sesija vairs nav aktīva (${session.state}), atpakaļ rindā`);
      return;
    }
    await setSession(onSessionOk(session, now(), { lookup: true }));
    queue.finish(job, "done");
    await send(jobBody(job, "result", r.status === "found" ? { found: true, rawText: r.rawText } : { found: false }));
    log(`uzdevums ${job.jobId.slice(0, 8)} ${job.kind}: ${r.status === "found" ? "atrasts" : "nav atrasts"}`);
  }

  /** Viens solis. Atgriež true, ja kaut kas tika izdarīts (izsaucējs var uzreiz mēģināt vēlreiz). */
  async function tick() {
    if (busy) return false;
    if (pendingManualLogin) {
      pendingManualLogin = false;
      if (session.state !== "active") {
        await exclusive(() => doLogin("manual"));
        return true;
      }
    }
    const q = queue.queued();
    if (!q.length) return false;
    if (session.state === "active") {
      if (queue.rateLimited()) return false;
      await exclusive(() => runLookup(q[0]));
      return true;
    }
    const manualJob = q.find((j) => j.trigger === "manual");
    const reason = manualJob ? null : autoLoginBlockReason(session, now(), cfg, isWorkHours);
    if (reason) {
      for (const job of q) {
        if (job.waitNotified === reason) continue;
        job.waitNotified = reason;
        await send(jobBody(job, "awaiting_login", { reason }));
      }
      return false;
    }
    await exclusive(() => doLogin(manualJob ? "manual" : "auto"));
    return true;
  }

  async function keepAliveTick() {
    if (busy || !keepAliveDue(session, now(), cfg, isWorkHours)) return false;
    await exclusive(async () => {
      try {
        const r = await browser.ping();
        if (r === "ok") await setSession(onSessionOk(session, now()));
        else {
          await setSession(onLoggedOutDetected(session, now(), cfg));
          log(`keep-alive: sesija beigusies (${session.state})`);
        }
      } catch (e) {
        log(`keep-alive kļūda: ${e instanceof Error ? e.message : "?"}`);
      }
    });
    return true;
  }

  function enqueue({ ref, query, kind, trigger }) {
    const { job, duplicate } = queue.enqueue({ ref, query, kind, trigger });
    return { jobId: job.jobId, duplicate, session: view() };
  }

  /** Nila poga "Pieslēgties e.csdd" (bez uzziņas). */
  function requestLogin() {
    if (session.state === "active" || session.state === "logging_in" || session.state === "awaiting_smartid") return view();
    pendingManualLogin = true;
    return view();
  }

  /** Nila poga "Atbrīvot e.csdd": serveris iziet un `minutes` pats nepiesakās. */
  async function release(minutes) {
    await exclusive(async () => {
      pendingManualLogin = false;
      await Promise.resolve(browser.logout()).catch(() => undefined);
      await setSession(onReleased(session, now(), minutes));
    });
    log(`e.csdd atbrīvots uz ${minutes} min`);
    return view();
  }

  return { load, tick, keepAliveTick, enqueue, requestLogin, release, session: view, stats: () => queue.stats(), getJob: queue.get };
}
