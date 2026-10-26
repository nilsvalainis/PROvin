import { vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { describe, expect, it } from "vitest";
import { parseDzintarzemeTameBody } from "@/lib/dzintarzeme-tame-calculator";
import { generateDzintarzemeTamePdfBytes } from "@/lib/dzintarzeme-tame-pdf";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import { buildIrissPasutijumsPrintHtml } from "@/lib/iriss-pasutijums-pdf-html";
import {
  DZINTARZEME_OFFER_LOGO_PATH,
  DZINTARZEME_OFFER_PUBLIC_LOGO_PATH,
} from "@/components/iriss-offer-public/DzintarzemeOfferBrandLogo";
import {
  DZINTARZEME_AUTO_LOGO_FILENAME,
  DZINTARZEME_AUTO_LOGO_MD5,
  DZINTARZEME_AUTO_LOGO_PUBLIC_PATH,
} from "@/lib/dzintarzeme-logo";
import { dzintarzemeAutoLogoFsPath } from "@/lib/dzintarzeme-logo-fs";

describe("Dzintarzeme offer brand logo", () => {
  it("uses the byte-identical original PNG everywhere", () => {
    expect(DZINTARZEME_OFFER_LOGO_PATH).toBe(DZINTARZEME_AUTO_LOGO_PUBLIC_PATH);
    expect(DZINTARZEME_OFFER_PUBLIC_LOGO_PATH).toBe(DZINTARZEME_AUTO_LOGO_PUBLIC_PATH);
    const abs = dzintarzemeAutoLogoFsPath();
    expect(existsSync(abs)).toBe(true);
    expect(readFileSync(path.join(process.cwd(), "lib/dzintarzeme-logo.ts"), "utf8")).not.toContain("node:path");
    const buf = readFileSync(abs);
    const md5 = createHash("md5").update(buf).digest("hex");
    expect(md5).toBe(DZINTARZEME_AUTO_LOGO_MD5);
    expect(path.basename(abs)).toBe(DZINTARZEME_AUTO_LOGO_FILENAME);
    expect(existsSync(path.join(process.cwd(), "public", "brands", "dzintarzeme-iriss-offer-light.svg"))).toBe(
      false,
    );
    expect(existsSync(path.join(process.cwd(), "public", "brands", "dzintarzeme-iriss-offer-pdf-logo.png"))).toBe(
      false,
    );
  });

  it("writes PDF header artifacts when CAPTURE_DZ_LOGO_ARTIFACT=1", async () => {
    if (process.env.CAPTURE_DZ_LOGO_ARTIFACT !== "1") return;
    const outDir = "/opt/cursor/artifacts";
    mkdirSync(outDir, { recursive: true });

    const rec = emptyIrissPasutijums("11111111-1111-4111-8111-111111111111", "2026-10-17T10:00:00.000Z");
    rec.brandModel = "Audi A6 3.0 V6 TDI quattro";
    const html = buildIrissPasutijumsPrintHtml(rec, "2026.10.17", null);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 900, height: 400 } });
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.locator(".ipdf-header").screenshot({ path: path.join(outDir, "dzintarzeme-iriss-pdf-html-header.png") });

    const parsed = parseDzintarzemeTameBody({
      brandModel: "Audi A6 3.0 V6 TDI quattro",
      vin: "",
      autoPrice: 10_000,
      applyVatToAutoPrice: false,
      commissionVariant: "A",
      depositPercent: 20,
      commissionManualNet: 0,
      commissionManualPercent: 0,
      transportNet: 500,
      chemicalCleaningNet: 0,
      polishingNet: 0,
      paintingNet: 0,
      leasingValuationNet: 0,
      extraServices: [],
    });
    if (!parsed.ok) throw new Error(parsed.error);
    const pdfPath = path.join(outDir, "dzintarzeme-tame-sample.pdf");
    const pdfBytes = await generateDzintarzemeTamePdfBytes(parsed.value);
    writeFileSync(pdfPath, pdfBytes);
    const pdfPage = await browser.newPage({ viewport: { width: 900, height: 500 } });
    await pdfPage.goto(`file://${pdfPath}`, { waitUntil: "networkidle", timeout: 60_000 });
    await pdfPage.screenshot({ path: path.join(outDir, "dzintarzeme-tame-pdf-header.png"), clip: { x: 0, y: 0, width: 900, height: 220 } });
    await browser.close();
  }, 120_000);
});
