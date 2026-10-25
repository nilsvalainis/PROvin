import { describe, expect, it } from "vitest";
import { AutoparksV2Pamatdati } from "@/components/admin/iriss-autoparks-v2/AutoparksV2Pamatdati";
import type { AutoparksV2Basics } from "@/lib/iriss-autoparks-v2";
import { renderText } from "@/lib/test-render";

const basics: AutoparksV2Basics = {
  id: "ap-1",
  title: "Volkswagen Golf",
  make: "Volkswagen",
  model: "Golf",
  year: "2020",
  color: "Melns",
  vin: "WVWZZZ1KZAW000001",
  plate: "AB-1234",
  status: "for_sale",
  statusLabel: "",
  owner: "IRISS",
  ownerLabel: "SIA ĪRISS",
  location: "Rīga, Hermaņa iela 2",
  arrivedAt: "2026-10-01",
  archived: false,
  mileageKm: { value: 50000, csdd: false },
  firstRegDate: { value: "", csdd: false },
  displacementCm3: { value: null, csdd: false },
  powerKw: { value: null, csdd: false },
  tyreSize: { value: "", csdd: false },
  gearbox: { value: "", csdd: false },
  engine: { value: "", csdd: false },
  registry: { status: "none", actNo: "", actDate: "", known: false },
  hasPhoto: false,
} as AutoparksV2Basics;

describe("Autoparks v2 Pamatdati - Atrašanās vieta j62", () => {
  it("vairs nerāda 'Atrašanās vieta' lauku (dzīvo tikai Loģistikā)", () => {
    const text = renderText(<AutoparksV2Pamatdati basics={basics} onBasics={() => undefined} />);
    expect(text).not.toContain("Atrašanās vieta");
    expect(text).not.toContain("Hermaņa iela");
    expect(text).toContain("Krāsa");
    expect(text).toContain("Melns");
  });
});
