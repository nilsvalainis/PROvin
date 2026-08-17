import { describe, expect, it } from "vitest";
import { sanitizeVinRegistryClientText } from "@/lib/vin-registry-client-text";

describe("sanitizeVinRegistryClientText", () => {
  it("drops English leftovers, icons and ISO dates", () => {
    const cleaned = sanitizeVinRegistryClientText(`
⚠ RED FLAG: auto iepriekš eksportēts no Zviedrijas.
2023-09-04: īpašnieka maiņa — AutoEtt European Cars
Īpašnieka maiņa — , in traffic and inspections was last updated 2026-08-11. Next update is scheduled for 2026-08-18.
Number of Owners (Metallic):
Satiksmē: nē
`);
    expect(cleaned).toContain("auto iepriekš eksportēts no Zviedrijas.");
    expect(cleaned).toContain("04.09.2023: īpašnieka maiņa - AutoEtt European Cars");
    expect(cleaned).toContain("Satiksmē: nē");
    expect(cleaned).not.toMatch(/⚠|RED FLAG|last updated|Number of Owners|Metallic/i);
  });
});
