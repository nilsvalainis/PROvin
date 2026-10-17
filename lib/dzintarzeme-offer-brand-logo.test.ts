import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DZINTARZEME_OFFER_LOGO_PATH,
} from "@/components/iriss-offer-public/DzintarzemeOfferBrandLogo";

describe("Dzintarzeme offer brand logo", () => {
  it("points at the public asset used by PDF and /p/[token]", () => {
    expect(DZINTARZEME_OFFER_LOGO_PATH).toBe("/brands/dzintarzeme-iriss-offer-pdf-logo.png");
    const abs = path.join(process.cwd(), "public", "brands", "dzintarzeme-iriss-offer-pdf-logo.png");
    expect(existsSync(abs)).toBe(true);
  });
});
