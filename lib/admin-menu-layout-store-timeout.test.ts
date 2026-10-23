import { describe, expect, it, vi } from "vitest";

// Krātuve "karājas": lasīšana nekad nebeidzas.
vi.mock("@/lib/iriss-logistics-store", () => ({
  isIrissLogisticsStoreEnabled: () => true,
  readLogisticsJsonFile: () => new Promise(() => undefined),
  writeLogisticsJsonFile: async () => undefined,
}));

import { readMenuLayoutForPage } from "@/lib/admin-menu-layout-store";

describe("j23: sākuma lapa netiek aizturēta, ja izkārtojuma krātuve neatbild", () => {
  it("pēc limita atgriež undefined (pārlūks ielādē pats), nevis gaida bezgalīgi", async () => {
    const t0 = Date.now();
    expect(await readMenuLayoutForPage({ kind: "admin", name: "Nils" }, "iriss", 50)).toBeUndefined();
    expect(Date.now() - t0).toBeLessThan(1000);
  });
});
