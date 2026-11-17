import { describe, expect, it } from "vitest";
import { batchPages } from "./scan-upload";

describe("skenējuma sadalīšana daļās (Vercel 4 MB)", () => {
  it("dala pēc baitiem un lapu skaita", () => {
    expect(batchPages([1_000_000, 1_000_000, 1_000_000, 1_000_000])).toEqual([[0, 1, 2], [3]]);
    expect(batchPages(Array(12).fill(100_000))).toEqual([[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [10, 11]]);
    expect(batchPages([5_000_000])).toEqual([[0]]);
  });
});
