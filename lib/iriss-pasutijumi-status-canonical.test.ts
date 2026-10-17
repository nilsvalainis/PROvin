import { describe, expect, it } from "vitest";
import {
  canonicalIrissPasutijumsListStatus,
  displayIrissPasutijumsListStatusLabel,
} from "@/lib/iriss-pasutijumi-types";

describe("IRISS pasūtījuma statusa kanons", () => {
  it("mapē searching/offered uz Aktīvs", () => {
    expect(canonicalIrissPasutijumsListStatus("searching")).toBe("active");
    expect(canonicalIrissPasutijumsListStatus("offered")).toBe("active");
    expect(displayIrissPasutijumsListStatusLabel("searching")).toBe("Aktīvs");
    expect(displayIrissPasutijumsListStatusLabel("reserved")).toBe("Rezervēts");
  });
});
