import { describe, expect, it } from "vitest";
import { AUDIT_PREPARATION_DEADLINE_MS } from "@/lib/admin-audit-deadline";
import {
  buildMorningSummary,
  isAuditDueToday,
  morningAuditTitle,
  morningPeekTitle,
  type MorningSummaryOrderInput,
} from "@/lib/admin-morning-summary";

const NOW = Date.parse("2026-10-13T08:00:00.000+03:00");

function order(partial: Partial<MorningSummaryOrderInput> & { id: string; createdOffsetH: number }): MorningSummaryOrderInput {
  return {
    id: partial.id,
    created: Math.floor((NOW - partial.createdOffsetH * 3600_000) / 1000),
    deadlineFromUnix: partial.deadlineFromUnix,
    auditComplete: partial.auditComplete,
    isB2bPack: partial.isB2bPack,
    makeModel: partial.makeModel,
    vin: partial.vin,
    customerName: partial.customerName,
    customerEmail: partial.customerEmail,
  };
}

describe("admin-morning-summary", () => {
  it("titles prefer model, then VIN, then client", () => {
    expect(morningAuditTitle({ id: "a", created: 1, makeModel: "VW Golf", vin: "WVWZZZ" })).toBe("VW Golf");
    expect(morningAuditTitle({ id: "a", created: 1, vin: "WVWZZZ" })).toBe("WVWZZZ");
    expect(morningAuditTitle({ id: "a", created: 1, customerEmail: "a@b.lv" })).toBe("a@b.lv");
    expect(morningPeekTitle({ id: "p", createdAt: "", status: "new", listingUrl: "https://www.ss.com/msg/123" })).toBe(
      "ss.com",
    );
  });

  it("marks 48 h deadline as due today in Riga and overdue after 48 h", () => {
    const dueSoon = order({ id: "due", createdOffsetH: 47 });
    const overdue = order({ id: "late", createdOffsetH: 50 });
    const fresh = order({ id: "ok", createdOffsetH: 10 });
    expect(isAuditDueToday(dueSoon, NOW)).toBe(true);
    expect(isAuditDueToday(overdue, NOW)).toBe(true);
    expect(isAuditDueToday(fresh, NOW)).toBe(false);
    expect(NOW - dueSoon.created * 1000).toBeLessThan(AUDIT_PREPARATION_DEADLINE_MS);
  });

  it("counts open / urgent / overdue and splits sections; skips done and B2B packs", () => {
    const summary = buildMorningSummary(
      [
        order({ id: "overdue", createdOffsetH: 50, makeModel: "Audi A4" }),
        order({ id: "urgent", createdOffsetH: 47, vin: "VINURGENT" }),
        order({ id: "ok", createdOffsetH: 8, customerName: "Jānis" }),
        order({ id: "done", createdOffsetH: 70, auditComplete: true, makeModel: "BMW" }),
        order({ id: "pack", createdOffsetH: 70, isB2bPack: true, makeModel: "Paka" }),
      ],
      [
        {
          id: "peek-late",
          createdAt: new Date(NOW - 30 * 3600_000).toISOString(),
          status: "new",
          email: "peek@late.lv",
          listingUrl: "https://ss.com/1",
        },
        {
          id: "peek-open",
          createdAt: new Date(NOW - 2 * 3600_000).toISOString(),
          status: "in_progress",
          email: "peek@ok.lv",
        },
        {
          id: "peek-done",
          createdAt: new Date(NOW - 40 * 3600_000).toISOString(),
          status: "completed",
          commentSentAt: new Date(NOW - 10 * 3600_000).toISOString(),
        },
      ],
      NOW,
    );

    expect(summary.counts.openAudits).toBe(3);
    expect(summary.counts.overdueAudits).toBe(1);
    expect(summary.counts.urgentAudits).toBe(1);
    expect(summary.counts.dueTodayAudits).toBe(2);
    expect(summary.counts.openPeeks).toBe(2);
    expect(summary.counts.overduePeeks).toBe(1);
    expect(summary.counts.unansweredPeeks).toBe(2);
    expect(summary.counts.open).toBe(5);
    expect(summary.counts.overdue).toBe(2);
    expect(summary.counts.urgent).toBe(1);

    expect(summary.overdueAudits.map((i) => i.id)).toEqual(["overdue"]);
    expect(summary.dueTodayAudits.map((i) => i.id)).toEqual(["urgent"]);
    expect(summary.urgentAudits).toEqual([]);
    expect(summary.unansweredPeeks.map((i) => i.id)).toEqual(["peek-late", "peek-open"]);
    expect(summary.unansweredPeeks[0]?.isNew).toBe(true);
    expect(summary.counts.newPeeksLast24h).toBe(1);
    expect(summary.newPeeksLast24h.map((i) => i.id)).toEqual(["peek-open"]);
  });

  it("uses upsell paidAt as the 48 h anchor", () => {
    const created = Math.floor((NOW - 80 * 3600_000) / 1000);
    const paidAt = Math.floor((NOW - 2 * 3600_000) / 1000);
    const summary = buildMorningSummary(
      [{ id: "upsell", created, deadlineFromUnix: paidAt, makeModel: "Volvo" }],
      [],
      NOW,
    );
    expect(summary.counts.openAudits).toBe(1);
    expect(summary.counts.overdueAudits).toBe(0);
    expect(summary.overdueAudits).toEqual([]);
    expect(summary.dueTodayAudits).toEqual([]);
    expect(summary.urgentAudits).toEqual([]);
  });
});
