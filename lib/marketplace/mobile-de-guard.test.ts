import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isListingHistoryChromeRelayUrl } from "@/lib/listing-history-relay";
import {
  actorPayloadContainsOfficeEgress,
  decideMobileDeActorStart,
  decideMobileDeAutomationEgress,
  isMobileDeAkamaiHost,
  looksLikeAkamaiAccessDenied,
  mobileDeAutomationShouldStopSweep,
  mobileDeCircuitAfterDenial,
  mobileDeHourlyCapReason,
  mobileDePlaywrightProxy,
  MOBILE_DE_CIRCUIT_OPEN_REASON,
  MOBILE_DE_PAUSE_MARK,
} from "@/lib/marketplace/mobile-de-guard";

describe("mobile.de egress gate", () => {
  it("refuses local Playwright unless a remote proxy is set", () => {
    expect(decideMobileDeAutomationEgress({}).allowed).toBe(false);
    expect(decideMobileDeAutomationEgress({ MOBILE_DE_EGRESS_MODE: "proxy" }).allowed).toBe(false);
    expect(
      decideMobileDeAutomationEgress({
        MOBILE_DE_EGRESS_MODE: "proxy",
        MOBILE_DE_EGRESS_PROXY_URL: "http://91.135.84.67:8080",
      }).allowed,
    ).toBe(false);
    expect(
      decideMobileDeAutomationEgress({
        MOBILE_DE_EGRESS_MODE: "proxy",
        MOBILE_DE_EGRESS_PROXY_URL: "http://127.0.0.1:8888",
      }).allowed,
    ).toBe(false);
    const ok = decideMobileDeAutomationEgress({
      MOBILE_DE_EGRESS_MODE: "proxy",
      MOBILE_DE_EGRESS_PROXY_URL: "http://user:secret@proxy.example:3128",
    });
    expect(ok.allowed).toBe(true);
    expect(ok.reason).toBe("");
  });

  it("splits proxy credentials for Playwright and does not keep the password in server", () => {
    const proxy = mobileDePlaywrightProxy("socks5://user:s%3Acret@proxy.example:1080");
    expect(proxy.server).toBe("socks5://proxy.example:1080");
    expect(proxy.username).toBe("user");
    expect(proxy.password).toBe("s:cret");
    expect(proxy.server).not.toContain("cret");
  });

  it("treats every mobile.de host as Akamai and leaves the image CDN alone", () => {
    expect(isMobileDeAkamaiHost("www.mobile.de")).toBe(true);
    expect(isMobileDeAkamaiHost("m.mobile.de")).toBe(true);
    expect(isMobileDeAkamaiHost("suchen.mobile.de")).toBe(true);
    expect(isMobileDeAkamaiHost("img.classistatic.de")).toBe(false);
  });

  it("recognises an Akamai denial page and ignores a plain Apify failure", () => {
    const html = "<html><head><title>Access Denied</title></head><body>Reference #18.1cec1702.1793787682.9ed545de https://errors.edgesuite.net/</body></html>";
    expect(looksLikeAkamaiAccessDenied(html)).toBe(true);
    expect(looksLikeAkamaiAccessDenied("Avota kļūda: mobile.de: Apify failed")).toBe(false);
    expect(mobileDeAutomationShouldStopSweep(MOBILE_DE_CIRCUIT_OPEN_REASON)).toBe(true);
    expect(mobileDeAutomationShouldStopSweep("Avota kļūda: mobile.de: Apify failed")).toBe(false);
  });

  it("pauses actor starts while the circuit is open and after the hourly cap", () => {
    const now = Date.parse("2026-11-02T07:20:00.000Z");
    const open = decideMobileDeActorStart({
      nowMs: now,
      pausedUntilMs: now + 60_000,
      recentStartMs: [],
      maxPerHour: 24,
    });
    expect(open.allowed).toBe(false);
    expect(open.reason).toBe(MOBILE_DE_CIRCUIT_OPEN_REASON);
    const stamps = Array.from({ length: 24 }, (_, i) => now - i * 1000);
    const capped = decideMobileDeActorStart({ nowMs: now, pausedUntilMs: 0, recentStartMs: stamps, maxPerHour: 24 });
    expect(capped.allowed).toBe(false);
    expect(capped.reason).toBe(mobileDeHourlyCapReason(24));
    expect(capped.reason.startsWith(MOBILE_DE_PAUSE_MARK)).toBe(true);
    const room = decideMobileDeActorStart({
      nowMs: now,
      pausedUntilMs: 0,
      recentStartMs: [now - 30 * 60 * 1000],
      maxPerHour: 24,
    });
    expect(room.allowed).toBe(true);
  });

  it("stores a six hour pause after a denial", () => {
    const now = Date.parse("2026-11-02T07:22:00.000Z");
    const file = mobileDeCircuitAfterDenial(now, "Access Denied edgesuite.net ".repeat(40), 6 * 60 * 60 * 1000);
    expect(Date.parse(file.pausedUntil) - now).toBe(6 * 60 * 60 * 1000);
    expect(file.reason.length).toBeLessThanOrEqual(180);
    expect(file.reason).not.toMatch(/\s{2,}/);
  });

  it("flags a payload that still contains the office IP", () => {
    expect(actorPayloadContainsOfficeEgress({ startUrls: ["http://91.135.84.67/x"] })).toBe(true);
    expect(actorPayloadContainsOfficeEgress({ make: "Volvo" })).toBe(false);
  });

  it("does not send mobile.de pages through the Hetzner Chrome relay", () => {
    expect(isListingHistoryChromeRelayUrl("https://www.mobile.de/")).toBe(false);
    expect(isListingHistoryChromeRelayUrl("https://suchen.mobile.de/fahrzeuge/details.html?id=1")).toBe(false);
    expect(isListingHistoryChromeRelayUrl("https://m.mobile.de/yams-proxy/img.classistatic.de/a")).toBe(false);
    expect(isListingHistoryChromeRelayUrl("https://www.ss.lv/msg/lv/transport/cars/a.html")).toBe(true);
  });

  it("exits auth-mobile before Chrome when the proxy gate is closed", () => {
    const res = spawnSync(process.execPath, [path.resolve(process.cwd(), "scripts/auth-mobile.mjs")], {
      cwd: process.cwd(),
      env: { ...process.env, MOBILE_DE_EGRESS_MODE: "", MOBILE_DE_EGRESS_PROXY_URL: "" },
      encoding: "utf8",
      timeout: 15_000,
    });
    expect(res.status).toBe(1);
    expect(`${res.stderr}\n${res.stdout}`).toMatch(/izslēgta|91\.135\.84\.67/);
  });
});
