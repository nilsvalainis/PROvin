import { describe, expect, it } from "vitest";

import { mergeAutoRecordsServiceWorksByOdometer } from "@/lib/auto-records-service-works";
import { buildDealerServiceVisitsHtml } from "@/lib/pdf-dealer-service-visits";
import { mergeOverlappingServiceWorkLines } from "@/lib/service-works-lines";

const LOC = "Ejner Hessel - Roskilde, Københavnsvej 299, 4000 Roskilde, Denmark";

describe("26.11: priekšējie / aizmugurējie darbi nekad nesaplūst", () => {
  it("priekšējo un aizmugurējo bremžu kluču maiņa paliek abas", () => {
    expect(
      mergeOverlappingServiceWorkLines(["Priekšējo bremžu kluču maiņa", "Aizmugurējo bremžu kluču maiņa"]),
    ).toEqual(["Priekšējo bremžu kluču maiņa", "Aizmugurējo bremžu kluču maiņa"]);
  });

  it("kreisais / labais, front / rear, vorne / hinten arī paliek atsevišķi", () => {
    expect(mergeOverlappingServiceWorkLines(["Kreisā priekšējā lukturā spuldze", "Labā priekšējā lukturā spuldze"])).toHaveLength(2);
    expect(mergeOverlappingServiceWorkLines(["Front brake pads replaced", "Rear brake pads replaced"])).toHaveLength(2);
    expect(mergeOverlappingServiceWorkLines(["Bremsbeläge vorne erneuert", "Bremsbeläge hinten erneuert"])).toHaveLength(2);
    expect(mergeOverlappingServiceWorkLines(["Bremžu kluču maiņa", "Priekšējo bremžu kluču maiņa"])).toHaveLength(2);
  });

  it("identisks darbs ar pozīciju apvienojas vienā", () => {
    expect(mergeOverlappingServiceWorkLines(["Priekšējo bremžu kluču maiņa", "priekšējo  bremžu kluču maiņa"])).toEqual([
      "Priekšējo bremžu kluču maiņa",
    ]);
  });

  it("WDD2122931A366915 18.01.2017: dīlera rinda + papildu km rinda nezaudē priekšējos klučus", () => {
    const dealer = {
      date: "18.01.2017",
      odometer: "218348",
      location: LOC,
      works: "Motoreļļas un eļļas filtra maiņa\nPriekšējo bremžu kluču maiņa\nAizmugurējo bremžu kluču maiņa\nA apkope",
    };
    const extra = { date: "18.01.2017", odometer: "218348", location: "", works: "" };
    const merged = mergeAutoRecordsServiceWorksByOdometer([dealer, extra]);
    const row = merged.find((r) => r.date === "18.01.2017");
    expect(row?.works).toContain("Priekšējo bremžu kluču maiņa");
    expect(row?.works).toContain("Aizmugurējo bremžu kluču maiņa");

    const html = buildDealerServiceVisitsHtml([dealer], { extraMileageRows: [extra] });
    expect(html).toContain("Priekšējo bremžu kluču maiņa");
    expect(html).toContain("Aizmugurējo bremžu kluču maiņa");
  });
});
