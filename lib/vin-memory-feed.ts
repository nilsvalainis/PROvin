import { isMemoryVin, VIN_MEMORY_SOURCES, type VinMemorySource, type VinObservationInput } from "@/lib/vin-memory";

/**
 * Tīrās funkcijas: izsoļu ielases auto un pasūtījumu indeksa ieraksti -> VIN atmiņas novērojumi.
 * Auto1 VIN ir jaucējkodi (līdz pirkumam), tos `isMemoryVin` izmet. Bildes un personas datus neņem.
 */

type ListingLike = {
  platform: string;
  vin?: string;
  vinSource?: string;
  title?: string;
  manufacturer?: string;
  mileageKm?: number | null;
  firstRegistration?: string;
  year?: string;
  countryCode?: string;
  sourceCountry?: string;
  lastSeenAt?: string;
  firstSeenAt?: string;
};

type OrderLike = {
  vin?: string | null;
  makeModel?: string | null;
  auditCompletedAt?: string | null;
  updatedAt?: string;
};

function sourceOf(platform: string): VinMemorySource | null {
  const p = platform.trim().toLowerCase();
  return VIN_MEMORY_SOURCES.find((s) => s === p) ?? null;
}

/** "03.2014", "2014-03", "2014-03-05", "03/2014", "2014" -> "YYYY-MM[-DD]" vai "YYYY". */
export function normalizeFirstRegistration(raw: string | undefined): string | undefined {
  const s = (raw ?? "").trim();
  if (!s) return undefined;
  let m = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (m) return m[3] ? `${m[1]}-${m[2]}-${m[3]}` : `${m[1]}-${m[2]}`;
  m = s.match(/^(?:(\d{2})[./])?(\d{2})[./](\d{4})$/);
  if (m) return m[1] ? `${m[3]}-${m[2]}-${m[1]}` : `${m[3]}-${m[2]}`;
  m = s.match(/^(\d{4})$/);
  return m ? m[1] : undefined;
}

export function observationsFromListings(vehicles: ListingLike[]): { inputs: VinObservationInput[]; skippedNoVin: number } {
  const inputs: VinObservationInput[] = [];
  let skippedNoVin = 0;
  for (const v of vehicles) {
    const source = sourceOf(v.platform);
    if (!source) continue;
    const vin = (v.vin ?? "").trim();
    if (!vin || !isMemoryVin(vin)) {
      skippedNoVin += 1;
      continue;
    }
    // OCR no foto bez apstiprinājuma var kļūdīties - tādu VIN atmiņā neliekam.
    if (v.vinSource === "ocr_photo") {
      skippedNoVin += 1;
      continue;
    }
    const date = v.lastSeenAt || v.firstSeenAt;
    if (!date) continue;
    const model = v.title || v.manufacturer || "";
    inputs.push({
      vin,
      date,
      source,
      km: v.mileageKm ?? null,
      model,
      firstRegistration: normalizeFirstRegistration(v.firstRegistration) ?? (v.year?.match(/^(19|20)\d{2}$/) ? v.year : undefined),
      country: v.sourceCountry || v.countryCode || undefined,
    });
  }
  return { inputs, skippedNoVin };
}

/** Pasūtījumi: datums = audita pabeigšana (ja ir), citādi pēdējā maiņa. Km pasūtījumu indeksā nav. */
export function observationsFromOrders(entries: OrderLike[]): { inputs: VinObservationInput[]; skippedNoVin: number } {
  const inputs: VinObservationInput[] = [];
  let skippedNoVin = 0;
  for (const e of entries) {
    const vin = (e.vin ?? "").trim();
    if (!vin || !isMemoryVin(vin)) {
      skippedNoVin += 1;
      continue;
    }
    if (!e.makeModel) continue;
    const date = e.auditCompletedAt || e.updatedAt;
    if (!date) continue;
    inputs.push({ vin, date, source: "order", km: null, model: e.makeModel });
  }
  return { inputs, skippedNoVin };
}
