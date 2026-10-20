import { describe, expect, it } from "vitest";
import { rigaLocalToUtc } from "@/lib/iriss-pavadzimes-parse";
import { selectActiveIrissPavadzimes } from "@/lib/iriss-pavadzimes-active";

function row(partial: {
  number: string;
  plate: string;
  validUntil: Date | string;
  issuedAt?: Date | string;
}) {
  return {
    number: partial.number,
    plate: partial.plate,
    brandModel: partial.number,
    validUntil: typeof partial.validUntil === "string" ? partial.validUntil : partial.validUntil.toISOString(),
    issuedAt: partial.issuedAt
      ? typeof partial.issuedAt === "string"
        ? partial.issuedAt
        : partial.issuedAt.toISOString()
      : "",
  };
}

describe("selectActiveIrissPavadzimes", () => {
  const now = rigaLocalToUtc(2026, 10, 14, 12, 0)!;

  it("ņem vienu pašreizējo pavadzīmi uz katru dīlera nr.", () => {
    const rows = [
      row({ number: "P01000", plate: "B193-7", validUntil: rigaLocalToUtc(2026, 9, 1, 12, 0)! }),
      row({ number: "P02787", plate: "B193-7", validUntil: rigaLocalToUtc(2026, 10, 14, 15, 59)! }),
      row({ number: "P02700", plate: "B762-7", validUntil: rigaLocalToUtc(2026, 10, 16, 10, 0)! }),
      row({ number: "P02515", plate: "B192-7", validUntil: rigaLocalToUtc(2026, 10, 13, 12, 0)! }),
    ];
    expect(selectActiveIrissPavadzimes(rows, now).map((r) => r.number)).toEqual(["P02515", "P02787", "P02700"]);
  });

  it("atmet sen beigušos numurus, atstāj nesen beigušos", () => {
    const rows = [
      row({ number: "P00100", plate: "B100-7", validUntil: rigaLocalToUtc(2025, 1, 1, 12, 0)! }),
      row({ number: "P02787", plate: "B193-7", validUntil: rigaLocalToUtc(2026, 10, 14, 15, 59)! }),
    ];
    expect(selectActiveIrissPavadzimes(rows, now).map((r) => r.number)).toEqual(["P02787"]);
  });

  it("kārto pēc numura zīmes", () => {
    const rows = [
      row({ number: "P3", plate: "B192-7", validUntil: rigaLocalToUtc(2026, 10, 20, 12, 0)! }),
      row({ number: "P1", plate: "B193-7", validUntil: rigaLocalToUtc(2026, 10, 20, 12, 0)! }),
      row({ number: "P2", plate: "B762-7", validUntil: rigaLocalToUtc(2026, 10, 20, 12, 0)! }),
    ];
    expect(selectActiveIrissPavadzimes(rows, now).map((r) => r.plate)).toEqual(["B192-7", "B193-7", "B762-7"]);
  });
});
