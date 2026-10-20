import { describe, expect, it } from "vitest";
import {
  formatIrissLoadConfirmButton,
  formatIrissLoadEstimateLine,
  formatIrissLoadMonthSpent,
  irissMarketplaceLoadTone,
} from "@/lib/iriss-marketplace-load-view";

describe("iriss marketplace load view", () => {
  it("formats spend, estimate and priority tones", () => {
    expect(formatIrissLoadMonthSpent("2026-10", 0.01, 4.5)).toBe("Oktobrī 0,01 / 4,50 $");
    expect(formatIrissLoadEstimateLine(0.02, 0.25)).toBe("Aplēse ~0,02 $ · griesti 0,25 $ ielādei");
    expect(formatIrissLoadConfirmButton(0.02)).toBe("Ielādēt par ~0,02 $");
    expect(irissMarketplaceLoadTone({
      loadsOff: true,
      missing: true,
      overLimit: true,
      warning80: true,
      busy: false,
      done: false,
      error: false,
    })).toBe("off");
    expect(irissMarketplaceLoadTone({
      loadsOff: false,
      missing: true,
      overLimit: false,
      warning80: false,
      busy: false,
      done: false,
      error: false,
    })).toBe("missing");
    expect(irissMarketplaceLoadTone({
      loadsOff: false,
      missing: false,
      overLimit: false,
      warning80: true,
      busy: false,
      done: false,
      error: false,
    })).toBe("warn");
  });
});
