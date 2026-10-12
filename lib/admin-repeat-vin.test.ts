import { describe, expect, it } from "vitest";
import { countRepeatVins } from "./admin-repeat-vin";

describe("countRepeatVins", () => {
  it("skaita citus darbus ar to pašu VIN (bez sevis)", () => {
    const vin = "WVWZZZ1KZAW000001";
    const pool = [
      { id: "a", vins: [vin] },
      { id: "b", vins: [vin.toLowerCase()] },
      { id: "qe:1", vins: [vin] },
      { id: "c", vins: ["WVWZZZ1KZAW999999"] },
    ];
    const r = countRepeatVins([{ id: "a", vins: [vin] }, { id: "c", vins: ["WVWZZZ1KZAW999999"] }, { id: "x", vins: [null] }], pool);
    expect(r.get("a")).toBe(2);
    expect(r.has("c")).toBe(false);
    expect(r.has("x")).toBe(false);
  });
});
