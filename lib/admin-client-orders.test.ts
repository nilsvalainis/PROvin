import { describe, expect, it } from "vitest";
import { previousOrdersByEmail } from "./admin-client-orders";

describe("previousOrdersByEmail", () => {
  it("atrod citus pasūtījumus ar to pašu e-pastu (reģistrnejutīgi), jaunākie augšā", () => {
    const pool = [
      { id: "a", created: 1, customerEmail: "X@y.lv", vin: "V1", amountTotal: 100, currency: "eur" },
      { id: "b", created: 3, customerEmail: "x@y.lv ", vin: "V2", amountTotal: 200, currency: "eur" },
      { id: "c", created: 2, customerEmail: "x@y.lv", vin: null, amountTotal: null, currency: null },
      { id: "d", created: 2, customerEmail: "", vin: null, amountTotal: null, currency: null },
    ];
    const r = previousOrdersByEmail([pool[0]!, pool[3]!], pool);
    expect(r.get("a")?.map((x) => x.id)).toEqual(["b", "c"]);
    expect(r.has("d")).toBe(false);
  });
});
