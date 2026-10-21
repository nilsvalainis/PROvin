import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLACE_DETAILS_FIELD_MASK } from "@/lib/iriss-logistics-places-server";

describe("Places izmaksas", () => {
  it("asks Place Details only for Essentials fields (no displayName = Pro)", () => {
    expect(PLACE_DETAILS_FIELD_MASK.split(",").sort()).toEqual(["formattedAddress", "location"]);
    const src = readFileSync("lib/iriss-logistics-places-server.ts", "utf8");
    expect(src).not.toMatch(/FieldMask": "[^"]*displayName/);
  });

  it("keeps the place name from the suggestion text on the client", () => {
    const ac = readFileSync("components/admin/iriss-logistika/IrissAddressAutocomplete.tsx", "utf8");
    expect(ac).toContain("name: body.name || s.main");
  });
});
