import { describe, expect, it } from "vitest";
import type { AutoparksFile } from "@/lib/iriss-autoparks";
import { auto1MissingDocLabels, classifyIegadeDocType, iegadeFileList, isAuto1Car, purchaseDateFromDocs } from "@/lib/iriss-autoparks-v2-iegade-files";
import { sniffContentType } from "@/lib/iriss-autoparks-v2-sniff";
import type { CabinetDocument } from "@/lib/iriss-logistics-cabinet";

const doc = (id: string, type: CabinetDocument["type"], createdAt: string, extra: Partial<CabinetDocument> = {}) =>
  ({ id, carId: "o1", section: "A", type, typeLabel: "", title: "", docNumber: "", source: "", sourceUrl: "", blobPath: `x/${id}.pdf`, dropboxPath: "", sha256: "", uploadedBy: "", createdAt, deletedAt: "", deletedBy: "", ...extra }) as CabinetDocument;
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
  it("kabineta dokumenti - editable + CSDD nozīmīte Car Invoice; v1/akts - nē (J30 F1/F4)", () => {
    const list = iegadeFileList({
      cabinetDocs: [doc("d1", "car_invoice", "2026-10-09"), doc("d2", "purchase_confirm", "2026-10-08")],
      v1Files: [file("f1", "purchase"), file("akts", "service")],
      numberCheckFileId: "akts",
    });
    expect(list.map((f) => [f.id, f.editable, f.csddBadge])).toEqual([
      ["c:d2", true, false],
      ["c:d1", true, true],
      ["f:f1", false, false],
      ["f:akts", false, false],
    ]);
  });
  it("isAuto1Car - no izsoles lauka vai dokumenta avota", () => {
    expect(isAuto1Car({ auction: "Auto1", cabinetDocs: [] })).toBe(true);
    expect(isAuto1Car({ auction: "", cabinetDocs: [doc("d1", "car_invoice", "2026-10-09", { source: "auto1" })] })).toBe(true);
    expect(isAuto1Car({ auction: "openlane", cabinetDocs: [doc("d1", "car_invoice", "2026-10-09", { source: "email" })] })).toBe(false);
  });
  it("auto1MissingDocLabels - trūkstošās obligātās PDF etiķetes", () => {
    const docs = [doc("d1", "car_invoice", "2026-10-09")];
    expect(auto1MissingDocLabels({ isAuto1: true, cabinetDocs: docs })).toEqual(["Pirkuma apstiprinājums"]);
    expect(auto1MissingDocLabels({ isAuto1: true, cabinetDocs: [] })).toEqual(["Pirkuma apstiprinājums", "Car Invoice"]);
    expect(auto1MissingDocLabels({ isAuto1: false, cabinetDocs: [] })).toEqual([]);
    expect(
      auto1MissingDocLabels({
        isAuto1: true,
        cabinetDocs: [doc("d1", "car_invoice", "2026-10-09"), doc("d2", "purchase_confirm", "2026-10-08")],
      }),
    ).toEqual([]);
    expect(auto1MissingDocLabels({ isAuto1: true, cabinetDocs: [doc("d1", "car_invoice", "2026-10-09", { deletedAt: "x" })] })).toEqual(["Pirkuma apstiprinājums", "Car Invoice"]);
  });
  it("pirkuma datums - pirmais rēķins", () => {
    expect(purchaseDateFromDocs([doc("a", "cmr", "2026-10-01"), doc("b", "auction_invoice", "2026-10-09T10:00Z"), doc("c", "car_invoice", "2026-10-10")])).toBe("2026-10-09");
  });
  it("satura tips pēc baitiem", () => {
    expect(sniffContentType(new TextEncoder().encode("%PDF-1.7"), "application/octet-stream")).toBe("application/pdf");
    expect(sniffContentType(new Uint8Array([0xff, 0xd8, 0xff, 0]), "")).toBe("image/jpeg");
  });
  it("kabineta dokumentam aiznes savu tipu, v1/aktam - tukšs (J61 pildspalvas izvēlei)", () => {
    const list = iegadeFileList({
      cabinetDocs: [doc("d1", "car_invoice", "2026-10-09"), doc("d2", "other", "2026-10-08")],
      v1Files: [file("f1", "purchase"), file("akts", "service")],
      numberCheckFileId: "akts",
    });
    expect(list.map((f) => [f.id, f.type])).toEqual([
      ["c:d2", "other"],
      ["c:d1", "car_invoice"],
      ["f:f1", ""],
      ["f:akts", ""],
    ]);
  });
});

describe("classifyIegadeDocType (J61 - Auto1 faila nosaukuma auto-klasifikācija augšupielādei)", () => {
  it("Auto1 pasūtījuma apstiprinājums - 'order confirmation' un valsts+PR kods", () => {
    expect(classifyIegadeDocType("Auto1_Order_Confirmation.pdf")).toBe("purchase_confirm");
    expect(classifyIegadeDocType("Pirkuma_apstiprinajums.pdf")).toBe("purchase_confirm");
    expect(classifyIegadeDocType("NLPR20261024.pdf")).toBe("purchase_confirm");
    expect(classifyIegadeDocType("DEPR20261024.pdf")).toBe("purchase_confirm");
  });
  it("Car Invoice - 'invoice'/'rēķins', valsts+kods un tīri Auto1 rēķina cipari", () => {
    expect(classifyIegadeDocType("Car_Invoice.pdf")).toBe("car_invoice");
    expect(classifyIegadeDocType("Rekins.pdf")).toBe("car_invoice");
    expect(classifyIegadeDocType("DETRPHL20261024.pdf")).toBe("car_invoice");
    expect(classifyIegadeDocType("900123456.pdf")).toBe("car_invoice");
  });
  it("pasvītrojumi/defises kā atdalītāji nenobloķē \\b robežu (reāls Auto1 faila nosaukums)", () => {
    expect(classifyIegadeDocType("Car_Invoice_900123456.pdf")).toBe("car_invoice");
    expect(classifyIegadeDocType("Auto1-Order-Confirmation-2026.pdf")).toBe("purchase_confirm");
  });
  it("izsoles rēķins atšķiras no Car Invoice", () => {
    expect(classifyIegadeDocType("Auction_Invoice_12345.pdf")).toBe("auction_invoice");
  });
  it("neatpazīts nosaukums - 'other', pildspalva paliek vienīgais ceļš labot", () => {
    expect(classifyIegadeDocType("skenets.pdf")).toBe("other");
    expect(classifyIegadeDocType("IMG_0001.pdf")).toBe("other");
  });
});
