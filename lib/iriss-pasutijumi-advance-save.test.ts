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
});
