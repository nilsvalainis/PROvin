import { describe, expect, it } from "vitest";

import {
  clearIrissOrderBackup,
  formatIrissBackupTime,
  irissAutosaveRetryDelayMs,
  irissAutosaveShouldRetry,
  irissOrderBackupDiffers,
  irissOrderSaveStatus,
  readIrissOrderBackup,
  writeIrissOrderBackup,
} from "@/lib/iriss-order-save-status";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";

function memStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    size: () => m.size,
  };
}

const rec = () => ({ ...emptyIrissPasutijums("ord-1", "2026-10-29T10:00:00.000Z"), brandModel: "Toyota Land Cruiser" });

describe("Drošā saglabāšana: stāvoklis galvenē", () => {
  const base = { dirty: false, saving: false, error: null, offline: false, savedTime: "13:11" };

  it("saglabāts rāda laiku", () => {
    expect(irissOrderSaveStatus(base)).toEqual({ kind: "saved", label: "Saglabāts 13:11" });
  });
  it("neizdevusies saglabāšana vairs nerāda «Saglabāts»", () => {
    const s = irissOrderSaveStatus({ ...base, dirty: true, error: "Tīkla kļūda: Failed to fetch" });
    expect(s.kind).toBe("error");
    expect(s.label).not.toMatch(/^Saglabāts/);
  });
  it("bez interneta un ar izmaiņām - offline", () => {
    expect(irissOrderSaveStatus({ ...base, dirty: true, offline: true }).kind).toBe("offline");
  });
  it("nesaglabātas izmaiņas un saglabāšana procesā", () => {
    expect(irissOrderSaveStatus({ ...base, dirty: true }).kind).toBe("pending");
    expect(irissOrderSaveStatus({ ...base, dirty: true, saving: true }).kind).toBe("saving");
  });
});

describe("Drošā saglabāšana: atkārtošana", () => {
  it("tīkla un servera kļūdas atkārto, konfliktu un tukšu ierakstu - nē", () => {
    expect(irissAutosaveShouldRetry("Tīkla kļūda: Failed to fetch")).toBe(true);
    expect(irissAutosaveShouldRetry("Serveris atbildēja 500")).toBe(true);
    expect(irissAutosaveShouldRetry("stale_revision")).toBe(false);
    expect(irissAutosaveShouldRetry("empty_record")).toBe(false);
    expect(irissAutosaveShouldRetry("Saglabāšana rindā.")).toBe(false);
  });
  it("pauzes pieaug līdz minūtei", () => {
    expect([0, 1, 2, 3, 9].map(irissAutosaveRetryDelayMs)).toEqual([3000, 10000, 30000, 60000, 60000]);
  });
});

describe("Drošā saglabāšana: rezerves kopija pārlūkā", () => {
  const now = new Date("2026-10-29T11:11:00.000Z");

  it("ieraksta, nolasa un notīra", () => {
    const st = memStorage();
    expect(writeIrissOrderBackup(st, rec(), now)).toBe(true);
    const b = readIrissOrderBackup(st, "ord-1", now);
    expect(b?.rec.brandModel).toBe("Toyota Land Cruiser");
    clearIrissOrderBackup(st, "ord-1");
    expect(readIrissOrderBackup(st, "ord-1", now)).toBeNull();
  });

  it("nesaglabātu bilžu baitus un foto albumus neglabā", () => {
    const st = memStorage();
    const r = {
      ...rec(),
      inspectionPhotos: [{ id: "p1", dataUrl: "data:image/jpeg;base64,AAAA" }],
      offers: [
        {
          ...(rec().offers[0] ?? {}),
          id: "o1",
          attachments: [
            { id: "a1", name: "x.jpg", mime: "image/jpeg", dataUrl: "data:image/jpeg;base64,BBBB" },
            { id: "a2", name: "y.jpg", mime: "image/jpeg", dataUrl: "data:image/jpeg;base64,CCCC", blobPath: "iriss/y.jpg" },
          ],
        },
      ],
    } as never;
    writeIrissOrderBackup(st, r, now);
    const b = readIrissOrderBackup(st, "ord-1", now)!;
    expect("inspectionPhotos" in b.rec).toBe(false);
    expect(b.rec.offers[0]!.attachments.map((a) => a.id)).toEqual(["a2"]);
    expect(b.rec.offers[0]!.attachments[0]!.dataUrl).toBe("");
  });

  it("vecāku par 7 dienām nepiedāvā", () => {
    const st = memStorage();
    writeIrissOrderBackup(st, rec(), new Date("2026-10-01T10:00:00.000Z"));
    expect(readIrissOrderBackup(st, "ord-1", now)).toBeNull();
  });

  it("piedāvā tikai, ja kopija atšķiras no servera", () => {
    const server = rec();
    expect(irissOrderBackupDiffers({ ...server, updatedAt: "2026-10-29T12:00:00.000Z" }, server)).toBe(false);
    expect(irissOrderBackupDiffers({ ...server, agentNotes: "Zvanīt rīt" }, server)).toBe(true);
  });

  it("kopijas laiks Rīgas laikā", () => {
    expect(formatIrissBackupTime("2026-10-29T11:11:00.000Z")).toBe("29.10. 13:11");
  });
});
