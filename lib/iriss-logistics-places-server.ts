import "server-only";

import { geocodeLogisticsAddress } from "@/lib/iriss-logistics-geocode-server";
import { consumeLogisticsMapsQuota, googleMapsServerKey } from "@/lib/iriss-logistics-store";

export type AddressSuggestion = {
  /** Google vietas ID (Places). Ģeokodēšanas rezervē tukšs, bet ir koordinātes. */
  placeId: string;
  main: string;
  secondary: string;
  lat?: number;
  lng?: number;
};

export type AddressSuggestResult =
  | { ok: true; source: "places" | "geocode"; items: AddressSuggestion[]; hint?: string }
  | { ok: false; limited?: boolean; notice: string };

const PLACES_OFF_HINT = "Ieteikumi no ģeokodēšanas. Lai tie būtu kā Google Maps, Google Cloud konsolē ieslēdz Places API (New).";

/** Places API (New) Autocomplete: ieteikumi rakstot, kā Google Maps. Sesijas tokens = lētāka Place Details. */
export async function suggestLogisticsAddresses(input: string, sessionToken: string): Promise<AddressSuggestResult> {
  const q = input.trim().slice(0, 200);
  if (q.length < 3) return { ok: true, source: "places", items: [] };
  const apiKey = googleMapsServerKey();
  if (!apiKey) return { ok: false, notice: "GOOGLE_MAPS_SERVER_KEY nav iestatīta. Adrešu meklēšana izslēgta." };
  const quota = await consumeLogisticsMapsQuota("autocomplete");
  if (!quota.ok) return { ok: false, limited: true, notice: quota.notice };

  const res = await fetchJson("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey },
    body: JSON.stringify({ input: q, sessionToken: sessionToken.slice(0, 80) || undefined, languageCode: "lv" }),
  });
  const body = (res?.body ?? {}) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId?: string;
        text?: { text?: string };
        structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
      };
    }>;
  };
  if (res && res.status === 200) {
    const items = (body.suggestions ?? []).flatMap((s) => {
      const p = s.placePrediction;
      if (!p?.placeId) return [];
      const main = p.structuredFormat?.mainText?.text || p.text?.text || "";
      return [{ placeId: p.placeId, main, secondary: p.structuredFormat?.secondaryText?.text ?? "" }];
    });
    return { ok: true, source: "places", items: items.slice(0, 6) };
  }
  // Places nav ieslēgts vai kļūda: rezerve ar ģeokodēšanu (viens rezultāts, jau ar koordinātēm).
  if (q.length < 5) return { ok: true, source: "geocode", items: [], hint: PLACES_OFF_HINT };
  const geo = await geocodeLogisticsAddress(q);
  if (!geo.ok) return geo.limited ? geo : { ok: true, source: "geocode", items: [], hint: PLACES_OFF_HINT };
  const [main, ...rest] = geo.entry.formatted.split(", ");
  return {
    ok: true,
    source: "geocode",
    hint: PLACES_OFF_HINT,
    items: [{ placeId: "", main: main ?? geo.entry.formatted, secondary: rest.join(", "), lat: geo.entry.lat, lng: geo.entry.lng }],
  };
}

/** Place Details lauki: abi ir Google "Essentials" līmenī (10 000 bez maksas mēnesī). */
export const PLACE_DETAILS_FIELD_MASK = "formattedAddress,location";

export type AddressPlaceResult =
  | { ok: true; formatted: string; name: string; lat: number; lng: number }
  | { ok: false; limited?: boolean; notice: string };

export async function logisticsPlaceDetails(placeId: string, sessionToken: string): Promise<AddressPlaceResult> {
  const id = placeId.trim();
  if (!/^[\w-]{10,300}$/.test(id)) return { ok: false, notice: "Nederīga vieta." };
  const apiKey = googleMapsServerKey();
  if (!apiKey) return { ok: false, notice: "GOOGLE_MAPS_SERVER_KEY nav iestatīta." };
  const quota = await consumeLogisticsMapsQuota("geocode_place");
  if (!quota.ok) return { ok: false, limited: true, notice: quota.notice };
  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`);
  url.searchParams.set("languageCode", "lv");
  if (sessionToken) url.searchParams.set("sessionToken", sessionToken.slice(0, 80));
  const res = await fetchJson(url.toString(), {
    // Tikai Essentials lauki (lētākais līmenis). Vietas nosaukumu klients ņem no ieteikuma (mainText), nevis no `displayName` (Pro).
    headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": PLACE_DETAILS_FIELD_MASK },
  });
  const body = (res?.body ?? {}) as {
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
  };
  const lat = body.location?.latitude;
  const lng = body.location?.longitude;
  if (!res || res.status !== 200 || typeof lat !== "number" || typeof lng !== "number") {
    return { ok: false, notice: "Vietas koordinātes neizdevās iegūt." };
  }
  return { ok: true, formatted: body.formattedAddress ?? "", name: "", lat, lng };
}

async function fetchJson(url: string, init: RequestInit): Promise<{ status: number; body: unknown } | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
