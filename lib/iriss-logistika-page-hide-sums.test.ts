/**
 * 17.11 prod tests (Andris): Loģistikas lapa SSR padeva kartītēm nemaskētas cenas.
 * Lapai jāpadod klientam tie paši maskētie ieraksti kā GET /api/admin/iriss-logistics.
 */
import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { AdminOrStaffActor } from "@/lib/staff-auth";

const state = vi.hoisted(() => ({ actor: null as unknown as AdminOrStaffActor }));

vi.mock("@/app/admin/iriss/logistika/iriss-logistika.css", () => ({}));
vi.mock("@/components/admin/iriss-logistika/IrissLogistikaClient", () => ({ IrissLogistikaClient: () => null }));
vi.mock("@/lib/staff-auth", () => ({ requireLogisticsPage: async () => state.actor }));
vi.mock("@/lib/iriss-logistics-cabinet-store", () => ({ listCabinetAccessRules: async () => [] }));
vi.mock("@/lib/iriss-car-share", () => ({ autoparksCarIdsByLogisticsOrder: () => ({}) }));
vi.mock("@/lib/iriss-autoparks-store", () => ({ readAutoparksState: async () => ({ cars: [] }) }));
vi.mock("@/lib/iriss-logistics-store", () => ({
  getIrissLogisticsStorageState: () => ({ enabled: true }),
  listLogisticsOrders: async () => [
    { id: "ord_1", make: "BMW", model: "X5", priceEur: 18450, notes: "Samaksāts 18 450 €", nextAction: "", statusNote: "" },
  ],
  listLogisticsPoints: async () => [],
  listPreviousLogisticsPoints: async () => [],
  listLogisticsAuctionSources: async () => [],
}));

function staff(sections: string[]): AdminOrStaffActor {
  return {
    kind: "staff",
    sessionId: "ses_x",
    user: { id: "usr_x", name: "Tests", email: "t@example.lv", role: "logistics", sections, status: "active", totpEnabled: true },
  } as unknown as AdminOrStaffActor;
}

async function initialOrders(): Promise<Array<Record<string, unknown>>> {
  const { default: Page } = await import("@/app/admin/iriss/logistika/page");
  const el = (await Page()) as ReactElement<{ children: ReactElement<{ initialOrders: Array<Record<string, unknown>> }> }>;
  return el.props.children.props.initialOrders;
}

describe("Loģistikas lapa (SSR): cenas šaurām lomām", () => {
  it("Loģistika: kartītēm padotajos ierakstos nav cenas un summas piezīmēs", async () => {
    state.actor = staff(["logistika"]);
    const orders = await initialOrders();
    expect(orders).toHaveLength(1);
    expect(orders[0].priceEur).toBeNull();
    expect(orders[0].notes).toBe("Samaksāts •• €");
  });

  it("Administrators redz cenu un piezīmi", async () => {
    state.actor = { kind: "admin", name: "Nils" } as unknown as AdminOrStaffActor;
    const orders = await initialOrders();
    expect(orders[0].priceEur).toBe(18450);
    expect(orders[0].notes).toBe("Samaksāts 18 450 €");
  });
});
