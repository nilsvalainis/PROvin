import { describe, expect, it } from "vitest";
import { canSeeWaybillOrders, selectActiveCardWaybills, waybillRowWithoutOrder } from "@/lib/iriss-pavadzimes-list";
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

describe("pavadzīmju dati darbiniekam bez Pasūtījumiem", () => {
  it("pasūtījuma saiti (klienta vārdu) redz tikai administrators vai Pasūtījumu sadaļa", () => {
    expect(canSeeWaybillOrders({ kind: "admin" })).toBe(true);
    expect(canSeeWaybillOrders({ kind: "staff", user: { sections: ["pavadzimes", "pasutijumi"] } })).toBe(true);
    expect(canSeeWaybillOrders({ kind: "staff", user: { sections: ["pavadzimes"] } })).toBe(false);
    expect(canSeeWaybillOrders({ kind: "staff", user: { sections: ["pavadzimes", "logistika"] } })).toBe(false);
  });

  it("atstāj tikai pavadzīmes laukus: bez pasūtījuma un krātuves ceļiem", () => {
    const row = {
      ...rec({ number: "26A1", plate: "B192-7", validUntil: "2026-10-25T10:00:00.000Z" }),
      dropboxId: "id:abc",
      dropboxPath: "/Pavadzīmes_IRISS/26A1.pdf",
      blobPath: "iriss/pavadzimes/26A1.pdf",
      validityTone: "ok" as const,
      order: { id: "ord_1", label: "Jānis Bērziņš" },
    };
    const out = waybillRowWithoutOrder(row);
    expect(out.order).toBeNull();
    expect(JSON.stringify(out)).not.toContain("Jānis");
    expect(JSON.stringify(out)).not.toContain("ord_1");
    expect([out.dropboxId, out.dropboxPath, out.blobPath]).toEqual(["", "", ""]);
    expect([out.number, out.plate, out.brandModel, out.validUntil]).toEqual(["26A1", "B192-7", "VW Passat", "2026-10-25T10:00:00.000Z"]);
  });
});
