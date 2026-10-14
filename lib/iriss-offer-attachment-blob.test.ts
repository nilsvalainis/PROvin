import { describe, expect, it } from "vitest";
import {
  attachmentAfterBlobPut,
  irissOfferAttachmentHasBytes,
  irissOfferImageBlobPath,
  parseDataUrlPayload,
} from "@/lib/iriss-offer-attachment-blob";

describe("iriss offer attachment blob", () => {
  it("keeps a dataUrl attachment until a blob path is stored", () => {
    const a = { id: "i1", name: "a.jpg", mimeType: "image/jpeg", size: 4, dataUrl: "data:image/jpeg;base64,QQ==" };
    expect(irissOfferAttachmentHasBytes(a)).toBe(true);
    expect(irissOfferImageBlobPath("ord", "off", "i1")).toBe("iriss-pasutijumi/offers/ord/off/i1");
    const parsed = parseDataUrlPayload(a.dataUrl);
    expect(parsed?.bytes.length).toBeGreaterThan(0);
    const stored = attachmentAfterBlobPut(a, "iriss-pasutijumi/offers/ord/off/i1", "https://blob/x");
    expect(stored.dataUrl).toBe("");
    expect(stored.blobPath).toBe("iriss-pasutijumi/offers/ord/off/i1");
    expect(irissOfferAttachmentHasBytes(stored)).toBe(true);
  });
});
