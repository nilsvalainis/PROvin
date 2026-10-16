import { describe, expect, it } from "vitest";
import { B2bDemoIsolationError } from "./b2b-demo-isolation";
import {
  applyB2bDemoOrderPatch,
  createB2bDemoOrder,
  emptyB2bDemoOffer,
  newB2bDemoOfferId,
  parseB2bDemoOrder,
} from "./b2b-demo-orders";

describe("b2b demo orders", () => {
  const tenantA = "tnt_ordaaa";
  const tenantB = "tnt_ordbbb";

  it("parses legacy clientName records and rejects a foreign tenant_id", () => {
    const created = createB2bDemoOrder(tenantA, { clientName: "Klients A", brandModel: "BMW" });
    expect(created.clientFirstName).toBe("Klients");
    expect(created.clientLastName).toBe("A");
    expect(created.status).toBe("active");
    expect(created.offers).toEqual([]);
    const parsed = parseB2bDemoOrder(
      {
        tenantId: tenantA,
        orderId: created.orderId,
        clientName: "Vecais vārds",
        brandModel: "Audi",
        vin: "",
        note: "piezīme",
        status: "completed",
        createdAt: created.createdAt,
      },
      tenantA,
    );
    expect(parsed?.clientName).toBe("Vecais vārds");
    expect(parsed?.note).toBe("piezīme");
    expect(parseB2bDemoOrder({ ...created, tenantId: tenantB }, tenantA)).toBeNull();
  });

  it("keeps offers tenant-bound and supports searching status", () => {
    const offer = emptyB2bDemoOffer(newB2bDemoOfferId(), "2026-10-16T00:00:00.000Z");
    offer.carPrice = "12000";
    const order = createB2bDemoOrder(tenantA, {
      clientFirstName: "Anna",
      clientLastName: "Liepa",
      brandModel: "Golf",
      status: "searching",
      offers: [offer],
    });
    expect(order.status).toBe("searching");
    expect(order.offers).toHaveLength(1);
    expect(() => applyB2bDemoOrderPatch(order, tenantB, { note: "svešs" })).toThrow(B2bDemoIsolationError);
  });
});
