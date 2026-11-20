"use client";

import Link from "next/link";
import { useState } from "react";
import { VinCopy } from "./ui";

export type TransitFixRowView = { id: string; title: string; vin: string; purchaseDate: string };

function dateLv(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "-";
}

/** P2 (Nils 20.11, 4A): «Ceļā» bez Loģistikas -> «Noliktavā» tikai pēc admina apstiprinājuma. Automātiski neko nedara. */
export function AutoparksV2TransitFix({ initialRows }: { initialRows: TransitFixRowView[] }) {
  const [rows, setRows] = useState(initialRows);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const allOn = rows.length > 0 && picked.size === rows.length;

  function toggle(id: string) {
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function move(ids: string[]) {
    if (ids.length === 0 || busy) return;
    if (!window.confirm(`Pārcelt uz «Noliktavā»: ${ids.length} auto?`)) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/iriss-autoparks-v2/cela-bez-logistikas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, confirm: true }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { moved?: string[] } | null;
    setBusy(false);
    if (!res?.ok || !Array.isArray(data?.moved)) {
      setError("Neizdevās pārcelt");
      return;
    }
    const moved = new Set(data.moved);
    setRows((rs) => rs.filter((r) => !moved.has(r.id)));
    setPicked((cur) => new Set([...cur].filter((id) => !moved.has(id))));
    if (moved.size < ids.length) setError(`Pārcelti ${moved.size} no ${ids.length}`);
  }

  return (
    <div className="ap2">
      <div className="ap2-top">
        <Link href="/admin/iriss/autoparks-v2" className="ap2-back">
          ← Autoparks
        </Link>
        <h1>Ceļā bez Loģistikas</h1>
        <span className="ap2-top-n">{rows.length} auto</span>
      </div>

      {rows.length > 0 ? (
        <div className="ap2-tfix-bar">
          <label className="ap2-tfix-all">
            <input type="checkbox" checked={allOn} onChange={() => setPicked(allOn ? new Set() : new Set(rows.map((r) => r.id)))} />
            Visi
          </label>
          <button type="button" className="ap2-btn dark sm" disabled={busy || picked.size === 0} onClick={() => void move([...picked])}>
            Pārcelt uz Noliktavā ({picked.size})
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="ap2-err" role="alert">
          {error}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="ap2-empty">Nav auto</p>
      ) : (
        <div className="ap2-tfix-list">
          {rows.map((r) => (
            <div key={r.id} className="ap2-tfix-row">
              <label className="ap2-tfix-pick">
                <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} aria-label={r.title} />
              </label>
              <span className="ap2-tfix-main">
                <Link href={`/admin/iriss/autoparks-v2/${encodeURIComponent(r.id)}`}>
                  <b>{r.title}</b>
                </Link>
                <span className="meta">
                  <VinCopy vin={r.vin} /> · Iegāde {dateLv(r.purchaseDate)}
                </span>
              </span>
              <button type="button" className="ap2-btn sec sm" disabled={busy} onClick={() => void move([r.id])}>
                Uz Noliktavā
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
