"use client";

import { useEffect, useState } from "react";
import { AUTOPARKS_STATUS_LV, isAutoparksStatus } from "@/lib/iriss-autoparks";
import { V2_VAT_MODE_LV, type V2HistoryRow, type V2VatMode } from "@/lib/iriss-autoparks-v2";
import { groupV2HistoryByDay, v2HistoryParts } from "@/lib/iriss-autoparks-v2-history-text";

const value = (s: string, field: string) =>
  field === "purchase.vat" ? V2_VAT_MODE_LV[s as V2VatMode] || s : isAutoparksStatus(s) ? AUTOPARKS_STATUS_LV[s] : s;

const time = (iso: string) => new Date(iso).toLocaleTimeString("lv-LV", { timeZone: "Europe/Riga", hour: "2-digit", minute: "2-digit" });

/** Vēsture (tikai Nilam), makets 27.10: pa dienām, laiks · kurš · kas · vecā (pārsvītrota) -> jaunā. */
export function AutoparksV2HistoryList({ rows, now }: { rows: V2HistoryRow[]; now?: Date }) {
  if (rows.length === 0) return <p className="ap2-empty">Nav izmaiņu</p>;
  return (
    <div className="ap2-vh">
      {groupV2HistoryByDay(rows, now).map((g) => (
        <section key={g.label} aria-label={g.label}>
          <h4 className="ap2-vh-day">{g.label}</h4>
          <div className="ap2-vh-card">
            {g.rows.map((r) => {
              const p = v2HistoryParts(r, value);
              return (
                <div key={r.id} className="ap2-vh-r">
                  <span className="t">
                    {time(r.at)}
                    <span className="wm"> · {r.actorName}</span>
                  </span>
                  <span className="w">{r.actorName}</span>
                  <span className="f">{p.field}</span>
                  <span className="c">
                    {p.from ? <s>{p.from}</s> : null}
                    {p.from && p.to ? <span className="ar"> → </span> : null}
                    {p.to ? <b>{p.to}</b> : p.from ? <span className="ar"> → -</span> : null}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function AutoparksV2History({ carId }: { carId: string }) {
  const [rows, setRows] = useState<V2HistoryRow[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/admin/iriss-autoparks-v2/vesture/${encodeURIComponent(carId)}`)
      .then((r) => r.json())
      .then((d: { history?: V2HistoryRow[] }) => live && setRows(d.history ?? []))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [carId]);
  if (!rows) return null;
  return (
    <div className="ap2-pane">
      <AutoparksV2HistoryList rows={rows} />
    </div>
  );
}
