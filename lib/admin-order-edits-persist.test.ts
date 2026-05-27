import { describe, expect, it } from "vitest";
import {
  parseOrderEditsFromLocalStorage,
  pickOrderEditsForHydration,
  serializeOrderEditsForLocalStorage,
} from "@/lib/admin-order-edits-persist";
import type { OrderDraftState } from "@/lib/admin-order-draft-types";

describe("pickOrderEditsForHydration", () => {
  it("prefers newer localStorage over older server", () => {
    const server: OrderDraftState = {
      orderEdits: { vin: "OLDVIN12345678901" },
      workspace: null,
      updatedAt: "2026-01-01T10:00:00.000Z",
    };
    const local = serializeOrderEditsForLocalStorage({ vin: "NEWVIN12345678901" });
    const picked = pickOrderEditsForHydration(server, local);
    expect(picked.vin).toBe("NEWVIN12345678901");
  });

  it("prefers newer server over older local", () => {
    const server: OrderDraftState = {
      orderEdits: { customerEmail: "new@provin.lv" },
      workspace: null,
      updatedAt: "2026-06-01T12:00:00.000Z",
    };
    const local = JSON.stringify({
      savedAt: "2026-01-01T10:00:00.000Z",
      orderEdits: { customerEmail: "old@provin.lv" },
    });
    const picked = pickOrderEditsForHydration(server, local);
    expect(picked.customerEmail).toBe("new@provin.lv");
  });

  it("legacy local without savedAt is not stomped by server updatedAt alone", () => {
    const server: OrderDraftState = {
      orderEdits: { internalComment: "Vecs servera teksts" },
      workspace: null,
      updatedAt: "2026-06-01T12:00:00.000Z",
    };
    const local = JSON.stringify({ internalComment: "Jaunāks lokālais teksts" });
    const picked = pickOrderEditsForHydration(server, local);
    expect(picked.internalComment).toBe("Jaunāks lokālais teksts");
  });
});

describe("parseOrderEditsFromLocalStorage", () => {
  it("reads envelope and legacy flat shape", () => {
    const env = parseOrderEditsFromLocalStorage(
      serializeOrderEditsForLocalStorage({ notes: "x" }),
    );
    expect(env.orderEdits.notes).toBe("x");
    expect(env.savedAtMs).toBeGreaterThan(0);
    const leg = parseOrderEditsFromLocalStorage(JSON.stringify({ vin: "V" }));
    expect(leg.orderEdits.vin).toBe("V");
  });
});
