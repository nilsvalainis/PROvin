import { describe, expect, it } from "vitest";
import {
  pickAutoImportPeek,
  quickEvalExpired,
  rankExportCandidates,
  vehicleKeys,
  type QuickEvalMatchOrder,
  type QuickEvalMatchPeek,
} from "@/lib/quick-eval-match";

const VIN = "WVWZZZ1KZAW000001";

function peek(over: Partial<QuickEvalMatchPeek> = {}): QuickEvalMatchPeek {
  return {
    id: "p1",
    email: "a@b.lv",
    phone: "+371 26 000 000",
    createdAt: "2026-10-01T10:00:00.000Z",
    vehicle: vehicleKeys(VIN, "AB-1234"),
    exportedTo: [],
    ...over,
  };
}

function order(over: Partial<QuickEvalMatchOrder> = {}): QuickEvalMatchOrder {
  return {
    id: "cs_1",
    createdMs: Date.parse("2026-10-03T10:00:00.000Z"),
    emails: ["A@B.lv"],
    phones: [],
    vehicle: vehicleKeys(VIN.toLowerCase()),
    ...over,
  };
}

describe("pickAutoImportPeek", () => {
  it("needs both VIN and e-mail", () => {
    expect(pickAutoImportPeek(order(), [peek()])?.id).toBe("p1");
    expect(pickAutoImportPeek(order({ emails: ["c@d.lv"] }), [peek()])).toBeNull();
    expect(pickAutoImportPeek(order({ vehicle: vehicleKeys("TMBZZZ1Z0A0000001") }), [peek()])).toBeNull();
  });

  it("matches plate entered in the eval", () => {
    expect(pickAutoImportPeek(order({ vehicle: vehicleKeys("AB1234") }), [peek()])?.id).toBe("p1");
  });

  it("skips already exported and picks newest", () => {
    const older = peek({ id: "old", createdAt: "2026-09-01T00:00:00.000Z" });
    const newer = peek({ id: "new", createdAt: "2026-10-02T00:00:00.000Z" });
    expect(pickAutoImportPeek(order(), [older, newer])?.id).toBe("new");
    expect(pickAutoImportPeek(order(), [peek({ exportedTo: ["cs_1"] })])).toBeNull();
  });
});

describe("rankExportCandidates", () => {
  it("ranks by number of matches and ignores orders long before the eval", () => {
    const r = rankExportCandidates(peek(), [
      order({ id: "phone", emails: [], phones: ["26000000"], vehicle: new Set() }),
      order({ id: "both" }),
      order({ id: "old", createdMs: Date.parse("2026-01-01T00:00:00.000Z") }),
    ]);
    expect(r.map((c) => c.id)).toEqual(["both", "phone"]);
    expect(r[0]!.matchedBy).toEqual(["vin", "email"]);
  });
});

describe("quickEvalExpired", () => {
  const now = Date.parse("2026-11-15T00:00:00.000Z");
  it("expires after 30 days unless exported", () => {
    expect(quickEvalExpired("2026-10-01T00:00:00.000Z", false, now)).toBe(true);
    expect(quickEvalExpired("2026-10-01T00:00:00.000Z", true, now)).toBe(false);
    expect(quickEvalExpired("2026-11-01T00:00:00.000Z", false, now)).toBe(false);
  });
});
