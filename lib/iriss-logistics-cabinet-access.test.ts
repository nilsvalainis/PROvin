import { describe, expect, it } from "vitest";
import {
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
  it("lets Loģistika see invoices by default (Nils 17:01)", () => {
    expect(defaultCabinetAccessAllow("logistika", "car_invoice")).toBe(true);
    expect(defaultCabinetAccessAllow("logistika", "service_invoice")).toBe(true);
    expect(defaultCabinetAccessAllow("logistika", "pickup_pdf")).toBe(true);
    expect(
      evaluateCabinetAccess(
        { userId: "u1", roles: ["logistika"], carId: "lo-1", section: "A", docType: "car_invoice" },
        [],
      ),
    ).toBe(true);
  });

  it("gives Grāmatvede full access and Serviss default-deny invoices", () => {
    expect(cabinetRolesFromSections(["gramatvede"])).toEqual(["gramatvede"]);
    expect(defaultCabinetAccessAllow("gramatvede", "car_invoice")).toBe(true);
    expect(defaultCabinetAccessAllow("serviss", "car_invoice")).toBe(false);
    expect(defaultCabinetAccessAllow("serviss", "pickup_pdf")).toBe(true);
    expect(
      evaluateCabinetAccess(
        { userId: "u2", roles: ["serviss"], carId: "lo-1", section: "C", docType: "service_invoice" },
        [],
      ),
    ).toBe(false);
  });

  it("lets Nils override a user/role × section × type rule on the server", () => {
    const hideInvoice: CabinetAccessRule = rule({
      id: "hide",
      userId: "u1",
      section: "A",
      docType: "invoices",
      allow: false,
    });
    expect(
      evaluateCabinetAccess(
        { userId: "u1", roles: ["logistika"], carId: "lo-1", section: "A", docType: "car_invoice" },
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
    ];
    const kept = filterDocumentsByCabinetAccess(docs, { userId: "s1", roles: ["serviss"], carId: "lo-1" }, []);
    expect(kept.map((d) => d.id)).toEqual(["2"]);
  });
});
