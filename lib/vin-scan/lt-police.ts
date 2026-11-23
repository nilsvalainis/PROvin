/**
 * Lietuvas policijas meklēto transportlīdzekļu reģistrs (epolicija.lt, Angular lapa kopš 2026).
 *
 * Lapa sūta `POST {apiUrl}/search-register/wanted-vehicle/unauthenticated` ar
 * `{ data, signature }`, kur `signature = HmacSHA512(orderedJson(data), SECRET_KEY)` hex
 * (crypto-js, atslēga ir publiski lapas JS). Neautentificētam lietotājam `data.captcha` ir
 * reCAPTCHA v2 žetons (siteKey no `/assets/config.json`). Bez žetona serveris atbild 422
 * «reCAPTCHA validation failed», ar nepareizu parakstu - 500.
 *
 * Tīras funkcijas (bez tīkla), lai paraksts un atbildes nolasīšana ir testējami ar fiksācijām.
 */
import { createHmac } from "node:crypto";

import type { VinScanParse } from "@/lib/vin-scan/types";

export const LT_POLICE_PAGE_URL = "https://www.epolicija.lt/eservice/wanted-vehicles-search";
export const LT_POLICE_API_URL = "https://www.epolicija.lt/api/search-register/wanted-vehicle/unauthenticated";
/** `assets/config.json` → `recaptcha.siteKey` (v2 ķeksis). */
export const LT_POLICE_RECAPTCHA_SITE_KEY = "6LfNQfEdAAAAAF4lF_OfdXWnWIEhdcaiQSAZ4RBv";
/** Publiski lapas JS (`SearchRegisterService.SECRET_KEY`), nav PROVIN noslēpums. */
export const LT_POLICE_SIGNATURE_KEY =
  "Okq6yF0+Zxj9eDM+1AwThgO4EfwqZMziyz3QIH0G9z4tmCGGHakK8mC5BdXnKwCBjSr6pFK2LgQuxNr4mViAQQ==";

export type LtPoliceSearchData = {
  vin?: string;
  licensePlate?: string;
  engineNumber?: string;
  captcha?: string;
};

/**
 * Lapas `orderedToString`: tukšās vērtības izmet, atslēgas kārto (`localeCompare`), vērtības JSON.
 * Ligzdotu objektu šai formai nav.
 */
export function ltPoliceOrderedJson(data: Record<string, unknown>): string {
  const entries = Object.entries(data)
    .filter(([, v]) => v != null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `"${k}":${JSON.stringify(v)}`).join(",")}}`;
}

export function ltPoliceSignature(data: Record<string, unknown>, key = LT_POLICE_SIGNATURE_KEY): string {
  return createHmac("sha512", key).update(ltPoliceOrderedJson(data), "utf8").digest("hex");
}

export function ltPoliceRequestBody(vin: string, captcha: string): string {
  const data: LtPoliceSearchData = { vin: vin.trim().toUpperCase(), captcha };
  return JSON.stringify({ data, signature: ltPoliceSignature(data) });
}

type LtPoliceResult = {
  searchStatus?: unknown;
  licensePlate?: unknown;
  vin?: unknown;
  engineNumber?: unknown;
  brand?: unknown;
  country?: unknown;
  searchStarted?: unknown;
  searchEnded?: unknown;
  incident?: unknown;
  incidentDate?: unknown;
  searchDateTime?: unknown;
  message?: unknown;
};

function str(v: unknown): string {
  if (typeof v === "string") return v.replace(/\s+/g, " ").trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

/** `2026-11-23T10:15:00` / `2026-11-23` → `2026-11-23`. */
function day(v: unknown): string {
  const s = str(v);
  return /^\d{4}-\d{2}-\d{2}/.exec(s)?.[0] ?? s;
}

/**
 * HTTP atbilde → VIN SCAN rinda.
 * IESKOMA = meklēšanā (found). NEIESKOMA / NUTRAUKTA = nav meklēšanā (lapa abiem rāda «NĖRA IEŠKOMA»).
 */
export function parseLtPoliceResponse(httpStatus: number, text: string, vin: string): VinScanParse {
  let json: LtPoliceResult | null = null;
  try {
    const raw = JSON.parse(text) as unknown;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) json = raw as LtPoliceResult;
  } catch {
    json = null;
  }
  const message = str(json?.message);
  if (httpStatus === 422 || /recaptcha/i.test(message)) {
    return { status: "unknown", summary: `epolicija.lt: reCAPTCHA netika pieņemta${message ? ` (${message.slice(0, 80)})` : ""}` };
  }
  if (httpStatus >= 400) {
    return { status: "unknown", summary: `epolicija.lt atbildēja ar HTTP ${httpStatus}` };
  }
  const status = str(json?.searchStatus).toUpperCase();
  const openUrl = LT_POLICE_PAGE_URL;
  if (status === "IESKOMA") {
    const brand = str(json?.brand);
    const plate = str(json?.licensePlate);
    const incident = str(json?.incident);
    const incidentDate = day(json?.incidentDate);
    const started = day(json?.searchStarted);
    const country = str(json?.country);
    const bits = [
      brand,
      plate ? `numurs ${plate}` : "",
      incident ? `notikums: ${incident}` : "",
      incidentDate ? `notikuma datums ${incidentDate}` : "",
      started ? `meklē kopš ${started}` : "",
      country ? `valsts ${country}` : "",
    ].filter(Boolean);
    const detail = [
      `Statuss: ${status}`,
      plate ? `Numurs: ${plate}` : "",
      str(json?.vin) ? `VIN: ${str(json?.vin)}` : `VIN: ${vin.trim().toUpperCase()}`,
      str(json?.engineNumber) ? `Dzinēja nr.: ${str(json?.engineNumber)}` : "",
      brand ? `Marka: ${brand}` : "",
      country ? `Valsts: ${country}` : "",
      started ? `Meklēšana sākta: ${started}` : "",
      day(json?.searchEnded) ? `Meklēšana beigsies: ${day(json?.searchEnded)}` : "",
      incident ? `Notikums: ${incident}` : "",
      incidentDate ? `Notikuma datums: ${incidentDate}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    return {
      status: "found",
      summary: bits.length ? `Meklēšanā. ${bits.join(", ")}` : "Meklēšanā",
      detail,
      incidents: [{ date: incidentDate || started || undefined, summary: `LT policija: meklēšanā${incident ? ` (${incident})` : ""}` }],
      openUrl,
    };
  }
  if (status === "NEIESKOMA" || status === "NUTRAUKTA") {
    const at = day(json?.searchDateTime);
    return {
      status: "none",
      summary: status === "NUTRAUKTA" ? "Nav meklēšanā (meklēšana pārtraukta)" : "Nav meklēšanā",
      ...(at ? { detail: `Pārbaudīts: ${at}` } : {}),
      openUrl,
    };
  }
  return { status: "unknown", summary: "epolicija.lt: neatpazīta atbilde" };
}
