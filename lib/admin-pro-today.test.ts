import { describe, expect, it } from "vitest";
import {
  countProTodayIngest,
  formatProTodayAge,
  parseAdminOrdersIngestParam,
  parseProTodayIngestCounts,
  proTodayRows,
} from "@/lib/admin-pro-today";
import { oldestOpenListingPeekAt } from "@/lib/listing-peek-queue";
import type { ProHomeSummary } from "@/lib/admin-pro-home";

const H = 3_600_000;

describe("«Šodien» skaitļi", () => {
  it("skaita tikai aktīvos: nav nosūtīti (dati gatavi) un kļūda / datu nav", () => {
    const c = countProTodayIngest([
      { ingest: { state: "done", label: "Ielasīts · 4", source: "dealer", sent: false } },
      { ingest: { state: "no_data", label: "Datu nav", source: "dealer", sent: false } },
      { ingest: { state: "error", label: "Kļūda", source: "vin_scan" } },
      { ingest: { state: "done", label: "Ielasīts · 4", source: "dealer", sent: true } },
      { ingest: { state: "error", label: "Kļūda", source: "vin_scan" }, auditComplete: true },
      { ingest: null },
    ]);
    // «Datu nav» ir abos: klientam jāpaziņo un jāizlemj par atmaksu (tāpat kā saraksta filtros).
    expect(c).toEqual({ notSent: 2, errors: 2 });
  });

  it("rindas: sarkans tikai kļūdām un kavējumiem; saites uz filtrētiem sarakstiem", () => {
    const now = Date.parse("2026-11-23T10:00:00Z");
    const nowS = now / 1000;
    const proHome: ProHomeSummary = {
      orders: { count: 5, overdue: 3, nextDeadlineFromUnix: null, oldestOverdueFromUnix: nowS - (48 + 24 * 24) * 3600 },
      dealers: { count: 2, overdue: 1, nextDeadlineFromUnix: null, oldestOverdueFromUnix: nowS - 50 * 3600 },
      today: { revenueCents: 0, count: 0 },
    };
    const rows = proTodayRows({
      ingest: { notSent: 3, errors: 2 },
      proHome,
      openCount: 2,
      openOldestAt: new Date(now - 34 * H).toISOString(),
      nowMs: now,
    });
    expect(rows.map((r) => [r.id, r.count, r.alert, r.sub])).toEqual([
      ["not_sent", 3, false, "dīlera dati · ielasīti"],
      ["errors", 2, true, "jāielasa vēlreiz vai jāatmaksā"],
      ["overdue", 4, true, "vecākais 24 d"],
      ["fast", 2, false, "vecākais 34 h"],
    ]);
    expect(rows.map((r) => r.href)).toEqual([
      "/admin/dashboard?ielase=nav-nosutiti",
      "/admin/dashboard?ielase=kludas",
      "/admin/dashboard?termins=nokavets",
      "/admin/atras-vertesanas?tab=pending",
    ]);
  });

  it("ja datu nav - rindu nerāda; nulle nav sarkana", () => {
    expect(proTodayRows({ ingest: null, proHome: null, openCount: null, nowMs: 0 })).toEqual([]);
    const rows = proTodayRows({ ingest: { notSent: 0, errors: 0 }, proHome: null, openCount: 0, nowMs: 0 });
    expect(rows.map((r) => r.id)).toEqual(["not_sent", "errors", "fast"]);
    expect(rows.some((r) => r.alert)).toBe(false);
  });

  it("URL parametrs un API atbilde", () => {
    expect(parseAdminOrdersIngestParam("nav-nosutiti")).toBe("not_sent");
    expect(parseAdminOrdersIngestParam("kludas")).toBe("errors");
    expect(parseAdminOrdersIngestParam("ielasa")).toBe("running");
    expect(parseAdminOrdersIngestParam(null)).toBe("all");
    expect(parseAdminOrdersIngestParam("x")).toBe("all");
    expect(parseProTodayIngestCounts({ ok: true, notSent: 1, errors: 0 })).toEqual({ notSent: 1, errors: 0 });
    expect(parseProTodayIngestCounts({ error: "load_failed" })).toBeNull();
  });

  it("vecums un vecākais ātrais vērtējums", () => {
    expect(formatProTodayAge(10 * 60_000)).toBe("<1 h");
    expect(formatProTodayAge(34 * H)).toBe("34 h");
    expect(formatProTodayAge(24 * 24 * H)).toBe("24 d");
    expect(
      oldestOpenListingPeekAt([
        { status: "completed", createdAt: "2026-11-01T00:00:00Z" },
        { status: "new", createdAt: "2026-11-20T00:00:00Z" },
        { status: "in_progress", createdAt: "2026-11-19T00:00:00Z" },
      ]),
    ).toBe("2026-11-19T00:00:00Z");
  });
});
