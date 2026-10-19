import { afterEach, describe, expect, it, vi } from "vitest";

const scanFetch = vi.fn();
const applyVinScanRelayIfBlocked = vi.fn();
const applyCarinfoSuperSearchHttp = vi.fn();

vi.mock("server-only", () => ({}));

vi.mock("@/lib/vin-scan/http", () => ({
  scanFetch: (...args: unknown[]) => scanFetch(...args),
  scanFetchSmart: vi.fn(),
  scanChallengeReason: () => "",
  scanCaptchaTokenPlaceholder: () => "",
  solveScanRecaptcha: async () => null,
}));

vi.mock("@/lib/vin-scan/listings-page-relay", () => ({
  applyVinScanRelayIfBlocked: (...args: unknown[]) => applyVinScanRelayIfBlocked(...args),
  applyCarinfoSuperSearchHttp: (...args: unknown[]) => applyCarinfoSuperSearchHttp(...args),
  isCarinfoSuperSearchUrl: (url: string) => String(url).includes("/search/super/"),
}));

import { emptyVinScanPlates } from "@/lib/vin-scan/plates";
import { probeCarinfo } from "@/lib/vin-scan/probes";

const VIN = "WVWZZZ7NZEV015204";
const DK_PAGE = `https://www.car.info/en-dk/vin/DK/${VIN}`;

/** Saīsināts pēc car.info VIN lapas, ko super-search atrod ārpus Zviedrijas. */
const SHARAN_HTML = `
<html><body>
<p>AB12345 is a Volkswagen Sharan from 2014.</p>
<dl>
<dt>In Traffic</dt><dd>Yes</dd>
<dt>Number of Owners</dt><dd>2</dd>
<dt>Mileage</dt><dd>120,000 km</dd>
</dl>
<table>
<tr><th>Reported odometer readings</th><th></th></tr>
<tr><td>Inspection 120,000 km</td><td>2024-06-01</td></tr>
</table>
</body></html>
`;

const EMPTY_SHELL = "<html><body><p>car.info</p><p>Search</p></body></html>";
const BLOCKED = "<html><title>403 Forbidden</title></html>";

function ctx() {
  return { vin: VIN, plates: emptyVinScanPlates(), listingUrl: "" };
}

const EMPTY_SUPER = JSON.stringify({ hits: { idents: [] }, hits_html: "" });

describe("probeCarinfo releja super-search", () => {
  afterEach(() => {
    scanFetch.mockReset();
    applyVinScanRelayIfBlocked.mockReset();
    applyCarinfoSuperSearchHttp.mockReset();
  });

  it("bloķēts tiešais ceļš super-search lasa pa HTTP releju, VIN lapu pa Chrome", async () => {
    scanFetch.mockResolvedValue({ status: 403, text: BLOCKED, cookie: "" });
    applyVinScanRelayIfBlocked.mockImplementation(async (url: string) => {
      if (url === DK_PAGE) return { status: 200, text: SHARAN_HTML, cookie: "" };
      return { status: 200, text: EMPTY_SHELL, cookie: "" };
    });
    applyCarinfoSuperSearchHttp.mockImplementation(async (url: string) => {
      if (String(url).includes("/en-dk/search/super/")) {
        return {
          status: 200,
          text: JSON.stringify({
            hits: { idents: [{ country: "DK", vin: VIN, secondary_name_blurred: "Volkswagen Sharan" }] },
            hits_html: `<a href="${DK_PAGE}">`,
          }),
          cookie: "",
        };
      }
      return { status: 200, text: EMPTY_SUPER, cookie: "" };
    });

    const row = await probeCarinfo(ctx());

    const chrome = applyVinScanRelayIfBlocked.mock.calls.map((call) => String(call[0]));
    const http = applyCarinfoSuperSearchHttp.mock.calls.map((call) => String(call[0]));
    expect(chrome.some((url) => url.includes("/search/super/"))).toBe(false);
    expect(chrome).toContain(DK_PAGE);
    expect(http.some((url) => url.includes("/en-dk/search/super/"))).toBe(true);
    expect(row.status).toBe("found");
    expect(row.summary).toContain("Sharan");
    expect(row.summary).toContain("2014");
    expect(row.summary).not.toBe("car.info lapā nav publisku datu par šo VIN");
    expect(row.openUrl).toBe(DK_PAGE);
  });

  it("lēns Chrome super-search netiek saukts un neapēd budžetu", async () => {
    scanFetch.mockResolvedValue({ status: 403, text: BLOCKED, cookie: "" });
    applyVinScanRelayIfBlocked.mockImplementation(async (url: string) => {
      if (String(url).includes("/search/super/")) {
        await new Promise((resolve) => setTimeout(resolve, 5_000));
        return { status: 403, text: BLOCKED, cookie: "" };
      }
      return { status: 200, text: EMPTY_SHELL, cookie: "" };
    });
    applyCarinfoSuperSearchHttp.mockResolvedValue({ status: 403, text: BLOCKED, cookie: "" });

    const started = Date.now();
    const row = await probeCarinfo(ctx());
    const chrome = applyVinScanRelayIfBlocked.mock.calls.map((call) => String(call[0]));

    expect(Date.now() - started).toBeLessThan(2_500);
    expect(chrome.some((url) => url.includes("/search/super/"))).toBe(false);
    expect(applyCarinfoSuperSearchHttp).toHaveBeenCalled();
    expect(row.status === "none" || row.status === "blocked").toBe(true);
    expect(row.summary).not.toMatch(/neatbildēja laikā/);
  });

  it("tiešs 200 VIN lapa releju neprasa", async () => {
    scanFetch.mockResolvedValue({ status: 200, text: SHARAN_HTML, cookie: "" });
    const row = await probeCarinfo(ctx());
    expect(applyVinScanRelayIfBlocked).not.toHaveBeenCalled();
    expect(applyCarinfoSuperSearchHttp).not.toHaveBeenCalled();
    expect(row.status).toBe("found");
    expect(row.summary).toContain("Sharan");
  });
});
