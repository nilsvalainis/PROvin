"use client";

import { ChevronLeft, ChevronRight, FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { AdminChangeHistoryButton } from "@/components/admin/AdminChangeHistoryButton";
import { AdminVinCopyButton } from "@/components/admin/AdminVinClipboardAndLinks";
import { AdminPushToggle } from "@/components/admin/AdminPushToggle";
import { IrissKomandaAivaramChat } from "@/components/admin/IrissKomandaAivaramChat";
import { IrissWaybillCalendar } from "@/components/admin/IrissWaybillCalendar";
import { IrissWaybillGauges } from "@/components/admin/IrissWaybillGauges";
import { IrissWaybillRequestArchive } from "@/components/admin/IrissWaybillMobileForm";
import { IrissWaybillPdfSheet } from "@/components/admin/IrissWaybillPdfSheet";
import { IrissVpnControl } from "@/components/admin/IrissVpnControl";
import { AdminMobileSheet } from "@/components/admin/mobile/AdminMobileChrome";
import { waybillHistoryForVin } from "@/lib/iriss-waybill-calendar";
import { formatIrissWaybillChip } from "@/lib/admin-mobile-ds";
import { AdminMobileTopBar } from "@/components/admin/mobile/AdminMobileChrome";
import { waybillRemainingShare } from "@/lib/iriss-pavadzimes-countdown";
import { sortWaybillsNewestFirst, waybillLifecycleLabel } from "@/lib/iriss-pavadzimes-lifecycle";
import { formatWaybillDateTime } from "@/lib/iriss-pavadzimes-parse";
import type { IrissPavadzimeListRow, IrissPavadzimeValidityTone } from "@/lib/iriss-pavadzimes-types";
import { remainingWaybillDays, waybillSoonTone } from "@/lib/iriss-waybill-requests";
import type { WaybillVehicleChip } from "@/lib/iriss-waybill-vehicles";

type PageData = {
  rows: IrissPavadzimeListRow[];
  pendingParse: number;
  dropboxConfigured: boolean;
  dropboxError: string | null;
};

const hug = "w-[1%] whitespace-nowrap";

function validityClass(tone: IrissPavadzimeValidityTone): string {
  if (tone === "expired") return "font-semibold text-[#DC2626]";
  if (tone === "today") return "font-semibold text-[#D97706]";
  return "text-[#3a3a3c]";
}

type WaybillView = "all" | "current" | "archive" | "calendar";

const VIEW_LABEL: Record<WaybillView, string> = { all: "Visas", current: "Aktīvās", archive: "Arhīvs", calendar: "Kalendārs" };

function isActiveNow(row: IrissPavadzimeListRow): boolean {
  if (row.archived || row.lifecycle === "interrupted") return false;
  return row.validityTone === "ok" || row.validityTone === "today";
}

function inView(row: IrissPavadzimeListRow, view: WaybillView): boolean {
  if (view === "calendar") return true;
  if (view === "current") return isActiveNow(row);
  if (view === "archive") return !isActiveNow(row);
  return true;
}

function WaybillStatusChip({ row }: { row: IrissPavadzimeListRow }) {
  const label = waybillLifecycleLabel(row.lifecycle);
  const chips: { text: string; cls: string; title?: string }[] = [];
  if (row.lifecycle === "interrupted") {
    chips.push({
      text: label,
      cls: "bg-[#FEF3C7] text-[#92400E]",
      title: row.supersededBy ? `Aizstāta ar ${row.supersededBy}` : undefined,
    });
  }
  if (row.archived) chips.push({ text: "Arhīvs", cls: "bg-[#f2f2f7] text-[#6e6e73]" });
  if (chips.length === 0) return null;
  return (
    <>
      {chips.map((c) => (
        <span
          key={c.text}
          title={c.title}
          className={`ml-1.5 inline-flex rounded-full px-1.5 py-[1px] align-middle font-sans text-[10.5px] font-semibold tracking-normal ${c.cls}`}
        >
          {c.text}
          {c.text === "Pārtraukta" && row.supersededBy ? ` → ${row.supersededBy}` : ""}
        </span>
      ))}
    </>
  );
}

/** Telefonā (< md) sākums ir apļi + forma; Kalendārs un Arhīvs ir sadaļā "Vēl". */
function isPhoneViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

function dash(v: string): string {
  return v.trim() || "-";
}

function PavadzimeSearchFocus({ rowCount }: { rowCount: number }) {
  const sp = useSearchParams();
  useEffect(() => {
    const id = sp.get("wb")?.trim() ?? "";
    if (!/^[A-Za-z0-9._-]{1,80}$/.test(id)) return;
    const nodes = document.querySelectorAll<HTMLElement>(`[data-pavadzime="${id}"]`);
    const visible = [...nodes].find((n) => n.getClientRects().length > 0);
    visible?.scrollIntoView({ block: "center" });
  }, [sp, rowCount]);
  return null;
}

export function IrissPavadzimesListClient({
  initial,
  isAdmin = false,
}: {
  initial: PageData;
  /** VPN / servera vadība un paziņojumi - tikai administratoram (darbiniekam API atbild 403). */
  isAdmin?: boolean;
}) {
  const [data, setData] = useState(initial);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [view, setView] = useState<WaybillView>("current");
  const [extendVehicle, setExtendVehicle] = useState<WaybillVehicleChip | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ href: string; title: string } | null>(null);
  const [historyVin, setHistoryVin] = useState<string | null>(null);

  /** Atkārtot ar vienu pieskārienu: Aivara pieprasījums aizpildīts ar to pašu numuru, auto un VIN. */
  const repeatWaybill = (row: IrissPavadzimeListRow) => {
    setExtendVehicle({
      chip: row.brandModel.split(/\s+/).slice(0, 2).join(" ") || row.number,
      brandModel: row.brandModel,
      vin: row.vin,
      plate: row.plate,
      orderId: row.order?.id ?? "",
    });
    if (isPhoneViewport()) setView("current");
    window.setTimeout(() => document.getElementById("komanda-aivaram")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const openPdf = (row: IrissPavadzimeListRow) =>
    setPdfPreview({ href: `/api/admin/iriss-pavadzimes/${encodeURIComponent(row.id)}/pdf`, title: `${row.number || "Pavadzīme"} · ${row.brandModel}`.trim() });
  const onDraftConsumed = useCallback(() => setExtendVehicle(null), []);

  useEffect(() => {
    setData(initial);
  }, [initial]);

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const applyWaybillRestore = useCallback((id: string, record: Record<string, unknown> | undefined) => {
    if (!record) return;
    setData((prev) => ({
      ...prev,
      rows: prev.rows.map((row) =>
        row.id === id
          ? {
              ...row,
              number: typeof record.number === "string" ? record.number : row.number,
              brandModel: typeof record.brandModel === "string" ? record.brandModel : row.brandModel,
              vin: typeof record.vin === "string" ? record.vin : row.vin,
              plate: typeof record.plate === "string" ? record.plate : row.plate,
              issuedAt: typeof record.issuedAt === "string" ? record.issuedAt : row.issuedAt,
              validUntil: typeof record.validUntil === "string" ? record.validUntil : row.validUntil,
              fileName: typeof record.fileName === "string" ? record.fileName : row.fileName,
            }
          : row,
      ),
    }));
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/iriss-pavadzimes", { credentials: "include", cache: "no-store" });
    const json = (await res.json().catch(() => null)) as (PageData & { error?: unknown }) | null;
    if (!res.ok || !json || !Array.isArray(json.rows)) {
      throw new Error(typeof json?.error === "string" ? json.error : "Neizdevās ielādēt");
    }
    setData(json);
    return json;
  }, []);

  useEffect(() => {
    if (data.pendingParse <= 0) return;
    const t = window.setTimeout(() => {
      void refresh().catch(() => undefined);
    }, 800);
    return () => window.clearTimeout(t);
  }, [data.pendingParse, refresh]);

  const now = new Date(nowMs);
  // Visos skatos jaunākās augšā (Nils 23.10: saraksts nedrīkst atvērties ar vecāko).
  const rows = sortWaybillsNewestFirst(data.rows.filter((row) => inView(row, view)));
  const viewCount = (v: WaybillView) => data.rows.filter((row) => inView(row, v)).length;

  return (
    <>
      <div className="md:hidden">
        <AdminMobileTopBar title="Pavadzīmes" />
      </div>
      <Suspense fallback={null}>
        <PavadzimeSearchFocus rowCount={rows.length} />
      </Suspense>
      <div className="mt-2 flex max-w-full flex-wrap items-center gap-2 max-md:hidden">
        <div className="inline-flex min-w-0 items-stretch rounded-lg bg-[#e9e9ee] p-0.5 max-md:w-full" role="tablist" aria-label="Pavadzīmju filtrs">
          {(["current", "calendar", "archive", "all"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[13px] font-semibold leading-none transition md:h-8 md:min-h-8 md:flex-none ${
                v === "all" ? "max-md:hidden" : ""
              } ${view === v ? "bg-white text-[#1d1d1f] shadow-sm" : "text-[#6e6e73] hover:text-[#1d1d1f]"}`}
            >
              <span>{VIEW_LABEL[v]}</span>
              {v === "calendar" ? null : <span className="tabular-nums text-[#8e8e93]">{viewCount(v)}</span>}
            </button>
          ))}
        </div>
        {data.pendingParse > 0 ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#8e8e93]" aria-hidden /> : null}
      </div>
      {data.dropboxError ? <p className="mt-1 text-right text-[11px] text-red-600 max-md:px-4">{data.dropboxError}</p> : null}

      {view !== "current" ? (
        <div className="px-4 md:hidden">
          <button
            type="button"
            onClick={() => setView("current")}
            className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-[15px] font-semibold text-[var(--acc,#3d5bd9)]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Pavadzīmes
          </button>
          <p className="pb-1 text-[20px] font-bold text-[var(--ink,#0b0c10)]">{VIEW_LABEL[view]}</p>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 max-md:mt-2 max-md:gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className={`min-w-0 ${view === "current" ? "max-md:px-4" : ""}`}>
      {view === "current" ? (
        <div className="md:hidden">
          <IrissWaybillGauges allHref={null} />
        </div>
      ) : null}
      {view === "calendar" ? (
        <IrissWaybillCalendar rows={data.rows} nowMs={nowMs} onOpen={openPdf} />
      ) : view === "current" ? (
        rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white px-6 py-12 text-center shadow-sm max-md:hidden">
            <p className="font-medium text-black">Nav aktīvu pavadzīmju</p>
            <p className="mt-1 text-[13px] text-[#6b7280]">Beigušās un pārtrauktās ir Arhīvā.</p>
          </div>
        ) : (
          <div className="flex max-w-full flex-col gap-3 max-md:hidden md:grid md:grid-cols-1 lg:grid-cols-1">
            {rows.map((row) => {
              const pdfHref = `/api/admin/iriss-pavadzimes/${encodeURIComponent(row.id)}/pdf`;
              const days = remainingWaybillDays(row.validUntil, now);
              const tone = waybillSoonTone(days);
              const share = waybillRemainingShare(row.issuedAt, row.validUntil, now);
              const bar = tone === "soon" ? "bg-[#f97316]" : "bg-[#3d5bd9]";
              const dayClass = tone === "soon" ? "text-[#c2410c]" : "text-[#3d5bd9]";
              return (
                <article
                  key={row.id}
                  data-pavadzime={row.id}
                  className="w-full min-w-0 rounded-[22px] border border-[#E5E7EB] bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-mono text-[12px] text-[#6b7280]">{dash(row.number)}</p>
                    <span className="rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[11px] font-medium text-[#067647]">derīga</span>
                  </div>
                  <p className="mt-1 text-[16px] font-semibold">{dash(row.brandModel)}</p>
                  <p className="text-[12px] text-[#6b7280]">
                    {row.plate.trim() ? row.plate : ""}
                    {row.validUntil ? ` · līdz ${formatWaybillDateTime(row.validUntil, now)}` : ""}
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#EEF2FF]">
                    <div className={`h-full ${bar}`} style={{ width: `${Math.round(share * 100)}%` }} />
                  </div>
                  <p className={`mt-1 text-right text-[12px] font-medium ${dayClass}`}>
                    {days === null ? "" : days <= 0 ? "beigusies" : `vēl ${days} d.`}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => openPdf(row)}
                      className="inline-flex min-h-11 items-center gap-1 rounded-full border border-[#E5E7EB] px-3 text-[13px] font-medium"
                    >
                      <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setExtendVehicle({
                          chip: row.brandModel.split(/\s+/).slice(0, 2).join(" ") || row.number,
                          brandModel: row.brandModel,
                          vin: row.vin,
                          plate: row.plate,
                          orderId: row.order?.id ?? "",
                        })
                      }
                      className="inline-flex min-h-11 items-center rounded-full border border-[#E5E7EB] px-3 text-[13px] font-medium"
                    >
                      Pagarināt
                    </button>
                    {row.vin ? (
                      <button
                        type="button"
                        onClick={() => setHistoryVin(row.vin)}
                        className="inline-flex min-h-11 items-center rounded-full border border-[#E5E7EB] px-3 text-[13px] font-medium"
                      >
                        Vēsture
                      </button>
                    ) : null}
                    <AdminChangeHistoryButton
                      kind="iriss-waybill"
                      recordId={row.id}
                      endpoint="/api/admin/change-history"
                      onRestored={(body) => applyWaybillRestore(row.id, body.record)}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white px-6 py-12 text-center shadow-sm">
          <p className="font-medium text-black">Nav pavadzīmju</p>
        </div>
      ) : (
        <>
          <ul className="mt-0 space-y-2 px-4 md:hidden">
            {rows.map((row) => {
              const pdfHref = `/api/admin/iriss-pavadzimes/${encodeURIComponent(row.id)}/pdf`;
              const orderHref = row.order ? `/admin/iriss/pasutijumi/${encodeURIComponent(row.order.id)}` : null;
              return (
                <li key={row.id} data-pavadzime={row.id} className="rounded-xl border border-[#ececee] bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`truncate text-[14px] font-semibold ${row.brandModel.trim() || row.number.trim() ? "text-[var(--color-apple-text)]" : "text-[#aeaeb2]"}`}>
                        {formatIrissWaybillChip({
                          code: row.number,
                          makeModel: row.brandModel,
                          label: dash(row.number),
                        })}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-[var(--color-provin-muted)]">
                        {row.plate.trim() ? `Tranzīta nr. ${row.plate}` : dash(row.plate)}
                        <WaybillStatusChip row={row} />
                      </p>
                    </div>
                    <span className={`shrink-0 text-[12px] tabular-nums ${validityClass(row.archived || row.lifecycle === "interrupted" ? "ok" : row.validityTone)}`}>
                      {formatWaybillDateTime(row.validUntil, now) || "-"}
                    </span>
                  </div>
                  <p className="mt-1.5 font-mono text-[12px] tracking-wide text-[#3a3a3c]">{dash(row.vin)}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] tabular-nums text-[var(--color-provin-muted)]">
                      {formatWaybillDateTime(row.issuedAt, now) || "-"}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openPdf(row)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#ececee] text-[#8e8e93]"
                        aria-label="Atvērt PDF"
                      >
                        <FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => repeatWaybill(row)}
                        className="inline-flex h-11 items-center rounded-full bg-[#1d1d1f] px-3.5 text-[12.5px] font-semibold text-white"
                      >
                        Atkārtot
                      </button>
                      <AdminChangeHistoryButton
                        kind="iriss-waybill"
                        recordId={row.id}
                        endpoint="/api/admin/change-history"
                        onRestored={(body) => applyWaybillRestore(row.id, body.record)}
                      />
                      {orderHref ? (
                        <Link href={orderHref} className="inline-flex rounded-full bg-[#f2f2f7] px-3.5 py-2 text-xs font-semibold text-[#3a3a3c]">
                          Pasūtījums
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 hidden overflow-hidden rounded-xl bg-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.1)] md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead>
                  <tr className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#6e6e73]">
                    <th className={`${hug} py-2.5 pl-4 pr-4`}>Nr.</th>
                    <th className="py-2.5 pr-4">Auto</th>
                    <th className={`${hug} py-2.5 pr-4`}>VIN</th>
                    <th className={`${hug} py-2.5 pr-4`}>Reg./tranzīts</th>
                    <th className={`${hug} py-2.5 pr-4`}>Derīga līdz</th>
                    <th className={`${hug} py-2.5 pr-4`}>Izdošana</th>
                    <th className={`${hug} py-2.5 pr-4`}>PDF</th>
                    <th className={`${hug} py-2.5 pr-4`}>Pasūtījums</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const pdfHref = `/api/admin/iriss-pavadzimes/${encodeURIComponent(row.id)}/pdf`;
                    const orderHref = row.order ? `/admin/iriss/pasutijumi/${encodeURIComponent(row.order.id)}` : null;
                    const vin = row.vin.trim();
                    return (
                      <tr key={row.id} data-pavadzime={row.id} className="h-[46px] whitespace-nowrap border-t border-[#f0f0f2] transition-colors hover:bg-[#f7f7f8]">
                        <td className={`${hug} py-1 pl-4 pr-4 font-mono text-[12px] tracking-wide text-[#3a3a3c]`}>
                          {dash(row.number)}
                          <WaybillStatusChip row={row} />
                        </td>
                        <td className="max-w-[300px] py-1 pr-4">
                          <span
                            className={`truncate text-[14px] ${row.brandModel.trim() ? "font-bold text-[#1d1d1f]" : "text-[#aeaeb2]"}`}
                            title={row.brandModel.trim() || undefined}
                          >
                            {dash(row.brandModel)}
                          </span>
                        </td>
                        <td className={`${hug} py-1 pr-4`}>
                          {vin ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="font-mono text-[12px] tracking-wide text-[#3a3a3c]" title={vin}>
                                {vin}
                              </span>
                              <AdminVinCopyButton value={vin} />
                            </span>
                          ) : (
                            <span className="text-[#c7c7cc]">-</span>
                          )}
                        </td>
                        <td className={`${hug} py-1 pr-4 text-[13.5px] text-[#1d1d1f]`}>{dash(row.plate)}</td>
                        <td className={`${hug} py-1 pr-4 text-[13px] tabular-nums ${validityClass(row.archived || row.lifecycle === "interrupted" ? "ok" : row.validityTone)}`}>
                          {formatWaybillDateTime(row.validUntil, now) || "-"}
                        </td>
                        <td className={`${hug} py-1 pr-4 text-[13px] tabular-nums text-[#3a3a3c]`}>
                          {formatWaybillDateTime(row.issuedAt, now) || "-"}
                        </td>
                        <td className={`${hug} py-1 pr-4`}>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => openPdf(row)} className="text-[13.5px] text-[#1d1d1f] hover:underline">
                              Atvērt PDF
                            </button>
                            <button type="button" onClick={() => repeatWaybill(row)} className="text-[13.5px] font-semibold text-[#1a73e8] hover:underline">
                              Atkārtot
                            </button>
                            {row.vin ? (
                              <button type="button" onClick={() => setHistoryVin(row.vin)} className="text-[13.5px] text-[#6e6e73] hover:underline">
                                Vēsture
                              </button>
                            ) : null}
                            <AdminChangeHistoryButton
                              kind="iriss-waybill"
                              recordId={row.id}
                              endpoint="/api/admin/change-history"
                              onRestored={(body) => applyWaybillRestore(row.id, body.record)}
                            />
                          </div>
                        </td>
                        <td className={`${hug} py-1 pr-4`}>
                          {orderHref ? (
                            <Link href={orderHref} className="admin-nav-link truncate text-[13.5px] text-[#1d1d1f] hover:underline">
                              {row.order?.label || "Pasūtījums"}
                            </Link>
                          ) : (
                            <span className="text-[#c7c7cc]">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {view === "archive" ? (
        <div className="max-md:px-4">
          <IrissWaybillRequestArchive />
        </div>
      ) : null}
        </div>
        <div id="komanda-aivaram" className={`scroll-mt-4 max-md:px-4 ${view === "current" ? "" : "max-md:hidden"}`}>
          <IrissKomandaAivaramChat
            draftVehicle={extendVehicle}
            onDraftConsumed={onDraftConsumed}
          />
        </div>
        {view === "current" ? (
          <div className="px-4 pb-6 md:hidden">
            <p className="px-1 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--ink2,#8e8e93)]">Vēl</p>
            <div className="overflow-hidden rounded-[14px] bg-[var(--s1,#fff)]">
              <button
                type="button"
                onClick={() => setView("calendar")}
                className="flex min-h-12 w-full items-center gap-2.5 px-3.5 text-left text-[15px] text-[var(--ink,#0b0c10)]"
              >
                <span className="flex-1">Kalendārs</span>
                <ChevronRight className="h-4 w-4 text-[var(--ink3,#9a9faa)]" aria-hidden />
              </button>
            </div>
            {isAdmin ? (
              <>
                <div className="mt-3">
                  <AdminPushToggle hint="Paziņojums telefonā, kad pavadzīme izdota vai neizdevās." />
                </div>
                {/* VPN un servera stāvoklis - pašā apakšā, liela poga (tikai telefonā; datorā augšā kā agrāk). */}
                <div className="mt-6">
                  <IrissVpnControl variant="card" />
                </div>
              </>
            ) : null}
            {/* Beigušās un vecās pavadzīmes nav pirmajā lapā - tikai maza saite pašā apakšā. */}
            <button
              type="button"
              onClick={() => setView("archive")}
              className="mx-auto mt-5 flex min-h-11 items-center px-3 text-[13px] font-medium text-[var(--ink2,#5e636e)]"
            >
              Arhīvs ({viewCount("archive")}) ›
            </button>
          </div>
        ) : null}
        <IrissWaybillPdfSheet href={pdfPreview?.href ?? null} title={pdfPreview?.title ?? ""} onClose={() => setPdfPreview(null)} />
        <AdminMobileSheet open={Boolean(historyVin)} title="Pavadzīmes šim auto" subtitle={historyVin ?? ""} onClose={() => setHistoryVin(null)}>
          <ul className="flex flex-col gap-2">
            {(historyVin ? waybillHistoryForVin(data.rows, historyVin) : []).map((h) => (
              <li key={h.id} className="flex items-center gap-3 rounded-[14px] bg-[#f2f2f7] px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[12.5px] font-semibold">{dash(h.number)} · {dash(h.plate)}</span>
                  <span className="block text-[12px] text-[#6e6e73]">
                    {formatWaybillDateTime(h.issuedAt, now) || "-"} → {formatWaybillDateTime(h.validUntil, now) || "-"}
                  </span>
                </span>
                <button type="button" className="min-h-9 rounded-full bg-white px-3 text-[12.5px] font-semibold" onClick={() => openPdf(h)}>
                  PDF
                </button>
              </li>
            ))}
          </ul>
        </AdminMobileSheet>
      </div>
    </>
  );
}
