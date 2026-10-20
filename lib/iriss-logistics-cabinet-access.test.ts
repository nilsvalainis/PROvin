import { describe, expect, it } from "vitest";
import {
  buildCabinetAccessView,
  cabinetActorCanWrite,
  cabinetCarVisibleToActor,
  cabinetRolesFromSections,
  defaultCabinetAccessAllow,
  evaluateCabinetAccess,
  filterDocumentsByCabinetAccess,
} from "@/lib/iriss-logistics-cabinet-access";
import type { CabinetAccessRule } from "@/lib/iriss-logistics-cabinet";

function rule(partial: Partial<CabinetAccessRule>): CabinetAccessRule {
  return {
    id: "r1",
    userId: "",
    role: "",
    carId: "",
    section: "",
    docType: "",
    allow: true,
    updatedAt: "",
    updatedBy: "",
    ...partial,
  };
}

describe("cabinet access matrix", () => {
  it("hides section A and invoice types from Loģistika by default", () => {
    expect(defaultCabinetAccessAllow("logistika", "car_invoice", "A")).toBe(false);
    expect(defaultCabinetAccessAllow("logistika", "service_invoice", "C")).toBe(false);
    expect(defaultCabinetAccessAllow("logistika", "pickup_pdf", "B")).toBe(true);
    expect(
      evaluateCabinetAccess(
        { userId: "u1", roles: ["logistika"], carId: "lo-1", section: "A", docType: "car_invoice" },
        [],
      ),
    ).toBe(false);
    expect(buildCabinetAccessView({ userId: "u1", roles: ["logistika"], carId: "lo-1" }, []).sections).toEqual([
      "B",
      "C",
    ]);
  });

  it("makes Grāmatvede read-only and only on assigned cars", () => {
    expect(cabinetRolesFromSections(["gramatvede"])).toEqual(["gramatvede"]);
    expect(cabinetActorCanWrite({ userId: "g1", roles: ["gramatvede"] })).toBe(false);
    expect(
      evaluateCabinetAccess(
        { userId: "g1", roles: ["gramatvede"], carId: "lo-1", section: "A", docType: "car_invoice" },
        [],
      ),
    ).toBe(false);
    const assigned = rule({ userId: "g1", carId: "lo-1", role: "gramatvede", allow: true });
    expect(
      evaluateCabinetAccess(
        { userId: "g1", roles: ["gramatvede"], carId: "lo-1", section: "A", docType: "car_invoice" },
        [assigned],
      ),
    ).toBe(true);
    expect(
      evaluateCabinetAccess(
        { userId: "g1", roles: ["gramatvede"], carId: "lo-2", section: "A", docType: "car_invoice" },
        [assigned],
      ),
    ).toBe(false);
    expect(
      evaluateCabinetAccess(
        { userId: "g1", roles: ["gramatvede"], carId: "lo-1", section: "B", docType: "pickup_pdf" },
        [assigned],
      ),
    ).toBe(false);
    expect(cabinetCarVisibleToActor({ userId: "g1", roles: ["gramatvede"], carId: "lo-1" }, [assigned])).toBe(true);
    const view = buildCabinetAccessView({ userId: "g1", roles: ["gramatvede"], carId: "lo-1" }, [assigned]);
    expect(view.write).toBe(false);
    expect(view.hideSums).toBe(false);
    expect(view.sections).toEqual(["A", "C"]);
    expect(buildCabinetAccessView({ userId: "u1", roles: ["logistika"], carId: "lo-1" }, []).hideSums).toBe(true);
    expect(cabinetActorCanWrite({ userId: "env-admin", roles: [] })).toBe(true);
  });

  it("lets Nils override a user/role × section × type rule on the server", () => {
    const hideInvoice: CabinetAccessRule = rule({
      id: "hide",
      userId: "u1",
      section: "C",
      docType: "note",
      allow: false,
    });
    expect(
      evaluateCabinetAccess(
        { userId: "u1", roles: ["logistika"], carId: "lo-1", section: "C", docType: "note" },
        [hideInvoice],
      ),
    ).toBe(false);
    expect(
      evaluateCabinetAccess(
        { userId: "u1", roles: ["logistika"], carId: "lo-1", section: "B", docType: "pickup_pdf" },
        [hideInvoice],
      ),
    ).toBe(true);
  });

  it("filters documents without dropping the rest of the cabinet", () => {
    const docs = [
      { id: "1", section: "A" as const, type: "car_invoice" as const },
      { id: "2", section: "B" as const, type: "pickup_pdf" as const },
      { id: "3", section: "C" as const, type: "service_invoice" as const },
    ];
    const kept = filterDocumentsByCabinetAccess(docs, { userId: "s1", roles: ["logistika"], carId: "lo-1" }, []);
    expect(kept.map((d) => d.id)).toEqual(["2"]);
  });
});
