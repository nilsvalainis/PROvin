import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DZINTARZEME_OFFER_LOGO_PATH,
  DZINTARZEME_OFFER_PUBLIC_LOGO_PATH,
} from "@/components/iriss-offer-public/DzintarzemeOfferBrandLogo";

describe("Dzintarzeme offer brand logo", () => {
  it("points at the public asset used by PDF and /p/[token]", () => {
    expect(DZINTARZEME_OFFER_LOGO_PATH).toBe("/brands/dzintarzeme-iriss-offer-pdf-logo.png");
    const abs = path.join(process.cwd(), "public", "brands", "dzintarzeme-iriss-offer-pdf-logo.png");
    expect(existsSync(abs)).toBe(true);
    expect(DZINTARZEME_OFFER_PUBLIC_LOGO_PATH).toBe("/brands/dzintarzeme-iriss-offer-light.svg");
    const lightAbs = path.join(process.cwd(), "public", "brands", "dzintarzeme-iriss-offer-light.svg");
    expect(existsSync(lightAbs)).toBe(true);
  });
});
