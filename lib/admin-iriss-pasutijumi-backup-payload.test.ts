import { describe, expect, it } from "vitest";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import {
  backupPayloadContainsOfferImages,
  buildIrissOrdersBackupPayload,
  irissOrdersBackupFilename,
} from "@/lib/admin-iriss-pasutijumi-backup-payload";

describe("irissOrdersBackupFilename", () => {
  it("names JSON/ZIP as a dated pasutijumi backup", () => {
    const now = new Date("2026-10-14T09:00:00.000Z");
    expect(irissOrdersBackupFilename("json", now)).toBe("provin-iriss-pasutijumi-backup-2026-10-14.json");
    expect(irissOrdersBackupFilename("zip", now)).toBe("provin-iriss-pasutijumi-backup-2026-10-14.zip");
    expect(irissOrdersBackupFilename("pdf", now)).toBe("provin-pasutijumu-saraksts-2026-10-14.pdf");
  });
});

describe("buildIrissOrdersBackupPayload", () => {
  it("keeps every order, offer and image dataUrl in the workspace JSON", () => {
    const rec = emptyIrissPasutijums("ord-1", "2026-10-14T08:00:00.000Z");
    rec.brandModel = "BMW 520d";
    rec.offers = [
      {
        id: "off-1",
        title: "Piedāvājums 1",
        brandModel: "BMW 520d",
        year: "",
        mileage: "",
        priceGermany: "",
        comment: "",
        firstRegistration: "",
        odometerReading: "",
        transmission: "",
        location: "",
        hasFullServiceHistory: false,
        hasFactoryPaint: false,
        hasNoRustBody: false,
        hasSecondWheelSet: false,
        specialNotes: "",
        visualAssessment: "",
        technicalAssessment: "",
        summary: "",
        carPrice: "12000",
        deliveryPrice: "",
        commissionFee: "",
        offerValidDays: "",
        attachments: [
          {
            id: "img-1",
            name: "auto.jpg",
            mimeType: "image/jpeg",
            size: 12,
            dataUrl: "data:image/jpeg;base64,abc123",
          },
        ],
        createdAt: rec.createdAt,
        updatedAt: rec.updatedAt,
      },
    ];
    const payload = buildIrissOrdersBackupPayload({
      records: [["ord-1.json", rec]],
      listOrder: { pinnedOrder: [], unpinnedOrder: ["ord-1"] },
      listRows: [],
      storage: { enabled: true, persistence: "filesystem" },
      exportedAt: "2026-10-14T09:00:00.000Z",
    });
    expect(payload.meta.draftFilesCount).toBe(1);
    expect(payload.orderDrafts["ord-1.json"]).toContain("BMW 520d");
    expect(payload.orderDrafts["ord-1.json"]).toContain("data:image/jpeg;base64,abc123");
    expect(payload.orderDrafts["ord-1.json"]).toContain("off-1");
    expect(backupPayloadContainsOfferImages(payload)).toBe(true);
    expect(payload.meta.exportedAt).toBe("2026-10-14T09:00:00.000Z");
  });
});
