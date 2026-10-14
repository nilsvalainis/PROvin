import { describe, expect, it } from "vitest";

import { parseSpeckrOrderSnapshotRaw, speckrOrderSnapshotHasData } from "@/lib/speckr-order";

describe("speckr-order", () => {
  it("parse un hasData", () => {
    const snap = parseSpeckrOrderSnapshotRaw({
      vin: "5YJ3E1EA7KF000000",
      fetchedAt: "2026-10-14T12:00:00.000Z",
      result: { outcome: "ok", summary: "Tesla", lines: [{ label: "Krāsa", value: "White" }] },
    });
    expect(snap?.vin).toBe("5YJ3E1EA7KF000000");
    expect(speckrOrderSnapshotHasData(snap)).toBe(true);
    expect(parseSpeckrOrderSnapshotRaw(null)).toBeUndefined();
  });
});
