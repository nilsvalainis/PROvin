/**
 * IRISS meklētāja cenu ↑/↓ čipi no sludinājuma priceHistory.
 */

import { isRealListingPriceChange } from "@/lib/iriss-listings-auto1-cents";
import { listingFmtEur } from "@/lib/iriss-listings-card";
import type { IrissListingPriceChange } from "@/lib/iriss-listings-types";
import { applyProvinHumanDashes } from "@/lib/source-summary-comment-format";

export type IrissPriceChipDirection = "up" | "down";
export type IrissPriceChipFilter = "all" | "down" | "up";

export type IrissPriceChip = {
  direction: IrissPriceChipDirection;
  delta: number;
  at: string;
  sinceLabel: string;
  label: string;
};

export type IrissPriceHistoryRow = {
  at: string;
  stamp: string;
  from: number;
  to: number;
  delta: number;
  direction: IrissPriceChipDirection;
};

function shortDateFromIso(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Riga",
    day: "2-digit",
    month: "2-digit",
  }).formatToParts(new Date(t));
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return day && month ? `${day}.${month}` : "";
}

function stampFromIso(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Riga",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(t));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}.${get("month")} ${get("hour")}:${get("minute")}`;
}

export function realIrissPriceChanges(
  history: readonly IrissListingPriceChange[] | undefined,
): IrissListingPriceChange[] {
  return (history ?? [])
    .filter((row) => isRealListingPriceChange(row) && row.from != null && row.to != null)
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function irissPriceHistoryRows(
  history: readonly IrissListingPriceChange[] | undefined,
): IrissPriceHistoryRow[] {
  return realIrissPriceChanges(history).map((row) => {
    const from = row.from as number;
    const to = row.to as number;
    const delta = to - from;
    return {
      at: row.at,
      stamp: stampFromIso(row.at),
      from,
      to,
      delta,
      direction: delta < 0 ? "down" : "up",
    };
  });
}

export function latestIrissPriceChip(
  history: readonly IrissListingPriceChange[] | undefined,
): IrissPriceChip | null {
  const rows = irissPriceHistoryRows(history);
  const last = rows[rows.length - 1];
  if (!last || last.delta === 0) return null;
  const since = shortDateFromIso(last.at);
  const arrow = last.direction === "down" ? "↓" : "↑";
  const abs = listingFmtEur(Math.abs(last.delta));
  return {
    direction: last.direction,
    delta: last.delta,
    at: last.at,
    sinceLabel: since,
    label: applyProvinHumanDashes(since ? `${arrow} ${abs} kopš ${since}` : `${arrow} ${abs}`),
  };
}

export function irissPriceChipFilterLabel(filter: IrissPriceChipFilter): string {
  if (filter === "down") return "Cena kritusies";
  if (filter === "up") return "Cena kāpusi";
  return "Visas cenas";
}

export function hitMatchesIrissPriceFilter(
  history: readonly IrissListingPriceChange[] | undefined,
  filter: IrissPriceChipFilter,
): boolean {
  if (filter === "all") return true;
  const chip = latestIrissPriceChip(history);
  if (!chip) return false;
  return chip.direction === filter;
}
