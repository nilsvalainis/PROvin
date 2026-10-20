import { describe, expect, it } from "vitest";

import { extractAutodnaOrderId } from "@/lib/autodna-purchase";

describe("extractAutodnaOrderId", () => {
  it("finds orderId in nested autoDNA JSON", () => {
    expect(extractAutodnaOrderId({ data: { orderId: "ord_abc123" } })).toBe("ord_abc123");
    expect(extractAutodnaOrderId({ order_id: "ORD-99aa" })).toBe("ORD-99aa");
    expect(extractAutodnaOrderId({ id: "x" })).toBeNull();
  });
});
