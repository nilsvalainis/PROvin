import { describe, expect, it, vi } from "vitest";
import {
  AUTO_WAYBILL_GRACE_MS,
  classifyWaybillForAuto,
  hiddenFromAivars,
  isStandardWaybillComment,
} from "@/lib/iriss-waybill-auto";
import { toAivarsCreateWaybillAction } from "@/lib/iriss-waybill-create";
import type { WaybillRequest } from "@/lib/iriss-waybill-requests";
import {
  ALLOWED_SCRIPTS,
  localStandardCheck,
  processJob,
  resolveWorkerScript,
} from "@/scripts/iriss-ttr/waybill-worker-core.mjs";

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
  ...over,
});

const free = { plateBusyNow: false };

describe("classifyWaybillForAuto", () => {
  it("accepts the standard request and maps the CSDD context", () => {
    expect(classifyWaybillForAuto(req(), free)).toEqual({ standard: true, plate: "B193-7", company: "iriss", ctx: "ctx1" });
    expect(classifyWaybillForAuto(req({ vehicle: { brandModel: "Audi A4", vin: "", plate: "B1927", orderId: "" } }), free)).toMatchObject(
      { standard: true, company: "dzintarzeme", ctx: "ctx2" },
    );
  });

  it("a busy plate is never standard (confirmBusy at create or busy now)", () => {
    expect(classifyWaybillForAuto(req({ plateBusyAtCreate: true }), free)).toEqual({ standard: false, reason: "numurs aizņemts" });
    expect(classifyWaybillForAuto(req(), { plateBusyNow: true })).toEqual({ standard: false, reason: "numurs aizņemts" });
  });

  it("leaves other hours, routes, retries and released jobs to Aivars", () => {
    expect(classifyWaybillForAuto(req({ validHours: 24 }), free).standard).toBe(false);
    expect(classifyWaybillForAuto(req({ routeTo: "Rīga, Brīvības 1" }), free).standard).toBe(false);
    expect(classifyWaybillForAuto(req({ attempts: 2 }), free).standard).toBe(false);
    expect(classifyWaybillForAuto(req({ autoDisabled: true }), free).standard).toBe(false);
    expect(classifyWaybillForAuto(req({ status: "in_progress" }), free).standard).toBe(false);
    expect(classifyWaybillForAuto(req({ vehicle: { brandModel: "BMW", vin: "", plate: "AB1234", orderId: "" } }), free).standard).toBe(
      false,
    );
  });

  it("comments: empty, Tukums or '<plate> uz <this car>' only", () => {
    expect(isStandardWaybillComment("", "B1937", "BMW 330")).toBe(true);
    expect(isStandardWaybillComment("Tukums", "B1937", "BMW 330")).toBe(true);
    expect(isStandardWaybillComment("193 uz BMW 330", "B1937", "BMW 330")).toBe(true);
    expect(isStandardWaybillComment("B193-7 uz bmw  330", "B1937", "BMW 330")).toBe(true);
    expect(isStandardWaybillComment("762 uz BMW 330", "B1937", "BMW 330")).toBe(false);
    expect(isStandardWaybillComment("193 uz Audi A6", "B1937", "BMW 330")).toBe(false);
    expect(isStandardWaybillComment("193 uz BMW 330, pārtrauc veco", "B1937", "BMW 330")).toBe(false);
    expect(isStandardWaybillComment("uz Rīgu", "B1937", "BMW 330")).toBe(false);
    expect(classifyWaybillForAuto(req({ noteUntrusted: "lūdzu uz 72h" }), free)).toEqual({ standard: false, reason: "komentārs" });
  });

  it("hides standard jobs from Aivars only during the grace window and only when enabled", () => {
    const now = Date.parse("2026-10-22T18:01:00.000Z");
    const std = classifyWaybillForAuto(req(), free);
    expect(hiddenFromAivars(std, req().createdAt, now, true)).toBe(true);
    expect(hiddenFromAivars(std, req().createdAt, now, false)).toBe(false);
    expect(hiddenFromAivars(std, req().createdAt, Date.parse(req().createdAt) + AUTO_WAYBILL_GRACE_MS, true)).toBe(false);
    expect(hiddenFromAivars({ standard: false, reason: "x" }, req().createdAt, now, true)).toBe(false);
  });
});

function autoJob(over: Partial<WaybillRequest> = {}) {
  const r = req(over);
  return { ...toAivarsCreateWaybillAction(r), auto: classifyWaybillForAuto(r, free) };
}

function deps(over: Record<string, unknown> = {}) {
  let t = Date.parse("2026-10-22T18:00:05.000Z");
  return {
    api: {
      claim: vi.fn(async () => true),
      event: vi.fn(async () => {}),
      result: vi.fn(async () => {}),
      release: vi.fn(async () => {}),
    },
    vpnLease: vi.fn(async () => {}),
    runScript: vi.fn(async (step: string, _input?: unknown) =>
      step === "fill"
        ? { ok: true, fields: { plate: "B193-7", validHours: 48 } }
        : { ok: true, waybillNo: "TTR123", pdfPath: "out/TTR123.pdf" },
    ),
    readPdfBase64: vi.fn(async () => "JVBERi0="),
    now: () => (t += 1000),
    log: vi.fn(),
    dryRun: false,
    ...over,
  };
}

describe("waybill worker (scripts/iriss-ttr)", () => {
  it("script allowlist has only fill/save, never stop or cancel", () => {
    expect(Object.values(ALLOWED_SCRIPTS).sort()).toEqual(["refill.js", "save.js"]);
    for (const step of ["partraukt", "pārtraukt", "anulet", "cancel", "stop", "x", "run"]) {
      expect(() => resolveWorkerScript(step)).toThrow(/script_not_allowed/);
    }
    expect(resolveWorkerScript("fill")).toBe("refill.js");
  });

  it("a busy-plate job (confirmBusy) is skipped: no claim, no VPN, no scripts", async () => {
    for (const job of [
      autoJob({ plateBusyAtCreate: true }),
      { ...autoJob(), confirmBusy: true },
      { ...autoJob(), plateBusy: true },
    ]) {
      const d = deps();
      const res = await processJob(job, d);
      expect(res.outcome).toBe("skipped");
      expect(d.api.claim).not.toHaveBeenCalled();
      expect(d.vpnLease).not.toHaveBeenCalled();
      expect(d.runScript).not.toHaveBeenCalled();
    }
  });

  it("re-checks locally even if the server marked the job standard", () => {
    expect(localStandardCheck({ ...autoJob(), validHours: 72 }).ok).toBe(false);
    expect(localStandardCheck({ ...autoJob(), comment_untrusted: "anulē veco" }).ok).toBe(false);
    expect(localStandardCheck(autoJob()).ok).toBe(true);
  });

  it("issues a standard job: claim -> VPN -> fill -> save -> result, with timings", async () => {
    const d = deps();
    const res = await processJob(autoJob({ noteUntrusted: "193 uz BMW 330" }), d);
    expect(res.outcome).toBe("issued");
    expect(d.runScript.mock.calls.map((c) => c[0])).toEqual(["fill", "save"]);
    const input = (d.runScript.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(input).not.toHaveProperty("comment_untrusted");
    expect(d.api.result).toHaveBeenCalledWith("wbr_abc123", expect.objectContaining({ ok: true, waybillNo: "TTR123", by: "auto" }));
    expect(res.timings?.totalSec).toBeGreaterThan(0);
  });

  it("fails before save -> release to Aivars, no save", async () => {
    const d = deps({ runScript: vi.fn(async () => ({ ok: true, fields: { plate: "B762-7", validHours: 48 } })) });
    const res = await processJob(autoJob(), d);
    expect(res.outcome).toBe("released");
    expect(d.runScript).toHaveBeenCalledTimes(1);
    expect(d.api.release).toHaveBeenCalled();
    expect(d.api.result).not.toHaveBeenCalled();
  });

  it("fails during save -> error result for a human, no release or retry", async () => {
    const d = deps({
      runScript: vi.fn(async (step: string) =>
        step === "fill" ? { ok: true, fields: { plate: "B1937", validHours: 48 } } : { ok: false, error: "timeout" },
      ),
    });
    const res = await processJob(autoJob(), d);
    expect(res.outcome).toBe("error_after_save");
    expect(d.api.release).not.toHaveBeenCalled();
    expect(d.api.result).toHaveBeenCalledWith("wbr_abc123", expect.objectContaining({ ok: false }));
  });

  it("dry-run never claims", async () => {
    const d = deps({ dryRun: true });
    expect((await processJob(autoJob(), d)).outcome).toBe("dry_run");
    expect(d.api.claim).not.toHaveBeenCalled();
  });
});
