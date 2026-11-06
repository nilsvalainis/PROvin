import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { IrissListingCardActions } from "@/components/admin/IrissListingCardActions";
import { IrissListingOrderChips } from "@/components/admin/IrissListingOrderChips";
import { IrissScanCriteriaCard } from "@/components/admin/IrissScanCriteriaCard";
import {
  irissListingCardContext,
  irissListingSalonHref,
  irissLogistikaPurchasePrefill,
} from "@/lib/iriss-listing-card-actions";
import { irissScanOrderBrief } from "@/lib/iriss-scan-listings";
import type { IrissListingVehicle } from "@/lib/iriss-listings-types";
import { applyIrissScanNameSuggestion, suggestIrissScanCriteriaFromName } from "@/lib/iriss-scan-criteria";
import { emptyIrissScanRecord } from "@/lib/iriss-scan-types";
import { renderHtml, renderText } from "@/lib/test-render";

const v = {
  id: "car-1",
  platform: "autobid",
  title: "Audi A4 Avant 2.0 TDI",
  manufacturer: "Audi",
  detailUrl: "https://autobid.de/item/123",
  mileageKm: 182000,
  vin: "WAUZZZ8K9BA123456",
} as IrissListingVehicle;

const noop = () => undefined;

describe("kartītes konteksts", () => {
  it("tikai Radari -> radar, ir klients -> order, nekas -> none", () => {
    expect(irissListingCardContext(["scan:a", "scan:b"])).toBe("radar");
    expect(irissListingCardContext(["scan:a", "ord-1"])).toBe("order");
    expect(irissListingCardContext([])).toBe("none");
  });

  it("Radara kartītē nav «Pasūtījuma detaļas» un «Nosūtīt klientam»; ir Meklējuma detaļas, piedāvājums, Pievienot salonam", () => {
    const text = renderText(
      createElement(IrissListingCardActions, { v, context: "radar", onPreviewDetails: noop, onCreateOffer: noop, onCreateRadar: noop }),
    );
    expect(text).not.toContain("Pasūtījuma detaļas");
    expect(text).not.toContain("Nosūtīt klientam");
    expect(text).toContain("Meklējuma detaļas");
    expect(text).toContain("Izveidot piedāvājumu");
    expect(text).toContain("Pievienot salonam");
  });

  it("klienta kartītē paliek kā bija (bez salona pogas)", () => {
    const html = renderHtml(createElement(IrissListingCardActions, { v, onPreviewDetails: noop, onCreateOffer: noop }));
    expect(html).toContain("Pasūtījuma detaļas");
    expect(html).not.toContain("Pievienot salonam");
  });

  it("piesaistes čips Radaram rāda Meklējuma detaļas", () => {
    const scanBrief = irissScanOrderBrief({ ...emptyIrissScanRecord("x", "t"), brandModel: "Audi radars" });
    const orderBrief = { ...scanBrief, id: "ord-1", clientName: "Jānis", brief: "" };
    const text = renderText(createElement(IrissListingOrderChips, { orders: [scanBrief, orderBrief], onPreview: noop }));
    expect(text).toContain("Meklējuma detaļas");
    expect(text).toContain("Pasūtījuma detaļas");
  });
});

describe("Pievienot salonam -> Loģistika «Nopirkts»", () => {
  it("saite nes auto datus; Loģistika tos nolasa tikai ar nopirkts=1", () => {
    const href = irissListingSalonHref(v);
    expect(href.startsWith("/admin/iriss/logistika?")).toBe(true);
    const params = new URL(href, "https://x.test").searchParams;
    expect(irissLogistikaPurchasePrefill(params)).toEqual({
      source: "auction",
      auction: "Autobid",
      link: "https://autobid.de/item/123",
      make: "Audi",
      model: "A4 Avant 2.0 TDI",
      km: "182000",
      vin: "WAUZZZ8K9BA123456",
    });
    expect(irissLogistikaPurchasePrefill(new URLSearchParams("saite=https://a.b"))).toBeNull();
  });

  it("mobile.de -> privāts; nedroša saite un VIN netiek pārņemti", () => {
    const href = irissListingSalonHref({ ...v, platform: "mobilede", vin: "bad" });
    const p = irissLogistikaPurchasePrefill(new URL(href, "https://x.test").searchParams)!;
    expect(p.source).toBe("private");
    expect(p.vin).toBe("");
    const evil = irissLogistikaPurchasePrefill(new URLSearchParams("nopirkts=1&saite=javascript:alert(1)"))!;
    expect(evil.link).toBe("");
  });
});

describe("Radara kritēriju kartīte", () => {
  const name = "Audi 2.0D manuālis 2009-2015, 150-330k, 3000-12000 EUR";

  it("vecam Radaram rāda ieteikumu no nosaukuma, lauki tukši", () => {
    const html = renderHtml(createElement(IrissScanCriteriaCard, { rec: { ...emptyIrissScanRecord("s", "t"), brandModel: name }, onChange: noop }));
    expect(html).toContain("Ieteikums no nosaukuma");
    expect(html).toContain("Saglabāt kritērijus");
    expect(html).toContain("Gadi: 2009-2015");
  });

  it("pēc saglabāšanas ieteikuma vairs nav, lauki aizpildīti", () => {
    const base = { ...emptyIrissScanRecord("s", "t"), brandModel: name };
    const rec = applyIrissScanNameSuggestion(base, suggestIrissScanCriteriaFromName(name)!);
    const html = renderHtml(createElement(IrissScanCriteriaCard, { rec, onChange: noop }));
    expect(html).not.toContain("Ieteikums no nosaukuma");
    expect(html).toContain('value="2009"');
    expect(html).toContain('value="330000"');
    expect(html).toContain('value="12000"');
    expect(html).toContain("Filtrē tāpat kā pasūtījumā");
  });
});
