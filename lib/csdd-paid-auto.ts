import "server-only";

import { randomUUID } from "node:crypto";

import { sendAdminPush } from "@/lib/admin-push";
import { patchOrderDraft, readOrderDraft } from "@/lib/admin-order-draft-store";
import { createDefaultSourceBlocks, mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import {
  CSDD_PAID_LEASE_MS,
  CSDD_PAID_LOGIN_WAIT_MS,
  CSDD_PAID_MAX_ATTEMPTS,
  CSDD_PAID_POLL_INTERVAL_MS,
  CSDD_PAID_RETRY_MS,
  csddPaidAutoDailyMax,
  csddPaidAutoEnabled,
  csddPaidAutoPlate,
  csddPaidAutoProductEligible,
  decideCsddPaidAutoAction,
  rigaDayKey,
  type CsddPaidAutoJob,
} from "@/lib/csdd-paid-auto-logic";
import {
  csddPaidAutoDailyCount,
  listOpenCsddPaidAutoJobs,
  readCsddPaidAutoJob,
  reserveCsddPaidAutoDailySlot,
  updateCsddPaidAutoJob,
} from "@/lib/csdd-paid-auto-store";
import { buildCsddLocalParseFromText } from "@/lib/csdd-pdf-ingest";
import { fetchEcsddRelaySession } from "@/lib/ecsdd-auto";
import { ecsddAutoSmsMode, fetchEcsddPaidReport, requestEcsddPaidSmsLink } from "@/lib/ecsdd-paid";
import { applyCsddPaidReportToForm, autoSmsDecision, isValidAutoSms } from "@/lib/ecsdd-paid-logic";
import { readAutoSms, writeAutoSms } from "@/lib/ecsdd-paid-store";
import { sendCsddSmsTriggerEmail } from "@/lib/email/send-transactional";
import { ensureOrderDropboxFolder } from "@/lib/order-dropbox";

/**
 * Automātiskā CSDD maksas izziņa (servera puse). Ieslēdz `CSDD_PAID_AUTO_ENABLED=1`; dienas griesti
 * `CSDD_PAID_AUTO_DAILY_MAX` (noklusējums 10). SMS sūta Nila iPhone Īsceļš (tas pats e-pasts kā pogai "Sūtīt automātiski").
 * Nekad: Smart-ID automātiski (login:false), atkārtota SMS tam pašam pasūtījumam, SMS naktī (23:00-07:30 Rīgā).
 */

const LOG = "[csdd-paid-auto]";
const iso = (ms = Date.now()) => new Date(ms).toISOString();

/** Pēc apmaksas (webhook, pēc CSDD API sēklas): izveido darbu, ja produkts un numurs der. Idempotenti. */
export async function enqueueCsddPaidAutoForOrder(
  sessionId: string,
  args: { checkoutLine?: string | null; fulfillment?: string | null; isDealerData?: boolean; isTelegram?: boolean; orderVinOrPlate?: string | null },
): Promise<CsddPaidAutoJob | null> {
  if (!csddPaidAutoEnabled()) return null;
  if (!csddPaidAutoProductEligible(args)) return null;
  const draft = await readOrderDraft(sessionId).catch(() => null);
  const csdd = mergeSourceBlocksWithDefaults(draft?.workspace?.sourceBlocks ?? {}).csdd;
  const plate = csddPaidAutoPlate({
    registryPlate: csdd.registry?.data?.registrationNumber,
    enteredPlates: [draft?.orderEdits?.licensePlate, args.orderVinOrPlate],
  });
  if (!plate) return null;
  const { job } = await updateCsddPaidAutoJob(sessionId, (cur) => {
    if (cur) return null; // viens darbs uz pasūtījumu (arī pēc atkārtota webhook)
    const now = iso();
    return { sessionId, plate, state: "queued", createdAt: now, updatedAt: now };
  });
  return job;
}

async function pushOnce(job: CsddPaidAutoJob, body: string): Promise<boolean> {
  if (job.loginPushAt) return false;
  await Promise.resolve()
    .then(() =>
      sendAdminPush({
    title: "e.csdd: vajag pieslēgties",
    body,
    url: `/admin/orders/${encodeURIComponent(job.sessionId)}`,
    tag: "ecsdd-paid-login",
    audience: "pro",
      }),
    )
    .catch(() => undefined);
  return true;
}

/** Noma: tikai viena palaišana vienlaikus vienam darbam. */
async function claim(sessionId: string, now: number): Promise<{ job: CsddPaidAutoJob; leaseId: string } | null> {
  const leaseId = randomUUID();
  const { job, changed } = await updateCsddPaidAutoJob(sessionId, (cur) => {
    if (!cur) return null;
    if (Date.parse(cur.leaseUntil ?? "") > now) return null;
    return { ...cur, leaseId, leaseUntil: iso(now + CSDD_PAID_LEASE_MS) };
  });
  return changed && job ? { job, leaseId } : null;
}

/** Raksta tikai, ja noma vēl pieder mums; noma tiek atbrīvota. */
async function finish(sessionId: string, leaseId: string, patch: (cur: CsddPaidAutoJob) => CsddPaidAutoJob): Promise<CsddPaidAutoJob | null> {
  const { job } = await updateCsddPaidAutoJob(sessionId, (cur) => {
    if (!cur || cur.leaseId !== leaseId) return null;
    const next = patch(cur);
    delete next.leaseId;
    delete next.leaseUntil;
    return next;
  });
  return job;
}

/** Izziņas teksts -> CSDD bloks (tas pats ceļš kā maksas izziņas pogai; ar roku aizpildītais paliek). */
export async function applyCsddPaidReportToOrderDraft(sessionId: string, rawText: string): Promise<boolean> {
  const parsed = buildCsddLocalParseFromText(rawText, "e.csdd maksas izziņa");
  for (let attempt = 0; attempt < 3; attempt++) {
    const draft = await readOrderDraft(sessionId);
    const baseline = draft?.workspace ?? {
      sourceBlocks: createDefaultSourceBlocks(),
      iriss: "",
      apskatesPlāns: "",
      tehniskoRiskuAnalize: "",
      cenasAtbilstiba: "",
      previewConfirmed: false,
    };
    const blocks = mergeSourceBlocksWithDefaults(baseline.sourceBlocks);
    const csdd = applyCsddPaidReportToForm(blocks.csdd, parsed.fields, parsed.rawUnprocessedData || rawText);
    const res = await patchOrderDraft(
      sessionId,
      { workspace: { ...baseline, sourceBlocks: { ...blocks, csdd } } },
      draft?.workspaceRevision ? { expectedWorkspaceRevision: draft.workspaceRevision } : {},
    );
    if (res.ok) return true;
    if (res.error !== "stale_revision") {
      console.error(`${LOG} apply failed`, { sessionId: sessionId.slice(-8), error: res.error });
      return false;
    }
  }
  return false;
}

async function smsSend(job: CsddPaidAutoJob, number: string, body: string): Promise<"sent" | "already" | "failed"> {
  const mode = ecsddAutoSmsMode();
  if (!mode) return "failed";
  const now = new Date();
  const rec = { id: `auto-${job.sessionId}`.slice(0, 80), number, body, plate: job.plate, createdAt: now.toISOString() };
  const prev = await readAutoSms();
  // Tas pats SMS teksts pirms brīža (piem. Nils nospieda pogu) - otru nesūtām.
  if (autoSmsDecision(prev, rec, now) === "duplicate") return "already";
  if (mode === "pull") return (await writeAutoSms({ ...rec, emailedAt: rec.createdAt })) ? "sent" : "failed";
  if (!(await writeAutoSms(rec))) return "failed";
  try {
    await sendCsddSmsTriggerEmail({ to: (process.env.ECSDD_SMS_TRIGGER_EMAIL ?? "").trim(), number, body });
  } catch (e) {
    console.error(`${LOG} trigger email failed`, e instanceof Error ? e.message.slice(0, 120) : "unknown");
    return "failed";
  }
  const sent = new Date().toISOString();
  await writeAutoSms({ ...rec, emailedAt: sent, consumedAt: sent });
  return "sent";
}

async function deferLogin(sessionId: string, leaseId: string, job: CsddPaidAutoJob, now: number, why: string) {
  if (now - Date.parse(job.createdAt) > CSDD_PAID_LOGIN_WAIT_MS) {
    return finish(sessionId, leaseId, (c) => ({ ...c, state: "error", error: "e.csdd sesija nebija aktīva 24 h" }));
  }
  const pushed = await pushOnce(job, `Automātiskā CSDD maksas izziņa (${job.plate}) gaida e.csdd sesiju. Adminā spied "Pieslēgt e.csdd".`);
  return finish(sessionId, leaseId, (c) => ({
    ...c,
    state: "queued",
    deferReason: "login",
    nextAttemptAt: iso(now + CSDD_PAID_RETRY_MS),
    error: why,
    ...(pushed ? { loginPushAt: iso(now) } : {}),
  }));
}

async function requestSms(sessionId: string, leaseId: string, job: CsddPaidAutoJob, now: number): Promise<CsddPaidAutoJob | null> {
  if (!ecsddAutoSmsMode()) return finish(sessionId, leaseId, (c) => ({ ...c, state: "error", error: "SMS automātika nav konfigurēta" }));
  const session = await fetchEcsddRelaySession();
  if (session?.state !== "active") return deferLogin(sessionId, leaseId, job, now, "e.csdd nav pieslēgts");

  const day = rigaDayKey(now);
  if (!(await reserveCsddPaidAutoDailySlot(day, sessionId, csddPaidAutoDailyMax()))) {
    return finish(sessionId, leaseId, (c) => ({ ...c, state: "queued", deferReason: "daily_cap", nextAttemptAt: iso(now + 60 * 60_000) }));
  }

  const link = await requestEcsddPaidSmsLink(job.plate, { login: false });
  if (link.status === "needs_login") return deferLogin(sessionId, leaseId, job, now, "e.csdd sesija beigusies");
  if (link.status === "not_found" || link.status === "no_button" || link.status === "not_configured") {
    return finish(sessionId, leaseId, (c) => ({ ...c, state: "error", error: link.status }));
  }
  if (link.status !== "ok") {
    const attempts = (job.attempts ?? 0) + 1;
    const code = link.status === "error" ? link.code || "error" : link.status;
    return finish(sessionId, leaseId, (c) =>
      attempts >= CSDD_PAID_MAX_ATTEMPTS
        ? { ...c, attempts, state: "error", error: code }
        : { ...c, attempts, state: "queued", deferReason: "retry", nextAttemptAt: iso(now + CSDD_PAID_RETRY_MS), error: code },
    );
  }
  if (!isValidAutoSms({ number: link.number, body: link.body, plate: job.plate })) {
    return finish(sessionId, leaseId, (c) => ({ ...c, state: "error", error: "SMS teksts neatbilst numuram" }));
  }

  // No šī brīža SMS šim pasūtījumam vairs nekad nesūta (arī ja process apstājas).
  const started = await finish(sessionId, leaseId, (c) => ({ ...c, smsStartedAt: iso(now) }));
  if (!started) return null;
  // `finish` noņem nomu; atjaunojam to SMS sūtīšanas laikam.
  const relock = await claim(sessionId, Date.now());
  const lease = relock?.leaseId ?? leaseId;
  const outcome = await smsSend(job, link.number, link.body);
  const t = Date.now();
  if (outcome === "failed") {
    const attempts = (job.attempts ?? 0) + 1;
    // E-pasts nenosūtījās (SMS netika sūtīta) - drīkst mēģināt vēlreiz.
    return finish(sessionId, lease, (c) => {
      const next: CsddPaidAutoJob = attempts >= CSDD_PAID_MAX_ATTEMPTS
        ? { ...c, attempts, state: "error", error: "SMS e-pasts neizdevās" }
        : { ...c, attempts, state: "queued", deferReason: "retry", nextAttemptAt: iso(t + CSDD_PAID_RETRY_MS), error: "SMS e-pasts neizdevās" };
      delete next.smsStartedAt;
      return next;
    });
  }
  console.info(`${LOG} sms`, { sessionId: sessionId.slice(-8), outcome });
  return finish(sessionId, lease, (c) => {
    const next: CsddPaidAutoJob = { ...c, state: "sms_sent", smsSentAt: iso(t), pollStartedAt: iso(t) };
    delete next.deferReason;
    delete next.nextAttemptAt;
    delete next.error;
    return next;
  });
}

async function poll(sessionId: string, leaseId: string, job: CsddPaidAutoJob, now: number): Promise<CsddPaidAutoJob | null> {
  const sinceMs = Date.parse(job.smsStartedAt ?? job.pollStartedAt ?? job.createdAt) - 2 * 60_000;
  // Pēc atrastas izziņas relejs nospiež "Nosūtīt uz reģistrēto epastu" (bez maksas) - PDF nonāk info@provin.lv.
  const out = await fetchEcsddPaidReport(job.plate, iso(sinceMs), { sendEmail: true });
  const t = Date.now();
  if (out.status === "found") {
    const found = await finish(sessionId, leaseId, (c) => ({
      ...c,
      state: "found",
      foundAt: iso(t),
      paidAt: out.paidAt || undefined,
      rawText: out.rawText,
      lastPollAt: iso(t),
      polls: (c.polls ?? 0) + 1,
      ...(out.emailSent ? { pdfEmailAt: iso(t) } : {}),
    }));
    if (found) await applyFound(found);
    return readCsddPaidAutoJob(sessionId);
  }
  let pushed = false;
  if (out.status === "needs_login") pushed = await pushOnce(job, `CSDD maksas izziņa (${job.plate}) gaida: e.csdd sesija beigusies. Adminā spied "Pieslēgt e.csdd".`);
  return finish(sessionId, leaseId, (c) => ({
    ...c,
    state: c.state === "queued" ? "sms_sent" : c.state,
    pollStartedAt: c.pollStartedAt ?? c.smsStartedAt ?? iso(now),
    lastPollAt: iso(t),
    polls: (c.polls ?? 0) + 1,
    ...(pushed ? { loginPushAt: iso(t) } : {}),
  }));
}

async function applyFound(job: CsddPaidAutoJob): Promise<void> {
  if (!job.rawText || job.appliedAt) return;
  const ok = await applyCsddPaidReportToOrderDraft(job.sessionId, job.rawText).catch(() => false);
  if (ok) {
    await updateCsddPaidAutoJob(job.sessionId, (c) => (c && !c.appliedAt ? { ...c, appliedAt: iso() } : null));
    // Marka/modelis tagad zināmi -> mapes nosaukums.
    await ensureOrderDropboxFolder(job.sessionId).catch(() => null);
  }
}

/** Viens solis vienam darbam (ja kaut kas jādara tagad). */
export async function runCsddPaidAutoOnce(sessionId: string): Promise<CsddPaidAutoJob | null> {
  const job = await readCsddPaidAutoJob(sessionId);
  if (!job) return null;
  const now = Date.now();
  const dailyCount = job.state === "queued" && !job.smsStartedAt ? await csddPaidAutoDailyCount(rigaDayKey(now)) : 0;
  const action = decideCsddPaidAutoAction(job, now, { dailyCount, dailyMax: csddPaidAutoDailyMax() });
  if (action.kind === "none" || action.kind === "wait") return job;
  if (action.kind === "defer") {
    const { job: next } = await updateCsddPaidAutoJob(sessionId, (c) =>
      c && c.state === "queued" && !c.smsStartedAt ? { ...c, deferReason: action.reason, nextAttemptAt: iso(action.until) } : null,
    );
    return next;
  }
  if (action.kind === "apply") {
    await applyFound(job);
    return readCsddPaidAutoJob(sessionId);
  }
  if (action.kind === "expire") {
    const { job: next } = await updateCsddPaidAutoJob(sessionId, (c) => (c && c.state === "sms_sent" ? { ...c, state: "awaiting_payment" } : null));
    return next;
  }
  const lease = await claim(sessionId, now);
  if (!lease) return job;
  try {
    if (action.kind === "request_sms") return await requestSms(sessionId, lease.leaseId, lease.job, now);
    return await poll(sessionId, lease.leaseId, lease.job, now);
  } catch (e) {
    console.error(`${LOG} step failed`, { sessionId: sessionId.slice(-8), error: e instanceof Error ? e.message.slice(0, 120) : "unknown" });
    await finish(sessionId, lease.leaseId, (c) => ({ ...c }));
    return readCsddPaidAutoJob(sessionId);
  }
}

/**
 * Cron (ik 5 min dienā): visi atvērtie darbi; kamēr kāds gaida izziņu, aptauja ik 30 s līdz `deadlineMs`.
 * Ja darbu nav, beidz uzreiz (lēti).
 */
export async function runCsddPaidAutoSweep(deadlineMs: number): Promise<{ processed: number; open: number }> {
  let processed = 0;
  for (;;) {
    const jobs = await listOpenCsddPaidAutoJobs();
    for (const job of jobs) {
      if (Date.now() > deadlineMs - 60_000) return { processed, open: jobs.length };
      await runCsddPaidAutoOnce(job.sessionId);
      processed++;
    }
    const waiting = (await listOpenCsddPaidAutoJobs()).filter((j) => j.state === "sms_sent");
    if (waiting.length === 0) return { processed, open: jobs.length };
    const nextDue = Math.min(...waiting.map((j) => (Date.parse(j.lastPollAt ?? "") || 0) + CSDD_PAID_POLL_INTERVAL_MS));
    const sleep = Math.max(1000, nextDue - Date.now());
    if (Date.now() + sleep > deadlineMs - 60_000) return { processed, open: waiting.length };
    await new Promise((r) => setTimeout(r, sleep));
  }
}

/** Admin: "Pārbaudīt vēlreiz" pēc "gaida apmaksu" - vēl 30 min aptauja, BEZ jaunas SMS. */
export async function recheckCsddPaidAuto(sessionId: string): Promise<CsddPaidAutoJob | null> {
  const { job } = await updateCsddPaidAutoJob(sessionId, (c) => {
    if (!c || (c.state !== "awaiting_payment" && !(c.state === "error" && c.smsStartedAt))) return null;
    const next: CsddPaidAutoJob = { ...c, state: "sms_sent", pollStartedAt: iso() };
    delete next.lastPollAt;
    delete next.error;
    return next;
  });
  return job;
}

/** Admin ievietoja izziņu pats (servera ielasīšana neizdevās). */
export async function markCsddPaidAutoApplied(sessionId: string): Promise<CsddPaidAutoJob | null> {
  const { job } = await updateCsddPaidAutoJob(sessionId, (c) => (c && c.state === "found" && !c.appliedAt ? { ...c, appliedAt: iso() } : null));
  return job ?? readCsddPaidAutoJob(sessionId);
}
