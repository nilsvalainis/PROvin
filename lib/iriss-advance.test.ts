import { describe, expect, it } from "vitest";
import {
  emptyIrissAdvanceDraft,
  irissAdvanceHasContent,
  irissAdvanceHeaderChip,
  irissAdvancePaidToday,
  irissAdvanceReceivedLabel,
  irissAdvanceTowardCommission,
  irissAdvanceWithQuickAmount,
  irissTameBalanceAfterAdvance,
  normalizeIrissAdvanceDraft,
  parseIrissAdvanceAmount,
  rigaTodayYmd,
} from "@/lib/iriss-advance";

describe("iriss-advance", () => {
  it("treats missing and empty drafts as absent", () => {
    expect(normalizeIrissAdvanceDraft(undefined)).toBeUndefined();
    expect(normalizeIrissAdvanceDraft({})).toBeUndefined();
    expect(irissAdvanceHasContent(emptyIrissAdvanceDraft())).toBe(false);
    expect(irissAdvanceHeaderChip(undefined)).toBeNull();
  });

  it("keeps filled optional fields and formats the header chip", () => {
    const draft = normalizeIrissAdvanceDraft({
      amount: "200",
      paidAt: "2026-10-17",
      method: "pārskaitījums",
      invoiceNo: "DZA-2026-04191",
    });
    expect(draft).toEqual({
      amount: "200",
      paidAt: "2026-10-17",
      method: "transfer",
      invoiceNo: "DZA-2026-04191",
    });
    expect(irissAdvanceHeaderChip(draft)?.label).toBe("Avanss 200 € · 17.10");
    expect(irissAdvanceHeaderChip(draft)?.tone).toBe("paid");
    expect(irissAdvanceReceivedLabel(draft)).toBe("Saņemts 17.10.2026");
  });

  it("sets paid today and quick amounts without inventing other fields", () => {
    const today = rigaTodayYmd(new Date("2026-10-17T10:00:00.000Z"));
    const paid = irissAdvancePaidToday(undefined, new Date("2026-10-17T10:00:00.000Z"));
    expect(paid.paidAt).toBe(today);
    expect(paid.amount).toBe("");
    expect(irissAdvanceWithQuickAmount(undefined, 500).amount).toBe("500");
    expect(parseIrissAdvanceAmount("1 000 €")).toBe(1000);
  });

  it("counts advance toward commission and never uses long dashes", () => {
    expect(irissAdvanceTowardCommission(1190, 200).remainingCommission).toBe(990);
    const chip = irissAdvanceHeaderChip({
      amount: "200",
      paidAt: "2026-10-17",
      method: "transfer",
      invoiceNo: "",
    });
    expect(chip?.label).not.toMatch(/[\u2013\u2014]/);
    expect(chip?.label).toContain(" · ");
  });

  it("subtracts advance from the tame total", () => {
    expect(irissTameBalanceAfterAdvance(5000, 200)).toBe(4800);
    expect(irissTameBalanceAfterAdvance(200, 500)).toBe(0);
  });
});
