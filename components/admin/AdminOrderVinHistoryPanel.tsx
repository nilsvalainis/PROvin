"use client";

import { useEffect, useState } from "react";
import { AdminVinHistoryList } from "@/components/admin/AdminVinHistoryList";
import type { VinHistoryEntry } from "@/lib/vin-history";

/**
 * Pasūtījumā: ja šis VIN jau pārbaudīts (cits klients vai agrāks darbs), parāda kad / kam / ko,
 * un ļauj vienā klikšķī pārnest jau nopirktos transportlīdzekļa datus. Personas dati netiek kopēti.
 */
export function AdminOrderVinHistoryPanel({
  sessionId,
  vin,
  listingUrl,
}: {
  sessionId: string;
  vin: string;
  listingUrl: string;
}) {
  const [entries, setEntries] = useState<VinHistoryEntry[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const v = vin.trim();
    if (v.length < 4) {
      setEntries([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/admin/vin-history?sessionId=${encodeURIComponent(sessionId)}&vin=${encodeURIComponent(v)}`, {
        cache: "no-store",
        signal: ctrl.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => setEntries(Array.isArray(j?.entries) ? (j.entries as VinHistoryEntry[]) : []))
        .catch(() => {});
    }, 600);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [sessionId, vin]);

  if (entries.length === 0 && !msg) return null;

  const reuse = async (fromId: string) => {
    if (!window.confirm("Pārnest iepriekš nopirktos transportlīdzekļa datus šajā pasūtījumā? Nesaglabātās izmaiņas vispirms saglabā.")) return;
    setBusyId(fromId);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/vin-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, fromId, vin, listingUrl }),
      });
      const j = (await res.json().catch(() => ({}))) as { copied?: string[]; conflicts?: string[]; error?: string };
      if (!res.ok) {
        setMsg(`Kļūda: ${j.error ?? res.status}`);
        return;
      }
      const conflicts = j.conflicts ?? [];
      setMsg(
        `Pārnesti bloki: ${(j.copied ?? []).length}.${conflicts.length ? ` Atšķiras (paliek esošais): ${conflicts.join(", ")}.` : ""} Lapa pārlādējas…`,
      );
      // Darba zona jāpārlādē no servera, citādi automātiskā saglabāšana pārrakstītu jaunos datus.
      setTimeout(() => window.location.reload(), 900);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-1">
      <AdminVinHistoryList entries={entries} busyId={busyId} onReuse={(id) => void reuse(id)} />
      {msg ? <p className="px-1 text-[11px] text-[var(--color-apple-text)]">{msg}</p> : null}
    </div>
  );
}
