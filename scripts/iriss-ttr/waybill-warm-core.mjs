// iriss-waybill-worker ātrums (Nils 20.11): silts pārlūks + adaptīvs poll. Loģika bez IO, testi: lib/iriss-waybill-warm.test.ts.
// Siltais režīms (IRISS_WAYBILL_WARM_BROWSER, noklusējumā ieslēgts; "0" -> vecā uzvedība ar atsevišķu procesu katram solim):
// sync/fill/save/stop worker procesā, tas pats runCli (waybill-scripts-core.mjs) ar tiem pašiem sargiem, ledger un pārbaudēm,
// tikai draiveris nāk no siltās sesijas (waybill-driver.mjs createWarmBrowserPool). Soļu allowlist tas pats
// (resolveWorkerScript): annul worker nepalaiž nekad, stop tikai ar replaceStopEnabled.

import { resolveWorkerScript } from "./waybill-worker-core.mjs";

/** Soļi, ko siltais režīms drīkst palaist (tie paši, ko resolveWorkerScript atļauj workerim). annul - nekad. */
export const WARM_STEPS = Object.freeze(["sync", "fill", "save", "stop"]);

/** IRISS_WAYBILL_WARM_BROWSER: ieslēgts pēc noklusējuma; "0"/"false"/"no" -> katram solim atsevišķs process (vecā uzvedība). */
export function warmBrowserEnabled(raw) {
  const v = String(raw ?? "").trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "no");
}

/** IRISS_WAYBILL_WARM_IDLE_MIN (1..60, nokl. 10): pēc cik minūtēm dīkstāvē aizvērt silto pārlūku (RAM). */
export function warmIdleMs(raw) {
  const n = Number(String(raw ?? "").trim());
  const min = Number.isFinite(n) && n >= 1 && n <= 60 ? n : 10;
  return Math.round(min * 60_000);
}

/** "ctx1" / 1 -> 1; cits -> 0. */
export function ctxNumber(ctx) {
  const n = Number(String(ctx ?? "").replace(/^ctx/i, ""));
  return n === 1 || n === 2 ? n : 0;
}

/**
 * Viens solis worker procesā ar silto draiveri. Atgriež to pašu JSON, ko skripts izrakstītu stdout pēdējā rindā.
 * deps: { pool, runCli, env, ledgerDir, dateFormat, platesForCtx, timeoutMs, log, replaceStopEnabled, stderr }.
 * - Allowlist: resolveWorkerScript (tas pats, kas aukstajā režīmā) + WARM_STEPS. annul -> kļūda pirms jebkā.
 * - Timeout: sesija tiek aizvērta (aptur Playwright darbības, kā process kill), soļa kļūda tiek mesta (kā execFile timeout).
 * - Kļūda vai ok:false: sesija tiek aizvērta (nākamais solis sāk tīri, ar jaunu pieslēgšanos).
 */
export async function runStepInProcess(step, input, deps) {
  resolveWorkerScript(step, { replaceStopEnabled: deps.replaceStopEnabled === true });
  if (!WARM_STEPS.includes(step)) throw new Error(`script_not_allowed:${step}`);
  const ctx = ctxNumber(input?.ctx);
  if (!ctx) throw new Error("ctx nederīgs");
  const env = { ...deps.env, IRISS_JOB_JSON: JSON.stringify(input), IRISS_AUTO: "1" };
  let out = "";
  const stdout = { write: (s) => ((out += String(s)), true) };
  const stderr = deps.stderr || { write: () => true };
  const drivers = [];
  const makeDriver = async (s) => {
    const d = await deps.pool.driverFor(ctx, s);
    drivers.push(d);
    return d;
  };
  let timer = null;
  let timedOut = false;
  const work = deps.runCli(step, {
    env,
    makeDriver,
    ledgerDir: deps.ledgerDir,
    dateFormat: deps.dateFormat,
    stdout,
    stderr,
    platesForCtx: deps.platesForCtx,
  });
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      reject(new Error(`step_timeout:${step}`));
    }, deps.timeoutMs || 180_000);
  });
  try {
    await Promise.race([work, timeout]);
  } catch (err) {
    deps.log?.("warm_step_failed", { step, ctx, err: err instanceof Error ? err.message.slice(0, 120) : "error" });
    await deps.pool.discard(ctx, timedOut ? "timeout" : "error");
    work.catch(() => {});
    throw err;
  } finally {
    clearTimeout(timer);
    if (!timedOut) {
      for (const d of drivers) await d.close({ keepPage: true }).catch(() => {});
      deps.pool.release(ctx);
    }
  }
  const last = out.trim().split("\n").filter(Boolean).pop() || "{}";
  const res = JSON.parse(last);
  if (!res || res.ok !== true) await deps.pool.discard(ctx, "step_not_ok");
  return res;
}

/**
 * Adaptīvs poll (Nils 20.11): serveris atbildē dod pollMs (2 s, kad pēdējās 15 min bija pieprasījums vai atvērta Pavadzīmju
 * lapa; citādi 10 s). Worker turklāt pats paliek ātrs 15 min pēc sava darba. Robežas 2..10 s (nekad ātrāk par 2 s).
 */
export const POLL_FAST_MS = 2_000;
export const POLL_SLOW_MS = 10_000;
export const LOCAL_HOT_MS = 15 * 60_000;

export function nextPollMs({ serverPollMs = 0, lastJobAtMs = 0, nowMs = Date.now() } = {}) {
  const n = Number(serverPollMs);
  let ms = Number.isFinite(n) && n > 0 ? Math.min(POLL_SLOW_MS, Math.max(POLL_FAST_MS, Math.round(n))) : POLL_SLOW_MS;
  if (lastJobAtMs && nowMs - lastJobAtMs < LOCAL_HOT_MS) ms = POLL_FAST_MS;
  return ms;
}
