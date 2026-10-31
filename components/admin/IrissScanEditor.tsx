"use client";

import { ChevronLeft, Pin, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminWorkspaceRevisionConflictBanner } from "@/components/admin/AdminWorkspaceRevisionConflictBanner";
import { useModalBackdropClose } from "@/hooks/useModalBackdropClose";
import { IrissAuctionLogo } from "@/components/admin/IrissAuctionLogo";
import { IrissMarketplaceLoadPanel } from "@/components/admin/IrissMarketplaceLoadPanel";
import { IrissOverflowItem, IrissOverflowMenu } from "@/components/admin/IrissOverflowMenu";
import { IrissScanFinds } from "@/components/admin/IrissScanFinds";
import { IrissScanLinksDrawer } from "@/components/admin/IrissScanLinksDrawer";
import { IrissUnsavedChangesGuard } from "@/components/admin/IrissUnsavedChangesGuard";
import { buildListingPlatformChips } from "@/lib/iriss-listing-links";
import type { IrissListingHitStatus } from "@/lib/iriss-listing-match-client";
import type { IrissOrderSaveResult } from "@/lib/iriss-order-section-save";
import { IRISS_SCAN_AUTOSAVE_DEBOUNCE_MS, irissScanFieldNotice } from "@/lib/iriss-scan-autosave";
import { applyIrissScanSaveResult, irissScanSaveRequest } from "@/lib/iriss-scan-editor-save";
import { irissScanFilterTableRows } from "@/lib/iriss-scan-filter-table";
import type { IrissScanFindCard } from "@/lib/iriss-scan-finds";
import { irissScanFindBucket } from "@/lib/iriss-scan-finds";
import { formatIrissScanLastRead, formatIrissScanNewHitsLabel, formatIrissScanTitle } from "@/lib/iriss-scan-list-view";
import { applyGeneratedScanSourceFilter } from "@/lib/iriss-scan-platform-search";
import { IRISS_STALE_REVISION, irissScanWorkspaceRevision, mergeIrissScanRecords } from "@/lib/iriss-scan-save-safety";
import type { IrissScanLinkKey } from "@/lib/iriss-scan-sources";
import type { IrissScanRecord } from "@/lib/iriss-scan-types";
import { irissScanHasOperatorContent } from "@/lib/iriss-scan-vin";
import { MARKETPLACE_RADAR_LOADS_ENABLED, MARKETPLACE_RADAR_PAUSED } from "@/lib/marketplace/radar-pause";
import { irissScanApifyPlatforms } from "@/lib/marketplace/query-from-scan";
import type { MarketplaceVehicleCategory } from "@/lib/marketplace/types";
import { planSilentAutosave } from "@/lib/iriss-pasutijumi-save-safety";

/** Stabils noklusējums: efekts ar [finds] citādi griežas bez gala. */
const EMPTY_FINDS: IrissScanFindCard[] = [];

export function IrissScanEditor({
  initialRecord,
  unsavedDraft = false,
  showBack = true,
  newHits = 0,
  finds = EMPTY_FINDS,
  lastReadAt = "",
  onRecordChange,
  onDeleted,
}: {
  initialRecord: IrissScanRecord;
  unsavedDraft?: boolean;
  showBack?: boolean;
  newHits?: number;
  finds?: IrissScanFindCard[];
  lastReadAt?: string;
  onRecordChange?: (rec: IrissScanRecord) => void;
  onDeleted?: (id: string) => void;
}) {
  const router = useRouter();
  const [rec, setRec] = useState<IrissScanRecord>(initialRecord);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(Boolean(unsavedDraft && irissScanHasOperatorContent(initialRecord)));
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [conflict, setConflict] = useState<{ server: IrissScanRecord } | null>(null);
  const [conflictBusy, setConflictBusy] = useState(false);
  const persistedIdRef = useRef(unsavedDraft ? "" : initialRecord.id);
  const [persistId, setPersistId] = useState(unsavedDraft ? "" : initialRecord.id);
  const lastSavedSnapshot = useRef(JSON.stringify(initialRecord));
  const autosaveTimer = useRef<number | null>(null);
  const autosaveInFlight = useRef(false);
  const autosaveQueued = useRef(false);
  const recRef = useRef(rec);
  recRef.current = rec;
  const chips = useMemo(() => buildListingPlatformChips(rec, 50), [rec]);
  const filterRows = useMemo(() => irissScanFilterTableRows(rec), [rec]);
  const fieldNotice = irissScanFieldNotice(saveMsg);
  const [liveFinds, setLiveFinds] = useState(finds);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLiveFinds(finds);
  }, [finds]);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 56)}px`;
  }, [rec.brandModel]);

  useEffect(() => {
    setRec(initialRecord);
    persistedIdRef.current = unsavedDraft ? "" : initialRecord.id;
    setPersistId(unsavedDraft ? "" : initialRecord.id);
    lastSavedSnapshot.current = JSON.stringify(initialRecord);
    setDirty(Boolean(unsavedDraft && irissScanHasOperatorContent(initialRecord)));
    setSaveMsg(null);
    setConflict(null);
  }, [initialRecord, unsavedDraft]);

  const patchRecord = useCallback((patch: Partial<IrissScanRecord>) => {
    setRec((r) => ({ ...r, ...patch }));
    setDirty(true);
    setSaveMsg(null);
  }, []);

  const save = useCallback(async (opts?: { silent?: boolean }): Promise<IrissOrderSaveResult> => {
    const snapshot = recRef.current;
    const silent = Boolean(opts?.silent);
    if (!persistedIdRef.current && !irissScanHasOperatorContent(snapshot)) {
      setSaveMsg("Nav ko saglabāt. Ieraksti VIN, marku vai saiti.");
      setBusy(false);
      return { ok: false, error: "empty_record" };
    }
    const plan = planSilentAutosave(autosaveInFlight.current);
    if (silent && !plan.startNow) {
      autosaveQueued.current = true;
      return { ok: false, error: "queued" };
    }
    setBusy(true);
    if (silent) autosaveInFlight.current = true;
    setSaveMsg(null);
    try {
      const persistIdNow = persistedIdRef.current;
      const req = irissScanSaveRequest(snapshot, persistIdNow);
      const res = await fetch(req.url, {
        method: req.method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      const data = (await res.json().catch(() => ({}))) as { record?: IrissScanRecord; id?: string; error?: string };
      const applied = applyIrissScanSaveResult({ rec: snapshot, persistId: persistIdNow, status: res.status, body: data });
      setRec(applied.rec);
      persistedIdRef.current = applied.persistId;
      setPersistId(applied.persistId);
      setSaveMsg(applied.ok ? null : applied.message);
      if (applied.conflict) setConflict({ server: applied.conflict });
      if (!applied.ok) return { ok: false, error: applied.message };
      setDirty(false);
      setConflict(null);
      lastSavedSnapshot.current = JSON.stringify(applied.rec);
      onRecordChange?.(applied.rec);
      if (req.isCreate && applied.href) {
        router.replace(applied.href);
        router.refresh();
      }
      return { ok: true };
    } catch {
      setRec(snapshot);
      setSaveMsg("Tīkla kļūda");
      return { ok: false, error: "Tīkla kļūda" };
    } finally {
      setBusy(false);
      autosaveInFlight.current = false;
      if (autosaveQueued.current) {
        autosaveQueued.current = false;
        void save({ silent: true });
      }
    }
  }, [onRecordChange, router]);

  useEffect(() => {
    const snap = JSON.stringify(rec);
    setDirty(snap !== lastSavedSnapshot.current);
    if (!persistedIdRef.current && !irissScanHasOperatorContent(rec)) return;
    if (snap === lastSavedSnapshot.current) return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      void save({ silent: true });
    }, IRISS_SCAN_AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [rec, save]);

  const reloadConflict = useCallback(() => {
    if (!conflict) return;
    setConflictBusy(true);
    setRec(conflict.server);
    persistedIdRef.current = conflict.server.id;
    setPersistId(conflict.server.id);
    lastSavedSnapshot.current = JSON.stringify(conflict.server);
    setDirty(false);
    setConflict(null);
    setSaveMsg(null);
    setConflictBusy(false);
  }, [conflict]);

  const mergeConflict = useCallback(() => {
    if (!conflict) return;
    setConflictBusy(true);
    const merged = mergeIrissScanRecords(conflict.server, rec);
    merged.workspaceRevision = irissScanWorkspaceRevision(conflict.server);
    setRec(merged);
    setConflict(null);
    setDirty(true);
    setSaveMsg("Apvienots droši. Izmaiņas saglabāsies pašas.");
    setConflictBusy(false);
  }, [conflict, rec]);

  async function setFindStatus(card: IrissScanFindCard, status: IrissListingHitStatus) {
    setLiveFinds((prev) =>
      prev.map((f) =>
        f.listingId === card.listingId && f.orderId === card.orderId
          ? { ...f, status, bucket: irissScanFindBucket(status) }
          : f,
      ),
    );
    await fetch("/api/admin/iriss-listings/match-status", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ orderId: card.orderId, listingId: card.listingId, status }] }),
    }).catch(() => {});
  }

  async function togglePin() {
    const next = rec.pinnedAt ? "" : new Date().toISOString();
    patchRecord({ pinnedAt: next });
  }

  const deleteConfirmBackdropClose = useModalBackdropClose(() => setDeleteOpen(false));

  return (
    <div className="iriss-scan-editor w-full min-w-0">
      <IrissUnsavedChangesGuard dirty={dirty} onSave={() => save()} />

      {showBack ? (
        <div className="mb-2 md:hidden">
          <Link href="/admin/iriss/scan" className="inline-flex min-h-10 items-center gap-0.5 text-[15px] font-medium text-[var(--acc)]">
            <ChevronLeft className="h-5 w-5" strokeWidth={2.4} aria-hidden /> Radars
          </Link>
        </div>
      ) : null}

      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <textarea
            ref={titleRef}
            rows={1}
            data-bare
            className="w-full resize-none overflow-hidden bg-transparent text-[20px] font-semibold leading-[1.25] tracking-tight text-[var(--ink)] outline-none placeholder:text-[var(--ink3)] md:text-[22px]"
            placeholder="Marka modelis"
            aria-label="Marka modelis"
            value={rec.brandModel}
            onChange={(e) => patchRecord({ brandModel: e.target.value })}
          />
          <input
            data-bare
            className="mt-1 w-full bg-transparent font-mono text-[14px] tracking-wide text-[var(--ink)] outline-none placeholder:text-[var(--ink3)]"
            placeholder="VIN"
            aria-label="VIN"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            value={rec.vin}
            onChange={(e) => patchRecord({ vin: e.target.value.toUpperCase() })}
          />
          <p className="mt-1 text-[12px] text-[var(--ink3)]">
            {rec.vin.trim() ? rec.vin.trim() : "VIN nav"}
            {persistId && formatIrissScanLastRead(lastReadAt) ? ` · pēdējā nolasīšana ${formatIrissScanLastRead(lastReadAt)}` : ""}
            {formatIrissScanNewHitsLabel(newHits) ? ` · ${formatIrissScanNewHitsLabel(newHits)}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Jaunam radaram, kas vēl nav saglabāts, "Saglabāts" maldinātu. */}
          {busy || persistId ? (
            <span className="iriss-ok-chip inline-flex items-center rounded-full bg-[var(--s1)] px-3.5 text-[12px] text-[var(--ink2)] shadow-[var(--sh)]" aria-live="polite">
              {busy ? "Saglabā..." : "Saglabāts"}
            </span>
          ) : null}
          <IrissOverflowMenu label="Darbības">
            <IrissOverflowItem onClick={() => void togglePin()}>
              {rec.pinnedAt ? "Atspraust" : "Piespraust"}
            </IrissOverflowItem>
            {chips.length > 0 ? (
              <IrissOverflowItem
                onClick={() => chips.forEach((c) => window.open(c.href, "_blank", "noopener,noreferrer"))}
              >
                Atvērt visas
              </IrissOverflowItem>
            ) : null}
            <IrissOverflowItem tone="danger" onClick={() => setDeleteOpen(true)}>
              Dzēst
            </IrissOverflowItem>
          </IrissOverflowMenu>
        </div>
      </header>

      {conflict ? (
        <div className="mb-3">
          <AdminWorkspaceRevisionConflictBanner
            kind={IRISS_STALE_REVISION}
            busy={conflictBusy}
            onReload={reloadConflict}
            onSafeMerge={mergeConflict}
          />
        </div>
      ) : null}

      <section className="mb-4 overflow-hidden rounded-3xl bg-[var(--s1)] p-3 shadow-[var(--sh)]">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--ink2)]">Avoti un filtri</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLinksOpen(true)}
              className="inline-flex h-[34px] shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-[var(--s2)] px-4 text-[13px] font-semibold text-[var(--ink)]"
            >
              Saites
            </button>
            <button
              type="button"
              disabled={chips.length === 0}
              onClick={() => chips.forEach((c) => window.open(c.href, "_blank", "noopener,noreferrer"))}
              className="inline-flex h-[34px] shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-[var(--s2)] px-4 text-[13px] font-semibold text-[var(--ink)] disabled:opacity-40"
            >
              Atvērt visas
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-[13px]">
            <colgroup>
              <col className="w-[120px]" />
              <col />
              <col className="w-[72px]" />
              <col className="w-24" />
            </colgroup>
            <tbody>
              {filterRows.map((row) => (
                <tr key={row.key} className="h-[52px] border-t border-[var(--hair)] first:border-t-0">
                  <th className="w-[120px] py-2.5 pr-3 font-semibold text-[var(--ink)]">
                    <IrissAuctionLogo platform={row.logoKey} fallback={row.label} size="md" />
                  </th>
                  <td className="min-w-0 py-2.5 pr-3 text-[var(--ink2)]">{row.description}</td>
                  <td className="w-[72px] py-2.5 pr-3 text-[var(--ink3)]">
                    <span className="iriss-ok-chip bg-[var(--s2)] text-[var(--ink2)]">{row.status}</span>
                  </td>
                  <td className="w-24 py-2.5 text-right">
                    {row.action === "open" && row.href ? (
                      <a
                        href={row.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-[34px] w-24 items-center justify-center whitespace-nowrap rounded-full bg-[var(--s2)] text-[12px] font-semibold text-[var(--ink)]"
                      >
                        Atvērt
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const next = applyGeneratedScanSourceFilter(rec, row.platform);
                          if (!next.url) {
                            setSaveMsg("Nav pietiekamu kritēriju šim filtram (marka).");
                            return;
                          }
                          if (next.record === rec) {
                            setSaveMsg("Šī avota filtrs jau ir sarakstā.");
                            return;
                          }
                          patchRecord(next.record);
                        }}
                        className="inline-flex h-[34px] w-24 items-center justify-center whitespace-nowrap rounded-full bg-[var(--chip-active-bg)] text-[12px] font-semibold text-[var(--chip-active-fg)]"
                      >
                        Izveidot
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {fieldNotice?.kind === "empty" ? (
          <p className="mt-3 text-[12px] text-[var(--bad)]">{fieldNotice.text}</p>
        ) : null}
        {fieldNotice?.kind === "failed" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-[var(--bad)]">
            <span>Neizdevās saglabāt. Ievadītās izmaiņas nepazūd.</span>
            <button
              type="button"
              onClick={() => void save()}
              className="inline-flex h-8 items-center rounded-full bg-[var(--bad-soft)] px-3 font-semibold text-[var(--bad)]"
            >
              Mēģināt vēlreiz
            </button>
          </div>
        ) : null}
        {fieldNotice?.kind === "info" ? <p className="mt-3 text-[12px] text-[var(--ink2)]">{fieldNotice.text}</p> : null}
      </section>

      <details className="mb-4 overflow-hidden rounded-3xl bg-[var(--s1)] shadow-[var(--sh)]">
        <summary className="cursor-pointer px-3 py-3 text-[13px] font-semibold text-[var(--ink)]">Kritēriji un ielāde</summary>
        <div className="space-y-3 border-t border-[var(--hair)] px-3 pb-3 pt-2">
          {(
            [
              ["productionYears", "Gadi", "2020-2026"],
              ["engineType", "Dzinējs", "Dīzelis līdz 2.0, no 110 kW"],
              ["transmission", "Kārba", "Manuālā"],
              ["bodyType", "Virsbūve", "Furgons H2L4"],
            ] as const
          ).map(([key, label, placeholder]) => (
            <label key={key} className="flex min-h-[44px] items-center gap-3">
              <span className="w-[5.5rem] shrink-0 text-[12px] font-medium text-[var(--ink3)]">{label}</span>
              <input
                data-bare
                className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--ink3)]"
                value={rec[key]}
                placeholder={placeholder}
                onChange={(e) => patchRecord({ [key]: e.target.value } as Pick<IrissScanRecord, typeof key>)}
                aria-label={label}
              />
            </label>
          ))}
          <div className="flex min-h-[44px] items-center gap-3">
            <span className="w-[5.5rem] shrink-0 text-[12px] font-medium text-[var(--ink3)]">Tips</span>
            <div className="flex flex-wrap gap-1.5 py-2">
              {(
                [
                  ["", "Automātiski"],
                  ["car", "Vieglā"],
                  ["van", "Furgons"],
                ] as const
              ).map(([value, label]) => {
                const on = rec.vehicleCategory === value;
                return (
                  <button
                    key={value || "auto"}
                    type="button"
                    aria-pressed={on}
                    onClick={() => patchRecord({ vehicleCategory: value as MarketplaceVehicleCategory | "" })}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                      on ? "bg-[var(--chip-active-bg)] text-[var(--chip-active-fg)]" : "bg-[var(--s2)] text-[var(--ink2)]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="flex min-h-[44px] items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--ink)]"
              checked={rec.apifyMobiledeEnabled}
              onChange={(e) => patchRecord({ apifyMobiledeEnabled: e.target.checked })}
            />
            <span className="text-[15px] text-[var(--ink)]">mobile.de (manuāli, maksas)</span>
          </label>
          <label className="flex min-h-[44px] items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--ink)]"
              checked={rec.apifyAutoscout24Enabled}
              onChange={(e) => patchRecord({ apifyAutoscout24Enabled: e.target.checked })}
            />
            <span className="text-[15px] text-[var(--ink)]">AutoScout24 (manuāli, maksas)</span>
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                setSaveMsg(null);
                try {
                  const persistIdNow = persistedIdRef.current;
                  const res = await fetch("/api/admin/iriss-scan/ecarstrade-links", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(
                      persistIdNow ? { apply: true, replace: true, id: persistIdNow } : { apply: false, replace: true, record: rec },
                    ),
                  });
                  const data = (await res.json()) as {
                    saved?: IrissScanRecord[];
                    addedCount?: number;
                    updatedCount?: number;
                    results?: Array<{ added?: string[]; generated?: string[] }>;
                  };
                  if (!res.ok) {
                    setSaveMsg("eCarsTrade ģenerēšana neizdevās");
                    return;
                  }
                  const saved = data.saved?.[0];
                  if (persistIdNow && saved) {
                    setRec(saved);
                    lastSavedSnapshot.current = JSON.stringify(saved);
                    setDirty(false);
                    setSaveMsg(data.updatedCount || data.addedCount ? "Aizstātas eCarsTrade saites" : "eCarsTrade saite jau ir aktuāla");
                    onRecordChange?.(saved);
                    return;
                  }
                  const generated = data.results?.[0]?.generated ?? data.results?.[0]?.added ?? [];
                  if (generated.length === 0) {
                    setSaveMsg("Nav eCarsTrade filtra no izsoles saites (Auto1/Openlane/Autobid)");
                    return;
                  }
                  patchRecord({ listingLinkEcarstrade: generated });
                  setSaveMsg(`Sagatavotas ${generated.length} eCarsTrade saites.`);
                } finally {
                  setBusy(false);
                }
              })();
            }}
            className="text-[13px] font-semibold text-[var(--acc)] disabled:opacity-40"
            title="Atjaunot eCarsTrade saites no Auto1 / Openlane / Autobid / Mobile filtriem"
          >
            Atjaunot eCarsTrade
          </button>
          {/* Nils 31.10: mobile.de / AutoScout24 pagaidām tikai pasūtījumiem; radara panelis atgriežas ar MARKETPLACE_RADAR_LOADS_ENABLED. */}
          {MARKETPLACE_RADAR_LOADS_ENABLED && persistId ? (
            <IrissMarketplaceLoadPanel scanId={persistId} enabledPlatforms={irissScanApifyPlatforms(rec)} />
          ) : (
            <p className="text-[12px] text-[var(--ink3)]">{MARKETPLACE_RADAR_LOADS_ENABLED ? "Saglabā radaru, tad ielādē mobile.de / AutoScout24." : MARKETPLACE_RADAR_PAUSED}</p>
          )}
        </div>
      </details>

      <IrissScanFinds finds={liveFinds} onStatus={(card, status) => void setFindStatus(card, status)} />

      <button
        type="button"
        onClick={() => setDeleteOpen(true)}
        className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-2xl bg-[var(--s1)] text-[15px] font-medium text-[var(--bad)] shadow-[var(--sh)]"
      >
        <Trash2 className="h-4 w-4" aria-hidden /> Dzēst ierakstu
      </button>

      <IrissScanLinksDrawer
        open={linksOpen}
        rec={rec}
        onClose={() => setLinksOpen(false)}
        onChangeLinks={(key, next) => patchRecord({ [key]: next } as Pick<IrissScanRecord, IrissScanLinkKey>)}
      />

      {deleteOpen ? (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/40 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6" {...deleteConfirmBackdropClose} role="presentation">
          <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-[var(--s1)] p-5 text-center shadow-[var(--gsh)]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[15px] font-semibold text-[var(--ink)]">Dzēst šo radara ierakstu?</h2>
            <p className="mt-1 text-[13px] text-[var(--ink3)]">Darbību nevar atsaukt.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDeleteOpen(false)} className="h-11 rounded-xl bg-[var(--s2)] text-[15px] font-medium text-[var(--ink)]">
                Atcelt
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    if (!persistedIdRef.current) {
                      onDeleted?.(rec.id);
                      router.push("/admin/iriss/scan");
                      return;
                    }
                    const res = await fetch(`/api/admin/iriss-scan/${encodeURIComponent(rec.id)}`, { method: "DELETE", credentials: "include" });
                    if (!res.ok) return;
                    onDeleted?.(rec.id);
                    router.push("/admin/iriss/scan");
                    router.refresh();
                  } finally {
                    setBusy(false);
                  }
                }}
                className="h-11 rounded-xl bg-[var(--bad)] text-[15px] font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Dzēš..." : "Dzēst"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rec.pinnedAt ? <Pin className="sr-only" aria-label="Piesprausts" /> : null}
      <span className="sr-only">{formatIrissScanTitle(rec.brandModel)}</span>
    </div>
  );
}
