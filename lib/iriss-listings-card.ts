/**
 * IRISS LIST kartītes tīrā loģika (foto, VIN rādījums, 1. reģ., atskaite, specifikācijas).
 */

import { formatListingPowerKwLabel } from "@/lib/engine-power-kw";
import { listingCopyId, type ListingDetailUrlInput } from "@/lib/iriss-listings-detail-url";
import { listingVinSourceMark } from "@/lib/iriss-listings-vin-from-photos";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { hasIso3779CheckDigit } from "@/lib/vin-iso3779";

export { listingVinSourceMark };

export const LISTING_VIN_SCAN_PATH = "/admin/iriss/scan";

export type ListingCardPhotoInput = {
  imageUrl?: string;
  imageUrls?: string[];
};

export type ListingCardGallery = {
  photos: string[];
  /** Bultiņas un sīktēlu josla tikai ja avots iedeva imageUrls un ir vairāk par 1 bildi. */
  interactive: boolean;
};

export function listingCardGallery(v: ListingCardPhotoInput): ListingCardGallery {
  const extras = (v.imageUrls ?? []).map((u) => u.trim()).filter(Boolean);
  const main = (v.imageUrl ?? "").trim();
  if (extras.length === 0) {
    return { photos: main ? [main] : [], interactive: false };
  }
  const photos: string[] = [];
  for (const u of [main, ...extras]) {
    if (u && !photos.includes(u)) photos.push(u);
  }
  return { photos, interactive: photos.length > 1 };
}

/** 4. sīktēls rāda +N (atlikušās, ieskaitot šo kadru): 17 bildes -> +14. */
export function listingThumbOverflowLabel(total: number, stripSize = 4): string {
  if (total <= stripSize) return "";
  const extra = total - (stripSize - 1);
  return extra > 0 ? `+${extra}` : "";
}

export function listingVinScanHref(vin: string): string {
  const v = normalizeVin(vin);
  if (!isValidVin(v)) return "";
  return `${LISTING_VIN_SCAN_PATH}?vin=${encodeURIComponent(v)}`;
}

export type ListingVinCardState = {
  vin: string;
  scanHref: string;
  handoff: boolean;
};

/**
 * LIST VIN rinda: avota VIN, vai OCR tikai ja 2+ foto sakrīt / check digit der.
 * Nesakritība un viena nederīga virkne - nerāda neko. Bez palīdzības tekstiem.
 */
export function listingVinCardState(v: {
  vin?: string;
  vinSource?: string;
  vinOcrStatus?: string;
}): ListingVinCardState | null {
  const vin = v.vin && isValidVin(normalizeVin(v.vin)) ? normalizeVin(v.vin) : "";
  if (!vin) return null;
  if (v.vinSource === "ocr_photo") {
    if (v.vinOcrStatus === "conflict") return null;
    if (v.vinOcrStatus !== "confirmed" && !hasIso3779CheckDigit(vin)) return null;
  }
  const scanHref = listingVinScanHref(vin);
  if (!scanHref) return null;
  return { vin, scanHref, handoff: true };
}

/** Pilns VIN operators kopē; kartītē saīsināts kā maketā (WBA…7731). */
export function listingVinShort(vin: string): string {
  const v = normalizeVin(vin);
  if (!v) return "";
  if (v.length <= 8) return v;
  return `${v.slice(0, 3)}…${v.slice(-4)}`;
}

export function listingStockNo(v: ListingDetailUrlInput): string {
  return listingCopyId(v);
}

export function listingFirstRegLabel(firstRegistration: string | null | undefined): string {
  const s = String(firstRegistration ?? "").trim();
  if (!s) return "";
  const iso = s.match(/^(\d{4})-(\d{2})(?:-\d{2})?/);
  if (iso) return `${iso[2]}/${iso[1]}`;
  const dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dmy) return `${dmy[2]!.padStart(2, "0")}/${dmy[3]}`;
  const my = s.match(/^(\d{1,2})[./](\d{4})$/);
  if (my) return `${my[1]!.padStart(2, "0")}/${my[2]}`;
  const y = s.match(/((?:19|20)\d{2})/);
  return y ? y[1]! : "";
}

export function listingDaysInAuctionLabel(startIso: string, nowMs: number | null): string {
  if (nowMs == null) return "";
  const t = Date.parse(startIso);
  if (!Number.isFinite(t)) return "";
  const d = (nowMs - t) / 86_400_000;
  if (d < 1) return `${Math.max(1, Math.round(Math.max(0, d) * 24))} h`;
  return `${Math.floor(d)}. diena`;
}

export function listingAuctionEndLabel(endIso: string): string {
  const t = Date.parse(endIso);
  if (!Number.isFinite(t)) return "";
  const parts = new Intl.DateTimeFormat("lv-LV", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Riga",
  }).formatToParts(new Date(t));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const day = get("day");
  const month = get("month");
  const hour = get("hour");
  const minute = get("minute");
  if (!day || !month || !hour || !minute) return "";
  return `beidzas ${day}.${month}. ${hour}:${minute}`;
}

export type ListingCountdown = { t: string; k: string; end: string };

export function listingCountdown(endIso: string, nowMs: number | null): ListingCountdown {
  const end = listingAuctionEndLabel(endIso);
  if (nowMs == null) return { t: "\u00a0", k: "text-slate-400", end };
  if (!endIso.trim()) return { t: "Beigu laiks nav zināms", k: "text-slate-400", end: "" };
  const endMs = Date.parse(endIso);
  if (!Number.isFinite(endMs)) return { t: "Beigu laiks nav zināms", k: "text-slate-400", end: "" };
  const ms = endMs - nowMs;
  if (ms <= 0) return { t: "Beigusies", k: "text-slate-400", end };
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}`;
  const t = d ? `${d}d ${clock}` : clock;
  const k = ms < 36e5 ? "text-red-600" : ms < 86_400_000 ? "text-orange-600" : "text-amber-600";
  return { t, k, end };
}

export type ListingSpecCell = { label: string; value: string };

export function listingSpecCells(v: {
  firstRegistration?: string;
  mileageKm?: number | null;
  fuel?: string;
  transmission?: string;
  powerKw?: string;
  color?: string;
}): ListingSpecCell[] {
  const km =
    v.mileageKm != null && Number.isFinite(v.mileageKm) ? `${Math.round(v.mileageKm).toLocaleString("lv-LV")} km` : "";
  const cells: ListingSpecCell[] = [
    { label: "1. reģ.", value: listingFirstRegLabel(v.firstRegistration) },
    { label: "Nobraukums", value: km },
    { label: "Degviela", value: (v.fuel ?? "").trim() },
    { label: "Kārba", value: (v.transmission ?? "").trim() },
    { label: "Jauda", value: formatListingPowerKwLabel(v.powerKw) },
    { label: "Krāsa", value: (v.color ?? "").trim() },
  ];
  return cells.filter((c) => c.value);
}

export function listingSubtitleParts(v: { bodyType?: string; doorCount?: string }): string {
  const body = (v.bodyType ?? "").trim();
  const doors = (v.doorCount ?? "").trim();
  const doorLabel = doors ? `${doors} durvis` : "";
  return [body, doorLabel].filter(Boolean).join(" · ");
}

export function listingFmtEur(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  const rounded = Math.round(n);
  const grouped = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${rounded < 0 ? "-" : ""}${grouped} €`;
}

export const LISTING_BUDGET_FIT_OK = "Ietilpst budžetā";
export const LISTING_BUDGET_FIT_OVER = "Pārsniedz budžetu";

/** +X € zem budžeta / -X € virs. Bez paskaidrojuma. */
export function listingBudgetFitPill(budget: number, total: number): { ok: boolean; label: string } {
  const left = budget - total;
  if (left >= 0) return { ok: true, label: `${LISTING_BUDGET_FIT_OK} +${listingFmtEur(left)}` };
  return { ok: false, label: `${LISTING_BUDGET_FIT_OVER} -${listingFmtEur(-left)}` };
}
