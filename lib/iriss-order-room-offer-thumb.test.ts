import { describe, expect, it } from "vitest";
import { irissOrderRoomOfferThumb } from "@/lib/iriss-order-room";
import type { IrissOfferRecord } from "@/lib/iriss-pasutijumi-types";

const ORDER = "94a8d0f8-ac52-4653-81d2-5f4b8c5680cc";

function offer(att: Partial<IrissOfferRecord["attachments"][number]>): Pick<IrissOfferRecord, "id" | "attachments" | "coverAttachmentId"> {
  return {
    id: "dcabaa16-da92-4b07-9434-f256fdcbdb4d",
    coverAttachmentId: "",
    attachments: [
      {
        id: "a0590cbd-91c4-4f57-950e-707cf6663085",
        name: "izsole-1.jpg",
        mimeType: "image/jpeg",
        size: 96871,
        dataUrl: "",
        ...att,
      } as IrissOfferRecord["attachments"][number],
    ],
  };
}

describe("irissOrderRoomOfferThumb (FABLE F3: salauzta bilde piedāvājuma kartītē)", () => {
  it("privātā Blob sīktēla saite iet caur admin starpnieku", () => {
    const src = irissOrderRoomOfferThumb(
      offer({ thumbUrl: "https://abc.private.blob.vercel-storage.com/iriss-pasutijumi/offers/x/thumb.jpg", blobPath: "p" }),
      ORDER,
    );
    expect(src).toBe(
      `/api/admin/iriss-pasutijumi/${ORDER}/offer/dcabaa16-da92-4b07-9434-f256fdcbdb4d/photo/a0590cbd-91c4-4f57-950e-707cf6663085`,
    );
  });

  it("ielādēts sīktēls (data:) un publiska saite paliek kā bija", () => {
    expect(irissOrderRoomOfferThumb(offer({ thumbDataUrl: "data:image/jpeg;base64,AAA" }), ORDER)).toBe("data:image/jpeg;base64,AAA");
    expect(irissOrderRoomOfferThumb(offer({ thumbUrl: "https://img-pa.auto1.com/img/x.jpg" }), ORDER)).toBe("https://img-pa.auto1.com/img/x.jpg");
  });

  it("bez pasūtījuma id privāto saiti nerāda (labāk tukšs nekā salauzts)", () => {
    expect(irissOrderRoomOfferThumb(offer({ thumbUrl: "https://abc.private.blob.vercel-storage.com/t.jpg" }))).toBe("");
  });
});
