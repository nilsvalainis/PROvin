"use client";

import { useEffect, useRef } from "react";
import { listingVinOcrIsCrossChecked } from "@/lib/iriss-listings-vin-from-photos";
import type { IrissListingVehicle, IrissListingVinOcrStatus } from "@/lib/iriss-listings-types";

export type ListingVinOcrPatch = Pick<IrissListingVehicle, "vin" | "vinSource" | "vinOcrStatus" | "vinOcrAlts">;

const inflight = new Set<string>();
const queued: string[] = [];
const waiters = new Map<string, Array<(patch: ListingVinOcrPatch | null) => void>>();
let running = false;

function asVinOcrStatus(v: unknown): IrissListingVinOcrStatus | undefined {
  if (v === "confirmed" || v === "unverified" || v === "conflict" || v === "miss" || v === "found") return v;
  return undefined;
}

function asAlts(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().toUpperCase());
  return out.length ? out : [];
}

async function runQueue() {
  if (running) return;
  running = true;
  while (queued.length > 0) {
    const id = queued.shift();
    if (!id) continue;
    inflight.add(id);
    let patch: ListingVinOcrPatch | null = null;
    try {
      const res = await fetch("/api/admin/iriss-listings/vin-ocr", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vehicleId: id }),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          status?: string;
          vin?: string;
          vinSource?: string;
          vinOcrAlts?: unknown;
        };
        const status = asVinOcrStatus(json.status);
        const alts = asAlts(json.vinOcrAlts);
        if (json.status === "has_vin" || status === "confirmed") {
          const vin = typeof json.vin === "string" ? json.vin : "";
          if (vin) {
            patch = {
              vin,
              vinSource: json.vinSource === "ocr_photo" ? "ocr_photo" : "source",
              vinOcrStatus: json.vinSource === "ocr_photo" ? "confirmed" : undefined,
              vinOcrAlts: json.vinSource === "ocr_photo" ? alts : undefined,
            };
          }
        } else if (json.status === "miss" || status === "conflict") {
          patch = { vinOcrStatus: "miss", vinOcrAlts: [] };
        }
      }
    } catch {
      patch = null;
    } finally {
      inflight.delete(id);
      const cbs = waiters.get(id) ?? [];
      waiters.delete(id);
      for (const cb of cbs) cb(patch);
    }
  }
  running = false;
}

function enqueue(id: string, cb: (patch: ListingVinOcrPatch | null) => void) {
  const list = waiters.get(id) ?? [];
  list.push(cb);
  waiters.set(id, list);
  if (!inflight.has(id) && !queued.includes(id)) queued.push(id);
  void runQueue();
}

export function useListingVinOcr(
  v: Pick<
    IrissListingVehicle,
    "id" | "platform" | "vin" | "vinSource" | "vinOcrStatus" | "imageUrl" | "imageUrls" | "documentImageUrls"
  >,
  onPatch: (id: string, patch: ListingVinOcrPatch) => void,
) {
  const onPatchRef = useRef(onPatch);
  onPatchRef.current = onPatch;
  useEffect(() => {
    if (v.platform !== "auto1") return;
    if (v.vin && v.vinSource !== "ocr_photo") return;
    if (v.vinOcrStatus === "miss") return;
    if (v.vin && listingVinOcrIsCrossChecked(v.vinOcrStatus)) return;
    const hasPhotos = Boolean(v.imageUrl || (v.imageUrls && v.imageUrls.length) || (v.documentImageUrls && v.documentImageUrls.length));
    if (!hasPhotos) return;
    let cancelled = false;
    enqueue(v.id, (patch) => {
      if (cancelled || !patch) return;
      onPatchRef.current(v.id, patch);
    });
    return () => {
      cancelled = true;
    };
  }, [v.documentImageUrls, v.id, v.imageUrl, v.imageUrls, v.platform, v.vin, v.vinOcrStatus, v.vinSource]);
}
