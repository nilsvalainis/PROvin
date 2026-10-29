"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PdStatusChip } from "@/components/iriss-piedavajumi/PdStatusChip";
import { deleteIrissPdRequest, usePdCopyLink, usePdRebase } from "@/components/admin/iriss-piedavajumi/pd-actions";
import {
  countIrissPdByStatus,
  filterIrissPdRows,
  formatIrissPdPrice,
  irissPdDeleteConfirm,
  irissPdRowEffectiveStatus,
  sortIrissPdRows,
  type IrissPdListFilter,
} from "@/lib/iriss-piedavajumi";
import {
  IRISS_PD_SOURCE_LV,
  IRISS_PD_SOURCES,
  IRISS_PD_STATUS_FILTER_LV,
  IRISS_PD_STATUSES,
  irissPdNumberLabel,
  type IrissPdListRow,
  type IrissPdSource,
  type IrissPdStatus,
} from "@/lib/iriss-piedavajumi-types";
import { formatOfferValidUntilLv } from "@/lib/iriss-offer-valid-until";

export function irissPdCountLabel(n: number): string {
  const one = n % 10 === 1 && n % 100 !== 11;
  return `${n} ${one ? "piedāvājums" : "piedāvājumi"}`;
}

function Thumb({ row }: { row: IrissPdListRow }) {
  if (!row.cover) return <span className="pd-thumb" aria-hidden="true" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="pd-thumb" src={`/api/admin/iriss-piedavajumi/${row.id}/foto/0?v=${encodeURIComponent(row.updatedAt)}`} alt="" loading="lazy" />;
}

function Source({ row }: { row: IrissPdListRow }) {
  return (
    <span>
      <span className="pd-src">{IRISS_PD_SOURCE_LV[row.source]}</span>
      {row.hasAuto1 ? <span className="pd-ok-hint">✓ Auto1 dati ielasīti</span> : null}
    </span>
  );
}

function RowAction({
  row,
  status,
  onCopy,
  onRebase,
  onDelete,
  busy,
}: {
  row: IrissPdListRow;
  status: IrissPdStatus;
  onCopy: () => void;
  onRebase: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const href = `/admin/iriss/piedavajumi/${row.id}`;
  const del = (
    <button type="button" className="pd-btn s bad" onClick={onDelete} disabled={busy}>
      Dzēst
    </button>
  );
  if (status === "requested") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <Link className="pd-btn p s" href={href}>Aizpildīt</Link>
        {del}
      </span>
    );
  }
  if (status === "draft") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <Link className="pd-btn s" href={href}>Turpināt</Link>
        {del}
      </span>
    );
  }
  if (status === "sent") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <button type="button" className="pd-btn s" onClick={onCopy} disabled={busy}>Kopēt saiti</button>
        {del}
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        {row.approvedOrderId ? (
          <Link className="pd-lnk" href={`/admin/iriss/pasutijumi/${row.approvedOrderId}`}>Pasūtījums · Rezervēts →</Link>
        ) : (
          <Link className="pd-btn s" href={href}>Izveidot pasūtījumu</Link>
        )}
        {del}
      </span>
    );
  }
  if (status === "declined") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <span className="pd-mu">Noraidīts</span>
        {del}
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <button type="button" className="pd-btn s" onClick={onRebase} disabled={busy}>Izveidot jaunu uz šī bāzes</button>
      {del}
    </span>
  );
}

export function PiedavajumiList({
  rows,
  nowMs,
  storeEnabled,
  loadError,
}: {
  rows: IrissPdListRow[];
  nowMs: number;
  storeEnabled: boolean;
  loadError: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<IrissPdListFilter>({ status: "all", source: "all", query: "" });
  const { copy, copiedId, copyError } = usePdCopyLink();
  const { rebase, rebaseBusy, rebaseError } = usePdRebase();
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const counts = useMemo(() => countIrissPdByStatus(rows, nowMs), [rows, nowMs]);
  const shown = useMemo(() => sortIrissPdRows(filterIrissPdRows(rows, filter, nowMs)), [rows, filter, nowMs]);
  const err = copyError || rebaseError || deleteError;
  const busy = rebaseBusy || deleteBusy;

  async function remove(row: IrissPdListRow) {
    if (!window.confirm(irissPdDeleteConfirm(irissPdNumberLabel(row.number)))) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await deleteIrissPdRequest(row.id);
      router.refresh();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Neizdevās dzēst.");
    } finally {
      setDeleteBusy(false);
    }
  }

  const header = (
    <header className="pd-hdr">
      <div className="pd-bc">
        <Link href="/admin/iriss">IRISS</Link> › Piedāvājumi
      </div>
      <div className="pd-top">
        <div>
          <h1>Piedāvājumi</h1>
          <div className="pd-sub">{irissPdCountLabel(rows.length)}</div>
        </div>
        <Link className="pd-btn p pd-new-top" href="/admin/iriss/piedavajumi/jauns">
          + Jauns piedāvājums
        </Link>
      </div>
    </header>
  );

  if (!storeEnabled || loadError) {
    return (
      <div className="pdv">
        {header}
        <div className="pd-err">{loadError || "IRISS krātuve nav pieslēgta (tā pati, kas Pasūtījumiem)."}</div>
      </div>
    );
  }

  const statusBtn = (s: IrissPdStatus | "all") => {
    const label = s === "all" ? "Visi" : IRISS_PD_STATUS_FILTER_LV[s];
    const n = counts[s];
    const withCount = s === "all" || s === "requested";
    return (
      <button key={s} type="button" className={filter.status === s ? "on" : ""} onClick={() => setFilter((f) => ({ ...f, status: s }))} aria-pressed={filter.status === s}>
        {label}
        {withCount && n > 0 ? ` ${n}` : ""}
      </button>
    );
  };

  return (
    <div className="pdv">
      {header}
      <div className="pd-fl">
        <label className="pd-srch">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          <input
            value={filter.query}
            onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))}
            placeholder="Meklēt modeli, VIN, klientu..."
            aria-label="Meklēt"
          />
        </label>
        <div className="pd-seg" role="group" aria-label="Statuss">
          {(["all", ...IRISS_PD_STATUSES] as const).map(statusBtn)}
        </div>
        <select
          className="pd-sel"
          value={filter.source}
          onChange={(e) => setFilter((f) => ({ ...f, source: e.target.value as IrissPdSource | "all" }))}
          aria-label="Avots"
        >
          <option value="all">Avots: visi</option>
          {IRISS_PD_SOURCES.map((s) => (
            <option key={s} value={s}>
              {IRISS_PD_SOURCE_LV[s]}
            </option>
          ))}
        </select>
      </div>
      {err ? <p className="pd-err" role="alert">{err}</p> : null}

      {shown.length === 0 ? (
        <div className="pd-empty">
          {rows.length === 0 ? "Vēl nav neviena piedāvājuma." : "Pēc šiem filtriem nekas nav atrasts."}
          <div style={{ marginTop: 12 }}>
            <Link className="pd-btn p" href="/admin/iriss/piedavajumi/jauns">+ Jauns piedāvājums</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="pd-tbl" role="table">
            <div className="pd-tr th" role="row">
              <span>Foto</span>
              <span>Modelis</span>
              <span>VIN</span>
              <span>Klients</span>
              <span>Avots</span>
              <span>Cena</span>
              <span>Termiņš</span>
              <span>Statuss</span>
              <span>Darbība</span>
            </div>
            {shown.map((row) => {
              const status = irissPdRowEffectiveStatus(row, nowMs);
              return (
                <div className="pd-tr" role="row" key={row.id} data-status={status}>
                  <Link href={`/admin/iriss/piedavajumi/${row.id}`} aria-label={irissPdNumberLabel(row.number)}>
                    <Thumb row={row} />
                  </Link>
                  <Link href={`/admin/iriss/piedavajumi/${row.id}`} className="pd-el" title={row.title}>
                    <b style={{ fontWeight: 500 }}>{row.title || irissPdNumberLabel(row.number)}</b>
                  </Link>
                  <span className="pd-mono pd-el">{row.vin || "-"}</span>
                  <span className="pd-el">{row.clientName || "-"}</span>
                  <Source row={row} />
                  <b>{formatIrissPdPrice(row.price) || "-"}</b>
                  <span>{row.validUntil ? formatOfferValidUntilLv(row.validUntil) : "-"}</span>
                  <span>
                    <PdStatusChip status={status} />
                  </span>
                  <span>
                    <RowAction
                      row={row}
                      status={status}
                      busy={busy}
                      onCopy={() => void copy(row.id)}
                      onRebase={() => void rebase(row.id, router)}
                      onDelete={() => void remove(row)}
                    />
                    {copiedId === row.id ? <span className="pd-ok-hint">Saite nokopēta</span> : null}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="pd-cards">
            {shown.map((row) => {
              const status = irissPdRowEffectiveStatus(row, nowMs);
              return (
                <div className="pd-mc" key={row.id} data-status={status}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <PdStatusChip status={status} />
                    <span className="pd-src">{IRISS_PD_SOURCE_LV[row.source]}</span>
                  </div>
                  <Link className="row" href={`/admin/iriss/piedavajumi/${row.id}`}>
                    <Thumb row={row} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <b className="pd-el">{row.title || irissPdNumberLabel(row.number)}</b>
                        <b style={{ whiteSpace: "nowrap" }}>{formatIrissPdPrice(row.price)}</b>
                      </span>
                      <span className="pd-mono pd-el" style={{ display: "block" }}>{row.vin || "-"}</span>
                      <span className="pd-mu pd-el" style={{ display: "block" }}>
                        {row.clientName || "-"} · līdz {row.validUntil ? formatOfferValidUntilLv(row.validUntil) : "-"}
                      </span>
                    </span>
                  </Link>
                  {status !== "declined" ? (
                    <div style={{ marginTop: 8 }}>
                      <RowAction
                      row={row}
                      status={status}
                      busy={busy}
                      onCopy={() => void copy(row.id)}
                      onRebase={() => void rebase(row.id, router)}
                      onDelete={() => void remove(row)}
                    />
                      {copiedId === row.id ? <span className="pd-ok-hint">Saite nokopēta</span> : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      )}
      <p className="pd-foot">Apstiprināts piedāvājums paliek šeit un automātiski izveido Pasūtījumu ar statusu «Rezervēts».</p>
      <Link className="pd-fab" href="/admin/iriss/piedavajumi/jauns" aria-label="Jauns piedāvājums">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </Link>
    </div>
  );
}
