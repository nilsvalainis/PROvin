import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({ Barlow_Condensed: () => ({ className: "font", style: {} }) }));

import { CarCard } from "@/components/admin/iriss-autoparks/IrissAutoparksClient";
import type { AutoparksListRow } from "@/lib/iriss-autoparks";
import { renderText } from "@/lib/test-render";

const row: AutoparksListRow = {
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
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "",
  owner: "IRISS",
  fileCount: 0,
  stageFileCounts: { purchase: 0, transport: 0, service: 0, sale: 0 },
  noteCount: 0,
  workOpen: 0,
} as AutoparksListRow;

describe("Autoparks saraksta kartīte - Atrašanās vieta j62", () => {
  it("vairs nerāda car.location kopsavilkuma rindā", () => {
    const text = renderText(
      <CarCard car={row} active={false} compact={false} canWrite={true} onOpen={() => undefined} onStatus={() => undefined} />,
    );
    expect(text).not.toContain("Hermaņa iela");
    expect(text).toContain("Melns");
    expect(text).toContain("50");
  });
});
