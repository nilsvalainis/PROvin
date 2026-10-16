import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { adminOrderMatchesQuery } from "@/lib/admin-orders-page-query";
import {
  ADMIN_SEARCH_OPERATOR_TENANT,
  adminSearchRecordMatches,
  adminSearchSectionRecords,
  adminSearchVinSuffixMatches,
  groupAdminSearchHits,
  restrictAdminSearchRecords,
  searchAdminGlobal,
  type AdminSearchRecord,
} from "@/lib/admin-global-search";

const VIN = "WVWZZZ3CZWE123456";

function row(partial: Partial<AdminSearchRecord> & Pick<AdminSearchRecord, "id" | "tenantId">): AdminSearchRecord {
  return {
    kind: "iriss-order",
    title: "Klients",
    subtitle: "",
    href: `/admin/iriss/pasutijumi/${partial.id}`,
    text: "",
    vin: "",
    ...partial,
  };
}

describe("admin meklēšanas normalizācija", () => {
  it("salīdzina bez diakritikām", () => {
    const records = [
      row({ id: "a", tenantId: ADMIN_SEARCH_OPERATOR_TENANT, text: "Jānis Bērziņš Škoda Octavia", title: "Jānis Bērziņš" }),
    ];
    const hits = searchAdminGlobal(records, "janis skoda", { kind: "operator" });
    expect(hits.map((h) => h.id)).toEqual(["a"]);
    expect(adminSearchRecordMatches(records[0]!, "BERZINS")).toBe(true);
  });

  it("VIN sakrīt pēc pēdējām 6+ zīmēm, ne pēc īsāka fragmenta vai prefiksa", () => {
    expect(adminSearchVinSuffixMatches(VIN, "123456")).toBe(true);
    expect(adminSearchVinSuffixMatches(VIN, "E123456")).toBe(true);
    expect(adminSearchVinSuffixMatches(VIN, VIN)).toBe(true);
    expect(adminSearchVinSuffixMatches("wvw zzz-3cz we123456", "123456")).toBe(true);
    expect(adminSearchVinSuffixMatches(VIN, "12345")).toBe(false);
    expect(adminSearchVinSuffixMatches(VIN, "WVWZZZ")).toBe(false);

    const records = [row({ id: "v", tenantId: ADMIN_SEARCH_OPERATOR_TENANT, text: "Audi A6", vin: VIN, title: "Audi A6" })];
    expect(searchAdminGlobal(records, "123456", { kind: "operator" }).map((h) => h.id)).toEqual(["v"]);
    expect(searchAdminGlobal(records, "12345", { kind: "operator" })).toEqual([]);
    expect(searchAdminGlobal(records, "WVWZZZ", { kind: "operator" })).toEqual([]);
  });

  it("PRO pasūtījums izmanto esošo ?q= salīdzināšanu", () => {
    const pro = {
      id: "cs_pro",
      created: 10,
      vin: VIN,
      makeModel: "Audi A6",
      customerName: "Jānis",
      customerEmail: "janis@example.com",
      customerPhone: "+371 21234567",
    };
    expect(adminOrderMatchesQuery(pro, "123")).toBe(true);
    expect(adminOrderMatchesQuery(pro, "audi a6")).toBe(true);
    const records = [
      row({
        id: "cs_pro",
        kind: "pro-order",
        tenantId: ADMIN_SEARCH_OPERATOR_TENANT,
        title: "Jānis",
        href: "/admin/orders/cs_pro",
        pro,
      }),
    ];
    expect(searchAdminGlobal(records, "audi a6", { kind: "operator" }).map((h) => h.id)).toEqual(["cs_pro"]);
    expect(searchAdminGlobal(records, "123", { kind: "operator" }).map((h) => h.id)).toEqual(["cs_pro"]);
    expect(searchAdminGlobal(records, "21234567", { kind: "operator" }).map((h) => h.id)).toEqual(["cs_pro"]);
  });

  it("atrod sadaļu pēc nosaukuma un grupē pēc tipa", () => {
    const hits = searchAdminGlobal(adminSearchSectionRecords(), "pavadzimes", { kind: "operator" });
    expect(hits.map((h) => h.href)).toEqual(["/admin/iriss/pavadzimes"]);
    expect(groupAdminSearchHits(hits)).toEqual([
      {
        kind: "section",
        label: "Sadaļas",
        hits,
      },
    ]);
  });
});

describe("admin meklēšanas tenant ierobežojums", () => {
  const shared = (tenantId: string, id: string): AdminSearchRecord =>
    row({ id, tenantId, text: "Jānis Bērziņš", title: "Jānis Bērziņš", vin: VIN });

  const catalog = [
    shared(ADMIN_SEARCH_OPERATOR_TENANT, "op"),
    shared("tnt_dealer1", "a"),
    shared("tnt_dealer2", "b"),
  ];

  it("B2B tenants redz tikai savus ierakstus", () => {
    expect(searchAdminGlobal(catalog, "janis", { kind: "tenant", tenantId: "tnt_dealer1" }).map((h) => h.id)).toEqual(["a"]);
    expect(searchAdminGlobal(catalog, "123456", { kind: "tenant", tenantId: "tnt_dealer2" }).map((h) => h.id)).toEqual(["b"]);
    expect(restrictAdminSearchRecords(catalog, { kind: "tenant", tenantId: "tnt_dealer1" }).map((r) => r.id)).toEqual(["a"]);
  });

  it("nederīgs vai svešs tenants neatgriež ierakstus", () => {
    expect(searchAdminGlobal(catalog, "janis", { kind: "tenant", tenantId: "nope" })).toEqual([]);
    expect(searchAdminGlobal(catalog, "janis", { kind: "tenant", tenantId: "tnt_short" })).toEqual([]);
    expect(searchAdminGlobal(catalog, "janis", { kind: "tenant", tenantId: "tnt_dealer9" })).toEqual([]);
  });

  it("operatora meklēšana neielaiž citu B2B tenantu", () => {
    const hits = searchAdminGlobal(catalog, "janis", { kind: "operator" });
    expect(hits.map((h) => h.id)).toEqual(["op"]);
    expect(hits.some((h) => h.id === "a" || h.id === "b")).toBe(false);
  });
});

describe("admin meklēšanas klienta robeža", () => {
  const root = process.cwd();
  const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

  it("klienta ķēde neimportē server-only vai node:crypto", () => {
    const files = [
      "components/admin/AdminGlobalSearch.tsx",
      "lib/admin-global-search.ts",
      "lib/admin-orders-page-query.ts",
      "lib/admin-audit-deadline-complete.ts",
      "lib/b2b-demo-isolation.ts",
      "lib/b2b-demo-ids.ts",
    ];
    for (const file of files) {
      const src = read(file);
      expect(src, file).not.toMatch(/import\s+["']server-only["']/);
      expect(src, file).not.toMatch(/from\s+["']node:crypto["']/);
      expect(src, file).not.toMatch(/from\s+["']crypto["']/);
    }
    expect(read("components/admin/AdminGlobalSearch.tsx")).not.toMatch(/admin-global-search-load|iriss-pasutijumi-store|iriss-pavadzimes-store|demo-orders/);
  });

  it("ielāde ir tikai lasīšana un neaktivizē maksas avotus", () => {
    const src = read("lib/admin-global-search-load.ts");
    expect(src).toMatch(/readIrissPavadzimesCached/);
    expect(src).toMatch(/searchAdminGlobal/);
    expect(src).toMatch(/kind: "operator"/);
    expect(src).not.toMatch(/refreshStripePaidIndexFromStripe/);
    expect(src).not.toMatch(/runIrissPavadzimesDropboxSync/);
    expect(src).not.toMatch(/listIrissPavadzimes\(/);
    expect(src).not.toMatch(/autodna|carvertical|outvin|vin-sources|scrape-listing/i);
  });
});
