import { describe, expect, it } from "vitest";
import { countAdminActiveOrders } from "@/lib/admin-active-orders-count";
import { collectAuditSlaWarningCandidates, isAdminOrderInactive } from "@/lib/admin-audit-deadline";
import { partitionAdminOrdersActiveFirst, sortAdminOrdersIncompleteFirst } from "@/lib/admin-audit-deadline-complete";
import { buildMorningSummary, morningProductLabel } from "@/lib/admin-morning-summary";
import { buildMorningSummaryEmailText } from "@/lib/admin-morning-summary-email";
import { matchesAdminOrdersDeadlineFilter } from "@/lib/admin-orders-deadline-filter";
import { summarizeProHome } from "@/lib/admin-pro-home";
import { toAdminPaymentAdjustment, adminOrderFullyReversed } from "@/lib/admin-orders";
import { serializeAdminOrderTableRows } from "@/lib/serialize-admin-order-table";

const NOW = 10 * 86400 * 1000;
const S = NOW / 1000;

describe("pilnībā atmaksāts / zaudēts strīds neskaitās aktīvs (audits 20.11)", () => {
  it("viena definīcija", () => {
    expect(isAdminOrderInactive({ fullyReversed: true })).toBe(true);
    expect(isAdminOrderInactive({ auditComplete: true })).toBe(true);
    expect(isAdminOrderInactive({ isB2bPack: true })).toBe(true);
    expect(isAdminOrderInactive({})).toBe(false);
  });

  it("sānjosla, «kavē», PRO sākums, SLA brīdinājumi, termiņa filtrs", () => {
    const rows = [
      { id: "a", created: S - 3 * 86400 },
      { id: "b", created: S - 3 * 86400, fullyReversed: true },
      { id: "c", created: S - (48 * 3600 - 3600), fullyReversed: true },
    ];
    expect(countAdminActiveOrders(rows, NOW)).toEqual({ activeCount: 1, overdueCount: 1, urgentCount: 0 });
    expect(summarizeProHome(rows, NOW).orders).toMatchObject({ count: 1, overdue: 1 });
    expect(collectAuditSlaWarningCandidates(rows, NOW)).toEqual([]);
    expect(matchesAdminOrdersDeadlineFilter(rows[1]!, "overdue", NOW)).toBe(false);
    expect(matchesAdminOrdersDeadlineFilter(rows[0]!, "overdue", NOW)).toBe(true);
  });

  it("saraksts: atmaksātais nav grupā «Aktīvie»", () => {
    const rows = [
      { id: "a", created: S - 100, fullyReversed: true },
      { id: "b", created: S - 200 },
    ];
    const { active, done } = partitionAdminOrdersActiveFirst(rows);
    expect(active.map((r) => r.id)).toEqual(["b"]);
    expect(done.map((r) => r.id)).toEqual(["a"]);
    expect(sortAdminOrdersIncompleteFirst(rows).map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("rīta kopsavilkums: atmaksātais nav rindā; rindā produkts", () => {
    const summary = buildMorningSummary(
      [
        { id: "late", created: S - 3 * 86400, vin: "WVWZZZ1", checkoutLine: "mini" },
        { id: "refund", created: S - 3 * 86400, vin: "WVWZZZ2", fullyReversed: true },
        { id: "biz", created: S - 3 * 86400, vin: "WVWZZZ3", checkoutLine: "business" },
        { id: "dealer", created: S - 3 * 86400, vin: "WVWZZZ4", amountTotalCents: 2499 },
      ],
      [],
      NOW,
    );
    expect(summary.counts.openAudits).toBe(3);
    expect(summary.overdueAudits.map((i) => i.id).sort()).toEqual(["biz", "dealer", "late"]);
    const byId = Object.fromEntries(summary.overdueAudits.map((i) => [i.id, i]));
    expect(byId.late!.product).toBe("MINI");
    expect(byId.biz!.product).toBe("Business");
    expect(byId.dealer!.product).toBe("Dīleris");
    expect(byId.late!.subtitle.startsWith("MINI")).toBe(true);
    expect(buildMorningSummaryEmailText(summary, { pageUrl: "https://x/admin", nowMs: NOW })).toContain("MINI · WVWZZZ1");
  });

  it("produkta nosaukums", () => {
    expect(morningProductLabel({ checkoutLine: "audit" })).toBe("AUDITS");
    expect(morningProductLabel({ amountTotalCents: 9999 })).toBe("AUDITS");
    expect(morningProductLabel({ checkoutLine: "dealer" })).toBe("Dīleris");
    expect(morningProductLabel({})).toBe("");
  });

  it("Stripe korekcija -> fullyReversed rindā un tabulā", () => {
    const full = toAdminPaymentAdjustment({ amountCents: 9999, refundedCents: 9999 } as never);
    expect(full?.fullyReversed).toBe(true);
    expect(adminOrderFullyReversed({ paymentAdjustment: full })).toBe(true);
    const part = toAdminPaymentAdjustment({ amountCents: 9999, refundedCents: 1000 } as never);
    expect(part?.fullyReversed).toBeUndefined();
    const [row] = serializeAdminOrderTableRows([
      { id: "x", created: 1, amountTotal: 9999, currency: "eur", paymentStatus: "paid", customerEmail: null, vin: null, paymentAdjustment: full },
    ]);
    expect(row!.fullyReversed).toBe(true);
  });
});
