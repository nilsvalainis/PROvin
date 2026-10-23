import { describe, expect, it, vi } from "vitest";
import {
  AUTO_WAYBILL_GRACE_MS,
  classifyWaybillForAuto,
  hiddenFromAivars,
  isStandardWaybillComment,
  plateTakenByOtherRequest,
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
  tradeAct: false,
  representative: "",
  stage: "",
  stageAt: "",
  ...over,
});

const NOW = Date.parse("2026-10-22T18:00:30.000Z");
const free = { plateBusyNow: false, nowMs: NOW };
/** Nila reālā plūsma: pieņemts auto, 1 h, tikai laiks + pārstāvis, bez maršruta. */
const tradeReq = (over: Partial<WaybillRequest> = {}) =>
  req({
    vehicle: { brandModel: "Peugeot 5008", vin: "VF30ARHHAAS201388", plate: "B1937", orderId: "" },
    routeFrom: "",
    routeTo: "",
    validHours: 1,
    validDays: 1,
    validUntil: "2026-10-22T19:00:00.000Z",
    tradeAct: true,
    representative: "Nils Valainis",
    ...over,
  });

describe("classifyWaybillForAuto", () => {
  it("accepts the standard request and maps the CSDD context", () => {
    expect(classifyWaybillForAuto(req(), free)).toEqual({ standard: true, plate: "B193-7", company: "iriss", ctx: "ctx1", flow: "new" });
    expect(classifyWaybillForAuto(req({ vehicle: { brandModel: "Audi A4", vin: "", plate: "B1927", orderId: "" } }), free)).toMatchObject(
      { standard: true, company: "dzintarzeme", ctx: "ctx2" },
    );
  });

  it("a busy plate is never standard (confirmBusy at create or busy now)", () => {
    expect(classifyWaybillForAuto(req({ plateBusyAtCreate: true }), free)).toEqual({ standard: false, reason: "numurs aizņemts" });
    expect(classifyWaybillForAuto(req(), { plateBusyNow: true, nowMs: NOW })).toEqual({ standard: false, reason: "numurs aizņemts" });
  });

  it("accepts Nils's real flows: accepted car (1 h, time + representative, no route) and new waybill with any hours", () => {
    expect(classifyWaybillForAuto(tradeReq(), free)).toEqual({ standard: true, plate: "B193-7", company: "iriss", ctx: "ctx1", flow: "tradeAct" });
    expect(classifyWaybillForAuto(req({ validHours: 1, validUntil: "2026-10-22T19:00:00.000Z" }), free)).toMatchObject({ standard: true, flow: "new" });
    expect(classifyWaybillForAuto(req({ validHours: 12 }), free)).toMatchObject({ standard: true, flow: "new" });
    expect(
      classifyWaybillForAuto(tradeReq({ vehicle: { brandModel: "Audi A4", vin: "WAUZZZ8K0BA000001", plate: "B1927", orderId: "" }, representative: "Taivo Batiņš" }), free),
    ).toMatchObject({ standard: true, company: "dzintarzeme", ctx: "ctx2", flow: "tradeAct" });
  });

  it("accepted car stays with Aivars without VIN or with another representative ('Cits')", () => {
    expect(classifyWaybillForAuto(tradeReq({ vehicle: { brandModel: "Peugeot 5008", vin: "", plate: "B1937", orderId: "" } }), free)).toEqual({
      standard: false,
      reason: "aktam vajag VIN",
    });
    expect(classifyWaybillForAuto(tradeReq({ representative: "Jānis Bērziņš" }), free)).toEqual({ standard: false, reason: "cits pārstāvis" });
    // Dzintarzemes numuram ĪRISS pārstāvis neder.
    expect(
      classifyWaybillForAuto(tradeReq({ vehicle: { brandModel: "Audi A4", vin: "WAUZZZ8K0BA000001", plate: "B1927", orderId: "" } }), free).standard,
    ).toBe(false);
  });

  it("an expired pending request or a plate already in another job is never auto", () => {
    expect(classifyWaybillForAuto(tradeReq(), { ...free, nowMs: Date.parse("2026-10-22T19:00:01.000Z") })).toEqual({
      standard: false,
      reason: "termiņš beidzies",
    });
    expect(classifyWaybillForAuto(req(), { ...free, plateInOtherRequest: true })).toEqual({ standard: false, reason: "numurs jau citā darbā" });
  });

  it("plateTakenByOtherRequest: another job in progress or a fresh issued waybill on the same plate", () => {
    const me = req({ id: "wbr_me" });
    const working = req({ id: "wbr_w", status: "in_progress", pickedAt: "2026-10-22T18:00:10.000Z" });
    const issued = req({ id: "wbr_i", status: "issued", validUntil: "2026-10-23T18:00:00.000Z" });
    const oldIssued = req({ id: "wbr_o", status: "issued", validUntil: "2026-10-21T18:00:00.000Z" });
    const otherPlate = req({ id: "wbr_p", status: "in_progress", pickedAt: "2026-10-22T18:00:10.000Z", vehicle: { brandModel: "X", vin: "", plate: "B7627", orderId: "" } });
    expect(plateTakenByOtherRequest([me, working], me, NOW)).toBe(true);
    expect(plateTakenByOtherRequest([me, issued], me, NOW)).toBe(true);
    expect(plateTakenByOtherRequest([me, oldIssued, otherPlate, req({ id: "wbr_c", status: "cancelled" })], me, NOW)).toBe(false);
  });

  it("leaves own routes, invalid hours, retries, cancelled and released jobs to Aivars", () => {
    expect(classifyWaybillForAuto(req({ validHours: 0 }), free).standard).toBe(false);
    expect(classifyWaybillForAuto(req({ validHours: 3000 }), free).standard).toBe(false);
    expect(classifyWaybillForAuto(req({ routeTo: "Rīga, Brīvības 1" }), free).standard).toBe(false);
    expect(classifyWaybillForAuto(req({ routeFrom: "Talsi, Lielā iela 5" }), free).standard).toBe(false);
    expect(classifyWaybillForAuto(req({ attempts: 2 }), free).standard).toBe(false);
    expect(classifyWaybillForAuto(req({ autoDisabled: true }), free).standard).toBe(false);
    expect(classifyWaybillForAuto(req({ status: "cancelled" }), free).standard).toBe(false);
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

function tradeJob(over: Partial<WaybillRequest> = {}) {
  const r = tradeReq(over);
  return { ...toAivarsCreateWaybillAction(r), auto: classifyWaybillForAuto(r, free) };
}

function deps(over: Record<string, unknown> = {}) {
  let t = Date.parse("2026-10-22T18:00:35.000Z");
  return {
    api: {
      claim: vi.fn(async () => true),
      event: vi.fn(async () => {}),
      result: vi.fn(async () => {}),
      release: vi.fn(async () => {}),
    },
    vpnLease: vi.fn(async () => {}),
    vpnRelease: vi.fn(async () => {}),
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
    expect(localStandardCheck({ ...autoJob(), validHours: 3000 }, NOW).ok).toBe(false);
    expect(localStandardCheck({ ...autoJob(), comment_untrusted: "anulē veco" }, NOW).ok).toBe(false);
    expect(localStandardCheck({ ...autoJob(), routeTo: "Rīga" }, NOW).ok).toBe(false);
    expect(localStandardCheck(autoJob(), NOW)).toEqual({ ok: true, company: "iriss", flow: "new" });
    expect(localStandardCheck(autoJob({ validHours: 1, validUntil: "2026-10-22T19:00:00.000Z" }), NOW).ok).toBe(true);
  });

  it("worker core accepts the trade-act job (1 h, no route) and rejects a wrong representative, no VIN or expiry", () => {
    expect(localStandardCheck(tradeJob(), NOW)).toEqual({ ok: true, company: "iriss", flow: "tradeAct" });
    expect(localStandardCheck({ ...tradeJob(), representative: "Cits Cilvēks" }, NOW).ok).toBe(false);
    expect(localStandardCheck({ ...tradeJob(), vehicle: { ...tradeJob().vehicle, vin: "" } }, NOW).ok).toBe(false);
    expect(localStandardCheck({ ...tradeJob(), auto: { ...tradeJob().auto, flow: "new" } }, NOW).ok).toBe(false);
    expect(localStandardCheck(tradeJob(), Date.parse("2026-10-22T19:00:01.000Z"))).toEqual({ ok: false, reason: "termiņš beidzies" });
  });

  it("trade-act job: reports real stages, passes flow + representative to the scripts and always releases the VPN lease", async () => {
    const d = deps({
      runScript: vi.fn(async (step: string, _input?: unknown) =>
        step === "fill" ? { ok: true, fields: { plate: "B193-7", validHours: 1 } } : { ok: true, waybillNo: "P02811", pdfPath: "pdf/x.pdf" },
      ),
    });
    const res = await processJob(tradeJob(), d);
    expect(res.outcome).toBe("issued");
    const input = (d.runScript.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(input).toMatchObject({ flow: "tradeAct", representative: "Nils Valainis", preferTradeAct: true, validHours: 1, vin: "VF30ARHHAAS201388" });
    const stages = d.api.event.mock.calls.map((c) => (c as unknown[])[1] as { stage?: string }).filter((b) => b.stage).map((b) => b.stage);
    expect(stages).toEqual(["vpn", "filling", "saving", "pdf"]);
    expect(d.vpnRelease).toHaveBeenCalledTimes(1);
  });

  it("releases the VPN lease also when the job fails (before and after save)", async () => {
    const before = deps({ vpnLease: vi.fn(async () => { throw new Error("vpn_lease_409"); }) });
    expect((await processJob(autoJob(), before)).outcome).toBe("released");
    expect(before.vpnRelease).toHaveBeenCalledTimes(1);
    const after = deps({
      runScript: vi.fn(async (step: string) =>
        step === "fill" ? { ok: true, fields: { plate: "B1937", validHours: 48 } } : { ok: false, error: "timeout" },
      ),
    });
    expect((await processJob(autoJob(), after)).outcome).toBe("error_after_save");
    expect(after.vpnRelease).toHaveBeenCalledTimes(1);
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

  it("dry-run never claims and never touches the VPN", async () => {
    const d = deps({ dryRun: true });
    expect((await processJob(autoJob(), d)).outcome).toBe("dry_run");
    expect(d.api.claim).not.toHaveBeenCalled();
    expect(d.vpnLease).not.toHaveBeenCalled();
    expect(d.vpnRelease).not.toHaveBeenCalled();
  });
});

describe("j8: laiks 1/12/48/brīvs abām plūsmām, akts bez maršruta, VPN cilvēkam", () => {
  const hoursReq = (flow: "tradeAct" | "new", validHours: number) => {
    const until = new Date(Date.parse("2026-10-22T18:00:00.000Z") + validHours * 3_600_000).toISOString();
    return flow === "tradeAct" ? tradeReq({ validHours, validUntil: until }) : req({ validHours, validUntil: until });
  };

  for (const flow of ["tradeAct", "new"] as const) {
    it(`${flow}: serveris un worker pieņem 1, 12, 48, brīvu (36) un 2160 h; noraida 0 un 2161`, () => {
      for (const h of [1, 12, 48, 36, 2160]) {
        const r = hoursReq(flow, h);
        expect(classifyWaybillForAuto(r, free)).toMatchObject({ standard: true, flow });
        const job = { ...toAivarsCreateWaybillAction(r), auto: classifyWaybillForAuto(r, free) };
        expect(localStandardCheck(job, NOW)).toMatchObject({ ok: true, flow });
      }
      for (const h of [0, 2161]) {
        expect(classifyWaybillForAuto(hoursReq(flow, h), free)).toEqual({ standard: false, reason: "nederīgs laiks" });
        const ok = hoursReq(flow, 12);
        const job = { ...toAivarsCreateWaybillAction(ok), auto: classifyWaybillForAuto(ok, free), validHours: h };
        expect(localStandardCheck(job, NOW)).toEqual({ ok: false, reason: "nederīgs laiks" });
      }
    });
  }

  it("akta darbam skripti nesaņem maršrutu (tikai laiks + pārstāvis), arī ja pieprasījumā tas būtu", async () => {
    const d = deps({
      runScript: vi.fn(async (step: string, _input?: unknown) =>
        step === "fill" ? { ok: true, fields: { plate: "B193-7", validHours: 1 } } : { ok: true, waybillNo: "P1", pdfPath: "pdf/x.pdf" },
      ),
    });
    await processJob({ ...tradeJob(), routeFrom: "Rīga", routeTo: "Rīga" }, d);
    const input = (d.runScript.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(input).toMatchObject({ flow: "tradeAct", routeFrom: "", routeTo: "", representative: "Nils Valainis", validHours: 1 });
  });

  it("ja Nils lieto VPN (vpn-ctl blocked) vai stāvoklis nav zināms: neko nedara - bez claim, bez VPN, bez skriptiem", async () => {
    for (const status of [{ vpn: "down", blocked: true }, null]) {
      const d = deps({ vpnStatus: vi.fn(async () => status) });
      expect(await processJob(tradeJob(), d)).toEqual({ outcome: "vpn_busy" });
      expect(d.api.claim).not.toHaveBeenCalled();
      expect(d.vpnLease).not.toHaveBeenCalled();
      expect(d.vpnRelease).not.toHaveBeenCalled();
      expect(d.runScript).not.toHaveBeenCalled();
    }
    const failing = deps({ vpnStatus: vi.fn(async () => { throw new Error("ECONNREFUSED"); }) });
    expect((await processJob(tradeJob(), failing)).outcome).toBe("vpn_busy");
    expect(failing.api.claim).not.toHaveBeenCalled();
  });

  it("VPN brīvs: darbs notiek un lease vienmēr tiek atbrīvots; dry-run VPN neaiztiek vispār", async () => {
    const d = deps({
      vpnStatus: vi.fn(async () => ({ vpn: "down", blocked: false })),
      runScript: vi.fn(async (step: string, _input?: unknown) =>
        step === "fill" ? { ok: true, fields: { plate: "B193-7", validHours: 1 } } : { ok: true, waybillNo: "P1", pdfPath: "pdf/x.pdf" },
      ),
    });
    expect((await processJob(tradeJob(), d)).outcome).toBe("issued");
    expect(d.vpnLease).toHaveBeenCalledTimes(1);
    expect(d.vpnRelease).toHaveBeenCalledTimes(1);
    const dryStatus = vi.fn(async () => ({ blocked: false }));
    const dry = deps({ dryRun: true, vpnStatus: dryStatus });
    expect((await processJob(tradeJob(), dry)).outcome).toBe("dry_run");
    expect(dryStatus).not.toHaveBeenCalled();
    expect(dry.vpnLease).not.toHaveBeenCalled();
    expect(dry.api.claim).not.toHaveBeenCalled();
  });
});
