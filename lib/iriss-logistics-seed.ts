import { parseLogisticsHoursText } from "@/lib/iriss-logistics-hours";
import {
  IRISS_LOGISTICS_WORKSPACE,
  isLogisticsAuction,
  type LogisticsAuction,
  type LogisticsOrder,
  type LogisticsOrderStatus,
  type LogisticsPoint,
} from "@/lib/iriss-logistics-types";

export type LogisticsPunktiJson = {
  atjaunots?: string;
  izsoles?: Record<string, LogisticsPunktiPointJson[]>;
};

export type LogisticsPunktiPointJson = {
  punkts?: string;
  adrese?: string;
  kontakti?: string;
  darba_laiks?: string;
  auto?: LogisticsPunktiCarJson[];
};

export type LogisticsPunktiCarJson = {
  marka?: string;
  modelis?: string;
  vin?: string;
  ref?: string;
  saite?: string;
  pickup_kods?: string;
  termins?: string;
  statuss?: string;
};

/** Aptuvenas koordinātas pirmajam kartes skatam, ja Google vēl nav ģeokodējis. */
const CITY_COORDS: Record<string, { lat: number; lng: number; precise: boolean }> = {
  hannover: { lat: 52.3985, lng: 9.6782, precise: true },
  bebra: { lat: 50.9716, lng: 9.7968, precise: true },
  dresden: { lat: 51.0338, lng: 13.6764, precise: true },
  bockel: { lat: 53.396, lng: 9.204, precise: true },
  ghislenghien: { lat: 50.6584, lng: 3.8833, precise: true },
  ketzin: { lat: 52.4928, lng: 12.8452, precise: false },
  etzin: { lat: 52.4928, lng: 12.8452, precise: false },
  hattingen: { lat: 51.3989, lng: 7.1856, precise: false },
  bilzen: { lat: 50.8734, lng: 5.518, precise: true },
};

export function logisticsAuctionFromSeedKey(raw: string): LogisticsAuction {
  const k = raw.trim().toLowerCase();
  if (k === "auto1" || k === "auto 1") return "Auto1";
  if (k === "autobid") return "Autobid";
  if (k.includes("openlane") || k.includes("adesa")) return "Openlane";
  if (k === "bca") return "BCA";
  if (isLogisticsAuction(raw.trim())) return raw.trim() as LogisticsAuction;
  return "cits";
}

export function slugLogisticsId(prefix: string, ...parts: string[]): string {
  const body = parts
    .join("-")
    .normalize("NFKD")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 56);
  return `${prefix}-${body || "x"}`;
}

export function parseLogisticsAddressLine(raw: string): {
  street: string;
  postcode: string;
  city: string;
  country: string;
  extra: string;
} {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  const extraMatch = cleaned.match(/\((.+)\)\s*$/);
  const extra = extraMatch?.[1]?.trim() ?? "";
  const main = cleaned.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const first = cleaned.match(
    /^(.+?),\s*(\d{4,5})\s+([^,]+)(?:,\s*([A-Z]{2})\b)?/i,
  );
  if (first) {
    return {
      street: first[1]?.trim() ?? "",
      postcode: first[2] ?? "",
      city: (first[3] ?? "").replace(/\s*\(.+\)$/, "").trim(),
      country: (first[4] ?? "DE").toUpperCase(),
      extra,
    };
  }
  return { street: main, postcode: "", city: "", country: "DE", extra };
}

export function parseLogisticsContacts(raw: string): { contactName: string; phone: string; email: string } {
  const email = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phones = [...raw.matchAll(/(?:\+|00)?[\d][\d\s./-]{7,}/g)].map((m) => m[0].trim()).filter((p) => p.replace(/\D/g, "").length >= 8);
  const phone = phones[0] ?? "";
  const without = raw
    .replace(email, "")
    .replace(phone, "")
    .replace(/tel\.?|mob\.?/gi, "")
    .replace(/[;,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/,$/, "");
  const contactName = without.split(/\s+/).slice(0, 4).join(" ").trim();
  return { contactName, phone, email };
}

export function mapSeedStatus(raw: string): LogisticsOrderStatus {
  const s = raw.toLowerCase();
  if (/piegādāt/.test(s)) return "delivered";
  if (/izņemts/.test(s) && !/nav/.test(s)) return "picked_up";
  if (/ceļā uz noliktavu|cela uz noliktavu/.test(s)) return "in_transit_to_warehouse";
  if (/dokumenti tiek izdoti/.test(s)) return "documents_issuing";
  if (/gatavs savākšan|gatavs savaksan/.test(s)) return "ready_for_pickup";
  if (/savākšana apstiprin|savaksana apstiprin/.test(s)) return "pickup_confirmed";
  if (/savākt|picked.?up/.test(s) && /apstiprin/.test(s) === false && /nav/.test(s) === false) return "picked_up";
  if (/apmaksu/.test(s)) return "awaiting_payment";
  if (/pārveš|atvests/.test(s)) return "waiting_transport";
  if (/gatavs/.test(s)) return "ready";
  if (/pieraksts|plānot/.test(s)) return "scheduled";
  if (/organizē|saskaņo/.test(s)) return "organize_pickup";
  return "organize_pickup";
}

function lookupCoords(city: string, street: string): { lat: number | null; lng: number | null; precise: boolean } {
  const hay = `${city} ${street}`.toLowerCase();
  for (const [key, val] of Object.entries(CITY_COORDS)) {
    if (hay.includes(key)) return { lat: val.lat, lng: val.lng, precise: val.precise };
  }
  return { lat: null, lng: null, precise: false };
}

function pickupDateFromTerm(term: string): string {
  const m = term.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function seedLogisticsFromPunkti(
  json: LogisticsPunktiJson,
  now = "2026-10-20T11:00:00.000Z",
): { points: LogisticsPoint[]; orders: LogisticsOrder[] } {
  const points: LogisticsPoint[] = [];
  const orders: LogisticsOrder[] = [];
  const izsoles = json.izsoles ?? {};
  for (const [auctionKey, rows] of Object.entries(izsoles)) {
    const auction = logisticsAuctionFromSeedKey(auctionKey);
    for (const row of rows ?? []) {
      const name = (row.punkts ?? "").trim();
      if (!name) continue;
      const addr = parseLogisticsAddressLine(row.adrese ?? "");
      const contacts = parseLogisticsContacts(row.kontakti ?? "");
      const hours = parseLogisticsHoursText(row.darba_laiks ?? "");
      const coords = lookupCoords(addr.city, addr.street);
      const pickupCodes = [...new Set((row.auto ?? []).map((c) => (c.pickup_kods ?? "").trim()).filter(Boolean))];
      const point: LogisticsPoint = {
        id: slugLogisticsId("lp", auction, name),
        workspace: IRISS_LOGISTICS_WORKSPACE,
        auction,
        name,
        street: addr.street,
        postcode: addr.postcode,
        city: addr.city.replace(/\s*\(.+\)$/, "").trim(),
        country: addr.country,
        lat: coords.lat,
        lng: coords.lng,
        hours: hours.hours,
        hoursText: hours.hoursText,
        contactName: contacts.contactName,
        phone: contacts.phone,
        email: contacts.email,
        parkingRule: null,
        rules: addr.extra,
        requiredDocs: [],
        notes: [row.darba_laiks, row.kontakti].filter(Boolean).join(" · "),
        pickupCodes,
        active: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: "seed",
      };
      points.push(point);
      for (const car of row.auto ?? []) {
        const vin = (car.vin ?? "").trim().toUpperCase();
        const make = (car.marka ?? "").trim();
        const model = (car.modelis ?? "").trim();
        const status = mapSeedStatus(car.statuss ?? "");
        const archived = status === "picked_up" || status === "delivered" || status === "archived";
        orders.push({
          id: slugLogisticsId("lo", vin || car.ref || `${make}-${model}`),
          workspace: IRISS_LOGISTICS_WORKSPACE,
          source: "auction",
          auction,
          auctionUrl: (car.saite ?? "").trim(),
          listingUrl: "",
          listingParsed: null,
          make,
          model,
          vin,
          title: [make, model].filter(Boolean).join(" "),
          priceEur: null,
          mileageKm: null,
          pickupPointId: point.id,
          pickupSnapshot: {
            name: point.name,
            auction: point.auction,
            street: point.street,
            postcode: point.postcode,
            city: point.city,
            country: point.country,
            lat: point.lat,
            lng: point.lng,
            hoursText: point.hoursText,
            contactName: point.contactName,
            phone: point.phone,
            email: point.email,
            parkingRule: point.parkingRule,
            rules: point.rules,
          },
          pickupRef: (car.pickup_kods ?? car.ref ?? "").trim(),
          pickupAddress: [point.street, [point.postcode, point.city].filter(Boolean).join(" "), point.country]
            .filter(Boolean)
            .join(", "),
          pickupLat: point.lat,
          pickupLng: point.lng,
          geocodeStatus: coords.lat == null ? "pending" : coords.precise ? "ok" : "neprecizs",
          pickupDate: pickupDateFromTerm(car.termins ?? ""),
          stockNo: (car.ref ?? "").trim(),
          freeParkingUntil: pickupDateFromTerm(car.termins ?? ""),
          status,
          archived,
          archivedAt: archived ? now : "",
          previousStatus: "",
          statusNote: (car.statuss ?? "").trim(),
          nextAction: (car.termins ?? "").trim(),
          sellerContact: "",
          notes: [(car.pickup_kods ?? "").trim(), (car.termins ?? "").trim()].filter(Boolean).join(" · "),
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }
  return { points, orders };
}
