import { describe, expect, it } from "vitest";
import {
  appendIrissStatusHistory,
  applyIrissFieldEdit,
  irissRequiredFieldWarnings,
  isIrissRecordDeleted,
  markIrissRecordDeleted,
  parseIrissStatusHistory,
  pickIrissPasutijumsAuditFields,
  restoreIrissRecord,
  setIrissInactiveReason,
} from "@/lib/iriss-pasutijumi-audit-fields";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";

function rec(extra: Partial<ReturnType<typeof emptyIrissPasutijums>> = {}) {
  return { ...emptyIrissPasutijums("a", "2026-10-14T10:00:00.000Z"), ...extra };
}

describe("IRISS audit fields", () => {
  it("marks a cleared string with a tombstone and timestamp", () => {
    const prev = rec({ clientFirstName: "Anna", notes: "x" });
    const next = applyIrissFieldEdit(prev, { clientFirstName: "" }, 1_700_000_000_000);
    expect(next.clientFirstName).toBe("");
    expect(next.clearedFields?.clientFirstName).toBe(1_700_000_000_000);
    expect(next.fieldUpdatedAt?.clientFirstName).toBe(1_700_000_000_000);
  });

  it("drops the tombstone when the field is filled again", () => {
    const prev = applyIrissFieldEdit(rec({ clientFirstName: "Anna" }), { clientFirstName: "" }, 10);
    const next = applyIrissFieldEdit(prev, { clientFirstName: "Ieva" }, 20);
    expect(next.clearedFields?.clientFirstName).toBeUndefined();
    expect(next.fieldUpdatedAt?.clientFirstName).toBe(20);
  });

  it("appends status history and optional Neaktīvs reason", () => {
    const next = appendIrissStatusHistory(rec({ listStatus: "active" }), "inactive", {
      at: "2026-10-15T10:00:00.000Z",
      reason: "Klients atsaucās",
    });
    expect(next.listStatus).toBe("inactive");
    expect(next.statusChangedAt).toBe("2026-10-15T10:00:00.000Z");
    expect(next.statusHistory).toEqual([
      {
        from: "active",
        to: "inactive",
        at: "2026-10-15T10:00:00.000Z",
        by: "operators",
        reason: "Klients atsaucās",
      },
    ]);
    const withReason = setIrissInactiveReason(next, "Cits iemesls");
    expect(withReason.inactiveReason).toBe("Cits iemesls");
    expect(withReason.statusHistory?.[0]?.reason).toBe("Cits iemesls");
  });

  it("soft-deletes and restores without dropping other fields", () => {
    const gone = markIrissRecordDeleted(rec({ brandModel: "Golf" }), "2026-10-15T12:00:00.000Z");
    expect(isIrissRecordDeleted(gone)).toBe(true);
    const back = restoreIrissRecord(gone);
    expect(isIrissRecordDeleted(back)).toBe(false);
    expect(back.brandModel).toBe("Golf");
  });

  it("warns on missing client name and phone without blocking", () => {
    expect(irissRequiredFieldWarnings(rec())).toEqual(["Nav klienta vārda.", "Nav tālruņa."]);
    expect(irissRequiredFieldWarnings(rec({ clientFirstName: "Anna", phone: "20000000" }))).toEqual([]);
  });

  it("marks edited eCarsTrade links as manual and timestamps the list", () => {
    const prev = rec({
      listingLinkEcarstrade: [
        "https://ecarstrade.com/search?mark[]=68",
        "https://ecarstrade.com/search?mark[]=68&fuel[]=Diesel",
      ],
    });
    const next = applyIrissFieldEdit(prev, { listingLinkEcarstrade: ["https://ecarstrade.com/search?mark[]=68"] }, 50);
    expect(next.listingLinkEcarstrade).toEqual(["https://ecarstrade.com/search?mark[]=68"]);
    expect(next.ecarstradeLinksManual).toBe(true);
    expect(next.fieldUpdatedAt?.listingLinkEcarstrade).toBe(50);
    const cleared = applyIrissFieldEdit(next, { listingLinkEcarstrade: [""] }, 60);
    expect(cleared.listingLinkEcarstrade).toEqual([""]);
    expect(cleared.clearedFields?.listingLinkEcarstrade).toBe(60);
    expect(cleared.ecarstradeLinksManual).toBe(true);
  });

  it("parses stored audit JSON defensively", () => {
    const picked = pickIrissPasutijumsAuditFields({
      clearedFields: { notes: 12 },
      fieldUpdatedAt: { notes: 12 },
      statusChangedAt: "2026-10-15T10:00:00.000Z",
      deletedAt: "2026-10-15T11:00:00.000Z",
      inactiveReason: "pauze",
      statusHistory: [
        { from: "active", to: "inactive", at: "2026-10-15T10:00:00.000Z", by: "nils", reason: "pauze" },
        { from: "nope", to: "active", at: "x" },
      ],
    });
    expect(picked.clearedFields).toEqual({ notes: 12 });
    expect(picked.statusHistory).toHaveLength(1);
    expect(parseIrissStatusHistory(picked.statusHistory)[0]?.to).toBe("inactive");
  });
});
