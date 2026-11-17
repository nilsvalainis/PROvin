import { describe, expect, it } from "vitest";
import { CheckoutFields } from "@/components/test-pricing-5/Tp5MobilePricingCard";
import { renderHtml } from "@/lib/test-render";

const copy = { vinPlaceholder: "Ievadi VIN kodu", vinAria: "VIN", listingPlaceholder: "Saite", listingAria: "Sludinājums" } as never;

/** FABLE v3 F6: kļūda bija tikai vizuāla - ievadei nebija aria-invalid / aria-describedby. */
describe("pasūtījuma lauku kļūdas pieejamas ekrāna lasītājam", () => {
  it("ar kļūdu: aria-invalid un aria-describedby uz kļūdas tekstu", () => {
    const html = renderHtml(
      <CheckoutFields vin="" listingUrl="" errors={{ vin: "Ievadi derīgu VIN" }} uiCopy={copy} onVinChange={() => {}} onListingUrlChange={() => {}} />,
    );
    const id = /aria-describedby="([^"]+)"/.exec(html)?.[1];
    expect(html).toContain('aria-invalid="true"');
    expect(id).toBeTruthy();
    expect(html).toContain(`id="${id}"`);
  });
  it("bez kļūdas: nav aria-invalid", () => {
    const html = renderHtml(
      <CheckoutFields vin="" listingUrl="" errors={{}} uiCopy={copy} onVinChange={() => {}} onListingUrlChange={() => {}} />,
    );
    expect(html).not.toContain("aria-invalid");
  });
});
