import { describe, expect, it } from "vitest";
import { atraCardSpan, atraWideCols } from "@/components/admin/AdminAtraParbaudeFacts";

/** Katrai rindai summa = 12 (bez caurumiem). */
function rows(n: number, cols: number): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const s = atraCardSpan(i, n, cols);
    cur.push(s);
    sum += s;
    if (sum === 12) {
      out.push(cur);
      cur = [];
      sum = 0;
    }
  }
  expect(cur).toEqual([]);
  return out;
}

describe("Ātrās pārbaudes režģis", () => {
  it("kolonnas pēc skaita", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(atraWideCols)).toEqual([1, 2, 3, 4, 3, 3, 4, 4]);
  });

  it("katra rinda pilna 1-8 kartītēm (dators, 2 kolonnas, telefons)", () => {
    for (let n = 1; n <= 8; n++) {
      rows(n, atraWideCols(n));
      rows(n, 2);
    }
    expect(rows(5, 3)).toEqual([[4, 4, 4], [6, 6]]);
    expect(rows(7, 4)).toEqual([[3, 3, 3, 3], [4, 4, 4]]);
    expect(rows(3, 2)).toEqual([[6, 6], [12]]);
  });
});
