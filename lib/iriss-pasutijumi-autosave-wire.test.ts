import { describe, expect, it } from "vitest";
import { emptyIrissOfferRecord, emptyIrissPasutijums, type IrissOfferAttachment } from "@/lib/iriss-pasutijumi-types";
import {
  irissSaveWirePayload,
  irissWireImageBytes,
  mergeServerAttachmentStorage,
} from "@/lib/iriss-pasutijumi-autosave-wire";

const NOW = "2026-10-17T20:00:00.000Z";
const BIG = `data:image/jpeg;base64,${"A".repeat(200_000)}`;
const THUMB = `data:image/jpeg;base64,${"B".repeat(20_000)}`;

function att(id: string, extra: Partial<IrissOfferAttachment> = {}): IrissOfferAttachment {
  return { id, name: `${id}.jpg`, mimeType: "image/jpeg", size: 150_000, dataUrl: "", ...extra };
}

function order(attachments: IrissOfferAttachment[], notes = "") {
  const offer = { ...emptyIrissOfferRecord("o1", NOW), attachments };
  return { ...emptyIrissPasutijums("r1", NOW), notes, offers: [offer] };
}

describe("irissSaveWirePayload", () => {
  it("sends a new image (no blobPath yet) exactly as is", () => {
    const rec = order([att("new", { dataUrl: BIG, thumbDataUrl: THUMB })]);
    expect(irissSaveWirePayload(rec)).toBe(rec);
  });

  it("drops bytes of images already stored, keeps references and text", () => {
    const rec = order(
      [
        att("stored", {
          dataUrl: BIG,
          thumbDataUrl: THUMB,
          blobPath: "iriss/o1/stored.jpg",
          thumbBlobPath: "iriss/o1/stored.thumb.jpg",
          thumbUrl: "https://blob/x.jpg",
        }),
        att("new", { dataUrl: BIG }),
      ],
      "Klients grib melnu",
    );
    const wire = irissSaveWirePayload(rec);
    const stored = wire.offers[0].attachments[0];
    expect(stored.dataUrl).toBe("");
    expect(stored.thumbDataUrl).toBeUndefined();
    expect(stored.blobPath).toBe("iriss/o1/stored.jpg");
    expect(stored.thumbBlobPath).toBe("iriss/o1/stored.thumb.jpg");
    expect(stored.thumbUrl).toBe("https://blob/x.jpg");
    expect(stored.name).toBe("stored.jpg");
    expect(stored.size).toBe(150_000);
    expect(wire.offers[0].attachments[1].dataUrl).toBe(BIG);
    expect(wire.notes).toBe("Klients grib melnu");
    expect(irissWireImageBytes(wire)).toBe(BIG.length);
  });

  it("does not mutate the editor state", () => {
    const rec = order([att("s", { dataUrl: BIG, blobPath: "p/s.jpg" })]);
    const before = JSON.stringify(rec);
    irissSaveWirePayload(rec);
    expect(JSON.stringify(rec)).toBe(before);
  });

  it("keeps a client thumb when the server has no stored thumb yet", () => {
    const rec = order([att("s", { thumbDataUrl: THUMB, blobPath: "p/s.jpg" })]);
    expect(irissSaveWirePayload(rec).offers[0].attachments[0].thumbDataUrl).toBe(THUMB);
  });

  it("keeps remote auction photos (blobUrl only) untouched", () => {
    const rec = order([att("r", { blobUrl: "https://img.example/1.jpg" })]);
    expect(irissSaveWirePayload(rec)).toBe(rec);
  });

  it("text-only autosave of an order with stored images is small", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      att(`a${i}`, { thumbDataUrl: THUMB, blobPath: `p/a${i}.jpg`, thumbBlobPath: `p/a${i}.t.jpg` }),
    );
    const wire = irissSaveWirePayload(order(many, "x"));
    expect(irissWireImageBytes(wire)).toBe(0);
    expect(JSON.stringify(wire).length).toBeLessThan(20_000);
  });
});

describe("mergeServerAttachmentStorage", () => {
  it("adopts server storage refs so the next autosave does not resend the image", () => {
    const local = order([att("new", { dataUrl: BIG, thumbDataUrl: THUMB })], "teksts");
    const server = order([
      att("new", { blobPath: "p/new.jpg", thumbBlobPath: "p/new.t.jpg", thumbUrl: "https://blob/t.jpg" }),
    ]);
    const merged = mergeServerAttachmentStorage(local, server);
    const a = merged.offers[0].attachments[0];
    expect(a.blobPath).toBe("p/new.jpg");
    expect(a.thumbBlobPath).toBe("p/new.t.jpg");
    expect(a.dataUrl).toBe(BIG);
    expect(a.thumbDataUrl).toBe(THUMB);
    expect(merged.notes).toBe("teksts");
    expect(irissWireImageBytes(irissSaveWirePayload(merged))).toBe(0);
  });

  it("does not add or remove attachments and ignores unknown ids", () => {
    const local = order([att("a", { dataUrl: BIG })]);
    const server = order([att("b", { blobPath: "p/b.jpg" })]);
    const merged = mergeServerAttachmentStorage(local, server);
    expect(merged).toBe(local);
    expect(merged.offers[0].attachments.map((x) => x.id)).toEqual(["a"]);
  });

  it("is a no-op without a server record", () => {
    const local = order([att("a", { dataUrl: BIG })]);
    expect(mergeServerAttachmentStorage(local, null)).toBe(local);
  });

  it("never overwrites an existing local blobPath", () => {
    const local = order([att("a", { blobPath: "p/local.jpg" })]);
    const server = order([att("a", { blobPath: "p/other.jpg" })]);
    expect(mergeServerAttachmentStorage(local, server).offers[0].attachments[0].blobPath).toBe("p/local.jpg");
  });
});
