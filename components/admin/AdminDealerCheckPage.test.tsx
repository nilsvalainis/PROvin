import { describe, expect, it } from "vitest";
import { AdminDealerCheckPage } from "@/components/admin/AdminDealerCheckPage";
import { dealerCheckEmptyStateText, dealerCheckPageHref, DEALER_CHECK_PAGE_PATH } from "@/lib/dealer-check";
import { renderHtml, renderText } from "@/lib/test-render";

describe("AdminDealerCheckPage", () => {
  it("sākumā avoti ir izslēgti, Ielādēt neaktīvs, rezultātu nav", () => {
    const html = renderHtml(<AdminDealerCheckPage initialVin="" />);
    const text = renderText(<AdminDealerCheckPage initialVin="" />);
    expect(text).toContain("Dīlera datu pārbaude");
    expect(text).toContain("noklusējumā visi izslēgti");
    expect(text).toContain("VIN Decoder");
    expect(text).toContain("OE Service History");
    expect(text).not.toMatch(/speckr/i);
    expect(html).toContain("disabled");
    expect(text).toContain(dealerCheckEmptyStateText());
    expect(text).not.toContain("Gemini: Servisa vēsture");
    expect(text).not.toContain("CSDD salīdzinājums");
  });

  it("Autoparks deep-link atstāj avotus izslēgtus un rāda VIN", () => {
    const vin = "WVWZZZ3CZKE012345";
    const html = renderHtml(<AdminDealerCheckPage initialVin={vin} fromAutoparks />);
    const text = renderText(<AdminDealerCheckPage initialVin={vin} fromAutoparks />);
    expect(html).toContain(`value="${vin}"`);
    expect(text).toContain("VIN iekopēts no Autoparks");
    expect(text).toContain("Avoti paliek izslēgti");
    expect(text).toContain("noklusējumā visi izslēgti");
    expect(html).toContain("disabled");
    expect(dealerCheckPageHref({ vin, from: "autoparks" })).toBe(
      `${DEALER_CHECK_PAGE_PATH}?vin=${vin}&no=autoparks`,
    );
  });
});
