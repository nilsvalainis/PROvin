import { describe, expect, it } from "vitest";
describe("faktiskais finansējuma % (QA 29.10)", () => {
  it("vecais ķeksītis 100 % dod 100, ja procents nav ievadīts", async () => {
    const { irissEffectiveClientFinancingPercent } = await import("@/lib/iriss-client-financing");
    expect(irissEffectiveClientFinancingPercent({ clientFinancingPercent: 0, dealClientFinancing100: true })).toBe(100);
    expect(irissEffectiveClientFinancingPercent({ clientFinancingPercent: 0, dealClientFinancing20: true })).toBe(20);
    expect(irissEffectiveClientFinancingPercent({ clientFinancingPercent: 50, dealClientFinancing100: true })).toBe(50);
    expect(irissEffectiveClientFinancingPercent({ clientFinancingPercent: 0 })).toBe(0);
  });
});
