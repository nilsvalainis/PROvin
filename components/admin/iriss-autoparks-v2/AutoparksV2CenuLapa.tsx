"use client";

import { useEffect, useState } from "react";
import { PRICE_SHEET_MAX_HIGHLIGHTS, priceSheetHighlightsLine, type V2PriceSheet } from "@/lib/iriss-autoparks-v2-cenu-lapa";
import { fmtEurRound } from "@/lib/iriss-autoparks-v2-format";
import type { CabinetPaneProps } from "./AutoparksV2Cabinet";
import { A4Sheet } from "./A4Sheet";

type Key = "displayName" | "listPriceEur";

/**
 * Cenu lapa (Nils 27.10, makets "Cenu lapa cilne"): pa kreisi lauki (nosaukums, viena cena, aprīkojums līdz 8),
 * zem tiem dati no Pamatdatiem/CSDD (tikai lasīt); pa labi A4 priekšskats pēc L7.
 */
export function AutoparksV2CenuLapa({ carId }: CabinetPaneProps) {
  const [s, setS] = useState<V2PriceSheet | null>(null);
  const [edit, setEdit] = useState<Key | null>(null);
  const [newHl, setNewHl] = useState("");
  const [error, setError] = useState("");
  const api = `/api/admin/iriss-autoparks-v2/cenu-lapa/${encodeURIComponent(carId)}`;

  useEffect(() => {
    let live = true;
    fetch(api)
      .then(async (r) => {
        const d = (await r.json().catch(() => null)) as { cenuLapa?: V2PriceSheet } | null;
        if (!live) return;
        if (r.ok && d?.cenuLapa) setS(d.cenuLapa);
        else setError("Neizdevās ielādēt");
      })
      .catch(() => live && setError("Neizdevās ielādēt"));
    return () => {
      live = false;
    };
  }, [api]);

  async function save(body: Record<string, string>) {
    setEdit(null);
    setError("");
    const r = await fetch(api, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const d = (await r?.json().catch(() => null)) as { cenuLapa?: V2PriceSheet } | null;
    if (r?.ok && d?.cenuLapa) setS(d.cenuLapa);
    else setError("Neizdevās saglabāt");
  }

  if (!s) return error ? <p className="ap2-err">{error}</p> : null;

  const setHighlights = (items: string[]) => void save({ equipmentLine: priceSheetHighlightsLine(items) });
  const full = s.highlights.length >= PRICE_SHEET_MAX_HIGHLIGHTS;

  const field = (k: Key, label: string, shown: string, raw: string, money = false) => (
    <div className="ap2-f">
      <i className="ap2-cd" />
      <span className="k">{label}</span>
      {edit === k ? (
        <input
          className="v"
          autoFocus
          inputMode={money ? "decimal" : undefined}
          defaultValue={raw}
          aria-label={label}
          onBlur={(e) => void save({ [k]: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setEdit(null);
          }}
        />
      ) : (
        <button type="button" className={`v ${shown ? "" : "add"}`} onClick={() => setEdit(k)}>
          {shown || "+ Pievienot"}
        </button>
      )}
    </div>
  );

  return (
    <div className="ap2-pane wide ap2-twocol ap2-clp">
      <div>
        <a className="ap2-btn dark ap2-a4btn ap2-cl-printm" href={`/admin/iriss/autoparks-v2/${encodeURIComponent(carId)}/cenu-lapa`} target="_blank" rel="noreferrer">
          Priekšskatīt un drukāt A4
        </a>
        <div className="ap2-card">
          <h3>Cenu lapa</h3>
          {field("displayName", "Nosaukums", s.displayName, s.displayName)}
          {field("listPriceEur", "Cena", fmtEurRound(s.priceEur), s.priceEur == null ? "" : String(s.priceEur), true)}
          <p className="ap2-cl-vat">{s.vatNote ? "PVN režīms no Dokumentiem: ar PVN - lapā maziem burtiem «cena ar PVN»." : "PVN režīms no Dokumentiem: margin vai nav norādīts - PVN lapā nerāda."}</p>
          <div className="ap2-cl-hled">
            <span className="k">
              Aprīkojums · {s.highlights.length} no {PRICE_SHEET_MAX_HIGHLIGHTS}
            </span>
            <div className="chips">
              {s.highlights.map((h) => (
                <span key={h} className="chip">
                  {h}
                  <button type="button" aria-label={`Noņemt ${h}`} onClick={() => setHighlights(s.highlights.filter((x) => x !== h))}>
                    ×
                  </button>
                </span>
              ))}
            </div>
            <form
              className="add"
              onSubmit={(e) => {
                e.preventDefault();
                const v = newHl.trim().toUpperCase();
                if (!v || full) return;
                setNewHl("");
                setHighlights([...s.highlights, v]);
              }}
            >
              <input
                value={newHl}
                onChange={(e) => setNewHl(e.target.value)}
                placeholder={full ? "Jau 8 ieraksti" : "Jauns ieraksts, piem. PANORĀMAS JUMTS"}
                aria-label="Jauns aprīkojuma ieraksts"
                disabled={full}
                maxLength={40}
              />
              <button type="submit" className="iriss-btn iriss-btn--secondary iriss-btn--sm" disabled={full || !newHl.trim()}>
                Pievienot
              </button>
            </form>
          </div>
        </div>
        <div className="ap2-card">
          <h3>Dati lapai</h3>
          <p className="ap2-cl-vat">No Pamatdatiem un CSDD reģistra. Labo Pamatdatos; tukšās rindas lapā nerāda.</p>
          {s.rows.map((r) => (
            <div key={r.label} className="ap2-f">
              <i className="ap2-cd" />
              <span className="k">{r.label}</span>
              <span className="v mut">{r.value}</span>
            </div>
          ))}
          {s.safetyRows.length > 0 ? (
            <div className="ap2-f">
              <i className="ap2-cd" />
              <span className="k">Drošības sistēmas</span>
              <span className="v mut">{s.safetyRows.map((r) => r.label.replace(/.*\((\w+)\)$/, "$1")).join(", ")}</span>
            </div>
          ) : null}
        </div>
        {error ? <p className="ap2-err">{error}</p> : null}
      </div>
      <div className="ap2-a4wrap">
        <a className="ap2-btn dark ap2-a4btn" href={`/admin/iriss/autoparks-v2/${encodeURIComponent(carId)}/cenu-lapa`} target="_blank" rel="noreferrer">
          Drukāt A4
        </a>
        <div className="ap2-cl-prev">
          <A4Sheet s={s} />
        </div>
      </div>
    </div>
  );
}
