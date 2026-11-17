import { describe, expect, it } from "vitest";
import { listingSpecCells } from "@/lib/iriss-listings-card";

const value = (label: string, cells: ReturnType<typeof listingSpecCells>) => cells.find((c) => c.label === label)?.value;

describe("listingSpecCells latviski", () => {
  it("tulko izsoļu degvielu, kārbu un krāsu (EN/ET/DE)", () => {
    const en = listingSpecCells({ fuel: "Petrol", transmission: "Automatic", color: "Grey (Metallic)" });
    expect(value("Degviela", en)).toBe("Benzīns");
    expect(value("Kārba", en)).toBe("Automātiskā");
    expect(value("Krāsa", en)).toBe("Pelēka (metāliks)");
    const et = listingSpecCells({ fuel: "Diisel", transmission: "Automaat" });
    expect(value("Degviela", et)).toBe("Dīzelis");
    expect(value("Kārba", et)).toBe("Automātiskā");
    expect(value("Kārba", listingSpecCells({ transmission: "Manual 6-speed" }))).toBe("Manuālā 6-speed");
  });

  it("nezināmu vērtību atstāj kā avotā", () => {
    expect(listingSpecCells({ fuel: "Wasserstoff" })[0]?.value).toBe("Wasserstoff");
  });
});
