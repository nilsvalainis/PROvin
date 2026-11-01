import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { irissMergedInternalNotes } from "@/lib/iriss-order-completion";
import { parseIrissPasutijumsPatchBody } from "@/lib/iriss-pasutijumi-body";
import { retainIrissOmittedFields } from "@/lib/iriss-pasutijumi-store";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";

const base = () => emptyIrissPasutijums("x", "2026-10-29T10:00:00.000Z");

describe("Nils 29.10: lauki nedrīkst nodzēsties pēc saglabāšanas", () => {
  it("avanss tiek pieņemts PATCH ķermenī", () => {
    const rec = parseIrissPasutijumsPatchBody("x", {
      ...base(),
      advance: { amount: "500", paidAt: "2026-10-29", method: "", invoiceNo: "IRI 26088" },
    });
    expect(rec?.advance).toMatchObject({ amount: "500", paidAt: "2026-10-29", invoiceNo: "IRI 26088" });
  });

  it("ja lauka pieprasījumā nav, esošais avanss un komunikācija paliek", () => {
    const existing = {
      ...base(),
      advance: { amount: "500", paidAt: "", method: "", invoiceNo: "" },
      communicationEvents: [{ id: "e1", at: "2026-10-28T10:00:00.000Z", kind: "note", text: "Zvans" }],
    } as never;
    const incoming = parseIrissPasutijumsPatchBody("x", { ...base() })!;
    const out = retainIrissOmittedFields(existing, incoming, incoming);
    expect(out.advance?.amount).toBe("500");
    expect(out.communicationEvents?.length).toBe(1);
  });

  it("notīrīts avanss (atslēga ir) netiek atjaunots", () => {
    const existing = { ...base(), advance: { amount: "500", paidAt: "", method: "", invoiceNo: "" } } as never;
    const incoming = parseIrissPasutijumsPatchBody("x", { ...base(), advance: { amount: "", paidAt: "", method: "", invoiceNo: "" } })!;
    expect(retainIrissOmittedFields(existing, incoming, incoming).advance).toBeUndefined();
  });

  it("iekšējās piezīmes: atstarpe teksta beigās paliek, rakstot", () => {
    expect(irissMergedInternalNotes({ agentNotes: "Zvanīt rīt ", internalNotes: "" })).toBe("Zvanīt rīt ");
  });

  it("#788: komunikācija un foto albumi tiek pieņemti PATCH ķermenī", () => {
    const rec = parseIrissPasutijumsPatchBody("x", {
      ...base(),
      communicationEvents: [
        { id: "e1", at: "2026-10-28T10:00:00.000Z", kind: "note", title: "Zvans" },
      ],
      inspectionPhotos: {
        attachments: [{ id: "ph1", name: "a.jpg", mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,AAAA", size: 4 }],
      },
      documentPhotos: {
        attachments: [{ id: "ph2", name: "b.jpg", mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,BBBB", size: 4 }],
      },
    });
    expect(rec?.communicationEvents).toEqual([
      { id: "e1", at: "2026-10-28T10:00:00.000Z", kind: "note", title: "Zvans" },
    ]);
    expect(rec?.inspectionPhotos?.attachments.map((a) => a.id)).toEqual(["ph1"]);
    expect(rec?.documentPhotos?.attachments.map((a) => a.id)).toEqual(["ph2"]);
  });

  it("#788: ja albumu atslēgas nav, esošie foto paliek; tukšs albums notīra", () => {
    const album = {
      attachments: [{ id: "ph1", name: "a.jpg", mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,AAAA", size: 4 }],
    };
    const existing = {
      ...base(),
      inspectionPhotos: album,
      documentPhotos: album,
      communicationEvents: [{ id: "e1", at: "2026-10-28T10:00:00.000Z", kind: "note", title: "Zvans" }],
    } as never;
    const omitted = parseIrissPasutijumsPatchBody("x", { ...base() })!;
    const kept = retainIrissOmittedFields(existing, omitted, omitted);
    expect(kept.inspectionPhotos?.attachments[0]?.id).toBe("ph1");
    expect(kept.documentPhotos?.attachments[0]?.id).toBe("ph1");
    expect(kept.communicationEvents?.[0]?.id).toBe("e1");

    const cleared = parseIrissPasutijumsPatchBody("x", {
      ...base(),
      inspectionPhotos: { attachments: [] },
      documentPhotos: { attachments: [] },
      communicationEvents: [],
    })!;
    const out = retainIrissOmittedFields(existing, cleared, cleared);
    expect(out.inspectionPhotos).toBeUndefined();
    expect(out.documentPhotos).toBeUndefined();
    expect(out.communicationEvents).toBeUndefined();
  });
});
