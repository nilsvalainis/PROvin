"use client";

import { useEffect, useState } from "react";
import type { V2PriceSheet } from "@/lib/iriss-autoparks-v2-cenu-lapa";
import { fmtEurRound } from "@/lib/iriss-autoparks-v2-format";
import type { CabinetPaneProps } from "./AutoparksV2Cabinet";
import { A4Sheet } from "./A4Sheet";

type Key = "displayName" | "equipmentLine" | "salePriceEur" | "listPriceEur";

/** Cenu lapa (D4): kreisajā pusē lauki, labajā - A4 priekšskatījums. Viena galvenā poga - "Priekšskatīt A4". */
export function AutoparksV2CenuLapa({ carId }: CabinetPaneProps) {
  const [s, setS] = useState<V2PriceSheet | null>(null);
  const [edit, setEdit] = useState<Key | null>(null);
  const [error, setError] = useState("");
  const api = `/api/admin/iriss-autoparks-v2/cenu-lapa/${encodeURIComponent(carId)}`;

  useEffect(() => {
    let live = true;
    fetch(api)
      .then((r) => r.json())
      .then((d: { cenuLapa?: V2PriceSheet }) => live && d.cenuLapa && setS(d.cenuLapa))
      .catch(() => live && setError("Neizdevās ielādēt"));
    return () => {
      live = false;
    };
  }, [api]);

  async function save(k: Key, v: string) {
    setEdit(null);
    const r = await fetch(api, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [k]: v }) }).catch(() => null);
    const d = (await r?.json().catch(() => null)) as { cenuLapa?: V2PriceSheet } | null;
    if (r?.ok && d?.cenuLapa) setS(d.cenuLapa);
    else setError("Neizdevās saglabāt");
  }

  if (!s) return error ? <p className="ap2-err">{error}</p> : null;

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
          onBlur={(e) => void save(k, e.target.value)}
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
  const ro = (label: string, value: string, csdd: boolean) => (
    <div className="ap2-f">
      <i className={`ap2-cd ${csdd && value ? "on" : ""}`} />
      <span className="k">{label}</span>
      <span className={`v mut`}>{value || "-"}</span>
    </div>
  );

  return (
    <div className="ap2-pane wide ap2-twocol">
      <div>
        <div className="ap2-card">
          <h3>Cenu lapa</h3>
          {field("displayName", "Nosaukums", s.displayName, s.displayName)}
          {field("equipmentLine", "Aprīkojums", s.equipmentLine, s.equipmentLine)}
          {field("salePriceEur", "Pārdošanas cena", fmtEurRound(s.salePriceEur), s.salePriceEur == null ? "" : String(s.salePriceEur), true)}
          {field("listPriceEur", "Cena (cenu lapai)", fmtEurRound(s.listPriceEur), s.listPriceEur == null ? "" : String(s.listPriceEur), true)}
          <h3>No Pamatdatiem</h3>
          {ro("Gads", s.year, false)}
          {ro("1. reģistrācija", s.firstRegDate.value, s.firstRegDate.csdd)}
          {ro("Nobraukums", s.mileage.value, s.mileage.csdd)}
          {ro("Motors", s.engine.value, s.engine.csdd)}
          {ro("Kārba", s.gearbox, false)}
        </div>
        <a className="ap2-btn dark ap2-a4btn" href={`/admin/iriss/autoparks-v2/${encodeURIComponent(carId)}/cenu-lapa`} target="_blank" rel="noreferrer">
          Priekšskatīt A4
        </a>
        {error ? <p className="ap2-err">{error}</p> : null}
      </div>
      <div className="ap2-a4wrap">
        <A4Sheet s={s} />
      </div>
    </div>
  );
}
