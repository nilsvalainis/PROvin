import { describe, expect, it } from "vitest";

import { cookiesRecordToHeader, isCloudflareChallengeHtml, mergeCookieHeader } from "@/lib/vin-sources/html-extract";
import { parseCarinfoSearchBody, parseCarinfoSuperSearch } from "@/lib/vin-sources/carinfo-search";

describe("parseCarinfoSuperSearch", () => {
  it("ņem ident saiti no hits_html", () => {
    const hit = parseCarinfoSuperSearch(
      {
        hits: {
          idents: [
            {
              license_code: "DK",
              country: "DK",
              vin: "VF12RFL1H49621453",
              secondary_name_blurred: "Demo, 000hp",
            },
          ],
        },
        hits_html:
          '<a href="https:\\/\\/www.car.info\\/en-dk\\/vin\\/DK\\/VF12RFL1H49621453"><span class="plate-text">AB12345</span>',
      },
      "VF12RFL1H49621453",
    );
    expect(hit?.href).toBe("https://www.car.info/en-dk/vin/DK/VF12RFL1H49621453");
    expect(hit?.country).toBe("DK");
  });

  it("relatīvu ident href padara par pilnu car.info saiti", () => {
    const hit = parseCarinfoSuperSearch(
      {
        hits: { idents: [{ country: "S", vin: "WVWZZZ3CZWE123456" }] },
        hits_html: '<a href="/en-se/vin/S/WVWZZZ3CZWE123456">',
      },
      "WVWZZZ3CZWE123456",
    );
    expect(hit?.href).toBe("https://www.car.info/en-se/vin/S/WVWZZZ3CZWE123456");
    expect(hit?.country).toBe("S");
  });

  it("tukšs rezultāts paliek null", () => {
    expect(
      parseCarinfoSuperSearch(
        { hits: { idents: [], cars: [] }, hits_html: "\n    " },
        "WBA5R1C0XLFH42873",
      ),
    ).toBeNull();
  });
});

describe("parseCarinfoSearchBody", () => {
  it("JSON ķermeni pārvērš ident hitā", () => {
    const hit = parseCarinfoSearchBody(
      JSON.stringify({
        hits: { idents: [{ country: "SE", vin: "WVWZZZ3CZWE123456" }] },
        hits_html: "",
      }),
      "WVWZZZ3CZWE123456",
    );
    expect(hit?.href).toBe("https://www.car.info/en-se/vin/S/WVWZZZ3CZWE123456");
  });

  it("Cloudflare HTML nav JSON", () => {
    expect(parseCarinfoSearchBody("<title>Just a moment...</title>", "WVWZZZ3CZWE123456")).toBeNull();
  });
});

describe("isCloudflareChallengeHtml", () => {
  it("atpazīst Just a moment", () => {
    expect(isCloudflareChallengeHtml("<title>Just a moment...</title>", 403)).toBe(true);
    expect(isCloudflareChallengeHtml("<html><title>Car.info</title></html>", 200)).toBe(false);
  });
});

describe("cookiesRecordToHeader", () => {
  it("saliek cf_clearance ar esošajām sīkdatnēm", () => {
    const fromSolver = cookiesRecordToHeader({ cf_clearance: "cf-1", unused: "" });
    expect(mergeCookieHeader("session=a", fromSolver)).toBe("session=a; cf_clearance=cf-1");
  });
});
