// #928 atcelšanas dzīvais tests (bez CSDD). Īstais processJob + īstais prod API (claim/events/status),
// bet: VPN netiek ieslēgts, neviens CSDD skripts netiek palaists (sync/fill ir imitācija),
// save/annul ir bloķēti - CSDD "Saglabāt" nav iespējams. Numuru momentuzņēmums uz serveri netiek sūtīts.
// Testi: lib/iriss-waybill-cancel-probe.test.ts.

import { processJob } from "./waybill-worker-core.mjs";

export const CANCEL_POINTS = Object.freeze(["filling", "saving"]);

/**
 * job - darbs no /api/iriss/aivars/waybill-requests?scope=auto&live=1.
 * deps: { api: { claim, event, result, release }, waitForCancel(): Promise<boolean>, now, log }.
 * cancelAt: "filling" = lietotājs atceļ "Pārbauda numuru" laikā; "saving" = atceļ formas aizpildes laikā.
 * Atgriež { pass, outcome, reason, blockedCalls, scriptCalls }.
 */
export async function runCancelProbe(job, deps, cancelAt = "saving") {
  if (!CANCEL_POINTS.includes(cancelAt)) throw new Error(`cancelAt jābūt: ${CANCEL_POINTS.join(" / ")}`);
  const scriptCalls = [];
  const blockedCalls = [];
  let waited = false;
  let cancelSeen = null;
  const waitOnce = async () => {
    if (waited) return;
    waited = true;
    deps.log("probe_wait_cancel", { id: job.id, cancelAt, hint: "Tagad IRISS nospied «Atcelt pieprasījumu»" });
    cancelSeen = await deps.waitForCancel();
    deps.log("probe_cancel_seen", { id: job.id, cancelled: cancelSeen });
  };
  const runScript = async (step) => {
    scriptCalls.push(step);
    if (step === "sync") {
      if (cancelAt === "filling") await waitOnce();
      return { ok: true, plates: {} };
    }
    if (step === "fill") {
      if (cancelAt === "saving") await waitOnce();
      return { ok: true, fields: { plate: job.vehicle.plate, validHours: job.validHours } };
    }
    // save / annul / jebkas cits: nekad. Atbilde "nav izveidota", lai processJob to nesauc par izdotu.
    blockedCalls.push(step);
    return { ok: false, notCreated: true, error: `PROBE: ${step} bloķēts` };
  };
  const api = {
    claim: deps.api.claim,
    event: deps.api.event,
    release: deps.api.release,
    // Atcelšanas ceļā rezultāts netiek sūtīts; ja processJob to tomēr mēģina - to neraksta serverī un tests ir FAIL.
    result: async (id, body) => {
      blockedCalls.push("result");
      deps.log("probe_result_blocked", { id, ok: body?.ok === true });
    },
  };
  const res = await processJob(job, {
    api,
    vpnLease: async () => {},
    vpnRelease: async () => {},
    runScript,
    readPdfBase64: async () => "",
    now: deps.now,
    log: deps.log,
    dryRun: false,
    annulEnabled: false,
  });
  const reasons = [];
  if (res.outcome !== "cancelled") reasons.push(`outcome=${res.outcome}${res.reason ? ` (${res.reason})` : ""}`);
  if (blockedCalls.length) reasons.push(`bloķēti izsaukumi: ${blockedCalls.join(", ")}`);
  if (cancelSeen === false) reasons.push("atcelšana netika saņemta laikā");
  return {
    pass: reasons.length === 0,
    outcome: res.outcome,
    reason: reasons.join("; "),
    blockedCalls,
    scriptCalls,
  };
}
