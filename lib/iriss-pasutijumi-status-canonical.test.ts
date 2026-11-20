import { describe, expect, it } from "vitest";
import {
  canonicalIrissPasutijumsListStatus,
  displayIrissPasutijumsListStatusLabel,
} from "@/lib/iriss-pasutijumi-types";

describe("IRISS pasūtījuma statusa kanons", () => {
  it("mapē searching/offered uz Aktīvs (P5: nosaukumi pa posmiem)", () => {
    expect(canonicalIrissPasutijumsListStatus("searching")).toBe("active");
    expect(canonicalIrissPasutijumsListStatus("offered")).toBe("active");
    expect(displayIrissPasutijumsListStatusLabel("searching")).toBe("Meklējam");
    expect(displayIrissPasutijumsListStatusLabel("offered")).toBe("Piedāvāts");
    expect(displayIrissPasutijumsListStatusLabel("completed")).toBe("Pārdots");
    expect(displayIrissPasutijumsListStatusLabel("reserved")).toBe("Rezervēts");
  });
});
