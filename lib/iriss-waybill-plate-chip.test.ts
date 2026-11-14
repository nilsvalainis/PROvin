import { describe, expect, it } from "vitest";
import { loadingWaybillPlateStates, waybillPlateChip } from "@/lib/iriss-waybill-plates";

describe("numura statuss formā", () => {
  it("ielādes laikā neviens numurs nav 'brīvs'", () => {
    const chips = loadingWaybillPlateStates().map(waybillPlateChip);
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.every((c) => c.label === "…" && c.tone === "loading")).toBe(true);
  });
  it("numurs ar pieprasījumu rindā vai darbā - 'gaida Aivaru', arī ja ir aizņemts", () => {
    expect(waybillPlateChip({ busy: false, issuing: { brandModel: "BMW" } })).toEqual({ tone: "pending", label: "gaida Aivaru" });
    expect(waybillPlateChip({ busy: true, issuing: { brandModel: "BMW", manual: true } }).label).toBe("gaida Aivaru");
  });
  it("pēc ielādes: aizņemts / brīvs", () => {
    expect(waybillPlateChip({ busy: true })).toEqual({ tone: "busy", label: "aizņemts" });
    expect(waybillPlateChip({ busy: false })).toEqual({ tone: "free", label: "brīvs" });
  });
});
