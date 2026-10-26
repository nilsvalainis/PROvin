import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scriptInput } from "@/scripts/iriss-ttr/waybill-worker-core.mjs";
import {
  compareFields,
  createLedger,
  dialogDecision,
  formatRigaDate,
  isClickAllowed,
  isRequestForbidden,
  normalizeFields,
  parseJobInput,
  parseRigaDate,
  runCli,
  runRefill,
  runSave,
} from "@/scripts/iriss-ttr/waybill-scripts-core.mjs";

const job = {
  id: "wbr_abc123",
  vehicle: { plate: "B193-7", brandModel: "BMW 330", vin: "WBA8E9C50GK000001" },
  auto: { company: "iriss", ctx: 1 },
  routeFrom: "Tukums, Rīgas iela",
  routeTo: "Tukuma CSDD",
  validFrom: "2026-10-22T10:00:00.000Z",
  validUntil: "2026-10-24T10:00:00.000Z",
  validHours: 48,
  // Pieņemts auto: akts -> "Noformēt pavadzīmi".
  tradeAct: true,
  representative: "Nils Valainis",
};
// Tā pati ievade, ko worker nodod caur IRISS_JOB_JSON.
const workerInput = () => scriptInput(job);
// Jauna pavadzīme (nav pieņemts tirdzniecībā).
const newWaybillInput = () => scriptInput({ ...job, tradeAct: false, representative: "" });

/** CSDD formas imitācija: atceras ievadītās vērtības, skaita Saglabāt klikšķus. */
function mockDriver(over: Record<string, unknown> = {}) {
  let form: Record<string, string> = {};
  let open = false;
  const d = {
    calls: [] as string[],
    saves: 0,
    open: vi.fn(async () => void d.calls.push("open")),
    findActiveWaybill: vi.fn(async () => null),
    openFromTradeAct: vi.fn(async () => {
      d.calls.push("tradeAct");
      open = true;
      return true;
    }),
    openNewWaybill: vi.fn(async () => {
      d.calls.push("new");
      open = true;
    }),
    fillForm: vi.fn(async (values: Record<string, string>) => {
      form = { ...values };
    }),
    readForm: vi.fn(async () => ({ ...form })),
    formMode: vi.fn(async () => (open ? "open" : "")),
    clickSave: vi.fn(async () => {
      d.saves += 1;
    }),
    readWaybillNo: vi.fn(async () => "TA-123456"),
    downloadPdf: vi.fn(async (name: string) => `pdf/${name}.pdf`),
    close: vi.fn(async () => {}),
    ...over,
  };
  return d;
}

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "wb-ledger-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("aizsardzība: nekad nepārtrauc / neanulē", () => {
  it("never clicks terminate/annul/end controls, in any phase", () => {
    for (const text of ["Pārtraukt", "Anulēt", "Beigt pavadzīmi", "Partraukt", "Dzēst", "Atcelt"]) {
      for (const phase of ["login", "fill", "save", "pdf"] as const) {
        expect(isClickAllowed({ text }, phase).allowed).toBe(false);
      }
    }
    expect(isClickAllowed({ text: "Saglabāt", onclick: "doAnul()" }, "save").allowed).toBe(false);
    expect(isClickAllowed({ text: "Paziņot klientam" }, "save").allowed).toBe(false);
    expect(isClickAllowed({ text: "Anulēt" }, "annul").allowed).toBe(false);
    expect(isClickAllowed({ text: "Paziņot klientam" }, "annul").allowed).toBe(false);
    expect(isClickAllowed({ text: "Pārtraukt!" }, "annul").allowed).toBe(true);
  });

  it("allows Saglabāt only in the save phase", () => {
    expect(isClickAllowed({ text: "Saglabāt" }, "fill").allowed).toBe(false);
    expect(isClickAllowed({ text: "Saglabāt" }, "save").allowed).toBe(true);
    expect(isClickAllowed({ text: "Jauna pavadzīme" }, "save").allowed).toBe(false);
    expect(isClickAllowed({ text: "Jauna pavadzīme" }, "fill").allowed).toBe(true);
    expect(isClickAllowed({ text: "Noformēt pavadzīmi" }, "fill").allowed).toBe(true);
    expect(isClickAllowed({ text: "Drukāt" }, "pdf").allowed).toBe(true);
  });

  it("blocks terminate/annul requests on the network", () => {
    expect(isRequestForbidden({ url: "https://x/ttr/partraukt?id=5" })).toBe(true);
    expect(isRequestForbidden({ url: "https://x/ttr/action", postData: "cmd=Anul%C4%93t" })).toBe(true);
    expect(isRequestForbidden({ url: "https://x/ttr/save", postData: "plate=B1937" })).toBe(false);
  });

  it("dismisses dialogs that mention terminating; accepts only plain save confirmations", () => {
    expect(dialogDecision("Numurs aizņemts. Pārtraukt iepriekšējo pavadzīmi?", "save")).toBe("dismiss");
    expect(dialogDecision("Vai saglabāt pavadzīmi?", "save")).toBe("accept");
    expect(dialogDecision("Vai saglabāt pavadzīmi?", "fill")).toBe("dismiss");
  });
});

describe("ievade un lauki", () => {
  it("accepts the worker's IRISS_JOB_JSON and rejects broken input", () => {
    const input = parseJobInput(JSON.stringify(workerInput()));
    expect(input).toMatchObject({ jobId: "wbr_abc123", validHours: 48, ctx: 1, preferTradeAct: true, flow: "tradeAct", representative: "Nils Valainis" });
    expect(parseJobInput(newWaybillInput())).toMatchObject({ flow: "new", preferTradeAct: false, representative: "" });
    // 1 h pieprasījums der (Nila reālā plūsma); akta darbam vajag VIN un pārstāvi.
    expect(parseJobInput({ ...workerInput(), validHours: 1, validUntil: "2026-10-22T11:00:00.000Z" }).validHours).toBe(1);
    expect(() => parseJobInput({ ...workerInput(), vin: "" })).toThrow("VIN");
    expect(() => parseJobInput({ ...workerInput(), representative: "" })).toThrow("pārstāvi");
    expect(() => parseJobInput("{")).toThrow();
    expect(() => parseJobInput({ ...workerInput(), jobId: "../etc" })).toThrow("jobId");
    expect(() => parseJobInput({ ...workerInput(), validUntil: "2026-10-23T10:00:00.000Z" })).toThrow("derīgum");
    expect(() => parseJobInput({ ...workerInput(), ctx: 3 })).toThrow("ctx");
  });

  it("formats and parses Riga time across DST", () => {
    expect(formatRigaDate("2026-10-22T10:00:00.000Z")).toBe("22.10.2026 13:00");
    expect(formatRigaDate("2026-12-01T10:00:00.000Z")).toBe("01.12.2026 12:00");
    expect(new Date(parseRigaDate("22.10.2026 13:00")).toISOString()).toBe("2026-10-22T10:00:00.000Z");
    expect(new Date(parseRigaDate("01.12.2026 12:00")).toISOString()).toBe("2026-12-01T10:00:00.000Z");
  });

  it("derives validity hours from the form dates when there is no hours field", () => {
    const f = normalizeFields({ plate: "B 193-7", validFrom: "22.10.2026 13:00", validUntil: "24.10.2026 13:00" }, "new");
    expect(f).toMatchObject({ plate: "B1937", validHours: 48 });
    expect(compareFields(parseJobInput(workerInput()), f)).toEqual([]);
    expect(compareFields(parseJobInput(workerInput()), { ...f, plate: "B7627" })).toEqual(["plate"]);
  });
});

describe("refill.js", () => {
  it("fills from the trade act and never presses Saglabāt", async () => {
    const driver = mockDriver();
    const out = await runRefill({ input: parseJobInput(workerInput()), ledger: createLedger(dir), driver });
    expect(out).toMatchObject({ ok: true, fields: { plate: "B1937", validHours: 48, mode: "trade_act" } });
    expect(driver.clickSave).not.toHaveBeenCalled();
    expect(driver.calls).toEqual(["open", "tradeAct"]);
    expect(driver.close).toHaveBeenCalledWith({ keepPage: true });
  });

  it("a new waybill (not accepted in trade) opens the new form directly", async () => {
    const driver = mockDriver();
    const out = await runRefill({ input: parseJobInput(newWaybillInput()), ledger: createLedger(dir), driver });
    expect(out.ok).toBe(true);
    expect(out.fields?.mode).toBe("new");
    expect(driver.openFromTradeAct).not.toHaveBeenCalled();
    expect(driver.openNewWaybill).toHaveBeenCalledTimes(1);
  });

  it("accepted car without a trade act: error, never a new waybill instead", async () => {
    const driver = mockDriver({ openFromTradeAct: vi.fn(async () => false) });
    const out = await runRefill({ input: parseJobInput(workerInput()), ledger: createLedger(dir), driver }).catch((e: Error) => ({
      ok: false as const,
      error: e.message,
    }));
    expect(out).toMatchObject({ ok: false, error: expect.stringContaining("akts nav atrasts") });
    expect(driver.openNewWaybill).not.toHaveBeenCalled();
    expect(driver.clickSave).not.toHaveBeenCalled();
  });

  it("fails without saving when the form shows different values", async () => {
    const driver = mockDriver({ readForm: vi.fn(async () => ({ plate: "B762-7", validHours: "48" })) });
    const out = await runRefill({ input: parseJobInput(workerInput()), ledger: createLedger(dir), driver });
    expect(out).toMatchObject({ ok: false, error: "lauki nesakrīt: plate" });
    expect(driver.clickSave).not.toHaveBeenCalled();
  });

  it("stops when the plate already has an active waybill (never terminates it)", async () => {
    const driver = mockDriver({ findActiveWaybill: vi.fn(async () => ({ waybillNo: "TA-1" })) });
    const out = await runRefill({ input: parseJobInput(workerInput()), ledger: createLedger(dir), driver });
    expect(out.ok).toBe(false);
    expect(driver.fillForm).not.toHaveBeenCalled();
  });

  it("does not refill a job whose save already started", async () => {
    const ledger = createLedger(dir);
    ledger.beginSave("wbr_abc123", { plate: "B193-7" });
    const driver = mockDriver();
    const out = await runRefill({ input: parseJobInput(workerInput()), ledger, driver });
    expect(out.ok).toBe(false);
    expect(driver.open).not.toHaveBeenCalled();
  });
});

describe("save.js: idempotence", () => {
  it("refill -> save presses Saglabāt once and returns number + pdf", async () => {
    const ledger = createLedger(dir);
    const input = parseJobInput(workerInput());
    const driver = mockDriver();
    await runRefill({ input, ledger, driver });
    const out = await runSave({ input, ledger, driver });
    expect(out).toEqual({ ok: true, waybillNo: "TA-123456", pdfPath: "pdf/wbr_abc123-TA-123456.pdf" });
    expect(driver.saves).toBe(1);
    expect(driver.fillForm).toHaveBeenCalledTimes(1);
  });

  it("refills in save.js when the form is not open (own browser per process)", async () => {
    const input = parseJobInput(workerInput());
    const out = await runSave({ input, ledger: createLedger(dir), driver: mockDriver() });
    expect(out.ok).toBe(true);
  });

  it("a repeated save returns the same waybill without pressing Saglabāt again", async () => {
    const ledger = createLedger(dir);
    const input = parseJobInput(workerInput());
    await runSave({ input, ledger, driver: mockDriver() });
    const again = mockDriver();
    const out = await runSave({ input, ledger, driver: again });
    expect(out).toMatchObject({ ok: true, waybillNo: "TA-123456", repeated: true });
    expect(again.open).not.toHaveBeenCalled();
    expect(again.saves).toBe(0);
  });

  it("only one concurrent save per job (atomic lock)", async () => {
    const ledger = createLedger(dir);
    const input = parseJobInput(workerInput());
    let release: () => void = () => {};
    const slow = mockDriver({ clickSave: vi.fn(() => new Promise<void>((r) => (release = r))) });
    const first = runSave({ input, ledger, driver: slow });
    await vi.waitFor(() => expect(slow.clickSave).toHaveBeenCalled());
    const second = mockDriver();
    const out2 = await runSave({ input, ledger, driver: second });
    expect(out2.ok).toBe(false);
    expect(second.saves).toBe(0);
    release();
    expect((await first).ok).toBe(true);
  });

  it("unknown result after the click: never presses Saglabāt again", async () => {
    const ledger = createLedger(dir);
    const input = parseJobInput(workerInput());
    const lost = mockDriver({ readWaybillNo: vi.fn(async () => "") });
    const out = await runSave({ input, ledger, driver: lost });
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/pārbaudi CSDD/);
    const retry = mockDriver();
    expect((await runSave({ input, ledger, driver: retry })).ok).toBe(false);
    expect(retry.saves).toBe(0);
    expect((await runRefill({ input, ledger, driver: retry })).ok).toBe(false);
  });

  it("failure before the click may be retried", async () => {
    const ledger = createLedger(dir);
    const input = parseJobInput(workerInput());
    const broken = mockDriver({ open: vi.fn(async () => Promise.reject(new Error("CSDD pieslēgšanās neizdevās"))) });
    expect(await runSave({ input, ledger, driver: broken })).toMatchObject({ ok: false, error: "CSDD pieslēgšanās neizdevās" });
    expect(broken.saves).toBe(0);
    const ok = mockDriver();
    expect((await runSave({ input, ledger, driver: ok })).ok).toBe(true);
    expect(ok.saves).toBe(1);
  });

  it("refuses a second waybill for the same plate saved by another job in the last 30 min", async () => {
    const ledger = createLedger(dir);
    await runSave({ input: parseJobInput(workerInput()), ledger, driver: mockDriver() });
    const other = mockDriver();
    const out = await runSave({ input: parseJobInput({ ...workerInput(), jobId: "wbr_other" }), ledger, driver: other });
    expect(out.ok).toBe(false);
    expect(other.saves).toBe(0);
  });

  it("does not save when the plate already has an active waybill", async () => {
    const driver = mockDriver({ findActiveWaybill: vi.fn(async () => ({ waybillNo: "TA-9" })) });
    const out = await runSave({ input: parseJobInput(workerInput()), ledger: createLedger(dir), driver });
    expect(out.ok).toBe(false);
    expect(driver.saves).toBe(0);
  });

  it("a PDF failure after saving still reports the saved waybill", async () => {
    const driver = mockDriver({ downloadPdf: vi.fn(async () => Promise.reject(new Error("timeout"))) });
    const out = await runSave({ input: parseJobInput(workerInput()), ledger: createLedger(dir), driver });
    expect(out).toEqual({ ok: true, waybillNo: "TA-123456", pdfPath: "" });
  });
});

describe("CLI līgums ar worker", () => {
  const sink = () => {
    let s = "";
    return { write: (c: string) => ((s += c), true), text: () => s };
  };

  it("prints the result as the last stdout line and exits 0", async () => {
    const stdout = sink();
    const code = await runCli("save", {
      env: { IRISS_JOB_JSON: JSON.stringify(workerInput()) },
      makeDriver: async () => mockDriver(),
      ledgerDir: dir,
      stdout,
      stderr: sink(),
    });
    expect(code).toBe(0);
    expect(JSON.parse(stdout.text().trim().split("\n").pop()!)).toMatchObject({ ok: true, waybillNo: "TA-123456" });
  });

  it("node refill.js without setup returns {ok:false} JSON instead of touching CSDD", () => {
    const ttrDir = fs.mkdtempSync(path.join(os.tmpdir(), "wb-ttr-"));
    for (const step of ["refill.js", "save.js"]) {
      const out = execFileSync("node", [path.resolve("scripts/iriss-ttr", step)], {
        env: { ...process.env, IRISS_TTR_DIR: ttrDir, IRISS_JOB_JSON: JSON.stringify(workerInput()) },
        encoding: "utf8",
      });
      expect(JSON.parse(out.trim().split("\n").pop()!)).toMatchObject({ ok: false, error: expect.stringContaining("waybill-ui.json") });
    }
    fs.rmSync(ttrDir, { recursive: true, force: true });
  });
});
