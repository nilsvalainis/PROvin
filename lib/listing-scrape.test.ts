import { describe, expect, it } from "vitest";
import { parseGenericListingHtml, parseSsLvListingHtml } from "@/lib/listing-scrape";

function ssLvListingHtml(opts: { kmLabel: string; kmValue: string; posted: string }): string {
  return `<html><head><title>Audi Q7 - Sludinājumi</title></head><body>
<table class="options_list">
<tr><td class="ads_opt_name">${opts.kmLabel}:</td><td class="ads_opt"><b>${opts.kmValue}</b></td></tr>
<tr><td class="ads_opt_name">Cena:</td><td class="ads_opt"><b>23 950 €</b></td></tr>
</table>
<div class="msg_footer">Izvietots: ${opts.posted}</div>
</body></html>`;
}

describe("parseSsLvListingHtml", () => {
  it("reads odometer, first posted date and days listed", () => {
    const snap = parseSsLvListingHtml(
      ssLvListingHtml({ kmLabel: "Nobraukums, km", kmValue: "233 000", posted: "16.07.2026" }),
      new Date(2026, 7, 13),
    );
    expect(snap.ok).toBe(true);
    expect(snap.currentKm).toBe("233 000 km");
    expect(snap.postedDateRaw).toBe("16.07.2026");
    expect(snap.daysListed).toBe(28);
  });

  it("expands Nobraukums, tūkst. km into full kilometres", () => {
    const snap = parseSsLvListingHtml(
      ssLvListingHtml({ kmLabel: "Nobraukums, tūkst. km", kmValue: "167", posted: "20.05.2026" }),
      new Date(2026, 7, 13),
    );
    expect(snap.currentKm).toBe("167 000 km");
  });
});

describe("parseGenericListingHtml", () => {
  it("reads title, km and posted date from autoplius-like HTML", () => {
    const html = `<html><head>
      <meta property="og:title" content="Audi Q7 3.0 TDI" />
      <meta property="og:description" content="Pardodams Audi Q7, labs stavoklis, servisa vesture." />
    </head><body>
      <p>Rida: 167 000 km</p>
      <p>Paskelbta: 02.02.2026</p>
      <p>Kaina 23 950 €</p>
      <dt>Gads</dt><dd>2015</dd>
    </body></html>`;
    const snap = parseGenericListingHtml(html, "https://autoplius.lt/skelbimai/audi-q7-123", new Date(2026, 7, 13));
    expect(snap.ok).toBe(true);
    expect(snap.pageTitle).toBe("Audi Q7 3.0 TDI");
    expect(snap.currentKm).toBe("167 000 km");
    expect(snap.postedDateRaw).toBe("02.02.2026");
    expect(snap.currentPriceEur).toContain("23 950");
    expect(snap.options.some((o) => o.label === "Gads" && o.value === "2015")).toBe(true);
  });
});
