"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { V2_VAT_MODE_LV, type V2VatMode } from "@/lib/iriss-autoparks-v2";
import {
  fmtDateLv,
  fmtDayMonth,
  fmtEur,
  rekiniLv,
} from "@/lib/iriss-autoparks-v2-format";
import type { V2IegadeView } from "@/lib/iriss-autoparks-v2-iegade";
import type { V2IegadeFile } from "@/lib/iriss-autoparks-v2-iegade-files";
import type { CabinetPaneProps } from "./AutoparksV2Cabinet";
import { FileModal, LinkIcon, PdfIcon } from "./FileModal";

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 2l3 3-8 8-3.5.5.5-3.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M4.5 4l.6 9a1 1 0 001 .9h3.8a1 1 0 001-.9l.6-9" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 1.5l7 12.2H1z" />
      <path d="M8 6v3.2M8 11.3h.01" />
    </svg>
  );
}

type Key =
  | "auction"
  | "auctionNo"
  | "purchaseDate"
  | "vatMode"
  | "purchasePriceEur"
  | "transportEur";

/** Iegādes dokumenti (D2, D3). Ar roku pievienotiem dokumentiem - augšupielāde/pārdēvēšana/dzēšana ar Dropbox /STOCK sinhronizāciju (J30 F1). */
export function AutoparksV2Iegade({ carId }: CabinetPaneProps) {
  const [view, setView] = useState<V2IegadeView | null>(null);
  const [editing, setEditing] = useState<Key | null>(null);
  const [costOpen, setCostOpen] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<V2IegadeFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  async function applyResult(res: Response | null) {
    const d = (await res?.json().catch(() => null)) as { iegade?: V2IegadeView } | null;
    if (res?.ok && d?.iegade) {
      setView(d.iegade);
      setError("");
    } else {
      setError("Neizdevās saglabāt");
    }
  }

  async function uploadFile(file: File) {
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${api}/faili`, { method: "POST", body: form }).catch(() => null);
    await applyResult(res);
    setBusy(false);
  }

  async function renameFile(f: V2IegadeFile) {
    const title = window.prompt("Jaunais nosaukums:", f.title)?.trim();
    if (!title || title === f.title) return;
    setBusy(true);
    const res = await fetch(`${api}/faili/${encodeURIComponent(f.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }).catch(() => null);
    await applyResult(res);
    setBusy(false);
  }

  async function confirmDelete() {
    const f = deleteTarget;
    if (!f) return;
    setDeleteTarget(null);
    setBusy(true);
    const res = await fetch(`${api}/faili/${encodeURIComponent(f.id)}`, { method: "DELETE" }).catch(() => null);
    await applyResult(res);
    setBusy(false);
  }

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

      <div className="ap2-files-head">
        <h3>Dokumenti</h3>
        <button
          type="button"
          className="ap2-add-doc"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
        >
          <PlusIcon />
          Pievienot dokumentu
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void uploadFile(file);
          }}
        />
      </div>
      {view.missingAuto1Docs.length > 0 ? (
        <div className="ap2-warn">
          <WarnIcon />
          Trūkst dokumenta: {view.missingAuto1Docs.join(", ")} (Auto1 auto - nepieciešamas 2 PDF)
        </div>
      ) : null}

      <div className="ap2-files">
        {view.files.map((f, i) => (
          <div key={f.id} className="ap2-fl">
            <button type="button" className="ap2-fl-open" onClick={() => setOpen(i)}>
              <span className="pv">
                <span className="ap2-tag">{f.tag}</span>
                {f.link ? (
                  <span className="ap2-lnk">
                    <LinkIcon />
                  </span>
                ) : null}
                {f.csddBadge ? (
                  <span className="ap2-csdd-badge" title="CSDD oriģinālais dokuments">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/brand/csdd-logo.png" alt="CSDD" />
                  </span>
                ) : null}
                <PdfIcon />
              </span>
              <span className="m">
                <b>{f.title}</b>
                <span>{fmtDayMonth(f.date)}</span>
              </span>
            </button>
            {f.editable ? (
              <span className="ap2-fl-actions">
                <button
                  type="button"
                  title="Pārdēvēt"
                  disabled={busy}
                  onClick={(e) => {
                    e.stopPropagation();
                    void renameFile(f);
                  }}
                >
                  <PencilIcon />
                </button>
                <button
                  type="button"
                  className="danger"
                  title="Dzēst"
                  disabled={busy}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(f);
                  }}
                >
                  <TrashIcon />
                </button>
              </span>
            ) : null}
          </div>
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
      {deleteTarget ? (
        <div className="ap2-modal" role="presentation" onClick={() => setDeleteTarget(null)}>
          <div className="ap2-del" role="dialog" aria-label="Dzēst dokumentu" onClick={(e) => e.stopPropagation()}>
            <b>Dzēst &quot;{deleteTarget.title}&quot;?</b>
            Dokuments tiks izdzēsts arī no Dropbox STOCK mapes. Šo darbību nevar atsaukt.
            <div className="row">
              <button type="button" className="cancel" onClick={() => setDeleteTarget(null)}>
                Atcelt
              </button>
              <button type="button" className="confirm" onClick={() => void confirmDelete()}>
                Dzēst
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
