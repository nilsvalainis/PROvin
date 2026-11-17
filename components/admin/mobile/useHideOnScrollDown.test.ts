import { describe, expect, it } from "vitest";
import { nextDockHidden } from "@/components/admin/mobile/useHideOnScrollDown";

const page = { viewport: 844, height: 3000 };

describe("telefona josla, variants A", () => {
  it("ritinot uz leju paslēpjas, uz augšu parādās", () => {
    expect(nextDockHidden(false, { ...page, y: 400, lastY: 300 })).toBe(true);
    expect(nextDockHidden(true, { ...page, y: 380, lastY: 400 })).toBe(false);
  });

  it("mazas kustības stāvokli nemaina", () => {
    expect(nextDockHidden(true, { ...page, y: 402, lastY: 400 })).toBe(true);
    expect(nextDockHidden(false, { ...page, y: 398, lastY: 400 })).toBe(false);
  });

  it("lapas augšā un lapas galā vienmēr redzama (apakšējā poga nav aizsegta)", () => {
    expect(nextDockHidden(true, { ...page, y: 10, lastY: 0 })).toBe(false);
    expect(nextDockHidden(true, { ...page, y: 2160, lastY: 2100 })).toBe(false);
  });
});
