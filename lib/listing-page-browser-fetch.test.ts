import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  LISTING_PAGE_BROWSER_HOSTS,
  LISTING_PAGE_BROWSER_MIN_USERSCRIPT,
  listingPageBrowserFetchAllowed,
  userscriptVersionAllowsListingPageFetch,
} from "@/lib/listing-page-browser-fetch";

const SCRIPT = readFileSync(path.join(process.cwd(), "public/userscripts/provin-vin-autofill.user.js"), "utf8");

describe("sludinājuma lapas pārlūka rezerve", () => {
  it("mobile.de nekad; ss.com / auto24 / autoplius / reklama.lv jā", () => {
    expect(listingPageBrowserFetchAllowed("https://suchen.mobile.de/fahrzeuge/details.html?id=1")).toBe(false);
    expect(listingPageBrowserFetchAllowed("https://m.mobile.de/x")).toBe(false);
    expect(listingPageBrowserFetchAllowed("http://www.ss.com/x")).toBe(false);
    expect(listingPageBrowserFetchAllowed("https://ss.com.evil.com/x")).toBe(false);
    expect(listingPageBrowserFetchAllowed("https://m.ss.com/msg/lv/x.html")).toBe(true);
    expect(listingPageBrowserFetchAllowed("https://www.auto24.ee/soidukid/1")).toBe(true);
    expect(listingPageBrowserFetchAllowed("https://lv.m.autoplius.lt/sludinajumi/x-1.html")).toBe(true);
    expect(listingPageBrowserFetchAllowed("https://reklama.lv/x-1.html")).toBe(true);
  });

  it("skripta saraksts un @connect sakrīt ar šo sarakstu; mobile.de nav", () => {
    for (const h of LISTING_PAGE_BROWSER_HOSTS) {
      expect(SCRIPT).toMatch(new RegExp(`// @connect\\s+${h.replace(/\./g, "\\.")}\\n`));
      expect(SCRIPT).toContain(`"${h}",`);
    }
    expect(SCRIPT).not.toMatch(/@connect\s+[^\n]*mobile\.de/);
    const version = SCRIPT.match(/@version\s+(\S+)/)?.[1] ?? "";
    expect(userscriptVersionAllowsListingPageFetch(version)).toBe(true);
  });

  it("versijas pārbaude", () => {
    expect(LISTING_PAGE_BROWSER_MIN_USERSCRIPT).toBe("1.26.3");
    expect(userscriptVersionAllowsListingPageFetch("1.26.2")).toBe(false);
    expect(userscriptVersionAllowsListingPageFetch("1.26.3")).toBe(true);
    expect(userscriptVersionAllowsListingPageFetch("1.27.0")).toBe(true);
    expect(userscriptVersionAllowsListingPageFetch("2.0.0")).toBe(true);
    expect(userscriptVersionAllowsListingPageFetch("")).toBe(false);
  });
});
