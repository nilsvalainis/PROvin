import { describe, expect, it } from "vitest";
import { readIrissCriteria } from "@/lib/iriss-criteria-migrate";
import { emptyIrissCriteria } from "@/lib/iriss-criteria-types";
import { emptyIrissOfferRecord, emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import {
  IRISS_STALE_REVISION,
  canSafelyMergeIrissPasutijumsRecords,
  irissPasutijumsHasOperatorContent,
  irissRevisionMatches,
  irissWorkspaceRevision,
  mergeIrissPasutijumsRecords,
  nextIrissWorkspaceRevision,
  parseExpectedIrissRevision,
  planSilentAutosave,
  prepareIrissPasutijumsConcurrentWrite,
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

  it("lets a later cleared field win over a filled server value", () => {
    const server = rec("a", { clientFirstName: "Anna", notes: "Serviss", fieldUpdatedAt: { clientFirstName: 10 } });
    const local = rec("a", {
      clientFirstName: "",
      notes: "Serviss",
      clearedFields: { clientFirstName: 20 },
      fieldUpdatedAt: { clientFirstName: 20 },
    });
    const merged = mergeIrissPasutijumsRecords(server, local);
    expect(merged.clientFirstName).toBe("");
    expect(merged.clearedFields?.clientFirstName).toBe(20);
  });

  it("lets the later statusChangedAt win, not local || server", () => {
    const server = rec("a", {
      listStatus: "reserved",
      statusChangedAt: "2026-10-15T12:00:00.000Z",
    });
    const local = rec("a", {
      listStatus: "active",
      statusChangedAt: "2026-10-15T10:00:00.000Z",
    });
    const merged = mergeIrissPasutijumsRecords(server, local);
    expect(merged.listStatus).toBe("reserved");
    expect(merged.statusChangedAt).toBe("2026-10-15T12:00:00.000Z");
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

  it("does not copy derived criteria onto a legacy record", () => {
    const server = rec("a", {
      engineType: "dīzelis",
      preferredColors: "melna",
      brandModel: "Volvo XC60",
      notes: "Serviss",
    });
    const local = {
      ...server,
      notes: "Jauna piezīme",
      criteria: readIrissCriteria(server),
    };
    const merged = mergeIrissPasutijumsRecords(server, local);
    expect(merged.notes).toBe("Jauna piezīme");
    expect(merged.engineType).toBe("dīzelis");
    expect(merged.preferredColors).toBe("melna");
    expect(merged.brandModel).toBe("Volvo XC60");
    expect(merged.criteria).toBeUndefined();
  });

  it("persists operator from-to criteria onto a legacy record", () => {
    const server = rec("a", { brandModel: "Volvo XC60", engineType: "dīzelis" });
    const criteria = emptyIrissCriteria();
    criteria.filters[0]!.useForm = true;
    criteria.filters[0]!.make = { value: ["Volvo"], manual: "", source: "form" };
    criteria.filters[0]!.models = { value: ["XC60"], manual: "", source: "form" };
    criteria.filters[0]!.yearFrom = { value: 2018, manual: "", source: "form" };
    criteria.filters[0]!.yearTo = { value: 2021, manual: "", source: "form" };
    criteria.filters[0]!.budgetFrom = { value: 10000, manual: "", source: "form" };
    criteria.filters[0]!.budgetTo = { value: 22000, manual: "", source: "form" };
    criteria.filters[0]!.mileageTo = { value: 150000, manual: "", source: "form" };
    const local = {
      ...server,
      productionYears: "2018-2021",
      totalBudget: "10000-22000",
      maxMileage: "150000",
      criteria,
    };
    const merged = mergeIrissPasutijumsRecords(server, local);
    expect(merged.criteria?.filters[0]?.budgetFrom.value).toBe(10000);
    expect(merged.criteria?.filters[0]?.yearTo.value).toBe(2021);
    expect(merged.brandModel).toBe("Volvo XC60");
  });

  it("keeps criteria that was already stored and ignores a fresh migration", () => {
    const stored = emptyIrissCriteria();
    stored.filters[0]!.label = "Jau saglabāts";
    const server = rec("a", { engineType: "dīzelis", criteria: stored });
    const local = {
      ...server,
      engineType: "benzīns",
      criteria: readIrissCriteria({ engineType: "benzīns" }),
    };
    const merged = mergeIrissPasutijumsRecords(server, local);
    expect(merged.criteria).toEqual(stored);
    expect(merged.criteria?.filters[0]?.label).toBe("Jau saglabāts");
    expect(merged.engineType).toBe("benzīns");
  });

  it("keeps a later deleted eCarsTrade list instead of restoring server rows", () => {
    const server = rec("a", {
      listingLinkEcarstrade: [
        "https://ecarstrade.com/search?mark[]=68",
        "https://ecarstrade.com/search?mark[]=68&fuel[]=Diesel",
      ],
      notes: "Aģenta piezīme",
      fieldUpdatedAt: { listingLinkEcarstrade: 10, notes: 40 },
    });
    const local = rec("a", {
      listingLinkEcarstrade: ["https://ecarstrade.com/search?mark[]=68"],
      ecarstradeLinksManual: true,
      fieldUpdatedAt: { listingLinkEcarstrade: 50 },
      clearedFields: {},
      notes: "",
    });
    const merged = mergeIrissPasutijumsRecords(server, local);
    expect(merged.listingLinkEcarstrade).toEqual(["https://ecarstrade.com/search?mark[]=68"]);
    expect(merged.ecarstradeLinksManual).toBe(true);
    expect(merged.notes).toBe("Aģenta piezīme");
  });

  it("merges concurrent notes vs ET-link edits instead of stale_revision", () => {
    const server = rec("a", {
      workspaceRevision: 6,
      notes: "Aģenta piezīme",
      listingLinkEcarstrade: [
        "https://ecarstrade.com/search?mark[]=68",
        "https://ecarstrade.com/search?mark[]=5",
      ],
      fieldUpdatedAt: { notes: 40 },
    });
    const local = rec("a", {
      workspaceRevision: 5,
      notes: "",
      listingLinkEcarstrade: ["https://ecarstrade.com/search?mark[]=68"],
      ecarstradeLinksManual: true,
      fieldUpdatedAt: { listingLinkEcarstrade: 50 },
    });
    expect(canSafelyMergeIrissPasutijumsRecords(server, local)).toBe(true);
    const prepared = prepareIrissPasutijumsConcurrentWrite(server, local, 5);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.merged).toBe(true);
    expect(prepared.record.notes).toBe("Aģenta piezīme");
    expect(prepared.record.listingLinkEcarstrade).toEqual(["https://ecarstrade.com/search?mark[]=68"]);
    expect(prepared.record.ecarstradeLinksManual).toBe(true);
  });

  it("still flags stale_revision when the same text field changed on both sides without timestamps", () => {
    const server = rec("a", { workspaceRevision: 2, notes: "cita cilne" });
    const local = rec("a", { workspaceRevision: 1, notes: "vecā cilne" });
    expect(canSafelyMergeIrissPasutijumsRecords(server, local)).toBe(false);
    const prepared = prepareIrissPasutijumsConcurrentWrite(server, local, 1);
    expect(prepared).toEqual({ ok: false, error: IRISS_STALE_REVISION, record: server });
  });
});

describe("planSilentAutosave", () => {
  it("queues a second silent save instead of skipping it", () => {
    expect(planSilentAutosave(false)).toEqual({ startNow: true, queue: false });
    expect(planSilentAutosave(true)).toEqual({ startNow: false, queue: true });
    expect(planSilentAutosave(false, true)).toEqual({ startNow: false, queue: true });
  });
});

describe("irissPasutijumsHasOperatorContent", () => {
  it("treats a brand-new empty card as empty", () => {
    expect(irissPasutijumsHasOperatorContent(rec("a"))).toBe(false);
  });

  it("treats VIN or listing link as content", () => {
    expect(irissPasutijumsHasOperatorContent(rec("a", { vin: "WVWZZZ1JZ3W386752" }))).toBe(true);
    expect(irissPasutijumsHasOperatorContent(rec("a", { listingLinkAuto1: ["https://auto1.com/x"] }))).toBe(true);
    expect(irissPasutijumsHasOperatorContent(rec("a", { listingLinkEcarstrade: ["https://ecarstrade.com/search"] }))).toBe(true);
  });
});

describe("retainIrissOfferDeadlines", () => {
  it("keeps an offer deadline when a save does not carry it, but lets it change", async () => {
    const { retainIrissOfferDeadlines } = await import("@/lib/iriss-pasutijumi-save-safety");
    const { emptyIrissOfferRecord, emptyIrissPasutijums } = await import("@/lib/iriss-pasutijumi-types");
    const at = "2026-10-26T16:00:00.000Z";
    const existing = emptyIrissPasutijums("11111111-1111-4111-8111-111111111111", at);
    const offer = emptyIrissOfferRecord("22222222-2222-4222-8222-222222222222", at, "Piedāvājums 1");
    existing.offers = [{ ...offer, validUntilAt: at }];
    const stale = { ...existing, offers: [{ ...offer, color: "Zila" }] };
    expect(retainIrissOfferDeadlines(existing, stale).offers[0]).toMatchObject({ color: "Zila", validUntilAt: at });
    const moved = { ...existing, offers: [{ ...offer, validUntilAt: "2026-10-28T16:00:00.000Z" }] };
    expect(retainIrissOfferDeadlines(existing, moved).offers[0]?.validUntilAt).toBe("2026-10-28T16:00:00.000Z");
    const noDeadlines = { ...existing, offers: [offer] };
    expect(retainIrissOfferDeadlines(noDeadlines, stale)).toBe(stale);
    expect(retainIrissOfferDeadlines(null, stale)).toBe(stale);
  });
});
