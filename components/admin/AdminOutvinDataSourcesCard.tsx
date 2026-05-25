"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OutvinCapabilitySlotUi, OutvinDataBundle } from "@/lib/outvin-data-bundle";
import { getAutoRecordsOutvinBundle, syncAutoRecordsWithOutvinBundle } from "@/lib/outvin-admin-sync";
import type { AutoRecordsBlockState } from "@/lib/admin-source-blocks";
import { normalizeVin, isOutvinApiVin } from "@/lib/order-field-validation";
import { AdminOutvinStructuredSections } from "@/components/admin/AdminOutvinStructuredSections";

type Props = {
  block: AutoRecordsBlockState;
  orderVin?: string | null;
  readOnly: boolean;
  disabled?: boolean;
  onBlockChange: (next: AutoRecordsBlockState) => void;
};

function statusBadge(slot: OutvinCapabilitySlotUi): { label: string; className: string } {
  switch (slot.status) {
    case "purchased":
      return { label: "Iegādāts", className: "bg-emerald-100 text-emerald-800" };
    case "disabled":
      return { label: "Nav pieejams", className: "bg-slate-100 text-slate-500" };
    case "unavailable":
      return { label: "Nav datu", className: "bg-amber-50 text-amber-800" };
    default:
      return { label: "Pieejams", className: "bg-sky-50 text-sky-800" };
  }
}

export function AdminOutvinDataSourcesCard({
  block,
  orderVin,
  readOnly,
  disabled,
  onBlockChange,
}: Props) {
  const vin = normalizeVin(orderVin ?? "");
  const vinReady = isOutvinApiVin(vin);
  const bundle = getAutoRecordsOutvinBundle(block, vin);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [precheckBusy, setPrecheckBusy] = useState(false);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState<Set<number>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const autoPrecheckDone = useRef(false);

  const slots = useMemo(
    () => (bundle.capabilitySlots.length > 0 ? bundle.capabilitySlots : []),
    [bundle.capabilitySlots],
  );

  const creditTotal = useMemo(() => {
    let n = 0;
    for (const t of selected) {
      const slot = slots.find((s) => s.historyType === t);
      if (slot && slot.status === "available") n += slot.creditCost;
    }
    return n;
  }, [selected, slots]);

  const applyBundle = useCallback(
    (nextBundle: OutvinDataBundle) => {
      onBlockChange(syncAutoRecordsWithOutvinBundle(block, nextBundle));
    },
    [block, onBlockChange],
  );

  const runPrecheck = useCallback(async () => {
    if (!vinReady) {
      setErr("Nepieciešams derīgs 17 simbolu VIN");
      return;
    }
    setPrecheckBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/outvin/capabilities", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin, existingBundle: bundle }),
      });
      const data = (await res.json()) as { bundle?: OutvinDataBundle; error?: string; detail?: string };
      if (!res.ok) {
        setErr(mapApiError(data));
        return;
      }
      if (data.bundle) applyBundle(data.bundle);
    } catch {
      setErr("Neizdevās savienoties ar Outvin");
    } finally {
      setPrecheckBusy(false);
    }
  }, [applyBundle, bundle, vin, vinReady]);

  useEffect(() => {
    if (!vinReady || readOnly || disabled) return;
    if (autoPrecheckDone.current) return;
    if (bundle.precheckAt && slots.length > 0) {
      autoPrecheckDone.current = true;
      return;
    }
    autoPrecheckDone.current = true;
    void runPrecheck();
  }, [vinReady, readOnly, disabled, bundle.precheckAt, slots.length, runPrecheck]);

  const toggleType = (historyType: number, slot: OutvinCapabilitySlotUi) => {
    if (slot.status !== "available") return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(historyType)) next.delete(historyType);
      else next.add(historyType);
      return next;
    });
  };

  const runPurchase = async () => {
    if (!vinReady || selected.size === 0) return;
    const types = [...selected].filter((t) => {
      const slot = slots.find((s) => s.historyType === t);
      return slot?.status === "available";
    });
    if (types.length === 0) return;

    setPurchaseBusy(true);
    setErr(null);
    setLoadingTypes(new Set(types));
    try {
      const res = await fetch("/api/admin/outvin/purchase", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin, types, existingBundle: bundle }),
      });
      const data = (await res.json()) as {
        bundle?: OutvinDataBundle;
        purchaseMessage?: string;
        paymentRequired?: boolean;
        results?: Array<{ type: number; ok: boolean; error?: string; httpStatus?: number }>;
        error?: string;
        detail?: string;
      };
      if (data.bundle) applyBundle(data.bundle);
      if (!res.ok) {
        setErr(formatPurchaseError(data));
        return;
      }
      setSelected(new Set());
      const feedback = formatPurchaseFeedback(data);
      if (feedback) setErr(feedback);
    } catch {
      setErr("Kļūda iegādē: neizdevās savienoties ar serveri");
    } finally {
      setPurchaseBusy(false);
      setLoadingTypes(new Set());
    }
  };

  if (!vinReady && bundle.purchases.length === 0) {
    return (
      <p className="mb-2 text-[10px] text-slate-500">
        Outvin: ievadi 17 simbolu VIN pasūtījuma galvenē, lai pārbaudītu datu avotus.
      </p>
    );
  }

  return (
    <div className="mb-3 rounded-lg border border-orange-200/80 bg-orange-50/30 p-2">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-700">
          Pieejamie Outvin datu avoti
        </p>
        {!readOnly && !disabled ? (
          <button
            type="button"
            className="rounded-md border border-orange-300/60 bg-white px-2 py-0.5 text-[10px] font-medium text-orange-800 hover:bg-orange-50 disabled:opacity-50"
            disabled={precheckBusy || !vinReady}
            onClick={() => void runPrecheck()}
          >
            {precheckBusy ? "Pārbauda…" : "Pārbaudīt Outvin iespējas"}
          </button>
        ) : null}
      </div>
      <p className="mb-2 text-[9px] leading-snug text-slate-600">
        Bezmaksas pārbaude (VIN + status API). Katrs veiksmīgs vēstures tips = 1 kredīts — atlasiet un pērciet
        manuāli.
      </p>
      {err ? (
        <p className="mb-2 text-[9px] leading-snug text-amber-800/90" title={err}>
          {err}
        </p>
      ) : null}

      {slots.length === 0 ? (
        <p className="text-[10px] text-slate-500">Nospied „Pārbaudīt Outvin iespējas”, lai redzētu sarakstu.</p>
      ) : (
        <ul className="mb-2 space-y-1">
          {slots.map((slot) => {
            const badge = statusBadge(slot);
            const isLoading = loadingTypes.has(slot.historyType);
            const canSelect = slot.status === "available" && !readOnly && !disabled;
            return (
              <li
                key={slot.id}
                className={`flex flex-wrap items-start gap-2 rounded-md border px-2 py-1 text-[10px] ${
                  slot.status === "disabled" ? "border-slate-100 bg-slate-50/80 opacity-70" : "border-slate-200/90 bg-white"
                }`}
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 shrink-0"
                    checked={selected.has(slot.historyType)}
                    disabled={!canSelect || purchaseBusy}
                    onChange={() => toggleType(slot.historyType, slot)}
                  />
                  <span className="min-w-0 flex-1 leading-snug text-slate-800">{slot.titleLv}</span>
                </label>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ${badge.className}`}>
                  {badge.label}
                </span>
                <span className="shrink-0 rounded bg-orange-100 px-1.5 py-0.5 text-[9px] font-semibold text-orange-900">
                  {slot.creditCost} kredīts
                </span>
                {isLoading ? (
                  <span className="text-[9px] text-slate-500" aria-live="polite">
                    Ielādē…
                  </span>
                ) : null}
                {slot.statusReason ? (
                  <span className="w-full text-[9px] text-slate-500">{slot.statusReason}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {!readOnly && !disabled ? (
        <button
          type="button"
          className="w-full rounded-md border border-[var(--color-provin-accent)]/40 bg-[var(--color-provin-accent)]/10 px-2 py-1 text-[10px] font-semibold text-[var(--color-provin-accent)] hover:bg-[var(--color-provin-accent)]/15 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={purchaseBusy || creditTotal === 0}
          onClick={() => void runPurchase()}
        >
          {purchaseBusy
            ? "Pērk…"
            : `Pirkt atlasītos datus (patērēs ${creditTotal} kredītu${creditTotal === 1 ? "" : "s"})`}
        </button>
      ) : null}

      <AdminOutvinStructuredSections
        bundle={bundle.purchases.length > 0 || bundle.precheckAt ? bundle : getAutoRecordsOutvinBundle(block, vin)}
        readOnly={readOnly}
        disabled={disabled}
        onBundleChange={(next) => applyBundle(next)}
      />
    </div>
  );
}

function mapApiError(data: { error?: string; detail?: string }): string {
  const detail = typeof data.detail === "string" ? data.detail.trim() : "";
  if (data.error === "missing_outvin_credentials") return "Nav OUTVIN_EMAIL / OUTVIN_PASSWORD";
  if (data.error === "outvin_unauthorized") return "Outvin: nederīgs konts";
  if (data.error === "invalid_vin") return "Nederīgs VIN";
  if (data.error === "no_types_selected") return "Atlasiet vismaz vienu avotu";
  return detail ? `Kļūda iegādē: ${detail}` : "Kļūda iegādē";
}

function formatPurchaseFeedback(data: {
  purchaseMessage?: string;
  paymentRequired?: boolean;
  results?: Array<{ type: number; ok: boolean; error?: string; httpStatus?: number }>;
}): string | null {
  if (typeof data.purchaseMessage === "string" && data.purchaseMessage.trim()) {
    return data.purchaseMessage.trim();
  }
  const failed = (data.results ?? []).filter((r) => !r.ok);
  if (failed.length === 0) return null;
  if (data.paymentRequired && failed.some((r) => r.httpStatus === 402)) {
    return "Outvin: kontā beidzās kredīti (HTTP 402). Daļa datu var būt jau saglabāta.";
  }
  return `Kļūda iegādē: ${failed
    .map((r) => {
      const status = r.httpStatus != null ? ` HTTP ${r.httpStatus}` : "";
      return `Type ${r.type} — ${r.error ?? "nezināms"}${status}`;
    })
    .join("; ")}`;
}

function formatPurchaseError(data: {
  purchaseMessage?: string;
  error?: string;
  detail?: string;
  results?: Array<{ type: number; ok: boolean; error?: string; httpStatus?: number }>;
}): string {
  const partial = formatPurchaseFeedback(data);
  if (partial) return partial;
  return mapApiError(data);
}
