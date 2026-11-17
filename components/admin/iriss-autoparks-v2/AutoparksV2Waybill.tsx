"use client";

import { useCallback, useEffect, useState } from "react";
import { IrissKomandaAivaramChat } from "@/components/admin/IrissKomandaAivaramChat";
import { IrissWaybillStopConfirm } from "@/components/admin/IrissWaybillStopConfirm";
import { useWaybillStop } from "@/components/admin/useWaybillStop";
import { formatWaybillExpiryDdMmHm } from "@/lib/iriss-pavadzimes-countdown";
import type { IrissPavadzimeListRow } from "@/lib/iriss-pavadzimes-types";
import { formatWaybillLeft } from "@/lib/iriss-waybill-gauges";
import type { WaybillVehicleChip } from "@/lib/iriss-waybill-vehicles";

type CarRef = { title: string; vin: string };

function normVin(v: string): string {
  return v.replace(/\s+/g, "").toUpperCase();
}

/** Šī auto derīgā pavadzīme (pēc VIN), ja ir. Tīra funkcija testiem. */
export function activeWaybillForCar(
  rows: readonly Pick<IrissPavadzimeListRow, "vin" | "validUntil" | "archived">[],
  vin: string,
  nowMs: number,
): number {
  const want = normVin(vin);
  if (!want) return -1;
  let best = -1;
  let bestUntil = 0;
  rows.forEach((r, i) => {
    if (r.archived || normVin(r.vin ?? "") !== want) return;
    const until = Date.parse(r.validUntil);
    if (!Number.isFinite(until) || until <= nowMs) return;
    if (until > bestUntil) {
      best = i;
      bestUntil = until;
    }
  });
  return best;
}

/**
 * Autoparka auto kartītē (Nils 27.10): poga «Pavadzīme» atver pavadzīmju formu turpat, auto jau aizpildīts,
 * numurs vienmēr jāizvēlas. Ja auto ir derīga pavadzīme - statuss un PDF / Pagarināt / Pārtraukt.
 * Autoparka datus nemaina (tikai lasa marku/modeli un VIN).
 */
export function AutoparksV2Waybill({ car }: { car: CarRef }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<WaybillVehicleChip | null>(null);
  const [active, setActive] = useState<IrissPavadzimeListRow | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const load = useCallback(() => {
    void fetch("/api/admin/iriss-pavadzimes?active=1", { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const json = (await res.json().catch(() => null)) as { rows?: IrissPavadzimeListRow[] } | null;
        const rows = Array.isArray(json?.rows) ? json.rows : [];
        const now = Date.now();
        const i = activeWaybillForCar(rows, car.vin, now);
        setActive(i >= 0 ? rows[i]! : null);
        setNowMs(now);
      })
      .catch(() => undefined);
  }, [car.vin]);

  const stop = useWaybillStop(load);

  useEffect(() => {
    load();
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function openForm(plate = "") {
    setDraft({ chip: car.title, brandModel: car.title, vin: car.vin, plate, orderId: "" });
    setOpen(true);
  }

  const onDraftConsumed = useCallback(() => setDraft(null), []);

  return (
    <div className="ap2-wb" data-autoparks-waybill="">
      {active ? (
        <div className="ap2-wb-active">
          <p className="ap2-wb-line">
            <b>{active.plate || "Pavadzīme"}</b>
            {" · "}līdz {formatWaybillExpiryDdMmHm(active.validUntil)} · atlikušas {formatWaybillLeft(active.validUntil, new Date(nowMs))}
          </p>
          <div className="ap2-wb-actions">
            <a className="ap2-wb-btn" href={`/api/admin/iriss-pavadzimes/${encodeURIComponent(active.id)}/pdf`} target="_blank" rel="noopener noreferrer">
              PDF{active.number ? ` · ${active.number}` : ""}
            </a>
            <button type="button" className="ap2-wb-btn" onClick={() => openForm(active.plate ?? "")}>
              Pagarināt
            </button>
            {active.number ? (
              <button
                type="button"
                className="ap2-wb-btn stop"
                onClick={() => stop.ask({ id: active.id, number: active.number, plate: active.plate ?? "" })}
              >
                Pārtraukt
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <button type="button" className="ap2-wb-main" onClick={() => openForm()}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M7 3h7l5 5v13H7z" />
            <path d="M14 3v5h5M10 13h6M10 17h4" />
          </svg>
          Pavadzīme
        </button>
      )}

      {open ? (
        <>
          <div className="ap2-dim" onClick={() => setOpen(false)} />
          <div className="ap2-wb-dialog" role="dialog" aria-label={`Pavadzīme: ${car.title}`}>
            <div className="ap2-wb-dialog-head">
              <b>Pavadzīme · {car.title}</b>
              <button type="button" aria-label="Aizvērt" className="ap2-wb-close" onClick={() => setOpen(false)}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <IrissKomandaAivaramChat draftVehicle={draft} onDraftConsumed={onDraftConsumed} compact requirePlateChoice />
          </div>
        </>
      ) : null}
      {stop.target ? (
        <IrissWaybillStopConfirm target={stop.target} busy={stop.busy} error={stop.error} onYes={() => void stop.confirm()} onNo={stop.cancel} />
      ) : null}
    </div>
  );
}
