"use client";

import { useEffect, useState } from "react";
import { AdminAuctionArchiveView, type AuctionArchiveCounts } from "@/components/admin/AdminAuctionArchiveView";
import type { VinObservation } from "@/lib/vin-memory";
import type { AuctionSourceProgress, VinMemoryBrowseRow } from "@/lib/vin-memory-auction";

type Payload = {
  counts: AuctionArchiveCounts | null;
  recent: VinMemoryBrowseRow[];
  progress: { autobid: AuctionSourceProgress; openline: AuctionSourceProgress } | null;
  passDay: string;
  completedDay: string | null;
  vin: string;
  observations: VinObservation[];
  rollback: { earlier: VinObservation; later: VinObservation } | null;
  vinNote: string;
  error?: string;
};

export function AdminAuctionArchiveClient({ initialVin }: { initialVin: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(vin: string) {
    const q = vin ? `?vin=${encodeURIComponent(vin)}` : "";
    const r = await fetch(`/api/admin/vin-memory-archive${q}`, { credentials: "include" });
    const body = (await r.json()) as Payload;
    if (!r.ok) throw new Error(body.error || "Neizdevās nolasīt arhīvu.");
    setData(body);
  }

  useEffect(() => {
    let alive = true;
    load(initialVin)
      .catch((err: unknown) => {
        if (alive) setMessage(err instanceof Error ? err.message : "Neizdevās nolasīt arhīvu.");
      });
    return () => {
      alive = false;
    };
    // load ir stabils šajā komponentē; atkarība ir tikai no VIN.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVin]);

  async function runStep() {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/admin/vin-memory-archive", { method: "POST", credentials: "include" });
      const body = (await r.json()) as { error?: string; note?: string; source?: string; sliceId?: string; vins?: number; added?: number; idle?: string };
      if (!r.ok) throw new Error(body.error || "Solis neizdevās.");
      const bit = body.idle ? body.note : `${body.source ?? ""} ${body.sliceId ?? ""}: ${body.vins ?? 0} VIN, jauni ${body.added ?? 0}. ${body.note ?? ""}`;
      setMessage((bit ?? "").trim());
      await load(initialVin);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Solis neizdevās.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteVin() {
    if (!initialVin) return;
    if (!window.confirm(`Dzēst ${initialVin} no Izsoļu portālu arhīva? Šķembā šis VIN vairs nebūs.`)) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(`/api/admin/vin-memory-archive?vin=${encodeURIComponent(initialVin)}`, { method: "DELETE", credentials: "include" });
      const body = (await r.json()) as { error?: string; removed?: boolean };
      if (!r.ok) throw new Error(body.error || "Dzēšana neizdevās.");
      setMessage(body.removed ? "VIN izņemts no šķembas." : "Šī VIN šķembā nebija.");
      await load(initialVin);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Dzēšana neizdevās.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteLedger() {
    if (!window.confirm("Dzēst gājiena kursoru un skaitītāju kešu? VIN šķembas paliek.")) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/admin/vin-memory-archive?ledger=cursor", { method: "DELETE", credentials: "include" });
      const body = (await r.json()) as { error?: string; ok?: boolean };
      if (!r.ok) throw new Error(body.error || "Kursoru neizdevās dzēst.");
      setMessage(body.ok ? "Kursors un skaitītāju kešs dzēsti." : "Kursoru neizdevās dzēst līdz galam.");
      await load(initialVin);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Kursoru neizdevās dzēst.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminAuctionArchiveView
      counts={data?.counts ?? null}
      recent={data?.recent ?? data?.counts?.recent ?? []}
      progress={data?.progress ?? null}
      passDay={data?.passDay ?? ""}
      completedDay={data?.completedDay ?? null}
      vin={initialVin}
      observations={data?.observations ?? []}
      rollback={data?.rollback ?? null}
      vinNote={data?.vinNote ?? ""}
      message={message}
      busy={busy}
      onRun={() => void runStep()}
      onDeleteVin={initialVin ? () => void deleteVin() : undefined}
      onDeleteLedger={() => void deleteLedger()}
    />
  );
}
