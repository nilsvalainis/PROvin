import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { operatorOrderConfigured, verifyOperatorOrderKey } from "@/lib/operator-order-auth";

describe("operator-order-auth", () => {
  const prev = process.env.OPERATOR_ORDER_SECRET;

  beforeEach(() => {
    process.env.OPERATOR_ORDER_SECRET = "test-operator-secret-16";
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.OPERATOR_ORDER_SECRET;
    else process.env.OPERATOR_ORDER_SECRET = prev;
  });

  it("configured when secret is long enough", () => {
    expect(operatorOrderConfigured()).toBe(true);
  });

  it("rejects short secrets", () => {
    process.env.OPERATOR_ORDER_SECRET = "short";
    expect(operatorOrderConfigured()).toBe(false);
    expect(verifyOperatorOrderKey("short")).toBe(false);
  });

  it("verifies matching key with timing-safe compare", () => {
    expect(verifyOperatorOrderKey("test-operator-secret-16")).toBe(true);
    expect(verifyOperatorOrderKey("wrong-key-value-16")).toBe(false);
    expect(verifyOperatorOrderKey("")).toBe(false);
  });
});
