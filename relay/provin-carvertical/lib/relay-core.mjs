/**
 * CarVertical releja kodols (bez pārlūka, testējams ar viltus pārlūku).
 *
 * Rinda: viens uzdevums vienlaikus (viens Chrome). Uzdevums `purchase` (Nila poga adminā ar apstiprinājumu) vai
 * `report` (jau nopirktas atskaites lejupielāde, nekad nepērk). Pirkuma aizsardzība:
 *   1) pirms pirkuma vienmēr pārbauda "Manas atskaites" - ja šim VIN atskaite jau ir, lejupielādē to, NEPĒRK;
 *   2) VIN reģistrs (`state.json`) tiek ierakstīts PIRMS klikšķa - pēc restarta / kļūdas tas pats VIN netiek pirkts otrreiz;
 *   3) pērk tikai, ja kredītu atlikums >= 1 (nolasīts tajā pašā solī); karti / checkout relejs neaiztiek.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";

import { decidePurchase, findReportForVin, isValidVin, normalizeLoginCode, normalizeVin } from "./cv-page.mjs";

const ACTIVE = new Set(["queued", "running", "awaiting_login", "checking", "purchasing", "waiting_report", "downloading"]);

/** PDF glabātuve atmiņā (testiem); serveris lieto failus `DATA_DIR/pdf/`. */
export function memoryPdfStore() {
  const m = new Map();
  return {
    async save(id, base64) {
      const buf = Buffer.from(base64, "base64");
      m.set(id, buf);
      return buf.length;
    },
    async read(id) {
      return m.get(id) ?? null;
    },
  };
}

/** PDF faili `dir/<jobId>.pdf` (600), vecāki par `keepMs` tiek dzēsti. */
export function filePdfStore(dir, { keepMs = 48 * 3600_000 } = {}) {
  const safe = (id) => (/^[a-f0-9-]{36}$/.test(id) ? id : "");
  return {
    async save(id, base64) {
      const buf = Buffer.from(base64, "base64");
      await fs.mkdir(dir, { recursive: true, mode: 0o700 });
      await fs.writeFile(`${dir}/${safe(id)}.pdf`, buf, { mode: 0o600 });
      try {
        for (const f of await fs.readdir(dir)) {
          const st = await fs.stat(`${dir}/${f}`).catch(() => null);
          if (st && Date.now() - st.mtimeMs > keepMs) await fs.rm(`${dir}/${f}`, { force: true });
        }
      } catch {
        /* tīrīšana nav kritiska */
      }
      return buf.length;
    },
    async read(id) {
      if (!safe(id)) return null;
      return fs.readFile(`${dir}/${id}.pdf`).catch(() => null);
    },
  };
}

export function createRelayCore({
  browser,
  notify,
  stateFile = "",
  now = () => new Date(),
  log = () => undefined,
  loginWaitMs = 30 * 60_000,
  reportWaitMs = 8 * 60_000,
  balanceTtlMs = 30 * 60_000,
  /** Cik ilgi gaida kodu no e-pasta (Apps Script -> PROVIN -> šeit), pirms prasa Nilam (push "ievadi kodu"). */
  autoCodeWaitMs = 10 * 60_000,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  pdfStore = memoryPdfStore(),
}) {
  /** @type {Map<string, any>} */
  const jobs = new Map();
  /** VIN -> { jobId, startedAt, reportId? } : relejs šo VIN jau ir pircis (vai sācis pirkt). */
  let purchased = {};
  let balance = { credits: null, checkedAt: "" };
  let session = { state: "unknown", updatedAt: now().toISOString() };
  let busy = false;
  let codeNotifiedAt = "";
  /** Kods pieprasīts (CarVertical nosūtīja e-pastu) - Nilam paziņo tikai, ja automātiskais kods neatnāk `autoCodeWaitMs` laikā. */
  let codePendingAt = "";
  /** E-pasta kods ir vecāks par pieteikšanās sākumu mīnus šis (pulksteņu nobīde) -> netiek lietots. */
  const CODE_CLOCK_SKEW_MS = 60_000;

  async function persist() {
    if (!stateFile) return;
    try {
      const body = JSON.stringify({ purchased, balance });
      await fs.writeFile(`${stateFile}.tmp`, body, { mode: 0o600 });
      await fs.rename(`${stateFile}.tmp`, stateFile);
    } catch (e) {
      log(`stāvokļa fails netika saglabāts: ${e instanceof Error ? e.message : "?"}`);
    }
  }

  async function load() {
    if (!stateFile) return;
    try {
      const raw = JSON.parse(await fs.readFile(stateFile, "utf8"));
      if (raw && typeof raw.purchased === "object" && raw.purchased) purchased = raw.purchased;
      if (raw && raw.balance && typeof raw.balance === "object") balance = raw.balance;
    } catch {
      /* jauns */
    }
  }

  function setSession(next) {
    session = { ...next, updatedAt: now().toISOString() };
    if (session.state === "awaiting_code") {
      const at = Date.parse(session.codeRequestedAt ?? "");
      if (Number.isFinite(at)) session.autoCodeUntil = new Date(at + autoCodeWaitMs).toISOString();
    }
    return session;
  }

  /**
   * Push Nilam "ievadi kodu" tikai, ja kods no e-pasta neatnāca `autoCodeWaitMs` laikā (viens paziņojums uz pieprasījumu).
   * Bez pārlūka - lieto pēdējo zināmo sesiju. Serveris sauc ik 30 s.
   */
  async function checkCodeReminder() {
    if (session.state !== "awaiting_code" || !codePendingAt || codeNotifiedAt === codePendingAt) return false;
    const at = Date.parse(codePendingAt);
    const since = Number.isFinite(at) ? at : Date.parse(session.updatedAt);
    if (now().getTime() - since < autoCodeWaitMs) return false;
    codeNotifiedAt = codePendingAt;
    await emit({ kind: "session", state: "awaiting_code", at: now().toISOString() });
    return true;
  }

  async function emit(body) {
    try {
      await notify(body);
    } catch (e) {
      log(`atzvans neizdevās: ${e instanceof Error ? e.message : "?"}`);
    }
  }

  async function jobEvent(job, state, extra = {}) {
    job.state = state;
    job.updatedAt = now().toISOString();
    await emit({ kind: "job", jobId: job.jobId, ref: job.ref, vin: job.vin, jobKind: job.kind, state, at: job.updatedAt, ...extra });
  }

  function enqueue({ ref, vin, kind, requestId = "" }) {
    const v = normalizeVin(vin);
    if (!isValidVin(v)) {
      const err = new Error("invalid_vin");
      err.code = "invalid_vin";
      throw err;
    }
    if (kind !== "purchase" && kind !== "report") {
      const err = new Error("invalid_kind");
      err.code = "invalid_kind";
      throw err;
    }
    // Dubultklikšķis / atkārtots pieprasījums: tas pats VIN jau rindā vai darbā -> tas pats uzdevums.
    for (const j of jobs.values()) {
      if (j.vin === v && ACTIVE.has(j.state)) return { jobId: j.jobId, state: j.state, duplicate: true };
      if (requestId && j.requestId === requestId) return { jobId: j.jobId, state: j.state, duplicate: true };
    }
    const job = { jobId: randomUUID(), ref, vin: v, kind, requestId, state: "queued", createdAt: now().toISOString(), updatedAt: now().toISOString() };
    jobs.set(job.jobId, job);
    return { jobId: job.jobId, state: job.state, duplicate: false };
  }

  function nextJob() {
    for (const j of jobs.values()) if (j.state === "queued" || j.state === "awaiting_login") return j;
    return null;
  }

  async function ensureSession() {
    const s = await browser.ensureSession();
    setSession(s);
    if (s.state === "awaiting_code") {
      if (s.codeRequestedAt) codePendingAt = s.codeRequestedAt;
      else if (!codePendingAt) codePendingAt = now().toISOString();
      await checkCodeReminder();
    } else if (s.state === "needs_human") {
      await emit({ kind: "session", state: "needs_human", code: s.code ?? "", at: now().toISOString() });
    }
    return s;
  }

  async function updateBalance(credits) {
    if (typeof credits !== "number" || !Number.isFinite(credits)) return;
    balance = { credits, checkedAt: now().toISOString() };
    await persist();
    await emit({ kind: "balance", credits, at: balance.checkedAt });
  }

  async function waitForReport(vin, reportId) {
    const deadline = now().getTime() + reportWaitMs;
    for (let i = 0; i < 200; i++) {
      const acct = await browser.account();
      const hit = reportId ? acct.reports.find((r) => r.id === reportId) ?? findReportForVin(acct.reports, vin, now()) : findReportForVin(acct.reports, vin, now());
      if (hit && hit.status === 30) return { report: hit, credits: acct.credits };
      if (now().getTime() >= deadline) return { report: null, credits: acct.credits };
      await sleep(15_000);
    }
    return { report: null, credits: null };
  }

  async function finishWithPdf(job, report, { existing, credits }) {
    await jobEvent(job, "downloading", { reportId: report.id });
    const pdf = await browser.downloadPdf(report.id);
    if (!pdf.ok) {
      await jobEvent(job, "error", { code: pdf.code || "pdf_failed", reportId: report.id, message: "Atskaite ir kontā, bet PDF neizdevās lejupielādēt" });
      return;
    }
    if (typeof credits === "number") await updateBalance(credits);
    // PDF paliek relejā (Vercel pieprasījuma ķermenis ir ~4,5 MB) - PROVIN to paņem ar GET /jobs/:id/pdf.
    const size = await pdfStore.save(job.jobId, pdf.base64);
    await jobEvent(job, "result", {
      reportId: report.id,
      existing,
      pdfSize: size,
      ...(typeof credits === "number" ? { credits } : {}),
    });
  }

  async function runJob(job) {
    const s = await ensureSession();
    if (s.state !== "active") {
      const waited = now().getTime() - Date.parse(job.createdAt);
      if (s.state === "needs_human" || waited > loginWaitMs) {
        await jobEvent(job, "error", {
          code: s.state === "needs_human" ? s.code || "needs_human" : "login_timeout",
          message: s.state === "needs_human" ? "CarVertical prasa cilvēka darbību (captcha) - ielogojies pats" : "CarVertical pieteikšanās kods netika ievadīts",
        });
        return;
      }
      if (job.state !== "awaiting_login") await jobEvent(job, "awaiting_login", { sessionState: s.state });
      return;
    }

    await jobEvent(job, "checking");
    const acct = await browser.account();
    if (typeof acct.credits === "number") await updateBalance(acct.credits);
    const existing = findReportForVin(acct.reports, job.vin, now());

    if (job.kind === "report") {
      if (!existing) {
        await jobEvent(job, "error", { code: "not_found", message: "Šim VIN kontā atskaites nav" });
        return;
      }
      if (existing.status !== 30) {
        const done = await waitForReport(job.vin, existing.id);
        if (!done.report) {
          await jobEvent(job, "error", { code: "report_timeout", message: "Atskaite vēl top - mēģini vēlāk" });
          return;
        }
        await finishWithPdf(job, done.report, { existing: true, credits: done.credits });
        return;
      }
      await finishWithPdf(job, existing, { existing: true, credits: acct.credits });
      return;
    }

    const decision = decidePurchase({ existing, alreadyPurchased: Boolean(purchased[job.vin]), credits: acct.credits });
    log(`${job.jobId.slice(0, 8)} lēmums: ${decision.action} (${decision.reason})`);
    if (decision.action === "download") {
      if (existing.status !== 30) {
        const done = await waitForReport(job.vin, existing.id);
        if (!done.report) {
          await jobEvent(job, "error", { code: "report_timeout", message: "Atskaite vēl top - mēģini vēlāk" });
          return;
        }
        await finishWithPdf(job, done.report, { existing: true, credits: done.credits });
        return;
      }
      await finishWithPdf(job, existing, { existing: true, credits: acct.credits });
      return;
    }
    if (decision.action === "wait_existing") {
      const done = await waitForReport(job.vin, purchased[job.vin]?.reportId ?? "");
      if (!done.report) {
        await jobEvent(job, "error", {
          code: "already_purchased",
          message: "Šis VIN jau tika pirkts, bet atskaite kontā nav redzama - pārbaudi CarVertical kontā (otrreiz nepērku)",
        });
        return;
      }
      await finishWithPdf(job, done.report, { existing: true, credits: done.credits });
      return;
    }
    if (decision.action === "stop") {
      await jobEvent(job, "error", {
        code: decision.reason,
        message: decision.reason === "insufficient_credits" ? "CarVertical kontā nav kredītu" : "Kredītu atlikumu neizdevās nolasīt - nepērku",
        ...(typeof acct.credits === "number" ? { credits: acct.credits } : {}),
      });
      return;
    }

    // Reģistrs PIRMS klikšķa: pēc kļūdas / restarta šis VIN netiek pirkts otrreiz.
    purchased[job.vin] = { jobId: job.jobId, startedAt: now().toISOString() };
    await persist();
    await jobEvent(job, "purchasing", { credits: acct.credits });
    const bought = await browser.purchase(job.vin, { creditsBefore: acct.credits });
    if (!bought.ok) {
      if (bought.clicked !== true) {
        // Nekas netika nospiests - VIN var pirkt vēlreiz.
        delete purchased[job.vin];
        await persist();
      }
      await jobEvent(job, "error", { code: bought.code || "purchase_failed", message: bought.message || "Pirkums neizdevās" });
      return;
    }
    if (bought.reportId) {
      purchased[job.vin] = { ...purchased[job.vin], reportId: bought.reportId };
      await persist();
    }
    await jobEvent(job, "waiting_report", { reportId: bought.reportId ?? "" });
    const done = await waitForReport(job.vin, bought.reportId ?? "");
    if (!done.report) {
      await jobEvent(job, "error", { code: "report_timeout", message: "Atskaite nopirkta, bet vēl top - nospied \"Ielādēt nopirkto\" vēlāk" });
      return;
    }
    purchased[job.vin] = { ...purchased[job.vin], reportId: done.report.id };
    await persist();
    await finishWithPdf(job, done.report, { existing: false, credits: done.credits });
  }

  /** Viens solis: nākamais uzdevums. Atgriež true, ja kaut kas tika darīts. */
  async function tick() {
    if (busy) return false;
    const job = nextJob();
    if (!job) return false;
    busy = true;
    const prevState = job.state;
    try {
      if (prevState === "queued") job.state = "running";
      await runJob(job);
    } catch (e) {
      log(`uzdevums ${job.jobId.slice(0, 8)} kļūda: ${e instanceof Error ? e.message : "?"}`);
      await jobEvent(job, "error", { code: e?.code || "internal", message: "Releja kļūda" });
    } finally {
      busy = false;
    }
    return job.state !== "awaiting_login" || prevState !== "awaiting_login";
  }

  /**
   * E-pasta kods: Nila ievadīts adminā (`source` tukšs) vai automātiski no e-pasta (`source: "email"`, Apps Script ->
   * PROVIN /api/carvertical/login-code). Automātiskais kods tikai, ja relejs tieši tagad gaida kodu un vēstule
   * pienākusi PĒC šīs pieteikšanās sākuma. Kods netiek logots.
   */
  async function submitCode(raw, { source = "", receivedAt = "" } = {}) {
    const code = normalizeLoginCode(raw);
    if (!code) return { ok: false, error: "invalid_code" };
    if (source === "email") {
      if (session.state !== "awaiting_code") return { ok: false, error: "not_waiting", session };
      const startedAt = Date.parse(session.loginStartedAt ?? session.codeRequestedAt ?? "");
      const got = Date.parse(receivedAt);
      if (!Number.isFinite(startedAt) || !Number.isFinite(got) || got < startedAt - CODE_CLOCK_SKEW_MS) {
        return { ok: false, error: "stale_code", session };
      }
    }
    if (busy) return { ok: false, error: "busy" };
    busy = true;
    try {
      const s = await browser.submitCode(code);
      setSession(s);
      return { ok: s.state === "active", session };
    } finally {
      busy = false;
    }
  }

  /** Nila poga "Pieslēgt CarVertical": sāk pieteikšanos (CarVertical nosūta kodu uz e-pastu). */
  async function login() {
    if (busy) return { ok: false, error: "busy", session };
    busy = true;
    try {
      const s = await ensureSession();
      return { ok: true, session: s };
    } finally {
      busy = false;
    }
  }

  /** Atlikums: kešs; ja vecāks par 30 min un relejs brīvs - atjauno (tikai aktīvā sesijā, bez jaunas pieteikšanās). */
  async function refreshBalance({ force = false } = {}) {
    const age = now().getTime() - (Date.parse(balance.checkedAt) || 0);
    if (!force && age < balanceTtlMs) return { balance, refreshed: false };
    if (busy) return { balance, refreshed: false };
    busy = true;
    try {
      const s = await browser.peekSession();
      setSession(s);
      if (s.state !== "active") return { balance, refreshed: false };
      const acct = await browser.account();
      if (typeof acct.credits === "number") await updateBalance(acct.credits);
      return { balance, refreshed: true };
    } catch (e) {
      log(`atlikums: ${e instanceof Error ? e.message : "?"}`);
      return { balance, refreshed: false };
    } finally {
      busy = false;
    }
  }

  /** "Manas atskaites" saraksts (tikai lasīšana). */
  async function listReports() {
    if (busy) return { status: "busy" };
    busy = true;
    try {
      const s = await browser.peekSession();
      setSession(s);
      if (s.state !== "active") return { status: "needs_login", session };
      const acct = await browser.account();
      if (typeof acct.credits === "number") await updateBalance(acct.credits);
      return { status: "ok", credits: acct.credits, reports: acct.reports };
    } finally {
      busy = false;
    }
  }

  /**
   * Arhīva foto JAU NOPIRKTAI atskaitei (2. fāze). Tikai lasīšana: nekad nepērk, neliek rindā pirkumu, nesāk pieteikšanos.
   * Atskaite jāatrod "Manās atskaitēs" (gatava, statuss 30), citādi `not_found`.
   */
  async function reportPhotos(vin) {
    const v = normalizeVin(vin);
    if (!isValidVin(v)) return { status: "invalid_vin" };
    if (busy) return { status: "busy" };
    busy = true;
    try {
      const s = await browser.peekSession();
      setSession(s);
      if (s.state !== "active") return { status: "needs_login", session };
      const acct = await browser.account();
      const existing = findReportForVin(acct.reports, v, now());
      if (!existing || existing.status !== 30) return { status: "not_found" };
      const out = await browser.reportPhotos(existing.id, v);
      if (!out.ok) return { status: "error", code: out.code || "photos_failed" };
      return { status: out.groups.length ? "ok" : "no_photos", reportId: existing.id, groups: out.groups };
    } finally {
      busy = false;
    }
  }

  return {
    load,
    reportPhotos,
    enqueue,
    tick,
    submitCode,
    checkCodeReminder,
    login,
    refreshBalance,
    listReports,
    session: () => session,
    balance: () => balance,
    getJob: (id) => jobs.get(id) ?? null,
    readPdf: (id) => pdfStore.read(id),
    purchasedVins: () => ({ ...purchased }),
    stats: () => ({ busy, queued: [...jobs.values()].filter((j) => ACTIVE.has(j.state)).length }),
  };
}
