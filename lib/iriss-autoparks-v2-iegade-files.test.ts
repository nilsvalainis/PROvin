import { describe, expect, it } from "vitest";
import type { AutoparksFile } from "@/lib/iriss-autoparks";
import { iegadeFileList, purchaseDateFromDocs } from "@/lib/iriss-autoparks-v2-iegade-files";
import { sniffContentType } from "@/lib/iriss-autoparks-v2-sniff";
import type { CabinetDocument } from "@/lib/iriss-logistics-cabinet";

const doc = (id: string, type: CabinetDocument["type"], createdAt: string, extra: Partial<CabinetDocument> = {}) =>
  ({ id, carId: "o1", section: "A", type, typeLabel: "", title: "", docNumber: "", source: "", sourceUrl: "", blobPath: `x/${id}.pdf`, sha256: "", uploadedBy: "", createdAt, deletedAt: "", deletedBy: "", ...extra }) as CabinetDocument;
const file = (id: string, stage: AutoparksFile["stage"], extra: Partial<AutoparksFile> = {}) =>
  ({ id, carId: "c1", stage, kind: "other", title: id, fileName: "", contentType: "application/pdf", size: 1, blobPath: "", sha256: "", scanned: false, uploadedBy: "", uploadedByName: "", createdAt: "2026-10-20", deletedAt: "", ...extra }) as AutoparksFile;

describe("Iegādes faili", () => {
  it("kabineta dokumenti + v1 Iegāde/Transports; servisa faili un dzēstie - nē; akts kā saite beigās", () => {
    const list = iegadeFileList({
      cabinetDocs: [doc("d1", "car_invoice", "2026-10-09"), doc("d2", "cmr", "2026-10-14"), doc("d3", "service_invoice", "2026-10-15"), doc("d4", "pickup_pdf", "2026-10-11", { deletedAt: "x" }), doc("d5", "note", "2026-10-11")],
      v1Files: [file("f1", "purchase"), file("f2", "service"), file("akts", "service"), file("f3", "transport", { deletedAt: "y" })],
      numberCheckFileId: "akts",
    });
    expect(list.map((f) => [f.id, f.tag, f.link])).toEqual([
      ["c:d1", "Rēķins", false],
      ["c:d2", "CMR", false],
      ["f:f1", "Dokuments", false],
      ["f:akts", "Akts", true],
    ]);
  });
  it("pirkuma datums - pirmais rēķins", () => {
    expect(purchaseDateFromDocs([doc("a", "cmr", "2026-10-01"), doc("b", "auction_invoice", "2026-10-09T10:00Z"), doc("c", "car_invoice", "2026-10-10")])).toBe("2026-10-09");
  });
  it("satura tips pēc baitiem", () => {
    expect(sniffContentType(new TextEncoder().encode("%PDF-1.7"), "application/octet-stream")).toBe("application/pdf");
    expect(sniffContentType(new Uint8Array([0xff, 0xd8, 0xff, 0]), "")).toBe("image/jpeg");
  });
});
