import { afterEach, describe, expect, it, vi } from "vitest";

const scanFetch = vi.fn();
const applyVinScanRelayIfBlocked = vi.fn();

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

describe("probeCarinfo releja super-search", () => {
  afterEach(() => {
    scanFetch.mockReset();
    applyVinScanRelayIfBlocked.mockReset();
  });

  it("bloķēts tiešais ceļš caur releju atrod DK super-search, nevis tukšu VIN lapu", async () => {
    scanFetch.mockResolvedValue({ status: 403, text: BLOCKED, cookie: "" });
    applyVinScanRelayIfBlocked.mockImplementation(async (url: string) => {
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
      if (url === DK_PAGE) return { status: 200, text: SHARAN_HTML, cookie: "" };
      return { status: 200, text: EMPTY_SHELL, cookie: "" };
    });

    const row = await probeCarinfo(ctx());

    const relayed = applyVinScanRelayIfBlocked.mock.calls.map((call) => String(call[0]));
    expect(relayed.some((url) => url.includes("/search/super/"))).toBe(true);
    expect(relayed).toContain(DK_PAGE);
    expect(row.status).toBe("found");
    expect(row.summary).toContain("Sharan");
    expect(row.summary).toContain("2014");
    expect(row.summary).not.toBe("car.info lapā nav publisku datu par šo VIN");
    expect(row.openUrl).toBe(DK_PAGE);
  });

  it("tiešs 200 VIN lapa releju neprasa", async () => {
    scanFetch.mockResolvedValue({ status: 200, text: SHARAN_HTML, cookie: "" });
    const row = await probeCarinfo(ctx());
    expect(applyVinScanRelayIfBlocked).not.toHaveBeenCalled();
    expect(row.status).toBe("found");
    expect(row.summary).toContain("Sharan");
  });
});
