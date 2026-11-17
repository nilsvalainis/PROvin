import { describe, expect, it, vi } from "vitest";
import { classifyWaybillForAuto } from "@/lib/iriss-waybill-auto";
import { toAivarsCreateWaybillAction } from "@/lib/iriss-waybill-create";
import type { WaybillRequest } from "@/lib/iriss-waybill-requests";
import { runCancelProbe } from "@/scripts/iriss-ttr/waybill-cancel-probe-core.mjs";

const req = (over: Partial<WaybillRequest> = {}): WaybillRequest => ({
  id: "wbr_abc123",
  createdBy: "usr_1",
  createdByName: "Jānis",
  createdAt: "2026-10-22T18:00:00.000Z",
  updatedAt: "2026-10-22T18:00:00.000Z",
  vehicle: { brandModel: "BMW 330", vin: "", plate: "B1937", orderId: "" },
  routeFrom: "Tukums, Rīgas iela",
  routeTo: "Tukuma CSDD",
  validDays: 2,
  validHours: 48,
  validFrom: "2026-10-22T18:00:00.000Z",
  validUntil: "2026-10-24T18:00:00.000Z",
  noteUntrusted: "",
  status: "queued",
  waybillNo: "",
  pdfUrl: "",
  errorReason: "",
  lastReplyText: "",
  attempts: 1,
  pickedBy: "",
  pickedAt: "",
  plateBusyAtCreate: false,
  autoDisabled: false,
  tradeAct: false,
  representative: "",
  stage: "",
  stageAt: "",
  dropboxPath: "",
  dropboxError: "",
  dropboxAt: "",
  ...over,
});


const NOW = Date.parse("2026-10-22T18:00:30.000Z");
const job = () => {
  const r = req();
  return { ...toAivarsCreateWaybillAction(r), auto: classifyWaybillForAuto(r, { plateBusyNow: false, nowMs: NOW }) };
};

/** Servera imitācija: pēc waitForCancel statuss ir "cancelled" (kā pēc «Atcelt pieprasījumu»). */
function server(opts: { userCancels?: boolean } = {}) {
  let cancelled = false;
  const api = {
    claim: vi.fn(async () => true),
    event: vi.fn(async () => (cancelled ? "cancelled" : "in_progress")),
    release: vi.fn(async () => {}),
  };
  const waitForCancel = vi.fn(async () => {
    if (opts.userCancels !== false) cancelled = true;
    return cancelled;
  });
  return { api, waitForCancel, now: () => NOW, log: vi.fn() };
}

describe("#928 atcelšanas tests bez CSDD (waybill-cancel-probe)", () => {
  it("cancel during the form: PASS, CSDD Save never runs, no result is sent", async () => {
    const d = server();
    const res = await runCancelProbe(job(), d, "saving");
    expect(res).toMatchObject({ pass: true, outcome: "cancelled", blockedCalls: [] });
    expect(res.scriptCalls).not.toContain("save");
    expect(d.api.claim).toHaveBeenCalledTimes(1);
    expect(d.waitForCancel).toHaveBeenCalledTimes(1);
  });

  it("cancel while the plate is checked: PASS, the form is never filled", async () => {
    const d = server();
    const res = await runCancelProbe(job(), d, "filling");
    expect(res.pass).toBe(true);
    expect(res.scriptCalls).not.toContain("fill");
    expect(res.scriptCalls).not.toContain("save");
  });

  it("if the cancel never arrives: FAIL, and Save is still blocked (only the probe stub is reached)", async () => {
    const d = server({ userCancels: false });
    const res = await runCancelProbe(job(), d, "saving");
    expect(res.pass).toBe(false);
    expect(res.blockedCalls).toContain("save");
    expect(res.reason).toContain("atcelšana netika saņemta");
  });

  it("rejects an unknown cancel point before touching the server", async () => {
    const d = server();
    await expect(runCancelProbe(job(), d, "annul")).rejects.toThrow();
    expect(d.api.claim).not.toHaveBeenCalled();
  });
});
