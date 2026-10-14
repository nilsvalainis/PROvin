import { describe, expect, it } from "vitest";
import { emptyIrissOfferRecord, emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import {
  IRISS_STALE_REVISION,
  irissPasutijumsHasOperatorContent,
  irissRevisionMatches,
  irissWorkspaceRevision,
  mergeIrissPasutijumsRecords,
  nextIrissWorkspaceRevision,
  parseExpectedIrissRevision,
  planSilentAutosave,
} from "@/lib/iriss-pasutijumi-save-safety";

function rec(id: string, extra: Partial<ReturnType<typeof emptyIrissPasutijums>> = {}) {
  return { ...emptyIrissPasutijums(id, "2026-10-14T10:00:00.000Z"), ...extra };
}

describe("IRISS revision", () => {
  it("treats missing revision as 0 and bumps on write", () => {
    expect(irissWorkspaceRevision(rec("a"))).toBe(0);
    expect(nextIrissWorkspaceRevision(0)).toBe(1);
    expect(parseExpectedIrissRevision(0)).toBe(0);
    expect(parseExpectedIrissRevision("3")).toBe(3);
    expect(irissRevisionMatches(2, 2)).toBe(true);
    expect(irissRevisionMatches(2, 1)).toBe(false);
    expect(irissRevisionMatches(2, null)).toBe(true);
    expect(IRISS_STALE_REVISION).toBe("stale_revision");
  });
});

describe("mergeIrissPasutijumsRecords", () => {
  it("does not let an empty field overwrite a filled one", () => {
    const server = rec("a", { clientFirstName: "Anna", notes: "Serviss", brandModel: "Golf", workspaceRevision: 4 });
    const local = rec("a", { clientFirstName: "", notes: "Jauna piezīme", brandModel: "Golf", phone: "20000000" });
    const merged = mergeIrissPasutijumsRecords(server, local);
    expect(merged.clientFirstName).toBe("Anna");
    expect(merged.notes).toBe("Jauna piezīme");
    expect(merged.phone).toBe("20000000");
    expect(merged.workspaceRevision).toBe(4);
  });

  it("keeps both offers and both images when ids differ", () => {
    const att = (id: string, dataUrl: string) => ({
      id,
      name: `${id}.jpg`,
      mimeType: "image/jpeg",
      size: 10,
      dataUrl,
    });
    const server = rec("a", {
      offers: [
        {
          ...emptyIrissOfferRecord("off-s", "2026-10-14T10:00:00.000Z", "S"),
          brandModel: "A4",
          vin: "WVWZZZ",
          attachments: [att("img-s", "data:image/jpeg;base64,ss")],
        },
      ],
    });
    const local = rec("a", {
      offers: [
        {
          ...emptyIrissOfferRecord("off-l", "2026-10-14T10:00:00.000Z", "L"),
          brandModel: "A6",
          attachments: [att("img-l", "data:image/jpeg;base64,ll")],
        },
      ],
    });
    const merged = mergeIrissPasutijumsRecords(server, local);
    expect(merged.offers.map((o) => o.id).sort()).toEqual(["off-l", "off-s"]);
    const s = merged.offers.find((o) => o.id === "off-s");
    expect(s?.attachments[0]?.dataUrl).toContain("ss");
  });
});

describe("planSilentAutosave", () => {
  it("queues a second silent save instead of skipping it", () => {
    expect(planSilentAutosave(false)).toEqual({ startNow: true, queue: false });
    expect(planSilentAutosave(true)).toEqual({ startNow: false, queue: true });
  });
});

describe("irissPasutijumsHasOperatorContent", () => {
  it("treats a brand-new empty card as empty", () => {
    expect(irissPasutijumsHasOperatorContent(rec("a"))).toBe(false);
  });

  it("treats VIN or listing link as content", () => {
    expect(irissPasutijumsHasOperatorContent(rec("a", { vin: "WVWZZZ1JZ3W386752" }))).toBe(true);
    expect(irissPasutijumsHasOperatorContent(rec("a", { listingLinkAuto1: ["https://auto1.com/x"] }))).toBe(true);
  });
});
