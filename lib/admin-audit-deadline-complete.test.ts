import { describe, expect, it } from "vitest";
import {
  ADMIN_AUDIT_COMPLETE_STORAGE_KEY,
  partitionAdminOrdersActiveFirst,
  parseAuditCompleteIds,
  serializeAuditCompleteIds,
  setAuditCompleteInLocalCache,
  sortAdminOrdersIncompleteFirst,
  toggleAuditCompleteInSet,
} from "@/lib/admin-audit-deadline-complete";

describe("admin-audit-deadline-complete", () => {
  it("parses and serializes session ids", () => {
    const ids = new Set(["cs_test_a", "cs_test_b"]);
    const raw = serializeAuditCompleteIds(ids);
    expect(parseAuditCompleteIds(raw)).toEqual(ids);
  });

  it("toggles membership", () => {
    const a = toggleAuditCompleteInSet(new Set(), "cs_x");
    expect(a.has("cs_x")).toBe(true);
    const b = toggleAuditCompleteInSet(a, "cs_x");
    expect(b.has("cs_x")).toBe(false);
  });

  it("setAuditCompleteInLocalCache writes expected set", () => {
    const store = new Map<string, string>();
    setAuditCompleteInLocalCache(
      "cs_1",
      true,
      (k) => store.get(k) ?? null,
      (k, v) => {
        store.set(k, v);
      },
    );
    expect(parseAuditCompleteIds(store.get(ADMIN_AUDIT_COMPLETE_STORAGE_KEY) ?? null).has("cs_1")).toBe(
      true,
    );
    setAuditCompleteInLocalCache(
      "cs_1",
      false,
      (k) => store.get(k) ?? null,
      (k, v) => {
        store.set(k, v);
      },
    );
    expect(parseAuditCompleteIds(store.get(ADMIN_AUDIT_COMPLETE_STORAGE_KEY) ?? null).has("cs_1")).toBe(
      false,
    );
  });

  it("floats incomplete orders above completed, then sorts each group by date desc", () => {
    const rows = [
      { id: "done-new", created: 300, auditComplete: true },
      { id: "open-mid", created: 200, auditComplete: false },
      { id: "done-old", created: 100, auditComplete: true },
      { id: "open-old", created: 50 },
    ];
    expect(sortAdminOrdersIncompleteFirst(rows).map((r) => r.id)).toEqual([
      "open-mid",
      "open-old",
      "done-new",
      "done-old",
    ]);
  });

  it("treats credit packs as finished so they do not float as VIN work", () => {
    const rows = [
      { id: "pack-new", created: 400, isB2bPack: true },
      { id: "open", created: 200 },
    ];
    expect(sortAdminOrdersIncompleteFirst(rows).map((r) => r.id)).toEqual(["open", "pack-new"]);
  });
});

describe("partitionAdminOrdersActiveFirst (noteikums: aktīvie augšā, jaunākie pirmie)", () => {
  it("reāli dati: jaunākie neizpildītie augšā, kavētie pēc datuma (netiek celti augšā)", () => {
    const t = (iso: string) => Date.parse(iso) / 1000;
    const rows = [
      { id: "iveco-kave-609h", created: t("2026-09-15T10:51:00Z") },
      { id: "renault-kave-26h", created: t("2026-10-09T18:10:00Z") },
      { id: "passat-12h", created: t("2026-10-11T07:18:00Z") },
      { id: "cla-mini-38h", created: t("2026-10-12T10:01:00Z") },
      { id: "x6-mini-39h", created: t("2026-10-12T10:23:00Z") },
      { id: "skoda-izpildits", created: t("2026-10-09T11:07:00Z"), auditComplete: true },
      { id: "pack", created: t("2026-10-12T12:00:00Z"), isB2bPack: true },
      { id: "vecs-ar-piepirkumu", created: t("2026-08-01T10:00:00Z"), activityUnix: t("2026-10-12T11:00:00Z") },
    ];
    const { active, done } = partitionAdminOrdersActiveFirst(rows);
    expect(active.map((r) => r.id)).toEqual([
      "vecs-ar-piepirkumu",
      "x6-mini-39h",
      "cla-mini-38h",
      "passat-12h",
      "renault-kave-26h",
      "iveco-kave-609h",
    ]);
    expect(done.map((r) => r.id)).toEqual(["skoda-izpildits", "pack"]);
  });
});
