import { describe, expect, it } from "vitest";
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildOrganizationJsonLd,
  buildServiceOffersJsonLd,
  parseLegalPostalAddress,
} from "@/lib/seo-json-ld";
import { PUBLIC_SERVICE_OFFERS } from "@/lib/seo-offers";

describe("seo json-ld", () => {
  it("parses the Tukums legal address into PostalAddress", () => {
    const addr = parseLegalPostalAddress("Jana iela 3, Tukums, LV3101, Latvija");
    expect(addr).toMatchObject({
      "@type": "PostalAddress",
      streetAddress: "Jana iela 3",
      addressLocality: "Tukums",
      postalCode: "LV-3101",
      addressCountry: "LV",
    });
  });

  it("builds Organization with contact and sameAs, without private legal details", () => {
    const org = buildOrganizationJsonLd("lv", "VIN koda pārbaude");
    expect(org["@type"]).toBe("Organization");
    expect(org).not.toHaveProperty("legalName");
    expect(org).not.toHaveProperty("address");
    expect(JSON.stringify(org)).not.toMatch(/Valainis|09118711109|Jana iela/);
    expect(org).not.toHaveProperty("telephone");
    expect(org.email).toBeTruthy();
    expect(org.sameAs.length).toBeGreaterThan(0);
  });

  it("emits priced Service offers for the public plans (MINI hidden)", () => {
    const list = buildServiceOffersJsonLd(
      "lv",
      { mini: "MINI", audits: "AUDITS", dealer: "DĪLERIS" },
      { mini: "a", audits: "b", dealer: "c" },
    );
    expect(list.itemListElement).toHaveLength(PUBLIC_SERVICE_OFFERS.length);
    const prices = list.itemListElement.map((row) => row.item.offers.price);
    expect(prices).toEqual(["99.99", "24.99"]);
  });

  it("builds FAQPage and breadcrumbs without locale-less URLs", () => {
    const faq = buildFaqPageJsonLd("en", "/biezi-jautajumi", [{ q: "Q", a: "A" }]);
    expect(faq.url).toContain("/en/biezi-jautajumi");
    expect(faq.mainEntity[0]).toMatchObject({ "@type": "Question", name: "Q" });
    const crumbs = buildBreadcrumbJsonLd("lv", [
      { name: "Sākums", path: "/" },
      { name: "BUJ", path: "/biezi-jautajumi" },
    ]);
    expect(crumbs.itemListElement[1]?.item).toContain("/lv/biezi-jautajumi");
  });
});
