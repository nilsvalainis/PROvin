import { describe, expect, it } from "vitest";
import { buildIrissOfferPrintHtml } from "@/lib/iriss-pasutijums-pdf-html";
import { emptyIrissOfferRecord, emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import {
  deleteOfferImages,
  moveOfferImage,
  offerImageDeleteToast,
  offerImageGridSrc,
  orderOfferAttachmentsForPdf,
  restoreOfferImageSession,
  setOfferCoverPhoto,
  toggleOfferImageSelection,
} from "@/lib/iriss-offer-image-sorter";

type Img = { id: string; mimeType: string; name: string };

function img(id: string): Img {
  return { id, mimeType: "image/jpeg", name: `${id}.jpg` };
}

describe("IRISS offer image sorter", () => {
  it("reorders one thumbnail and keeps the others", () => {
    const next = moveOfferImage([img("a"), img("b"), img("c")], "c", "a");
    expect(next.map((item) => item.id)).toEqual(["c", "a", "b"]);
  });

  it("toggles multi-select without dropping other ids", () => {
    expect(toggleOfferImageSelection(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleOfferImageSelection(["a", "b"], "a")).toEqual(["b"]);
  });

  it("sets the cover by moving that photo first", () => {
    const set = setOfferCoverPhoto([img("a"), img("b"), img("c")], "b");
    expect(set?.coverId).toBe("b");
    expect(set?.images.map((item) => item.id)).toEqual(["b", "a", "c"]);
  });

  it("deletes the selection and undo restores those images and the previous order", () => {
    const start = [img("a"), img("b"), img("c"), img("d")];
    const reordered = moveOfferImage(start, "d", "b");
    expect(reordered.map((item) => item.id)).toEqual(["a", "d", "b", "c"]);
    const deleted = deleteOfferImages(reordered, "a", ["d", "c"]);
    expect(deleted.removed.map((item) => item.id)).toEqual(["d", "c"]);
    expect(deleted.images.map((item) => item.id)).toEqual(["a", "b"]);
    expect(deleted.coverId).toBe("a");

    const afterDelete = restoreOfferImageSession(
      { images: reordered, coverId: "a", selectedIds: ["d", "c"] },
      { images: deleted.images, coverId: deleted.coverId, selectedIds: [] },
    );
    expect(afterDelete.images.map((item) => item.id)).toEqual(["a", "d", "b", "c"]);
    expect(afterDelete.coverId).toBe("a");
    expect(afterDelete.selectedIds).toEqual(["d", "c"]);

    const afterOrder = restoreOfferImageSession(
      { images: start, coverId: "a", selectedIds: [] },
      afterDelete,
    );
    expect(afterOrder.images.map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("keeps a photo added after the delete when undo runs", () => {
    const start = [img("a"), img("b")];
    const deleted = deleteOfferImages(start, "a", ["b"]);
    const withUpload = [...deleted.images, img("new")];
    const restored = restoreOfferImageSession(
      { images: start, coverId: "a", selectedIds: ["b"] },
      { images: withUpload, coverId: "a", selectedIds: [] },
    );
    expect(restored.images.map((item) => item.id)).toEqual(["a", "b", "new"]);
  });

  it("puts the cover first in the PDF order and leaves non-images at the end", () => {
    const ordered = orderOfferAttachmentsForPdf({
      coverAttachmentId: "b",
      attachments: [
        img("a"),
        { id: "note", mimeType: "application/pdf", name: "note.pdf" },
        img("b"),
        img("c"),
      ],
    });
    expect(ordered.map((item) => item.id)).toEqual(["b", "a", "c", "note"]);
  });

  it("prefers a thumbnail data URL for the grid", () => {
    expect(
      offerImageGridSrc({
        thumbDataUrl: "data:image/jpeg;base64,QQ==",
        dataUrl: "data:image/jpeg;base64,BBBB",
        blobUrl: "https://blob.example/full",
      }),
    ).toBe("data:image/jpeg;base64,QQ==");
    expect(offerImageDeleteToast(1)).toBe("Attēls dzēsts");
    expect(offerImageDeleteToast(3)).toBe("3 attēli dzēsti");
  });

  it("offer HTML gallery follows cover then the remaining order", () => {
    const rec = emptyIrissPasutijums("pdf-order", "2026-04-15T10:00:00.000Z");
    const offer = emptyIrissOfferRecord("off-order", rec.createdAt, "Piedāvājums 1");
    offer.brandModel = "Audi A4";
    offer.coverAttachmentId = "b";
    offer.attachments = [
      { id: "a", name: "a.jpg", mimeType: "image/jpeg", size: 4, dataUrl: "data:image/jpeg;base64,QQ==" },
      { id: "b", name: "b.jpg", mimeType: "image/jpeg", size: 4, dataUrl: "data:image/jpeg;base64,Qg==" },
      { id: "c", name: "c.jpg", mimeType: "image/jpeg", size: 4, dataUrl: "data:image/jpeg;base64,Qw==" },
    ];
    const html = buildIrissOfferPrintHtml(rec, offer, "2026. gada 15. aprīlis", null);
    const posB = html.indexOf("base64,Qg");
    const posA = html.indexOf("base64,QQ");
    const posC = html.indexOf("base64,Qw");
    expect(posB).toBeGreaterThan(-1);
    expect(posB).toBeLessThan(posA);
    expect(posA).toBeLessThan(posC);
  });
});
