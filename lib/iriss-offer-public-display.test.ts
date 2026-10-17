import { describe, expect, it } from "vitest";
import {
  formatIrissOfferPublicBodyType,
  formatIrissOfferPublicFuel,
  formatIrissOfferPublicOdometer,
  formatIrissOfferPublicTransmission,
} from "@/lib/iriss-offer-public-display";
import { emptyIrissOfferRecord } from "@/lib/iriss-pasutijumi-types";
import { buildIrissOfferPublicView } from "@/lib/iriss-offer-client-link";

describe("iriss offer public display", () => {
  it("formats odometer with grouped km", () => {
    expect(formatIrissOfferPublicOdometer("300271")).toBe("300\u00a0271 km");
    expect(formatIrissOfferPublicOdometer("300271 km")).toBe("300\u00a0271 km");
  });

  it("translates gearbox enums to Latvian", () => {
    expect(formatIrissOfferPublicTransmission("automatic")).toBe("Automātiskā");
    expect(formatIrissOfferPublicTransmission("manual")).toBe("Manuālā");
    expect(formatIrissOfferPublicTransmission("Automātiskā")).toBe("Automātiskā");
  });

  it("translates fuel and body enums", () => {
    expect(formatIrissOfferPublicFuel("diesel")).toBe("Dīzelis");
    expect(formatIrissOfferPublicFuel("petrol")).toBe("Benzīns");
    expect(formatIrissOfferPublicBodyType("avant")).toBe("Universālis");
    expect(formatIrissOfferPublicBodyType("suv")).toBe("SUV");
  });

  it("buildIrissOfferPublicView applies display formatting", () => {
    const offer = emptyIrissOfferRecord("22222222-2222-4222-8222-222222222222", "2026-10-15T08:00:00.000Z", "P");
    offer.odometerReading = "300271";
    offer.transmission = "automatic";
    offer.fuel = "diesel";
    offer.bodyTypeOffer = "avant";
    const view = buildIrissOfferPublicView(offer, { decision: "", question: "" });
    expect(view.odometer).toBe("300\u00a0271 km");
    expect(view.transmission).toBe("Automātiskā");
    expect(view.fuel).toBe("Dīzelis");
    expect(view.bodyType).toBe("Universālis");
  });
});
