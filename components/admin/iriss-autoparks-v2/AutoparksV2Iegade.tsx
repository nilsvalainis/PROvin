"use client";

import { useCallback, useEffect, useState } from "react";
import { V2_VAT_MODE_LV, type V2VatMode } from "@/lib/iriss-autoparks-v2";
import {
  fmtDateLv,
  fmtDayMonth,
  fmtEur,
  rekiniLv,
} from "@/lib/iriss-autoparks-v2-format";
import type { V2IegadeView } from "@/lib/iriss-autoparks-v2-iegade";
import type { CabinetPaneProps } from "./AutoparksV2Cabinet";
import { FileModal, LinkIcon, PdfIcon } from "./FileModal";

type Key =
  | "auction"
  | "auctionNo"
  | "purchaseDate"
  | "vatMode"
  | "purchasePriceEur"
  | "transportEur";

/** Iegādes dokumenti (D2, D3). Faili netiek ievadīti ar roku - tos dod Loģistika un /STOCK. */
export function AutoparksV2Iegade({ carId }: CabinetPaneProps) {
  const [view, setView] = useState<V2IegadeView | null>(null);
  const [editing, setEditing] = useState<Key | null>(null);
  const [costOpen, setCostOpen] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState("");
  const api = `/api/admin/iriss-autoparks-v2/iegade/${encodeURIComponent(carId)}`;

  useEffect(() => {
    let live = true;
    fetch(api)
      .then((r) => r.json())
      .then(
        (d: { iegade?: V2IegadeView }) => live && d.iegade && setView(d.iegade),
      )
      .catch(() => live && setError("Neizdevās ielādēt"));
    return () => {
      live = false;
    };
  }, [api]);

  async function save(key: Key, value: string) {
    setEditing(null);
    setError("");
    const res = await fetch(api, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    }).catch(() => null);
    const d = (await res?.json().catch(() => null)) as {
      iegade?: V2IegadeView;
    } | null;
    if (res?.ok && d?.iegade) setView(d.iegade);
    else setError("Neizdevās saglabāt");
  }

  const urlFor = useCallback(
    (f: { id: string }) => `${api}/faili/${encodeURIComponent(f.id)}`,
    [api],
  );
  if (!view) return error ? <p className="ap2-err">{error}</p> : null;

  const cell = (
    key: Key,
    label: string,
    shown: string,
    raw: string,
    type: "text" | "date" = "text",
  ) => (
    <div className="ap2-kvc">
      <span>{label}</span>
      {editing === key ? (
        <input
          type={type}
          defaultValue={raw}
          autoFocus
          onBlur={(e) => void save(key, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setEditing(null);
          }}
        />
      ) : (
        <button
          type="button"
          className={shown ? "" : "add"}
          onClick={() => setEditing(key)}
        >
          {shown || "+ Pievienot"}
        </button>
      )}
    </div>
  );

  const vatCell = (
    <div className="ap2-kvc">
      <span>PVN režīms</span>
      {editing === "vatMode" ? (
        <select
          autoFocus
          defaultValue={view.vatMode}
          onChange={(e) => void save("vatMode", e.target.value)}
          onBlur={() => setEditing(null)}
        >
          <option value="">-</option>
          {(["margin", "gross", "net"] as V2VatMode[]).map((m) => (
            <option key={m} value={m}>
              {V2_VAT_MODE_LV[m]}
            </option>
          ))}
        </select>
      ) : (
        <button
          type="button"
          className={view.vatLabel ? "" : "add"}
          onClick={() => setEditing("vatMode")}
        >
          {view.vatLabel || "+ Pievienot"}
        </button>
      )}
    </div>
  );

  const c = view.cost;
  return (
    <div className="ap2-pane wide">
      <div className="ap2-kvwrap">
        <div className={`ap2-kv ${c ? "with-cost" : ""}`}>
          {cell("auction", "Izsole", view.auction, view.auction)}
          {cell("auctionNo", "Izsoles nr.", view.auctionNo, view.auctionNo)}
          {cell(
            "purchaseDate",
            "Pirkuma datums",
            fmtDateLv(view.purchaseDate),
            view.purchaseDate,
            "date",
          )}
          {vatCell}
          {c ? (
            <button
              type="button"
              className="ap2-kvc ap2-cost"
              onClick={() => setCostOpen((o) => !o)}
              aria-expanded={costOpen}
            >
              <span>
                Pašizmaksa <em>▾</em>
              </span>
              <b>{fmtEur(c.totalEur)}</b>
            </button>
          ) : null}
        </div>

        {c && costOpen ? (
          <>
            <div className="ap2-popdim" onClick={() => setCostOpen(false)} />
            <div className="ap2-pop" role="dialog" aria-label="Pašizmaksa">
              <div className="ap2-grab" />
              <div className="pr">
                <span>Iepirkuma cena</span>
                {editing === "purchasePriceEur" ? (
                  <input
                    inputMode="decimal"
                    autoFocus
                    defaultValue={view.purchasePriceEur ?? ""}
                    onBlur={(e) =>
                      void save("purchasePriceEur", e.target.value)
                    }
                    onKeyDown={(e) =>
                      e.key === "Enter" && (e.target as HTMLInputElement).blur()
                    }
                  />
                ) : (
                  <button
                    type="button"
                    className={view.purchasePriceEur == null ? "add" : ""}
                    onClick={() => setEditing("purchasePriceEur")}
                  >
                    {view.purchasePriceEur == null
                      ? "+ Pievienot"
                      : fmtEur(view.purchasePriceEur)}
                  </button>
                )}
              </div>
              <div className="pr">
                <span>Transports</span>
                {editing === "transportEur" ? (
                  <input
                    inputMode="decimal"
                    autoFocus
                    defaultValue={view.transportEur ?? ""}
                    onBlur={(e) => void save("transportEur", e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && (e.target as HTMLInputElement).blur()
                    }
                  />
                ) : (
                  <button
                    type="button"
                    className={view.transportEur == null ? "add" : ""}
                    onClick={() => setEditing("transportEur")}
                  >
                    {view.transportEur == null
                      ? "+ Pievienot"
                      : fmtEur(view.transportEur)}
                  </button>
                )}
              </div>
              <div className="pr">
                <span>
                  Servisa rēķini
                  {c.service.count > 0 ? (
                    <small>
                      {rekiniLv(c.service.count)}
                      {c.service.withoutAmount > 0
                        ? ` · ${c.service.withoutAmount} bez summas`
                        : ""}
                    </small>
                  ) : null}
                </span>
                <b>{fmtEur(c.service.sumEur)}</b>
              </div>
              <div className="pr">
                <span>Citi izdevumi</span>
                <b>{fmtEur(c.otherEur)}</b>
              </div>
              <div className="pr tot">
                <span>Pašizmaksa</span>
                <b>{fmtEur(c.totalEur)}</b>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div className="ap2-files">
        {view.files.map((f, i) => (
          <button
            key={f.id}
            type="button"
            className="ap2-fl"
            onClick={() => setOpen(i)}
          >
            <span className="pv">
              <span className="ap2-tag">{f.tag}</span>
              {f.link ? (
                <span className="ap2-lnk">
                  <LinkIcon />
                </span>
              ) : null}
              <PdfIcon />
            </span>
            <span className="m">
              <b>{f.title}</b>
              <span>{fmtDayMonth(f.date)}</span>
            </span>
          </button>
        ))}
      </div>
      {error ? <p className="ap2-err">{error}</p> : null}
      {open != null ? (
        <FileModal
          files={view.files}
          index={open}
          urlFor={urlFor}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}
