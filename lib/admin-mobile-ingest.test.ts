import { describe, expect, it } from "vitest";
import {
  adminIngestFromDealerJob,
  adminIngestFromVinScan,
  adminIngestMatchesFilter,
  adminIngestSentLabel,
  countAdminIngestFilters,
  parseAdminOrderIngest,
} from "@/lib/admin-mobile-ingest";
import { serializeAdminOrderTableRows } from "@/lib/serialize-admin-order-table";

type Hint = NonNullable<Parameters<typeof adminIngestFromVinScan>[0]>;
const hint = (p: Partial<Hint> = {}): Hint => ({
  status: "done",
  found: 0,
  none: 0,
  error: 0,
  blocked: 0,
  timeout: 0,
  configMissing: 0,
  ...p,
});

describe("telefona saraksts: ielases indikācija (variants 3)", () => {
  it("dīlera darbs: ielasīts ar ierakstu skaitu un nosūtīšanas statusu", () => {
    const i = adminIngestFromDealerJob({ status: "done", serviceEventCount: 14 }, false);
    expect(i).toEqual({ state: "done", label: "Ielasīts · 14", count: 14, source: "dealer", sent: false });
    expect(adminIngestSentLabel(i)).toBe("Nav nosūtīts");
    expect(adminIngestSentLabel(adminIngestFromDealerJob({ status: "done", serviceEventCount: 9 }, true))).toBe("Nosūtīts");
  });

  it("dīlera darbs: VIN dekodēšanas atkārtojums = vēsture jau ielasīta", () => {
    expect(adminIngestFromDealerJob({ status: "failed", error: "vin_decode:x", serviceEventCount: 3 }).state).toBe("done");
  });

  it("dīlera darbs: datu nav / kļūda - sarkans; ielasa / nav palaists - pelēks", () => {
    expect(adminIngestFromDealerJob({ status: "no_data" }).state).toBe("no_data");
    expect(adminIngestFromDealerJob({ status: "no_data" }).label).toBe("Datu nav");
    expect(adminIngestFromDealerJob({ status: "failed", error: "http_500" }).label).toBe("Kļūda");
    expect(adminIngestFromDealerJob({ status: "no_vin" })).toMatchObject({ state: "error", label: "Nav VIN" });
    expect(adminIngestFromDealerJob({ status: "running" })).toMatchObject({ state: "running", label: "Ielasa…" });
    expect(adminIngestFromDealerJob({ status: "failed", error: "http_202" }).state).toBe("running");
    expect(adminIngestFromDealerJob({ status: "pending" })).toMatchObject({ state: "idle", label: "Gaida ielasi" });
    expect(adminIngestFromDealerJob(null)).toMatchObject({ state: "idle", label: "Nav palaists" });
  });

  it("nosūtīšanas statuss nav zināms - nerāda «Nav nosūtīts»", () => {
    const i = adminIngestFromDealerJob({ status: "done", serviceEventCount: 2 }, null);
    expect(i.sent).toBeUndefined();
    expect(adminIngestSentLabel(i)).toBeNull();
  });

  it("citi produkti pēc VIN SCAN: atrasto skaits, kļūda, datu nav, ielasa", () => {
    expect(adminIngestFromVinScan(hint({ found: 5 }), { complete: false })).toMatchObject({ state: "done", label: "Ielasīts · 5" });
    expect(adminIngestFromVinScan(hint({ error: 2 }), { complete: false })?.state).toBe("error");
    expect(adminIngestFromVinScan(hint({ none: 7 }), { complete: false })?.state).toBe("no_data");
    expect(adminIngestFromVinScan(hint({ status: "running" }), { complete: false })?.state).toBe("running");
    expect(adminIngestFromVinScan(null, { complete: false })).toMatchObject({ state: "idle", label: "Nav palaists" });
    expect(adminIngestFromVinScan(null, { complete: true })).toBeNull();
  });

  it("filtri: Nav nosūtīti / Kļūdas / Ielasa", () => {
    const list = [
      adminIngestFromDealerJob({ status: "done", serviceEventCount: 14 }, false),
      adminIngestFromDealerJob({ status: "done", serviceEventCount: 9 }, true),
      adminIngestFromDealerJob({ status: "no_data" }, false),
      adminIngestFromDealerJob({ status: "failed", error: "x" }),
      adminIngestFromDealerJob({ status: "running" }),
      adminIngestFromVinScan(hint({ found: 3 }), { complete: false }),
      null,
    ];
    expect(countAdminIngestFilters(list)).toEqual({ not_sent: 2, errors: 2, running: 1 });
    expect(adminIngestMatchesFilter(null, "all")).toBe(true);
    expect(adminIngestMatchesFilter(list[5], "not_sent")).toBe(false);
  });

  it("serializācija RSC -> klients: derīgu lauku saglabā, nederīgu izmet", () => {
    expect(parseAdminOrderIngest({ state: "bogus", label: "x", source: "dealer" })).toBeUndefined();
    const base = {
      id: "cs_1",
      created: 1,
      amountTotal: 2499,
      currency: "eur",
      paymentStatus: "paid",
      customerEmail: null,
      vin: "WBA5R1C0XLFH42873",
      invoicePdfUrl: null,
    };
    const [a, b] = serializeAdminOrderTableRows([
      { ...base, ingest: { state: "done", label: "Ielasīts · 14", count: 14, source: "dealer", sent: false } },
      { ...base, id: "cs_2", ingest: { state: "nope" } },
    ]);
    expect(a.ingest).toEqual({ state: "done", label: "Ielasīts · 14", count: 14, source: "dealer", sent: false });
    expect(b.ingest).toBeUndefined();
  });
});
