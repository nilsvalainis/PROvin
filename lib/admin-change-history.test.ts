import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_SEARCH_OPERATOR_TENANT } from "@/lib/admin-global-search";
import { B2bDemoIsolationError } from "@/lib/b2b-demo-isolation";
import { emptyIrissOfferRecord, emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import {
  ADMIN_CHANGE_HISTORY_LIMIT,
  ADMIN_CHANGE_OPERATOR_TENANT,
  appendAdminChangeHistory,
  applyIrissOrderSnapshot,
  diffAdminChangeFields,
  planAdminChangeRestore,
  snapshotIrissOrder,
  visibleAdminChangeHistory,
  type AdminChangeHistoryLog,
} from "@/lib/admin-change-history";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_A = "tnt_dealer1";
const TENANT_B = "tnt_dealer2";

function entryInput(
  id: string,
  before: Record<string, string>,
  after: Record<string, string>,
  tenantId = ADMIN_CHANGE_OPERATOR_TENANT,
) {
  return {
    id,
    kind: "iriss-order" as const,
    recordId: ORDER_ID,
    tenantId,
    at: "2026-10-16T08:00:00.000Z",
    by: "admin",
    before,
    after,
  };
}

describe("izmaiņu vēstures diff", () => {
  it("uzrāda tikai mainītos laukus", () => {
    const fields = diffAdminChangeFields(
      { brandModel: "Audi", vin: "WVWZZZ3CZWE123456", phone: "" },
      { brandModel: "BMW", vin: "WVWZZZ3CZWE123456", notes: "Piezīme" },
    );
    expect(fields).toEqual([
      { field: "brandModel", before: "Audi", after: "BMW" },
      { field: "notes", before: "", after: "Piezīme" },
    ]);
  });

  it("pasūtījuma snapshot salīdzina statusu un piedāvājuma cenu, ne attēlus", () => {
    const before = emptyIrissPasutijums(ORDER_ID, "2026-10-16T08:00:00.000Z");
    before.brandModel = "Audi A6";
    before.listStatus = "active";
    const offer = emptyIrissOfferRecord("22222222-2222-4222-8222-222222222222", before.createdAt);
    offer.carPrice = "10000";
    offer.attachments = [{ id: "a", name: "foto.jpg", mimeType: "image/jpeg", size: 10, dataUrl: "data:image/jpeg;base64,xx" }];
    const after = {
      ...before,
      brandModel: "BMW 520",
      listStatus: "searching" as const,
      updatedAt: "2026-10-16T09:00:00.000Z",
      offers: [offer],
    };
    const left = snapshotIrissOrder(before);
    const right = snapshotIrissOrder(after);
    const fields = diffAdminChangeFields(left, right).map((row) => row.field);
    expect(fields).toContain("brandModel");
    expect(fields).toContain("listStatus");
    expect(fields).toContain("offerIds");
    expect(fields.some((field) => field.includes("dataUrl") || field.includes("attachment"))).toBe(false);
    expect(JSON.stringify(right)).not.toContain("base64");
  });
});

describe("izmaiņu vēstures limits", () => {
  it("glabā pēdējās 50 versijas un nemaina iepriekšējos ierakstus", () => {
    let log: AdminChangeHistoryLog | null = null;
    let stable: AdminChangeHistoryLog["entries"][number] | undefined;
    for (let i = 0; i <= ADMIN_CHANGE_HISTORY_LIMIT; i += 1) {
      log = appendAdminChangeHistory(log, entryInput(`h_${i.toString(36).padStart(6, "0")}`, { vin: String(i) }, { vin: String(i + 1) }));
      if (log && i === 1) stable = log.entries.at(-1);
    }
    expect(log?.entries).toHaveLength(ADMIN_CHANGE_HISTORY_LIMIT);
    expect(log?.entries[0]?.id).toBe("h_000001");
    expect(log?.entries.at(-1)?.id).toBe(`h_${ADMIN_CHANGE_HISTORY_LIMIT.toString(36).padStart(6, "0")}`);
    expect(log?.entries.find((row) => row.id === "h_000000")).toBeUndefined();
    expect(log?.entries.find((row) => row.id === stable?.id)).toBe(stable);
    expect(log?.entries[0]?.snapshot.vin).toBe("1");
  });

  it("bez lauku starpības nepievieno ierakstu", () => {
    const log = appendAdminChangeHistory(null, entryInput("h_000001", { vin: "A" }, { vin: "A" }));
    expect(log).toBeNull();
  });
});

describe("izmaiņu vēstures tenants", () => {
  it("operators un B2B tenants redz tikai savu vēsturi", () => {
    const operator = appendAdminChangeHistory(null, entryInput("h_00000a", { vin: "" }, { vin: "A" }))!;
    const dealer = appendAdminChangeHistory(null, entryInput("h_00000b", { vin: "" }, { vin: "B" }, TENANT_A))!;
    const other = appendAdminChangeHistory(null, entryInput("h_00000c", { vin: "" }, { vin: "C" }, TENANT_B))!;
    const all = [...operator.entries, ...dealer.entries, ...other.entries];

    expect(ADMIN_CHANGE_OPERATOR_TENANT).toBe(ADMIN_SEARCH_OPERATOR_TENANT);
    expect(visibleAdminChangeHistory(all, { kind: "operator" }).map((row) => row.id)).toEqual(["h_00000a"]);
    expect(visibleAdminChangeHistory(all, { kind: "tenant", tenantId: TENANT_A }).map((row) => row.id)).toEqual(["h_00000b"]);
    expect(visibleAdminChangeHistory(all, { kind: "tenant", tenantId: TENANT_B }).map((row) => row.id)).toEqual(["h_00000c"]);
    expect(visibleAdminChangeHistory(all, { kind: "tenant", tenantId: "nope" })).toEqual([]);
    expect(visibleAdminChangeHistory(all, { kind: "tenant", tenantId: "tnt_dealer9" })).toEqual([]);
  });

  it("sveša tenanta atjaunošana tiek noraidīta", () => {
    const dealer = appendAdminChangeHistory(null, entryInput("h_00000b", { brandModel: "Audi" }, { brandModel: "BMW" }, TENANT_A))!;
    expect(() =>
      planAdminChangeRestore(dealer, "h_00000b", { kind: "tenant", tenantId: TENANT_B }, { brandModel: "BMW" }, {
        id: "h_00000d",
        at: "2026-10-16T09:00:00.000Z",
        by: "cits",
      }),
    ).toThrow(B2bDemoIsolationError);
    expect(() =>
      planAdminChangeRestore(dealer, "h_00000b", { kind: "operator" }, { brandModel: "BMW" }, {
        id: "h_00000d",
        at: "2026-10-16T09:00:00.000Z",
      }),
    ).toThrow(B2bDemoIsolationError);
  });
});

describe("izmaiņu vēstures atjaunošana", () => {
  it("atjauno iepriekšējo stāvokli un pievieno jaunu ierakstu", () => {
    const saved = appendAdminChangeHistory(
      null,
      entryInput("h_000001", { brandModel: "Audi", vin: "AAA" }, { brandModel: "BMW", vin: "AAA" }),
    )!;
    const original = saved.entries[0]!;
    const planned = planAdminChangeRestore(saved, original.id, { kind: "operator" }, { brandModel: "BMW", vin: "AAA" }, {
      id: "h_000002",
      at: "2026-10-16T10:00:00.000Z",
      by: "admin",
    });
    expect(planned.snapshot).toEqual({ brandModel: "Audi", vin: "AAA" });
    expect(planned.log.entries).toHaveLength(2);
    expect(planned.log.entries[0]).toBe(original);
    expect(planned.log.entries[1]?.action).toBe("restore");
    expect(planned.log.entries[1]?.snapshot).toEqual({ brandModel: "BMW", vin: "AAA" });
    expect(planned.log.entries[1]?.fields).toEqual([{ field: "brandModel", before: "BMW", after: "Audi" }]);

    const current = emptyIrissPasutijums(ORDER_ID, "2026-10-16T08:00:00.000Z");
    current.brandModel = "BMW";
    const restored = applyIrissOrderSnapshot(current, planned.snapshot);
    expect(restored.brandModel).toBe("Audi");
    expect(snapshotIrissOrder(restored).brandModel).toBe("Audi");
  });
});

describe("izmaiņu vēstures klienta robeža", () => {
  const root = process.cwd();
  const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

  it("klienta ķēde neimportē server-only", () => {
    const files = [
      "components/admin/AdminChangeHistoryButton.tsx",
      "lib/admin-change-history.ts",
      "lib/b2b-demo-isolation.ts",
      "lib/b2b-demo-ids.ts",
      "lib/b2b-demo-types.ts",
      "lib/iriss-listing-match-client.ts",
      "lib/iriss-pasutijumi-types.ts",
      "lib/iriss-pavadzimes-types.ts",
    ];
    for (const file of files) {
      const src = read(file);
      expect(src, file).not.toMatch(/import\s+["']server-only["']/);
      expect(src, file).not.toMatch(/from\s+["']node:/);
      expect(src, file).not.toMatch(/admin-change-history-store/);
    }
    expect(read("components/admin/AdminChangeHistoryButton.tsx")).not.toMatch(/iriss-pasutijumi-store|iriss-pavadzimes-store|iriss-listing-match-store/);
  });

  it("vēsture neaktivizē maksas avotus un Dropbox sinhronizāciju", () => {
    const files = [
      "lib/admin-change-history.ts",
      "lib/admin-change-history-store.ts",
      "app/api/admin/change-history/route.ts",
      "app/api/b2b-demo/orders/[id]/history/route.ts",
    ];
    for (const file of files) {
      const src = read(file);
      expect(src, file).not.toMatch(/autodna|carvertical|outvin|vin-sources|scrape-listing|refreshStripePaidIndexFromStripe|runIrissPavadzimesDropboxSync/i);
    }
    expect(read("app/api/admin/change-history/route.ts")).toMatch(/getAdminSession/);
    expect(read("app/api/b2b-demo/orders/[id]/history/route.ts")).toMatch(/requireB2bDemoActor/);
    expect(read("components/admin/AdminShellMainWithMobilePull.tsx")).not.toContain("admin-search-gutter");
    expect(read("app/admin/admin-ios-theme.css")).not.toContain("admin-search-gutter");
    expect(read("components/admin/AdminGlobalSearch.tsx")).not.toContain("fixed left-2");
    expect(read("components/admin/AdminGlobalSearch.tsx")).toContain("AdminMobileSearchButton");
    expect(read("components/admin/AdminSidebar.tsx")).toMatch(/setMore\(false\);\s*requestAdminGlobalSearch\(\)/);
    expect(read("components/admin/AdminShell.tsx")).toContain("<AdminMobileSearchButton />");
    expect(read("components/admin/AdminShell.tsx")).not.toMatch(/AdminMobileSearchButton[\s\S]{0,180}fixed/);
  });
});
