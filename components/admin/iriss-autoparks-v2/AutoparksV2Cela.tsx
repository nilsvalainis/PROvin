"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CABINET_PICKUP_STAGE_LV } from "@/lib/iriss-logistics-cabinet";
import { AUTOPARKS_TRANSIT_STEPS, type AutoparksTransit } from "@/lib/iriss-autoparks-transit";

function dateLv(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso || "-";
}

/**
 * Kabineta cilne «Ceļā» (Nils 27.10, makets): Loģistika ir Autoparka posms. Rāda transporta stāvokli,
 * savākšanu un kravu; «Atvests» pārslēdz auto uz «Gaida sagatavošanu» un Loģistikas ierakstu uz arhīvu.
 * Summas šeit nav (šoferis tās neredz).
 */
export function AutoparksV2Cela({ transit, canWrite = true }: { transit: AutoparksTransit; canWrite?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const current = AUTOPARKS_TRANSIT_STEPS.indexOf(transit.stage);

  async function arrived() {
    if (!window.confirm("Auto atvests? Statuss kļūs «Gaida sagatavošanu», Loģistikā auto aizies uz arhīvu.")) return;
    setBusy(true);
    setErr("");
    const res = await fetch("/api/admin/iriss-logistics/autoparks", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromOrderId: transit.orderId }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setErr("Neizdevās atzīmēt kā atvestu.");
      return;
    }
    router.refresh();
  }

  const rows: Array<[string, string]> = [
    ["Savākšanas vieta", transit.pickupAddress || "-"],
    ["Izsole", transit.auction || "-"],
    ["Pickup nr.", transit.pickupRef || "-"],
    ["Krava", transit.cargoPlace ? `${transit.cargoLabel} (${transit.cargoPlace}. vieta)` : transit.cargoLabel],
    ["Savākšanas datums", transit.pickupDate ? dateLv(transit.pickupDate) : "-"],
    ["Bezmaksas stāvvieta līdz", transit.freeParkingUntil ? dateLv(transit.freeParkingUntil) : "-"],
    ["Loģistikas statuss", transit.orderStatusLabel || "-"],
  ];

  return (
    <section className="ap2-cela" aria-label="Ceļā">
      <ol className="ap2-cela-steps">
        {AUTOPARKS_TRANSIT_STEPS.map((s, i) => (
          <li key={s} className={i === current ? "cur" : i < current ? "done" : ""} aria-current={i === current ? "step" : undefined}>
            <span>{i + 1}.</span>
            <b>{CABINET_PICKUP_STAGE_LV[s]}</b>
          </li>
        ))}
      </ol>
      <dl className="ap2-cela-kv">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {err ? <p className="ap2-err">{err}</p> : null}
      <div className="ap2-cela-acts">
        {canWrite ? (
          <button type="button" className="iriss-btn iriss-btn--primary" disabled={busy} onClick={() => void arrived()}>
            {busy ? "Saglabā..." : "Atvests → Gaida sagatavošanu"}
          </button>
        ) : null}
        <Link className="iriss-btn iriss-btn--secondary" href={`/admin/iriss/logistika?car=${encodeURIComponent(transit.orderId)}`}>
          Atvērt Loģistikā
        </Link>
      </div>
    </section>
  );
}
