import { describe, expect, it } from "vitest";

import { DzintarzemeTameSection, formatTameEur } from "@/components/admin/DzintarzemeTameSection";
import { defaultIrissDzintarzemeTameDraft } from "@/lib/iriss-pasutijumi-types";
import { renderText } from "@/lib/test-render";

const base = (patch: Partial<ReturnType<typeof defaultIrissDzintarzemeTameDraft>> = {}, extra: Record<string, unknown> = {}) => (
  <DzintarzemeTameSection
    orderId="x"
    shellCard=""
    draft={{ ...defaultIrissDzintarzemeTameDraft(), ...patch }}
    orderBrandModel="Toyota Land Cruiser"
    onDraftChange={() => undefined}
    {...extra}
  />
);

describe("Izmaksu tāme - forma (makets 28.10)", () => {
  it("summas ar tūkstošu atstarpi arī 4 cipariem", () => {
    expect(formatTameEur(1078)).toBe("1 078,00 €");
    expect(formatTameEur(43010.88)).toBe("43 010,88 €");
    expect(formatTameEur(-500)).toBe("-500,00 €");
  });

  it("kopsavilkums blakus: kopā, avanss un atlikums", async () => {
    const text = await renderText(
      base({ tameAutoPriceStr: "38500", tameCommissionVariant: "B", tameTransportStr: "1450" }, { advancePaidEur: 500 }),
    );
    expect(text).toContain("Kopsavilkums");
    expect(text).toContain("38 500,00 €");
    expect(text).toContain("Avanss");
    expect(text).toContain("-500,00 €");
    expect(text).toContain("Atlikums apmaksai");
    // B: 990 + 3,5 % no 30 800
    expect(text).toContain("2 068,00 €");
  });

  it("tukšie pakalpojumi nav rindas, bet pievienošanas pogas", async () => {
    const text = await renderText(base({ tameTransportStr: "1450" }));
    expect(text).toContain("Transports");
    expect(text).toContain("+ Ķīmiskā tīrīšana");
    expect(text).not.toContain("+ Transports");
    expect(text).toContain("CSDD reģistrācijas un valsts nodevas tāmē netiek iekļautas.");
    expect(text).not.toMatch(/Derīga līdz/);
  });
});
