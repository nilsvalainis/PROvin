import { describe, expect, it } from "vitest";
import {
  buildIrissOfferClientShareBody,
  buildIrissOfferShareSubject,
  irissOfferImagesOmittedNotice,
} from "@/lib/iriss-offer-share";

const draft = { brandModel: "BMW 320d", firstRegistration: "2018", year: "2018" };

describe("IRISS offer share copy", () => {
  it("uses the Dzintarzeme Auto brand and does not mention PROVIN.LV", () => {
    const subject = buildIrissOfferShareSubject(draft);
    const body = buildIrissOfferClientShareBody(draft, "Anna", "Bērziņa", "piedavajums.pdf");
    expect(subject.startsWith("Dzintarzeme Auto: piedāvājums")).toBe(true);
    expect(subject).toContain("BMW 320d");
    expect(body).toContain("Dzintarzeme Auto");
    expect(subject).not.toContain("PROVIN");
    expect(body).not.toContain("PROVIN");
    expect(subject).not.toContain("\u2014");
    expect(body).not.toContain("\u2014");
  });

  it("names omitted images instead of staying silent", () => {
    expect(irissOfferImagesOmittedNotice(0)).toBe("");
    expect(irissOfferImagesOmittedNotice(1)).toContain("viens attēls");
    expect(irissOfferImagesOmittedNotice(3)).toContain("3 attēli");
  });
});