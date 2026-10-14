import { describe, expect, it } from "vitest";
import { parseAdminOrdersQuery, queryAdminOrderRows } from "@/lib/admin-orders-page-query";

const mk = (i: number, extra: Record<string, unknown> = {}) => ({
  id: `cs_${i}`,
  created: 1_700_000_000 + i * 3600,
  auditComplete: true,
  vin: `WAUZZZF50NA0${String(i).padStart(5, "0")}`,
  makeModel: i % 2 ? "Škoda Octavia" : "Audi A6",
  customerEmail: `c${i}@ex.lv`,
  customerName: i === 7 ? "Jānis Bērziņš" : null,
  ...extra,
});

describe("admin orders page query", () => {
  const rows = [...Array.from({ length: 120 }, (_, i) => mk(i)), mk(500, { auditComplete: false }), mk(501, { auditComplete: false })];

  it("active always on top (newest first), then 50 done newest first", () => {
    const r = queryAdminOrderRows(rows, parseAdminOrdersQuery({}));
    expect(r.activeCount).toBe(2);
    expect(r.rows.slice(0, 2).map((x) => x.id)).toEqual(["cs_501", "cs_500"]);
    expect(r.doneShown).toBe(50);
    expect(r.rows[2]!.id).toBe("cs_119");
    expect(r.doneTotal).toBe(120);
  });
  it("load more: limit rounds to 50s", () => {
    expect(parseAdminOrdersQuery({ limit: "100" }).limit).toBe(100);
    expect(parseAdminOrdersQuery({ limit: "60" }).limit).toBe(100);
    expect(queryAdminOrderRows(rows, parseAdminOrdersQuery({ limit: "100" })).doneShown).toBe(100);
  });
  it("search VIN tail, make/model without diacritics, email, name", () => {
    expect(queryAdminOrderRows(rows, parseAdminOrdersQuery({ q: "00042" })).matched).toBe(1);
    expect(queryAdminOrderRows(rows, parseAdminOrdersQuery({ q: "skoda octavia" })).matched).toBe(61);
    expect(queryAdminOrderRows(rows, parseAdminOrdersQuery({ q: "c13@ex.lv" })).matched).toBe(1);
    expect(queryAdminOrderRows(rows, parseAdminOrdersQuery({ q: "janis berzins" })).rows[0]!.id).toBe("cs_7");
  });
  it("oldest sort", () => {
    const r = queryAdminOrderRows(rows, parseAdminOrdersQuery({ sort: "oldest" }));
    expect(r.rows[2]!.id).toBe("cs_0");
  });
});
