/**
 * `/lot-vins`: ar ielogotu profilu atver lotes lapas pēc kārtas un nolasa VIN.
 * Viena lote nekad nepārtrauc partiju; captcha / WAF vai zudusi sesija pārtrauc.
 */
import { pageText, randomPause, sleep } from "./browser.mjs";
import {
  autobidLotFromNuxt,
  cleanVin,
  lotLooksGone,
  lotVinResult,
  openlaneLotFromJson,
  runLotVinBatch,
  vinFromPageText,
} from "./lot-vin-logic.mjs";

const OPENLANE_API_HOST_RE = /openlane\.(?:eu|com)/i;
const OPENLANE_SKIP_API_RE = /CurrentUserDetails|myaccount|findcarv6\/search|notification|basket|favourite|watchlist|translations?|resources/i;
const LOGGED_OUT_URL_RE = { openlane: /id\.openlane\.eu|\/login\b|\/signin\b/i, autobid: /\/login\b/i };

async function readOne(page, platform, url, opts) {
  const jsonLots = [];
  const onResponse = async (resp) => {
    if (platform !== "openlane") return;
    try {
      const u = resp.url();
      if (!OPENLANE_API_HOST_RE.test(u) || OPENLANE_SKIP_API_RE.test(u)) return;
      const type = resp.headers()["content-type"] ?? "";
      if (!/json/i.test(type)) return;
      const lot = openlaneLotFromJson(await resp.json());
      if (lot.vin) jsonLots.push(lot);
    } catch {
      /* ne JSON vai lapa aizvērta */
    }
  };
  page.on("response", onResponse);
  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const httpStatus = resp && typeof resp.status === "function" ? resp.status() : 0;
    if (httpStatus === 403 || httpStatus === 429) return { stop: "blocked", note: `HTTP ${httpStatus}` };
    await sleep(1_500);
    if (LOGGED_OUT_URL_RE[platform].test(page.url())) return { stop: "login_required", note: "sesija beigusies" };
    const challenge = opts.hasChallenge ? await opts.hasChallenge(page) : "";
    if (challenge) return { stop: "blocked", note: String(challenge) };

    let lot = { vin: "", mileageKm: null, firstRegistration: "", title: "" };
    let text = "";
    // SPA: gaida, līdz parādās VIN (līdz ~12 s)
    for (let i = 0; i < 6 && !lot.vin; i += 1) {
      if (i > 0) await sleep(2_000);
      if (platform === "autobid") {
        const nuxt = await page
          .evaluate(() => document.getElementById("__NUXT_DATA__")?.textContent ?? "")
          .catch(() => "");
        if (nuxt) lot = autobidLotFromNuxt(nuxt);
      } else if (jsonLots.length) {
        lot = jsonLots[0];
      }
      if (!lot.vin) {
        text = await pageText(page, 30_000);
        const vin = cleanVin(vinFromPageText(text));
        if (vin) lot = { ...lot, vin };
        else if (lotLooksGone(platform, url, page.url(), text, httpStatus)) break;
        // Autobid: NUXT ir uzreiz; ja tur «-», gaidīt nav jēgas
        else if (platform === "autobid" && i >= 1) break;
      }
    }
    if (!lot.title) {
      const title = await page.title().catch(() => "");
      lot = { ...lot, title: String(title).replace(/\s+/g, " ").trim().slice(0, 160) };
    }
    if (!lot.vin && lotLooksGone(platform, url, page.url(), text, httpStatus)) return { result: lotVinResult(url, lot, { status: "gone" }) };
    return { result: lotVinResult(url, lot) };
  } catch (e) {
    const note = e instanceof Error ? e.message.split("\n")[0].slice(0, 160) : "nezināma kļūda";
    return { result: lotVinResult(url, null, { status: "error" }), note };
  } finally {
    page.off("response", onResponse);
  }
}

/** Partija ar īsto pārlūku; secības un limita loģika ir `runLotVinBatch`. */
export async function fetchLotVins(page, platform, slots, opts = {}) {
  return runLotVinBatch(platform, slots, {
    ...opts,
    pause: randomPause,
    readOne: (url) => readOne(page, platform, url, opts),
  });
}
