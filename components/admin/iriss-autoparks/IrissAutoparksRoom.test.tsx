import { describe, expect, it } from "vitest";
import { CarFields } from "@/components/admin/iriss-autoparks/IrissAutoparksRoom";
import type { AutoparksCar } from "@/lib/iriss-autoparks";
import { renderHtml, renderText } from "@/lib/test-render";

const car: AutoparksCar = {
  id: "ap-1",
  orderId: "",
  vin: "WVWZZZ1KZAW000001",
  make: "Volkswagen",
  model: "Golf",
  year: "2020",
  plate: "AB-1234",
  color: "Melns",
  mileageKm: 50000,
  status: "for_sale",
  statusChangedAt: "",
  location: "Rīga, Hermaņa iela 2",
  purchasePriceEur: null,
  salePriceEur: null,
  arrivedAt: "2026-10-01T00:00:00.000Z",
  archivedAt: "",
  createdAt: "",
  updatedAt: "",
} as AutoparksCar;

describe("Autoparks auto kabinets - Atrašanās vieta j62", () => {
  it("vairs nerāda 'Atrašanās vieta' lauku kabinetā (dzīvo tikai Loģistikā)", () => {
    const el = <CarFields car={car} hideSums={false} canWrite={true} onSave={() => undefined} />;
    const text = renderText(el);
    const html = renderHtml(el);
    expect(text).not.toContain("Atrašanās vieta");
    expect(html).not.toContain("Hermaņa iela");
    expect(text).toContain("Krāsa");
    expect(html).toContain("Melns");
  });
});
