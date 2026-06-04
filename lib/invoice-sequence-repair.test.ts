import { describe, expect, it } from "vitest";
import {
  formatPrvInvoiceNumber,
  parsePrvInvoiceSequence,
} from "@/lib/invoice-number-format";

describe("formatPrvInvoiceNumber", () => {
  it("pads sequence to four digits", () => {
    expect(formatPrvInvoiceNumber(2026, 1)).toBe("PRV-2026-0001");
    expect(formatPrvInvoiceNumber(2026, 42)).toBe("PRV-2026-0042");
  });
});

describe("parsePrvInvoiceSequence", () => {
  it("parses matching year", () => {
    expect(parsePrvInvoiceSequence("PRV-2026-0007", 2026)).toBe(7);
  });

  it("rejects wrong year", () => {
    expect(parsePrvInvoiceSequence("PRV-2025-0007", 2026)).toBeNull();
  });
});
