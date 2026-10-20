import { describe, expect, it } from "vitest";
import { selectActiveCardWaybills } from "@/lib/iriss-pavadzimes-list";
import { rigaLocalToUtc } from "@/lib/iriss-pavadzimes-parse";
import type { IrissPavadzimeRecord } from "@/lib/iriss-pavadzimes-types";

function rec(partial: Pick<IrissPavadzimeRecord, "number" | "plate" | "validUntil">): IrissPavadzimeRecord {
  return {
    id: partial.number,
    number: partial.number,
    brandModel: "VW Passat",
    vin: "",
    plate: partial.plate,
    issuedAt: "",
    validUntil: partial.validUntil,
    fileName: `${partial.number}.pdf`,
    source: "dropbox",
    dropboxId: "",
    dropboxPath: "",
    dropboxRev: "",
    dropboxContentHash: "",
    blobPath: "",
    parsedAt: "",
    updatedAt: "",
  };
}

describe("selectActiveCardWaybills", () => {
  const now = rigaLocalToUtc(2026, 10, 20, 12, 0)!;

  it("keeps live dealer plates and drops B861-6 from the sidebar card", () => {
    const rows = selectActiveCardWaybills(
      [
        rec({ number: "P02787", plate: "B193-7", validUntil: rigaLocalToUtc(2026, 10, 22, 15, 59)!.toISOString() }),
        rec({ number: "P02515", plate: "B861-6", validUntil: rigaLocalToUtc(2026, 10, 21, 12, 0)!.toISOString() }),
        rec({ number: "P02800", plate: "B192-7", validUntil: rigaLocalToUtc(2026, 10, 23, 10, 0)!.toISOString() }),
      ],
      now,
    );
    expect(rows.map((row) => row.plate)).toEqual(["B192-7", "B193-7"]);
    expect(rows.some((row) => row.plate === "B861-6")).toBe(false);
  });
});
