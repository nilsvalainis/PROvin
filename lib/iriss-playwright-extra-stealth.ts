import "server-only";

/**
 * Playwright-extra nevar droši dinamiski `require()` evasion apakšmoduļus Next.js serverī
 * (metode `resolveDependenciesStanza` → "Plugin dependency not found").
 * Reģistrējam katru `stealth/evasions/*` ar statisku require pirms `StealthPlugin()`.
 */
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { chromium } from "playwright-extra";

let stealthReady = false;

function registerStealthEvasionPaths(): void {
  const set = (depPath: string, mod: unknown) => {
    // playwright-extra: evasion moduļi ir rūpnīcas funkcijas; `CompatiblePluginModule` nav eksportēts stabilā veidā
    chromium.plugins.setDependencyResolution(depPath, mod as Parameters<typeof chromium.plugins.setDependencyResolution>[1]);
  };
  /* eslint-disable @typescript-eslint/no-require-imports -- obligāti statiski ceļi bundlerim */
  set("stealth/evasions/chrome.app", require("puppeteer-extra-plugin-stealth/evasions/chrome.app"));
  set("stealth/evasions/chrome.csi", require("puppeteer-extra-plugin-stealth/evasions/chrome.csi"));
  set("stealth/evasions/chrome.loadTimes", require("puppeteer-extra-plugin-stealth/evasions/chrome.loadTimes"));
  set("stealth/evasions/chrome.runtime", require("puppeteer-extra-plugin-stealth/evasions/chrome.runtime"));
  set("stealth/evasions/defaultArgs", require("puppeteer-extra-plugin-stealth/evasions/defaultArgs"));
  set("stealth/evasions/iframe.contentWindow", require("puppeteer-extra-plugin-stealth/evasions/iframe.contentWindow"));
  set("stealth/evasions/media.codecs", require("puppeteer-extra-plugin-stealth/evasions/media.codecs"));
  set("stealth/evasions/navigator.hardwareConcurrency", require("puppeteer-extra-plugin-stealth/evasions/navigator.hardwareConcurrency"));
  set("stealth/evasions/navigator.languages", require("puppeteer-extra-plugin-stealth/evasions/navigator.languages"));
  set("stealth/evasions/navigator.permissions", require("puppeteer-extra-plugin-stealth/evasions/navigator.permissions"));
  set("stealth/evasions/navigator.plugins", require("puppeteer-extra-plugin-stealth/evasions/navigator.plugins"));
  set("stealth/evasions/navigator.webdriver", require("puppeteer-extra-plugin-stealth/evasions/navigator.webdriver"));
  set("stealth/evasions/sourceurl", require("puppeteer-extra-plugin-stealth/evasions/sourceurl"));
  set("stealth/evasions/user-agent-override", require("puppeteer-extra-plugin-stealth/evasions/user-agent-override"));
  set("stealth/evasions/webgl.vendor", require("puppeteer-extra-plugin-stealth/evasions/webgl.vendor"));
  set("stealth/evasions/window.outerdimensions", require("puppeteer-extra-plugin-stealth/evasions/window.outerdimensions"));
  /* eslint-enable @typescript-eslint/no-require-imports */
}

export function getChromiumWithStealth(): typeof chromium {
  if (!stealthReady) {
    registerStealthEvasionPaths();
    chromium.use(StealthPlugin());
    stealthReady = true;
  }
  return chromium;
}
