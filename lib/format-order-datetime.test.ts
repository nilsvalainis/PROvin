import { describe, expect, it } from "vitest";
import { formatOrderTimestampSec } from "@/lib/format-order-datetime";
import { formatMoneyEur } from "@/lib/format-money";

describe("formatOrderTimestampSec", () => {
  it("formats valid unix seconds", () => {
    const s = formatOrderTimestampSec(1_700_000_000);
    expect(s).not.toBe("—");
    expect(s.length).toBeGreaterThan(4);
  });

  it("returns em dash for invalid timestamps", () => {
    expect(formatOrderTimestampSec(NaN)).toBe("—");
    expect(formatOrderTimestampSec(Infinity)).toBe("—");
    expect(formatOrderTimestampSec(-1)).toBe("—");
    expect(formatOrderTimestampSec(0)).toBe("—");
    expect(formatOrderTimestampSec(null)).toBe("—");
    expect(formatOrderTimestampSec("1700000000")).toBe("—");
  });
});

describe("formatMoneyEur", () => {
  it("formats valid cents", () => {
    const s = formatMoneyEur(7999, "EUR");
    expect(s).toMatch(/79/);
  });

  it("returns em dash for invalid amounts", () => {
    expect(formatMoneyEur(NaN, "EUR")).toBe("—");
    expect(formatMoneyEur(Infinity, "EUR")).toBe("—");
    expect(formatMoneyEur(null, "EUR")).toBe("—");
    expect(formatMoneyEur(undefined, "EUR")).toBe("—");
  });
});
