import { describe, expect, it } from "vitest";
import { auditTime, groupAuditByDay } from "@/lib/iriss-staff-audit-days";

const now = new Date(2026, 9, 27, 1, 0);
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).toISOString();

describe("darbību žurnāls pa dienām", () => {
  it("šodienas un vakardienas ieraksti ir atsevišķās grupās", () => {
    const rows = [
      { id: "a", createdAt: at(27, 0, 6) },
      { id: "b", createdAt: at(26, 23, 53) },
      { id: "c", createdAt: at(26, 21, 45) },
      { id: "d", createdAt: at(24, 13, 38) },
    ];
    const g = groupAuditByDay(rows, now);
    expect(g.map((x) => [x.label, x.rows.map((r) => r.id).join("")])).toEqual([
      ["Šodien", "a"],
      ["Vakar", "bc"],
      ["24.10.2026", "d"],
    ]);
  });

  it("nederīgs datums nesalauž sarakstu", () => {
    const g = groupAuditByDay([{ createdAt: null }, { createdAt: "x" }], now);
    expect(g).toHaveLength(1);
    expect(g[0].label).toBe("Bez datuma");
    expect(auditTime(at(26, 9, 5))).toBe("09:05");
  });
});
