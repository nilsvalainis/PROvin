import { describe, expect, it } from "vitest";
import { matchIrissPasutijumsByVin } from "@/lib/iriss-pavadzimes-match";

function order(partial: {
  id: string;
  vin: string;
  updatedAt?: string;
  listStatus?: "active" | "completed" | "inactive";
  clientFirstName?: string;
  clientLastName?: string;
  brandModel?: string;
}) {
  return {
    updatedAt: "2026-10-01T00:00:00.000Z",
    listStatus: "active" as const,
    clientFirstName: "",
    clientLastName: "",
    brandModel: "Volvo V50",
    ...partial,
  };
}

describe("IRISS pavadzīme ↔ pasūtījums pēc VIN", () => {
  it("atgriež null, ja VIN tukšs vai nesakrīt", () => {
    const rows = [order({ id: "a", vin: "WBA8E31000A123456" })];
    expect(matchIrissPasutijumsByVin("", rows)).toBeNull();
    expect(matchIrissPasutijumsByVin("WVWZZZ1JZ3W386752", rows)).toBeNull();
  });

  it("atrod pasūtījumu pēc VIN un dod klienta vārdu", () => {
    const hit = matchIrissPasutijumsByVin("wba8e31000a123456", [
      order({
        id: "ord-1",
        vin: "WBA8E31000A123456",
        clientFirstName: "Nils",
        clientLastName: "Valainis",
      }),
    ]);
    expect(hit).toEqual({ id: "ord-1", label: "Nils Valainis" });
  });

  it("dod priekšroku aktīvam pasūtījumam", () => {
    const hit = matchIrissPasutijumsByVin("WBA8E31000A123456", [
      order({ id: "old", vin: "WBA8E31000A123456", listStatus: "completed", updatedAt: "2026-10-10T00:00:00.000Z" }),
      order({ id: "live", vin: "WBA8E31000A123456", listStatus: "active", updatedAt: "2026-09-01T00:00:00.000Z" }),
    ]);
    expect(hit?.id).toBe("live");
  });
});
