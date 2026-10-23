import { describe, expect, it } from "vitest";
import { waybillPageOpensAtTop } from "@/components/admin/useWaybillPageOpenAtTop";

describe("j13: Pavadzīmes lapa atveras augšā", () => {
  it("parasti - augšā; saite uz konkrētu pavadzīmi (?wb=) - rāda to", () => {
    expect(waybillPageOpensAtTop("")).toBe(true);
    expect(waybillPageOpensAtTop("?view=archive")).toBe(true);
    expect(waybillPageOpensAtTop("?wb=")).toBe(true);
    expect(waybillPageOpensAtTop("?wb=abc_123")).toBe(false);
  });
});
