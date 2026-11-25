/**
 * AutoDNA releja kodols (bez pārlūka, testējams ar viltus pārlūku).
 *
 * Rinda: viens uzdevums vienlaikus (viens Chrome). Uzdevums `purchase` (Nila poga adminā ar apstiprinājumu) vai
 * `report` (jau nopirktas atskaites lejupielāde, nekad nepērk). Pirkuma aizsardzība:
 *   1) pirms pirkuma AutoDNA pašai pajautā, vai šim VIN atskaite jau nopirkta - ja jā, lejupielādē, NEPĒRK;
 *   2) VIN reģistrs (`state.json`) tiek ierakstīts PIRMS klikšķa - pēc restarta / kļūdas tas pats VIN netiek pirkts otrreiz;
 *   3) pērk tikai, ja kredītu atlikums >= 1 (nolasīts tajā pašā solī); karti / pakas relejs neaiztiek;
 *   4) Nila likums 25.11: pērk TIKAI, ja AutoDNA bezmaksas priekšpārbaude (/vin/<VIN> tajā pašā pārlūkā) rāda
 *      «Auto arhīva fotogrāfijas» vai «Transportlīdzekļa vēsture» ar >0 ierakstiem. Citādi (arī Turnstile / nezināms
 *      formāts / kļūda) - `precheck_no_records` / `precheck_unavailable`, kredīts netiek tērēts.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";

import { decidePurchase, isValidVin, normalizeVin } from "./dna-page.mjs";
import { DNA_PRECHECK_MESSAGE_LV } from "./dna-precheck.mjs";

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

/** Pārlūka priekšpārbaudes rezultāts -> drošs lēmums (jebkas neskaidrs = nepērk). */
export function precheckVerdict(pre) {
  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const photos = num(pre?.photos);
  const history = num(pre?.history);
  const allowed = pre?.allowed === true && ((photos ?? 0) > 0 || (history ?? 0) > 0);
  if (allowed) return { allowed: true, photos, history };
  const code = pre?.code === "precheck_no_records" && (photos != null || history != null) ? "precheck_no_records" : "precheck_unavailable";
  return { allowed: false, code, photos, history, ...(pre?.turnstile ? { reason: "turnstile" } : {}) };
}

const NEEDS_HUMAN_LV = {
  bad_credentials: "AutoDNA neņēma paroli - Nilam jāiestata parole (Aizmirsi paroli?) un jāieliek 1Password",
  captcha: "AutoDNA prasa captcha pieteikšanās brīdī - ielogojies pats",
  login_code: "AutoDNA prasa kodu pieteikšanās brīdī - vajag e-pasta koda ielasi",
  login_page_changed: "AutoDNA pieteikšanās lapa mainījusies",
  login_form_not_opened: "AutoDNA pieteikšanās forma neatvērās (pārklājums vai lēna lapa) - relejs mēģinās vēlreiz",
  login_unknown: "AutoDNA pieteikšanās neizdevās",
};

export function createRelayCore({
  browser,
  notify,
  stateFile = "",
  now = () => new Date(),
  log = () => undefined,
  loginWaitMs = 20 * 60_000,
  reportWaitMs = 8 * 60_000,
  balanceTtlMs = 30 * 60_000,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  pdfStore = memoryPdfStore(),
}) {
  /** @type {Map<string, any>} */
  const jobs = new Map();
  /** VIN -> { jobId, startedAt } : relejs šo VIN jau ir pircis (vai sācis pirkt). */
  let purchased = {};
  let balance = { credits: null, checkedAt: "" };
  let session = { state: "unknown", updatedAt: now().toISOString() };
  let busy = false;
  let lastActivity = now().getTime();
  let lastHumanCode = "";

  async function readBrowserPrecheck(vin) {
    try {
      return await browser.precheck(vin);
    } catch (e) {
      log(`priekšpārbaude neizdevās: ${e instanceof Error ? e.message : "?"}`);
      return null;
    }
  }

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
    return session;
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
    // Viens push par katru jaunu iemeslu (nevis ik 20 s).
    if (s.state === "needs_human" && s.code !== lastHumanCode) {
      lastHumanCode = s.code ?? "";
      await emit({ kind: "session", state: "needs_human", code: s.code ?? "", at: now().toISOString() });
    }
    if (s.state === "active") lastHumanCode = "";
    return s;
  }

  async function updateBalance(credits) {
    if (typeof credits !== "number" || !Number.isFinite(credits)) return;
    balance = { credits, checkedAt: now().toISOString() };
    await persist();
    await emit({ kind: "balance", credits, at: balance.checkedAt });
  }

  /** Gaida, kamēr AutoDNA atskaite ir lejupielādējama (pēc pirkuma tā top dažas minūtes). */
  async function downloadWithWait(job, { existing, credits, precheck = null }) {
    const deadline = now().getTime() + reportWaitMs;
    let last = { ok: false, code: "not_found" };
    // Atzvans tikai vienreiz (katrs ir Vercel izsaukums); atkārtojumi klusi līdz termiņam.
    await jobEvent(job, "downloading");
    for (let i = 0; i < 100; i++) {
      last = await browser.downloadPdf(job.vin);
      if (last.ok) break;
      if (now().getTime() >= deadline) break;
      await sleep(20_000);
    }
    if (!last.ok) {
      await jobEvent(job, "error", {
        code: last.code === "not_in_history" || last.code === "pdf_link_missing" ? "report_timeout" : last.code || "pdf_failed",
        message: "Atskaite ir kontā, bet PDF neizdevās lejupielādēt - nospied \"Ielādēt nopirkto\" vēlāk",
      });
      return;
    }
    if (typeof credits === "number") await updateBalance(credits);
    // PDF paliek relejā (Vercel pieprasījuma ķermenis ir ~4,5 MB) - PROVIN to paņem ar GET /jobs/:id/pdf.
    const size = await pdfStore.save(job.jobId, last.base64);
    await jobEvent(job, "result", { existing, pdfSize: size, ...(typeof credits === "number" ? { credits } : {}), ...(precheck ? { precheck } : {}) });
  }

  async function runJob(job) {
    const s = await ensureSession();
    if (s.state !== "active") {
      const waited = now().getTime() - Date.parse(job.createdAt);
      if (s.state === "needs_human" || waited > loginWaitMs) {
        const code = s.state === "needs_human" ? s.code || "needs_human" : "login_timeout";
        await jobEvent(job, "error", { code, message: NEEDS_HUMAN_LV[code] ?? "AutoDNA pieteikšanās neizdevās" });
        return;
      }
      if (job.state !== "awaiting_login") await jobEvent(job, "awaiting_login", { sessionState: s.state });
      return;
    }

    await jobEvent(job, "checking");
    const acct = await browser.account(job.vin);
    if (typeof acct.credits === "number") await updateBalance(acct.credits);

    if (job.kind === "report") {
      if (!acct.bought) {
        await jobEvent(job, "error", { code: "not_found", message: "Šim VIN AutoDNA kontā atskaites nav" });
        return;
      }
      await downloadWithWait(job, { existing: true, credits: acct.credits });
      return;
    }

    const decision = decidePurchase({ bought: acct.bought, alreadyPurchased: Boolean(purchased[job.vin]), credits: acct.credits });
    log(`${job.jobId.slice(0, 8)} lēmums: ${decision.action} (${decision.reason})`);
    if (decision.action === "download") {
      await downloadWithWait(job, { existing: true, credits: acct.credits });
      return;
    }
    if (decision.action === "wait_existing") {
      await jobEvent(job, "error", {
        code: "already_purchased",
        message: "Šis VIN jau tika pirkts, bet AutoDNA to nerāda kā nopirktu - pārbaudi AutoDNA kontā (otrreiz nepērku)",
      });
      return;
    }
    if (decision.action === "stop") {
      await jobEvent(job, "error", {
        code: decision.reason,
        message: decision.reason === "insufficient_credits" ? "AutoDNA kontā nav kredītu" : "Kredītu atlikumu neizdevās nolasīt - nepērku",
        ...(typeof acct.credits === "number" ? { credits: acct.credits } : {}),
      });
      return;
    }

    // Nila likums 25.11: bezmaksas priekšpārbaude PIRMS jebkuras pirkuma darbības.
    const pre = precheckVerdict(await readBrowserPrecheck(job.vin));
    const precheck = { photos: pre.photos, history: pre.history };
    log(`${job.jobId.slice(0, 8)} priekšpārbaude: ${pre.allowed ? "drīkst" : pre.code} (foto ${pre.photos ?? "?"}, vēsture ${pre.history ?? "?"})`);
    if (!pre.allowed) {
      await jobEvent(job, "error", {
        code: pre.code,
        message: DNA_PRECHECK_MESSAGE_LV[pre.code],
        precheck,
        ...(pre.reason ? { reason: pre.reason } : {}),
        ...(typeof acct.credits === "number" ? { credits: acct.credits } : {}),
      });
      return;
    }

    // Reģistrs PIRMS klikšķa: pēc kļūdas / restarta šis VIN netiek pirkts otrreiz.
    purchased[job.vin] = { jobId: job.jobId, startedAt: now().toISOString() };
    await persist();
    await jobEvent(job, "purchasing", { credits: acct.credits, precheck });
    const bought = await browser.purchase(job.vin, { creditsBefore: acct.credits });
    if (!bought.ok) {
      if (bought.clicked !== true) {
        delete purchased[job.vin];
        await persist();
      }
      await jobEvent(job, "error", { code: bought.code || "purchase_failed", message: bought.message || "Pirkums neizdevās", precheck });
      return;
    }
    await jobEvent(job, "waiting_report");
    const after = await browser.account(job.vin).catch(() => ({ credits: null }));
    await downloadWithWait(job, { existing: false, credits: typeof after.credits === "number" ? after.credits : null, precheck });
  }

  /** Viens solis: nākamais uzdevums. Atgriež true, ja kaut kas tika darīts. */
  async function tick() {
    if (busy) return false;
    const job = nextJob();
    if (!job) return false;
    busy = true;
    lastActivity = now().getTime();
    const prevState = job.state;
    try {
      if (prevState === "queued") job.state = "running";
      await runJob(job);
    } catch (e) {
      log(`uzdevums ${job.jobId.slice(0, 8)} kļūda: ${e instanceof Error ? e.message : "?"}`);
      await jobEvent(job, "error", { code: e?.code || "internal", message: "Releja kļūda" });
    } finally {
      busy = false;
      lastActivity = now().getTime();
    }
    return job.state !== "awaiting_login" || prevState !== "awaiting_login";
  }

  async function exclusive(fn, fallback) {
    if (busy) return fallback;
    busy = true;
    lastActivity = now().getTime();
    try {
      return await fn();
    } finally {
      busy = false;
      lastActivity = now().getTime();
    }
  }

  /** Nila poga "Pieslēgt AutoDNA": pieteikšanās ar e-pastu + paroli no env faila. */
  async function login() {
    return exclusive(async () => {
      const s = await ensureSession();
      return { ok: s.state === "active", session: s };
    }, { ok: false, error: "busy", session });
  }

  /** Atlikums: kešs; ja vecāks par 30 min un relejs brīvs - atjauno (tikai aktīvā sesijā, bez jaunas pieteikšanās). */
  async function refreshBalance({ force = false } = {}) {
    const age = now().getTime() - (Date.parse(balance.checkedAt) || 0);
    if (!force && age < balanceTtlMs) return { balance, refreshed: false };
    return exclusive(async () => {
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
      }
    }, { balance, refreshed: false });
  }

  /** "Manas atskaites" saraksts (tikai lasīšana). */
  async function listReports() {
    return exclusive(async () => {
      const s = await browser.peekSession();
      setSession(s);
      if (s.state !== "active") return { status: "needs_login", session };
      const acct = await browser.account();
      if (typeof acct.credits === "number") await updateBalance(acct.credits);
      return { status: "ok", credits: acct.credits, reports: await browser.listReports() };
    }, { status: "busy" });
  }

  /** Pirkuma lapas pārbaude bez klikšķiem (galvenajam pirms tiešā pirkuma ieslēgšanas). */
  async function probe(vin) {
    const v = normalizeVin(vin);
    if (!isValidVin(v)) return { status: "invalid_vin" };
    return exclusive(async () => {
      const s = await browser.peekSession();
      setSession(s);
      const out = await browser.probe(v);
      return { status: "ok", session: s.state, ...out };
    }, { status: "busy" });
  }

  /** Tikai lasīšana: priekšpārbaude ielogotajā pārlūkā (bez pirkuma). */
  async function precheck(vin) {
    const v = normalizeVin(vin);
    if (!isValidVin(v)) return { status: "invalid_vin" };
    return exclusive(async () => {
      const out = precheckVerdict(await readBrowserPrecheck(v));
      return { status: "ok", vin: v, ...out };
    }, { status: "busy" });
  }

  return {
    load,
    precheck,
    enqueue,
    tick,
    login,
    refreshBalance,
    listReports,
    probe,
    session: () => session,
    balance: () => balance,
    getJob: (id) => jobs.get(id) ?? null,
    readPdf: (id) => pdfStore.read(id),
    purchasedVins: () => ({ ...purchased }),
    idleMs: () => (busy || [...jobs.values()].some((j) => ACTIVE.has(j.state)) ? 0 : now().getTime() - lastActivity),
    stats: () => ({ busy, queued: [...jobs.values()].filter((j) => ACTIVE.has(j.state)).length }),
  };
}
