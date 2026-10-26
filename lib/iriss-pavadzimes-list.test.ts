import { describe, expect, it } from "vitest";
import { appendCsddOnlyRows, canSeeWaybillOrders, selectActiveCardWaybills, waybillRowWithoutOrder } from "@/lib/iriss-pavadzimes-list";
import { rigaLocalToUtc } from "@/lib/iriss-pavadzimes-parse";
import type { IrissPavadzimeListRow, IrissPavadzimeRecord } from "@/lib/iriss-pavadzimes-types";
import { withdrawnWaybillNos } from "@/lib/iriss-waybill-plates";
import type { CsddPlatesDoc } from "@/lib/iriss-waybill-csdd-plates";

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

function listRow(over: Partial<IrissPavadzimeListRow> & { number: string; plate: string }): IrissPavadzimeListRow {
  return {
    id: over.id ?? over.number,
    number: over.number,
    brandModel: over.brandModel ?? "VW Passat",
    vin: over.vin ?? "",
    plate: over.plate,
    issuedAt: over.issuedAt ?? "2026-10-20T10:00:00.000Z",
    validUntil: over.validUntil ?? "2026-10-28T10:00:00.000Z",
    fileName: over.fileName ?? `${over.number}.pdf`,
    source: over.source ?? "dropbox",
    dropboxId: over.dropboxId ?? "",
    dropboxPath: over.dropboxPath ?? "",
    dropboxRev: over.dropboxRev ?? "",
    dropboxContentHash: over.dropboxContentHash ?? "",
    blobPath: over.blobPath ?? "",
    parsedAt: over.parsedAt ?? "",
    updatedAt: over.updatedAt ?? "",
    validityTone: over.validityTone ?? "ok",
    lifecycle: over.lifecycle ?? "active",
    order: over.order ?? null,
  };
}

function csddDocP02827(): CsddPlatesDoc {
  return {
    version: 1,
    updatedAt: "2026-10-26T09:00:00.000Z",
    plates: [
      {
        plate: "B193-7",
        ok: true,
        checkedAt: "2026-10-26T09:00:00.000Z",
        active: [{ waybillNo: "P02827", validUntil: "2026-10-28T10:00:00.000Z", brandModel: "BMW 330" }],
        error: "",
      },
    ],
  };
}

function showsInAktivas(row: IrissPavadzimeListRow): boolean {
  if (row.archived || row.lifecycle === "interrupted") return false;
  return row.validityTone === "ok" || row.validityTone === "today";
}

describe("Aktīvās: CSDD-aktīvas bez indeksa", () => {
  const now = new Date("2026-10-26T10:00:00.000Z");

  it("P02827 / B193-7 (CSDD aktīva, indeksā nav) parādās Aktīvajās kā rinda bez PDF", () => {
    const indexed = listRow({ id: "wb_p02800", number: "P02800", plate: "B192-7", brandModel: "VW Passat" });
    const csdd = csddDocP02827();
    const out = appendCsddOnlyRows([indexed], csdd, withdrawnWaybillNos([indexed], csdd), now);
    const extra = out.find((r) => r.number === "P02827");
    expect(extra).toMatchObject({
      id: "",
      number: "P02827",
      plate: "B193-7",
      brandModel: "BMW 330",
      fileName: "",
      lifecycle: "active",
    });
    expect(showsInAktivas(extra!)).toBe(true);
    expect(out.find((r) => r.number === "P02800")).toEqual(indexed);
  });

  it("nekad neizstāj indeksa rindu, pat ja CSDD tam pašam numuram ir cits auto", () => {
    const indexed = listRow({
      id: "wb_p02827",
      number: "P02827",
      plate: "B193-7",
      brandModel: "BMW 330d",
      dropboxPath: "/Pavadzīmes_IRISS/P02827.pdf",
    });
    const out = appendCsddOnlyRows([indexed], csddDocP02827(), new Set(), now);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual(indexed);
  });

  it("nepievieno withdrawn numuru un beigušos CSDD ierakstus", () => {
    expect(appendCsddOnlyRows([], csddDocP02827(), new Set(["P02827"]), now)).toEqual([]);
    const expired: CsddPlatesDoc = {
      version: 1,
      updatedAt: "2026-10-26T09:00:00.000Z",
      plates: [
        {
          plate: "B193-7",
          ok: true,
          checkedAt: "2026-10-20T09:00:00.000Z",
          active: [{ waybillNo: "P02810", validUntil: "2026-10-21T10:00:00.000Z", brandModel: "Audi" }],
          error: "",
        },
      ],
    };
    expect(appendCsddOnlyRows([], expired, new Set(), now)).toEqual([]);
    expect(appendCsddOnlyRows([listRow({ number: "P02800", plate: "B192-7" })], null, new Set(), now)).toHaveLength(1);
  });
});
