import { describe, expect, it } from "vitest";
import { parseSsLvListingHtml } from "@/lib/listing-scrape";

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
