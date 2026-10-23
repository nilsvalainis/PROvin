"use client";

import { useEffect, useState } from "react";
import { fmtDateLv, fmtEur } from "@/lib/iriss-autoparks-v2-format";
import type { CabinetPaneProps } from "./AutoparksV2Cabinet";

type Row = { id: string; text: string; date: string; amountEur: number | null };
type View = { rows: Row[]; totalEur: number | null; canSums: boolean };

/** Citi izdevumi: teksts + datums + summa (summa tikai ar Summām). Ieskaitās pašizmaksā. */
export function AutoparksV2Izdevumi({ carId }: CabinetPaneProps) {
  const [v, setV] = useState<View | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const api = `/api/admin/iriss-autoparks-v2/izdevumi/${encodeURIComponent(carId)}`;

  useEffect(() => {
    let live = true;
    fetch(api)
      .then((r) => r.json())
      .then((d: { izdevumi?: View }) => live && d.izdevumi && setV(d.izdevumi))
      .catch(() => live && setError("Neizdevās ielādēt"));
    return () => {
      live = false;
    };
  }, [api]);

  async function patch(body: Record<string, unknown>) {
    const r = await fetch(api, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const d = (await r?.json().catch(() => null)) as { izdevumi?: View } | null;
    if (r?.ok && d?.izdevumi) setV(d.izdevumi);
    else setError("Neizdevās saglabāt");
  }

  if (!v) return error ? <p className="ap2-err">{error}</p> : null;
  return (
    <div className="ap2-pane">
      <div className="ap2-card">
        <h3>Citi izdevumi</h3>
        {v.rows.map((r) => (
          <div key={r.id} className="ap2-xrow">
            <input
              data-bare
              className="t"
              defaultValue={r.text}
              onBlur={(e) =>
                e.target.value.trim() !== r.text &&
                void patch(
                  e.target.value.trim()
                    ? { id: r.id, text: e.target.value }
                    : { id: r.id, remove: true },
                )
              }
            />
            <small>{fmtDateLv(r.date)}</small>
            {v.canSums ? (
              <input
                data-bare
                className="a"
                inputMode="decimal"
                placeholder="+ Summa"
                defaultValue={r.amountEur == null ? "" : fmtEur(r.amountEur)}
                onBlur={(e) => {
                  const raw = e.target.value;
                  if (raw !== (r.amountEur == null ? "" : fmtEur(r.amountEur)))
                    void patch({ id: r.id, amountEur: raw });
                }}
              />
            ) : (
              <span />
            )}
          </div>
        ))}
        {adding ? (
          <div className="ap2-xrow">
            <input
              data-bare
              className="t"
              autoFocus
              placeholder="Izdevums"
              onBlur={(e) => {
                setAdding(false);
                if (e.target.value.trim()) void patch({ text: e.target.value });
              }}
              onKeyDown={(e) =>
                e.key === "Enter" && (e.target as HTMLInputElement).blur()
              }
            />
          </div>
        ) : (
          <button
            type="button"
            className="ap2-addline"
            onClick={() => setAdding(true)}
          >
            + Izdevums
          </button>
        )}
        {v.canSums && v.rows.length > 0 ? (
          <div className="ap2-irow tot">
            <span>Kopā</span>
            <span>{fmtEur(v.totalEur)}</span>
          </div>
        ) : null}
      </div>
      {error ? <p className="ap2-err">{error}</p> : null}
    </div>
  );
}
