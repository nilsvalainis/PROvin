"use client";

import { useEffect, useState } from "react";
import { AUTOPARKS_STATUS_LV, isAutoparksStatus } from "@/lib/iriss-autoparks";
import { V2_VAT_MODE_LV, type V2HistoryRow, type V2VatMode } from "@/lib/iriss-autoparks-v2";
import { v2HistoryText } from "@/lib/iriss-autoparks-v2-history-text";

/** Vēsture (tikai Nilam): kurš, kad, lauks, no -> uz. */
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
      <div className="ap2-card">
        {rows.length === 0 ? <p className="ap2-empty">Nav izmaiņu</p> : null}
        <ul className="ap2-hist">
          {rows.map((r) => {
            const t = v2HistoryText(r, (s, field) =>
              field === "purchase.vat" ? V2_VAT_MODE_LV[s as V2VatMode] || s : isAutoparksStatus(s) ? AUTOPARKS_STATUS_LV[s] : s,
            );
            return (
              <li key={r.id}>
                <span>{t.field}</span>
                <small>
                  {r.actorName} · {new Date(r.at).toLocaleString("lv-LV", { timeZone: "Europe/Riga", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </small>
                <span className="chg">{t.change}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
