import { describe, expect, it } from "vitest";
import {
  BULK_VIN_MAX,
  capBulkVinTokens,
  classifyBulkVinTokens,
  isBulkVinFormatValid,
  isBulkVinOrderable,
  parseCsvFirstColumn,
  planBulkVinCredits,
  splitVinPaste,
  summarizeBulkVinKinds,
} from "@/lib/b2b-partner-bulk-vin";
import { iso3779CheckDigit } from "@/lib/vin-scan/vin-check";

function vin17(template17: string): string {
  const proto = `${template17.slice(0, 8)}0${template17.slice(9)}`.padEnd(17, "0").slice(0, 17);
  const digit = iso3779CheckDigit(proto);
  if (!digit) throw new Error("check digit");
  return `${proto.slice(0, 8)}${digit}${proto.slice(9)}`;
}

const VALID_A = vin17("WVWZZZ3HZHE703058");
const VALID_B = vin17("WVWZZZ1JZXW000001");
const VALID_C = vin17("TMBJF7NP0L7012345");

describe("bulk VIN parse", () => {
  it("splits paste by newline, comma and semicolon", () => {
    expect(splitVinPaste(` ${VALID_A}\n${VALID_B}, ${VALID_C} ; `)).toEqual([VALID_A, VALID_B, VALID_C]);
  });

  it("reads the first CSV column and skips a VIN header", () => {
    const csv = `VIN,model\n"${VALID_A}",Golf\n${VALID_B};Passat\n`;
    expect(parseCsvFirstColumn(csv)).toEqual([VALID_A, VALID_B]);
  });

  it("caps at 20 tokens", () => {
    const tokens = Array.from({ length: 25 }, (_, i) => `TOKEN${i}`);
    const capped = capBulkVinTokens(tokens);
    expect(capped.tokens).toHaveLength(BULK_VIN_MAX);
    expect(capped.truncated).toBe(true);
  });
});

describe("bulk VIN classify", () => {
  it("accepts only a 17-char VIN alphabet (check digit is not required)", () => {
    expect(isBulkVinFormatValid(VALID_A)).toBe(true);
    expect(isBulkVinFormatValid("WVWZZZ3HZHE70")).toBe(false);
    expect(isBulkVinFormatValid("SHORT")).toBe(false);
    expect(isBulkVinFormatValid("WVWZZZ3HIHE703058")).toBe(false);
  });

  it("marks short or illegal-alphabet VIN as invalid with character count", () => {
    const { rows } = classifyBulkVinTokens(["ABC", "WVWZZZ3HQHE703058", "W0VZCYHZXN684325"]);
    expect(rows[0]).toMatchObject({ kind: "invalid", charCount: 3, vin: "ABC" });
    expect(rows[1]?.kind).toBe("invalid");
    expect(rows[1]?.charCount).toBe(17);
    expect(rows[2]).toMatchObject({ kind: "invalid", charCount: 16 });
  });

  it("marks the second same VIN as a list duplicate", () => {
    const { rows } = classifyBulkVinTokens([VALID_A, VALID_A.toLowerCase(), VALID_B]);
    expect(rows.map((row) => row.kind)).toEqual(["valid", "duplicate", "valid"]);
  });

  it("marks already ordered VINs from the lookup map", () => {
    const already = new Map([
      [VALID_A, { id: "ord_1", created: Date.parse("2026-03-15T12:00:00+02:00") / 1000, reportReady: true }],
    ]);
    const { rows } = classifyBulkVinTokens([VALID_A, VALID_B], already);
    expect(rows[0]?.kind).toBe("already_ordered");
    expect(rows[0]?.alreadyOrderedLabel).toBe("15.03");
    expect(rows[0]?.reportHref).toBe("/api/partner/report/ord_1");
    expect(rows[1]?.kind).toBe("valid");
  });

  it("counts orderable rows including explicit reorder", () => {
    const rows = [
      { kind: "valid" as const },
      { kind: "invalid" as const },
      { kind: "duplicate" as const },
      { kind: "already_ordered" as const, reorder: false },
      { kind: "already_ordered" as const, reorder: true },
    ];
    expect(summarizeBulkVinKinds(rows)).toEqual({
      valid: 1,
      invalid: 1,
      duplicate: 1,
      alreadyOrdered: 2,
      orderable: 2,
    });
    expect(isBulkVinOrderable({ kind: "already_ordered", reorder: true })).toBe(true);
    expect(isBulkVinOrderable({ kind: "already_ordered" })).toBe(false);
  });

  it("plans credits without going negative and reports shortfall", () => {
    expect(planBulkVinCredits(5, 3)).toEqual({ used: 3, from: 5, to: 2, shortfall: 0, canOrder: true });
    expect(planBulkVinCredits(2, 5)).toEqual({ used: 5, from: 2, to: 2, shortfall: 3, canOrder: false });
    expect(planBulkVinCredits(4, 0)).toEqual({ used: 0, from: 4, to: 4, shortfall: 0, canOrder: false });
  });
});
