import { describe, expect, it } from "vitest";
import { csddPlateCheckText, withCsddCheckInfo, type CsddPlatesDoc } from "@/lib/iriss-waybill-csdd-plates";
import { composeWaybillPlateStates } from "@/lib/iriss-waybill-live-plates";
import { waybillGaugesFromPlates } from "@/lib/iriss-waybill-gauges";

const NOW = Date.parse("2026-11-19T10:00:00.000Z");

const doc: CsddPlatesDoc = {
  version: 1,
  updatedAt: "2026-11-19T09:50:00.000Z",
  plates: [
    { plate: "B193-7", ok: true, checkedAt: "2026-11-19T09:50:00.000Z", active: [], error: "" },
    { plate: "B762-7", ok: false, checkedAt: "2026-11-19T09:55:00.000Z", active: [], error: "timeout" },
  ],
};

describe("CSDD nolasījuma laiks pie numura", () => {
  it("teksts: tikko / min / h / d", () => {
    expect(csddPlateCheckText({ csddCheckedAt: "2026-11-19T09:59:40.000Z", csddCheckOk: true }, NOW)).toEqual({
      text: "Stāvoklis no CSDD tikko",
      stale: false,
    });
    expect(csddPlateCheckText({ csddCheckedAt: "2026-11-19T09:30:00.000Z", csddCheckOk: true }, NOW)).toEqual({
      text: "Stāvoklis no CSDD pirms 30 min",
      stale: false,
    });
    expect(csddPlateCheckText({ csddCheckedAt: "2026-11-19T07:00:00.000Z", csddCheckOk: true }, NOW).text).toBe(
      "Stāvoklis no CSDD pirms 3 h - var būt novecojis",
    );
    expect(csddPlateCheckText({ csddCheckedAt: "2026-11-17T09:00:00.000Z", csddCheckOk: true }, NOW).text).toBe(
      "Stāvoklis no CSDD pirms 2 d - var būt novecojis",
    );
  });

  it("vecs par 90 min, kļūda, VPN izslēgts vai nav nolasīts - stale", () => {
    expect(csddPlateCheckText({ csddCheckedAt: "2026-11-19T08:20:00.000Z", csddCheckOk: true }, NOW).stale).toBe(true);
    expect(csddPlateCheckText({ csddCheckedAt: "2026-11-19T09:15:00.000Z", csddCheckOk: true }, NOW).stale).toBe(false);
    expect(csddPlateCheckText({ csddCheckedAt: "2026-11-19T09:58:00.000Z", csddCheckOk: false }, NOW).stale).toBe(true);
    expect(csddPlateCheckText({ csddCheckedAt: "2026-11-19T09:58:00.000Z", csddCheckOk: true }, NOW, { vpnDown: true }).stale).toBe(true);
    expect(csddPlateCheckText({}, NOW)).toEqual({ text: "Stāvoklis no CSDD nav nolasīts", stale: true });
  });

  it("withCsddCheckInfo: katram numuram savs nolasījums; bez ieraksta - bez laika", () => {
    const out = withCsddCheckInfo([{ plate: "B193-7" }, { plate: "B762-7" }, { plate: "B192-7" }], doc);
    expect(out[0]).toEqual({ plate: "B193-7", csddCheckedAt: "2026-11-19T09:50:00.000Z", csddCheckOk: true });
    expect(out[1]).toMatchObject({ csddCheckOk: false });
    expect(out[2]).toEqual({ plate: "B192-7" });
    expect(withCsddCheckInfo([{ plate: "B193-7" }], null)).toEqual([{ plate: "B193-7" }]);
  });

  it("apļi (composeWaybillPlateStates -> gauges) saņem nolasījuma laiku", () => {
    const plates = composeWaybillPlateStates([], doc, [], new Date(NOW));
    const g = waybillGaugesFromPlates(plates, [], new Date(NOW));
    const b193 = g.find((x) => x.plate === "B193-7")!;
    expect(csddPlateCheckText(b193, NOW).text).toBe("Stāvoklis no CSDD pirms 10 min");
    const b192 = g.find((x) => x.plate === "B192-7")!;
    expect(b192.csddCheckedAt).toBeUndefined();
  });
});

describe("csddPlatesCheckSummary (20.11: viens teksts visiem numuriem)", () => {
  it("ņem vecāko nolasījumu; kļūda vai nenolasīts numurs = stale", async () => {
    const { csddPlatesCheckSummary, csddPlateCheckText } = await import("@/lib/iriss-waybill-csdd-plates");
    const now = Date.parse("2026-11-20T10:00:00Z");
    const ok = csddPlatesCheckSummary([
      { csddCheckedAt: "2026-11-20T09:55:00Z", csddCheckOk: true },
      { csddCheckedAt: "2026-11-20T09:50:00Z", csddCheckOk: true },
    ]);
    expect(csddPlateCheckText(ok, now)).toEqual({ text: "Stāvoklis no CSDD pirms 10 min", stale: false });
    const bad = csddPlatesCheckSummary([{ csddCheckedAt: "2026-11-20T09:55:00Z", csddCheckOk: false }, {}]);
    expect(csddPlateCheckText(bad, now).stale).toBe(true);
    expect(csddPlateCheckText(csddPlatesCheckSummary([{}, {}]), now).text).toBe("Stāvoklis no CSDD nav nolasīts");
  });
});
