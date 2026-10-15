"use client";

import { FileDown, Mail, Phone, Plus, Star, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { DzintarzemeTameSection } from "@/components/admin/DzintarzemeTameSection";
import { IrissListingPlatformChipsRow, IrissListingPlatformsFields } from "@/components/admin/IrissListingPlatformsSection";
import { IrissOrderSectionSaveButton } from "@/components/admin/IrissOrderSectionSaveButton";
import { listingBudgetFitPill, listingFmtEur } from "@/lib/iriss-listings-card";
import { IRISS_LISTING_PLATFORM_LABEL } from "@/lib/iriss-listings-platform";
import { serializeListingOrderFilter } from "@/lib/iriss-listings-orders";
import {
  IRISS_LIST_PREFS_KEY,
  irissListBrowserStorage,
  migrateIrissListPrefs,
  parseIrissListPrefs,
  persistIrissListPrefs,
  safeStorageGet,
} from "@/lib/iriss-listings-operator-prefs";
import type { IrissOrderSaveResult } from "@/lib/iriss-order-section-save";
import {
  IRISS_ORDER_ROOM_TEMPLATES,
  appendIrissOrderRoomNote,
  irissOrderRoomClientLine,
  irissOrderRoomCommunicationCount,
  irissOrderRoomCriteriaChips,
  irissOrderRoomDealPill,
  irissOrderRoomDocumentCount,
  irissOrderRoomExcludeTokens,
  irissOrderRoomHitBucket,
  irissOrderRoomHitPassesCriteria,
  irissOrderRoomHitShareText,
  irissOrderRoomListingLinkCount,
  irissOrderRoomMatch,
  irissOrderRoomNextSteps,
  irissOrderRoomOfferMatchesHit,
  irissOrderRoomOfferStatus,
  irissOrderRoomOfferThumb,
  irissOrderRoomOfferTotal,
  irissOrderRoomPlatformLabels,
  irissOrderRoomRef,
  irissOrderRoomStamp,
  irissOrderRoomStatusLabel,
  irissOrderRoomVisibleHits,
  type IrissOrderRoomHit,
  type IrissOrderRoomHitBucket,
  type IrissOrderRoomTab,
} from "@/lib/iriss-order-room";
import { parseIrissOrderBudget } from "@/lib/iriss-listings-orders";
import {
  IRISS_DEAL_DETAIL_OPTIONS,
  IRISS_PASUTIJUMS_LIST_STATUSES,
  IRISS_PASUTIJUMS_LIST_STATUS_LV,
  defaultIrissDzintarzemeTameDraft,
  type IrissOfferRecord,
  type IrissPasutijumsListStatus,
  type IrissPasutijumsRecord,
} from "@/lib/iriss-pasutijumi-types";

const fieldClass =
  "min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[16px] text-[var(--color-apple-text)] shadow-sm outline-none transition focus:border-[var(--color-provin-accent)] focus:ring-2 focus:ring-[var(--color-provin-accent)]/25 sm:text-[15px]";

const areaClass = `${fieldClass} min-h-[88px] resize-y py-2.5 leading-snug`;

const cardClass = "rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5";

const BUCKETS: ReadonlyArray<{ id: IrissOrderRoomHitBucket; label: string }> = [
  { id: "new", label: "Jauni" },
  { id: "saved", label: "Saglabāti" },
  { id: "offered", label: "Piedāvāti" },
  { id: "reject", label: "Neder" },
];

type CriteriaDraft = Pick<
  IrissPasutijumsRecord,
  | "totalBudget"
  | "productionYears"
  | "engineType"
  | "transmission"
  | "bodyType"
  | "driveType"
  | "maxMileage"
  | "preferredColors"
  | "nonPreferredColors"
  | "interiorFinish"
  | "equipmentRequired"
  | "equipmentDesired"
>;

function criteriaFrom(rec: IrissPasutijumsRecord): CriteriaDraft {
  return {
    totalBudget: rec.totalBudget,
    productionYears: rec.productionYears,
    engineType: rec.engineType,
    transmission: rec.transmission,
    bodyType: rec.bodyType,
    driveType: rec.driveType,
    maxMileage: rec.maxMileage,
    preferredColors: rec.preferredColors,
    nonPreferredColors: rec.nonPreferredColors,
    interiorFinish: rec.interiorFinish,
    equipmentRequired: rec.equipmentRequired,
    equipmentDesired: rec.equipmentDesired,
  };
}

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "h-4 w-4 fill-current"} aria-hidden>
      <path d="M12.04 2C6.55 2 2.1 6.45 2.1 11.94c0 1.93.55 3.81 1.59 5.43L2 22l4.8-1.61a9.9 9.9 0 0 0 5.24 1.5h.01c5.49 0 9.95-4.45 9.95-9.95A9.96 9.96 0 0 0 12.04 2Zm0 18.1h-.01a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-2.85.95.95-2.78-.19-.29a8.1 8.1 0 0 1-1.25-4.33c0-4.49 3.65-8.14 8.14-8.14a8.1 8.1 0 0 1 5.76 2.38 8.08 8.08 0 0 1 2.38 5.76c0 4.48-3.65 8.13-8.14 8.13Zm4.46-6.06c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.95-1.22a7.34 7.34 0 0 1-1.35-1.67c-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.37.51.58.18 1.11.15 1.53.09.47-.07 1.43-.58 1.63-1.13.2-.56.2-1.04.14-1.13-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  );
}

function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 border-l-4 border-[var(--color-provin-accent)] bg-[var(--color-provin-accent-soft)]/40 py-1.5 pl-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-provin-accent)]">
      {children}
    </h2>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  autoComplete,
  id,
  warning,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: "tel" | "email" | "text";
  autoComplete?: string;
  id?: string;
  warning?: string | null;
  type?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">{label}</span>
      <input
        id={id}
        type={type}
        className={fieldClass}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
      />
      {warning ? <p className="mt-1 text-[11px] text-amber-800">{warning}</p> : null}
    </label>
  );
}

function offerShareText(offer: IrissOfferRecord): string {
  const total = irissOrderRoomOfferTotal(offer);
  const bits = [offer.brandModel.trim() || offer.title.trim(), offer.firstRegistration.trim() || offer.year.trim()];
  if (total != null) bits.push(listingFmtEur(total));
  return [`Sveiki! Piedāvājums: ${bits.filter(Boolean).join(", ")}.`, "", "Labu dienu,", "PROVIN.LV"].join("\n");
}

export function IrissOrderRoom({
  rec,
  hits,
  dismissedHitIds,
  listingsCache,
  busy,
  orderPdfBusy,
  saveMsg,
  orderPdfRetryOpen,
  phoneWarning,
  vinWarning,
  canCall,
  canEmail,
  conflict,
  deleted,
  onPatch,
  onPatchRecord,
  onInactiveReason,
  onSetStatus,
  onSave,
  onSaveCriteria,
  onPdf,
  onRetryPdf,
  onDismissPdfRetry,
  onCall,
  onWhatsappText,
  onAppendNote,
  onCreateOffer,
  onEditOffer,
  onPrepareOffer,
  onOpenOfferPdf,
  onRestore,
  onDeleteOrder,
}: {
  rec: IrissPasutijumsRecord;
  hits: IrissOrderRoomHit[];
  dismissedHitIds: string[];
  listingsCache: "on" | "off";
  busy: boolean;
  orderPdfBusy: boolean;
  saveMsg: string | null;
  orderPdfRetryOpen: boolean;
  phoneWarning: string | null;
  vinWarning: string | null;
  canCall: boolean;
  canEmail: boolean;
  conflict: ReactNode;
  deleted: boolean;
  onPatch: <K extends keyof IrissPasutijumsRecord>(key: K, value: IrissPasutijumsRecord[K]) => void;
  onPatchRecord: (patch: Partial<IrissPasutijumsRecord>) => void;
  onInactiveReason: (value: string) => void;
  onSetStatus: (status: IrissPasutijumsListStatus) => void;
  onSave: () => Promise<IrissOrderSaveResult>;
  onSaveCriteria: (patch: CriteriaDraft) => Promise<IrissOrderSaveResult>;
  onPdf: () => void;
  onRetryPdf: () => void;
  onDismissPdfRetry: () => void;
  onCall: () => void;
  onWhatsappText: (text: string) => void;
  onAppendNote: (text: string) => void;
  onCreateOffer: () => void;
  onEditOffer: (offer: IrissOfferRecord) => void;
  onPrepareOffer: (hit: IrissOrderRoomHit) => void;
  onOpenOfferPdf: (offerId: string) => void;
  onRestore: () => void;
  onDeleteOrder: () => void;
}) {
  const [tab, setTab] = useState<IrissOrderRoomTab>("overview");
  const [bucket, setBucket] = useState<IrissOrderRoomHitBucket>("new");
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const [criteriaOn, setCriteriaOn] = useState(false);
  const [criteriaDraft, setCriteriaDraft] = useState<CriteriaDraft>(() => criteriaFrom(rec));
  const [excludeDraft, setExcludeDraft] = useState("");
  const [criteriaBusy, setCriteriaBusy] = useState(false);
  const [favIds, setFavIds] = useState<Set<string>>(() => new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set(dismissedHitIds));
  const [roomMsg, setRoomMsg] = useState<string | null>(null);
  const [composer, setComposer] = useState("");
  const [linksOpen, setLinksOpen] = useState(false);

  useEffect(() => {
    setDismissed(new Set(dismissedHitIds));
  }, [dismissedHitIds]);

  useEffect(() => {
    const storage = irissListBrowserStorage();
    if (!storage) return;
    setFavIds(new Set(migrateIrissListPrefs(storage).fav));
  }, []);

  const offeredIds = useMemo(() => {
    const ids = new Set<string>();
    for (const hit of hits) {
      if (rec.offers.some((offer) => irissOrderRoomOfferMatchesHit(offer, hit))) ids.add(hit.id);
    }
    return ids;
  }, [hits, rec.offers]);

  const visibleHits = useMemo(
    () => irissOrderRoomVisibleHits(hits, dismissed, offeredIds),
    [dismissed, hits, offeredIds],
  );
  const filteredHits = useMemo(
    () => (criteriaOn ? visibleHits.filter((hit) => irissOrderRoomHitPassesCriteria(rec, hit)) : visibleHits),
    [criteriaOn, rec, visibleHits],
  );

  function bucketOf(hit: IrissOrderRoomHit): IrissOrderRoomHitBucket {
    return irissOrderRoomHitBucket({
      dismissed: dismissed.has(hit.id),
      saved: favIds.has(hit.id),
      offered: offeredIds.has(hit.id),
    });
  }

  const bucketCounts = useMemo(() => {
    const counts: Record<IrissOrderRoomHitBucket, number> = { new: 0, saved: 0, offered: 0, reject: 0 };
    for (const hit of filteredHits) counts[bucketOf(hit)] += 1;
    return counts;
    // bucketOf closes over dismissed/fav/offered, which are already in the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissed, favIds, filteredHits, offeredIds]);

  const shownHits = filteredHits.filter((hit) => bucketOf(hit) === bucket);
  const chips = irissOrderRoomCriteriaChips(rec);
  const dealPill = irissOrderRoomDealPill(rec);
  const clientLine = irissOrderRoomClientLine(rec);
  const refLabel = irissOrderRoomRef(rec.id);
  const linkCount = irissOrderRoomListingLinkCount(rec);
  const platforms = irissOrderRoomPlatformLabels(visibleHits);
  const budget = parseIrissOrderBudget(rec.totalBudget);
  const newHits = visibleHits.filter((hit) => bucketOf(hit) === "new").length;
  const steps = irissOrderRoomNextSteps({
    newHits,
    offerCount: rec.offers.length,
    hasPhone: canCall,
    hasVin: Boolean(rec.vin.trim()),
  });
  const commCount = irissOrderRoomCommunicationCount((rec.statusHistory ?? []).length, Boolean(rec.notes.trim()));
  const docCount = irissOrderRoomDocumentCount(rec.offers.length);
  const searchHref = `/admin/iriss/sludinajumi?ord=${encodeURIComponent(serializeListingOrderFilter({ kind: "order", id: rec.id }))}`;
  const history = [...(rec.statusHistory ?? [])].reverse();

  function openCriteria() {
    setCriteriaDraft(criteriaFrom(rec));
    setExcludeDraft("");
    setCriteriaOpen(true);
  }

  async function saveCriteria() {
    setCriteriaBusy(true);
    const result = await onSaveCriteria(criteriaDraft);
    setCriteriaBusy(false);
    if (result.ok) {
      setCriteriaOn(true);
      setCriteriaOpen(false);
    }
  }

  function toggleFav(id: string) {
    const storage = irissListBrowserStorage();
    if (!storage) return;
    const prefs = parseIrissListPrefs(safeStorageGet(storage, IRISS_LIST_PREFS_KEY));
    const fav = prefs.fav.includes(id) ? prefs.fav.filter((x) => x !== id) : [...prefs.fav, id];
    persistIrissListPrefs(storage, { ...prefs, fav });
    setFavIds(new Set(fav));
  }

  async function setHitHidden(hit: IrissOrderRoomHit, hidden: boolean) {
    setRoomMsg(null);
    setDismissed((prev) => {
      const next = new Set(prev);
      if (hidden) next.add(hit.id);
      else next.delete(hit.id);
      return next;
    });
    try {
      const res = await fetch("/api/admin/iriss-listings/dismiss", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ id: hit.id, platform: hit.platform, externalId: hit.externalId, hidden }],
        }),
      });
      if (!res.ok) throw new Error("dismiss");
    } catch {
      setDismissed(new Set(dismissedHitIds));
      setRoomMsg("Sludinājuma statusu neizdevās saglabāt.");
    }
  }

  function openMail(body: string) {
    if (!rec.email.trim()) return;
    const subject = `PROVIN.LV: ${rec.brandModel.trim() || "pasūtījums"}`;
    window.location.href = `mailto:${rec.email.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  const actionBtn =
    "inline-flex h-10 min-h-10 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[13px] font-semibold text-[var(--color-apple-text)] shadow-sm transition hover:bg-slate-50 disabled:opacity-40";

  return (
    <div data-iriss-order-room="1" className="pb-1">
      <AdminDashboardHeaderWithMenu>
        <div className="flex flex-col gap-2">
          <Link
            href="/admin/iriss/pasutijumi"
            title={rec.id}
            className="inline-flex min-h-10 items-center gap-1 self-start text-[15px] font-medium text-[var(--color-provin-accent)]"
          >
            IRISS · Pasūtījumi / {refLabel}
          </Link>
          <div className={cardClass}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <h1 className="text-[20px] font-semibold leading-tight text-[var(--color-apple-text)]">
                    {rec.brandModel.trim() || "Pasūtījums"}
                  </h1>
                  <label className="inline-flex items-center">
                    <span className="sr-only">Statuss</span>
                    <select
                      className="h-8 rounded-full bg-slate-900 px-2.5 text-[12px] font-semibold text-white outline-none"
                      value={rec.listStatus}
                      aria-label="Pasūtījuma statuss"
                      onChange={(e) => onSetStatus(e.target.value as IrissPasutijumsListStatus)}
                    >
                      {IRISS_PASUTIJUMS_LIST_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {IRISS_PASUTIJUMS_LIST_STATUS_LV[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {dealPill ? (
                    <span className="inline-flex h-8 items-center rounded-full bg-emerald-50 px-2.5 text-[12px] font-semibold text-emerald-800">
                      {dealPill}
                    </span>
                  ) : null}
                </div>
                {clientLine ? <p className="mt-1 text-[13px] leading-snug text-[var(--color-provin-muted)]">{clientLine}</p> : null}
              </div>
              <div className="flex gap-2 overflow-x-auto">
                <button type="button" className={`${actionBtn} shrink-0`} disabled={!canCall} onClick={onCall}>
                  <Phone className="h-4 w-4" aria-hidden />
                  Zvanīt
                </button>
                <button
                  type="button"
                  className="inline-flex h-10 min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#25D366] px-3 text-[13px] font-semibold text-white shadow-sm disabled:opacity-40"
                  disabled={!canCall}
                  onClick={() => onWhatsappText("")}
                >
                  <WhatsAppGlyph className="h-4 w-4 fill-white" />
                  WhatsApp
                </button>
                <button type="button" className={`${actionBtn} shrink-0`} disabled={!canEmail} onClick={() => openMail("")}>
                  <Mail className="h-4 w-4" aria-hidden />
                  E-pasts
                </button>
                <button type="button" className={`${actionBtn} shrink-0`} disabled={orderPdfBusy} onClick={onPdf}>
                  <FileDown className="h-4 w-4" aria-hidden />
                  {orderPdfBusy ? "PDF…" : "PDF"}
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto border-b border-[#e5e5ea]" role="tablist" aria-label="Pasūtījuma istaba">
            {(
              [
                ["overview", "Pārskats", null],
                ["search", "Meklētājs", filteredHits.length],
                ["offers", "Piedāvājumi", rec.offers.length],
                ["communication", "Komunikācija", commCount],
                ["documents", "Dokumenti", docCount],
              ] as const
            ).map(([id, label, count]) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(id)}
                  className={`shrink-0 border-b-2 px-3 py-2 text-[14px] ${
                    active
                      ? "border-[var(--color-provin-accent)] font-semibold text-[var(--color-apple-text)]"
                      : "border-transparent font-medium text-[var(--color-provin-muted)]"
                  }`}
                >
                  {label}
                  {count != null ? <span className="ml-1 text-[12px] text-[var(--color-provin-muted)]">{count}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      </AdminDashboardHeaderWithMenu>

      {saveMsg ? (
        <p className="mt-2 text-[12px] font-medium text-[var(--color-provin-muted)]" role="status">
          {saveMsg}
        </p>
      ) : null}
      {roomMsg ? (
        <p className="mt-2 text-[12px] font-medium text-amber-800" role="status">
          {roomMsg}
        </p>
      ) : null}
      {orderPdfRetryOpen ? (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-[12px] leading-snug text-amber-950" role="status">
          <p className="font-semibold">Saglabāšana ir veiksmīga. PDF ģenerēšana vai lejupielāde neizdevās.</p>
          <button type="button" onClick={onRetryPdf} className="mt-1.5 inline-flex min-h-9 items-center rounded-full border border-amber-300/90 bg-white px-3 text-[12px] font-semibold text-[var(--color-provin-accent)]">
            Lejupielādēt PDF vēlreiz
          </button>
          <button type="button" onClick={onDismissPdfRetry} className="ml-2 text-[11px] font-medium text-slate-600 underline">
            Aizvērt
          </button>
        </div>
      ) : null}
      {conflict ? <div className="mt-3">{conflict}</div> : null}
      {deleted ? (
        <div className="mt-3 rounded-lg border border-amber-400/70 bg-amber-50 px-3 py-2.5 text-amber-950" role="status">
          <p className="text-[12px] font-semibold">Šis pasūtījums ir miskastē.</p>
          <button
            type="button"
            disabled={busy}
            onClick={onRestore}
            className="mt-2 inline-flex h-8 items-center rounded-lg border border-amber-400/80 bg-white px-2 text-[11px] font-semibold text-amber-950 disabled:opacity-50"
          >
            Atjaunot
          </button>
        </div>
      ) : null}

      {tab === "overview" ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-3">
            <section className={cardClass}>
              <CardTitle>Transportlīdzekļa specifikācija</CardTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block min-w-0">
                  <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Statuss</span>
                  <select className={fieldClass} value={rec.listStatus} aria-label="Statuss specifikācijā" onChange={(e) => onSetStatus(e.target.value as IrissPasutijumsListStatus)}>
                    {IRISS_PASUTIJUMS_LIST_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {IRISS_PASUTIJUMS_LIST_STATUS_LV[status]}
                      </option>
                    ))}
                  </select>
                  {rec.listStatus === "inactive" ? (
                    <input
                      className={`${fieldClass} mt-1.5`}
                      value={rec.inactiveReason ?? ""}
                      placeholder="Iemesls (neobligāti)"
                      aria-label="Neaktīvs iemesls"
                      onChange={(e) => onInactiveReason(e.target.value)}
                    />
                  ) : null}
                </label>
                <Field label="Marka / modelis" value={rec.brandModel} onChange={(value) => onPatch("brandModel", value)} />
                <Field id="iriss-room-vin" label="VIN" value={rec.vin} warning={vinWarning} onChange={(value) => onPatch("vin", value.toUpperCase())} />
                <Field label="Kopējais budžets" value={rec.totalBudget} onChange={(value) => onPatch("totalBudget", value)} />
                <Field label="Ražošanas gadi" value={rec.productionYears} placeholder="piem., 2018-2021" onChange={(value) => onPatch("productionYears", value)} />
                <Field label="Dzinēja tips" value={rec.engineType} onChange={(value) => onPatch("engineType", value)} />
                <Field label="Ātrumkārba" value={rec.transmission} onChange={(value) => onPatch("transmission", value)} />
                <Field label="Virsbūves tips" value={rec.bodyType} placeholder="piem., hečbeks, SUV" onChange={(value) => onPatch("bodyType", value)} />
                <Field label="Piedziņas tips" value={rec.driveType} placeholder="piem., priekšējā, 4x4" onChange={(value) => onPatch("driveType", value)} />
                <Field label="Sēdvietu skaits" value={rec.seatCount} placeholder="piem., 5" onChange={(value) => onPatch("seatCount", value)} />
                <Field label="Maks. nobraukums" value={rec.maxMileage} onChange={(value) => onPatch("maxMileage", value)} />
                <Field label="Vēlamās krāsas" value={rec.preferredColors} onChange={(value) => onPatch("preferredColors", value)} />
                <Field label="Nevēlamās krāsas" value={rec.nonPreferredColors} onChange={(value) => onPatch("nonPreferredColors", value)} />
                <div className="sm:col-span-2">
                  <Field label="Salona apdare" value={rec.interiorFinish} onChange={(value) => onPatch("interiorFinish", value)} />
                </div>
              </div>
              <IrissOrderSectionSaveButton disabled={busy || orderPdfBusy} onSave={onSave} />
            </section>

            <section className={cardClass}>
              <CardTitle>Avanss un darījums</CardTitle>
              <Field label="Pasūtījuma datums" type="date" value={rec.orderDate} onChange={(value) => onPatch("orderDate", value)} />
              <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {IRISS_DEAL_DETAIL_OPTIONS.map((opt) => (
                  <label key={opt.key} className="inline-flex items-center gap-2 text-[13px] text-[var(--color-apple-text)]">
                    <input type="checkbox" checked={Boolean(rec[opt.key])} onChange={(e) => onPatch(opt.key, e.target.checked)} />
                    {opt.label}
                  </label>
                ))}
              </div>
            </section>

            <section className={cardClass}>
              <CardTitle>Aprīkojums</CardTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Obligātās prasības</span>
                  <textarea className={areaClass} value={rec.equipmentRequired} onChange={(e) => onPatch("equipmentRequired", e.target.value)} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Vēlamās prasības</span>
                  <textarea className={areaClass} value={rec.equipmentDesired} onChange={(e) => onPatch("equipmentDesired", e.target.value)} />
                </label>
              </div>
              <IrissOrderSectionSaveButton disabled={busy || orderPdfBusy} onSave={onSave} />
            </section>

            <section className={cardClass}>
              <CardTitle>Piezīmes</CardTitle>
              <textarea className={areaClass} aria-label="Piezīmes" value={rec.notes} onChange={(e) => onPatch("notes", e.target.value)} />
              <IrissOrderSectionSaveButton disabled={busy || orderPdfBusy} onSave={onSave} />
            </section>

            <section className={cardClass}>
              <CardTitle>Klienta dati</CardTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="Vārds, uzvārds"
                  autoComplete="name"
                  value={[rec.clientFirstName, rec.clientLastName].filter(Boolean).join(" ").trim()}
                  onChange={(value) => {
                    const normalized = value.replace(/\s+/g, " ").trim();
                    if (!normalized) {
                      onPatchRecord({ clientFirstName: "", clientLastName: "" });
                      return;
                    }
                    const [first, ...rest] = normalized.split(" ");
                    onPatchRecord({ clientFirstName: first ?? "", clientLastName: rest.join(" ") });
                  }}
                />
                <label className="block min-w-0">
                  <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Tālrunis</span>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <input className={`${fieldClass} min-w-0 flex-1`} value={rec.phone} inputMode="tel" autoComplete="tel" onChange={(e) => onPatch("phone", e.target.value)} />
                    <button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[var(--color-provin-accent)] disabled:opacity-35" title="Zvanīt" aria-label="Zvanīt" disabled={!canCall} onClick={onCall}>
                      <Phone className="h-5 w-5" aria-hidden />
                    </button>
                    <button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 disabled:opacity-35" title="Atvērt WhatsApp" aria-label="Atvērt WhatsApp" disabled={!canCall} onClick={() => onWhatsappText("")}>
                      <WhatsAppGlyph className="h-5 w-5" />
                    </button>
                  </div>
                  {phoneWarning ? <p className="mt-1 text-[11px] text-amber-800">{phoneWarning}</p> : null}
                </label>
                <Field label="E-pasts" value={rec.email} inputMode="email" autoComplete="email" onChange={(value) => onPatch("email", value)} />
              </div>
              <IrissOrderSectionSaveButton disabled={busy || orderPdfBusy} onSave={onSave} />
            </section>

            <div id="iriss-room-tame">
              <DzintarzemeTameSection
                orderId={rec.id}
                shellCard={cardClass}
                draft={rec.dzintarzemeTameDraft ?? defaultIrissDzintarzemeTameDraft()}
                orderBrandModel={rec.brandModel}
                onDraftChange={(next) => onPatchRecord({ dzintarzemeTameDraft: next })}
                sectionSave={<IrissOrderSectionSaveButton disabled={busy || orderPdfBusy} onSave={onSave} />}
              />
            </div>

            <section className={`${cardClass} border-red-100/80 bg-red-50/20`}>
              <p className="text-[12px] leading-snug text-red-950/90">
                Neatgriezeniski dzēst šo pasūtījumu un visus piedāvājumus. Pirms dzēšanas tiek prasīts apstiprinājums.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <button type="button" onClick={onCreateOffer} className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-[var(--color-provin-accent)]">
                  <Plus className="h-4 w-4" aria-hidden />
                  Izveidot piedāvājumu
                </button>
                <button type="button" disabled={busy || orderPdfBusy} onClick={() => void onSave()} className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--color-provin-accent)] px-4 text-[13px] font-semibold text-[var(--color-provin-accent)] disabled:opacity-50">
                  {busy || orderPdfBusy ? "Saglabā…" : "Saglabāt"}
                </button>
                <button type="button" disabled={busy} onClick={onDeleteOrder} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-red-300/90 bg-white px-4 text-[13px] font-semibold text-red-800 disabled:opacity-50">
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Dzēst pasūtījumu
                </button>
              </div>
            </section>
          </div>

          <aside className="space-y-3">
            <section className={cardClass}>
              <CardTitle>Statusa vēsture</CardTitle>
              {history.length === 0 ? (
                <p className="text-[13px] text-[var(--color-provin-muted)]">Statusa maiņas vēl nav.</p>
              ) : (
                <ol className="space-y-2">
                  {history.slice(0, 8).map((entry) => (
                    <li key={`${entry.at}-${entry.from}-${entry.to}`} className="text-[13px] leading-snug text-[var(--color-apple-text)]">
                      <span className="text-[var(--color-provin-muted)]">{irissOrderRoomStamp(entry.at)}</span>
                      {" · "}
                      {irissOrderRoomStatusLabel(entry.from)} uz {irissOrderRoomStatusLabel(entry.to)}
                      {entry.by ? ` · ${entry.by}` : ""}
                      {entry.reason ? ` (${entry.reason})` : ""}
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <section className={cardClass}>
              <CardTitle>Nākamie soļi</CardTitle>
              {steps.length === 0 ? (
                <p className="text-[13px] text-[var(--color-provin-muted)]">Šobrīd nav atsevišķu soļu.</p>
              ) : (
                <ul className="space-y-2">
                  {steps.map((step) => (
                    <li key={step.id}>
                      <button
                        type="button"
                        className="text-left text-[13px] font-medium text-[var(--color-provin-accent)]"
                        onClick={() => {
                          setTab(step.tab);
                          if (step.id === "vin") document.getElementById("iriss-room-vin")?.focus();
                        }}
                      >
                        {step.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className={cardClass}>
              <CardTitle>Platformas</CardTitle>
              <IrissListingPlatformChipsRow rec={rec} />
              <p className="mt-2 text-[13px] text-[var(--color-provin-muted)]">
                {linkCount > 0 ? `${linkCount} saglabātas meklēšanas saites` : "Nav saglabātu meklēšanas saišu"}
                {platforms.length > 0 ? ` · ${platforms.join(" ")}` : ""}
              </p>
              <button type="button" className="mt-2 text-[13px] font-semibold text-[var(--color-provin-accent)]" onClick={() => setLinksOpen((v) => !v)}>
                {linksOpen ? "Aizvērt saites" : "Rediģēt saites"}
              </button>
              {linksOpen ? (
                <div className="mt-3">
                  <IrissListingPlatformsFields rec={rec} onPatch={onPatchRecord} />
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      ) : null}

      {tab === "search" ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={openCriteria}
                className={`max-w-full truncate rounded-full px-2.5 py-1 text-[12px] font-medium ${
                  chip.tone === "required" ? "bg-rose-50 text-rose-800" : "bg-white text-[var(--color-apple-text)] shadow-sm ring-1 ring-slate-200"
                }`}
              >
                {chip.label}
              </button>
            ))}
            <button type="button" onClick={openCriteria} className="rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold text-[var(--color-provin-accent)] shadow-sm ring-1 ring-slate-200">
              Visi kritēriji
            </button>
            {criteriaOn ? (
              <button type="button" className="rounded-full bg-slate-900 px-2.5 py-1 text-[12px] font-semibold text-white" onClick={() => setCriteriaOn(false)}>
                Filtrs ieslēgts
              </button>
            ) : null}
            <Link href={searchHref} className="ml-auto text-[13px] font-semibold text-[var(--color-provin-accent)]">
              Atvērt meklētājā
            </Link>
          </div>
          <p className="text-[12px] leading-snug text-[var(--color-provin-muted)]">
            Tie paši jau nolasītie auto, kas Meklētājā ir piesaistīti šim pasūtījumam. Istaba pati nesāk jaunu nolasīšanu.
          </p>
          {listingsCache === "off" ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-950">
              Sludinājumu kešs nav ieslēgts. Maksas avoti netiek prasīti.
            </p>
          ) : null}
          <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Sludinājumu statuss">
            {BUCKETS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setBucket(item.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold ${
                  bucket === item.id ? "bg-slate-900 text-white" : "bg-white text-[var(--color-apple-text)] ring-1 ring-slate-200"
                }`}
              >
                {item.label} {bucketCounts[item.id]}
              </button>
            ))}
          </div>
          {shownHits.length === 0 ? (
            <p className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-6 text-[14px] text-[var(--color-provin-muted)]">
              {listingsCache === "off" ? "Kešā nav ko rādīt." : "Šajā statusā nav sludinājumu."}
            </p>
          ) : (
            <ul className="space-y-3">
              {shownHits.map((hit) => {
                const match = irissOrderRoomMatch(rec, hit);
                const fit = budget != null && hit.price != null ? listingBudgetFitPill(budget, hit.price) : null;
                return (
                  <li key={hit.id} className="rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-sm sm:p-4">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <HitPhoto src={hit.imageUrl} alt={hit.title} count={hit.imageCount} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[15px] font-semibold leading-snug text-[var(--color-apple-text)]">{hit.title || "Sludinājums"}</p>
                            <p className="mt-0.5 text-[12px] text-[var(--color-provin-muted)]">
                              {[hit.year, hit.mileageKm != null ? `${Math.round(hit.mileageKm).toLocaleString("lv-LV")} km` : "", hit.fuel, IRISS_LISTING_PLATFORM_LABEL[hit.platform]]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[18px] font-semibold text-[var(--color-apple-text)]">{hit.price != null ? listingFmtEur(hit.price) : "nav cenas"}</p>
                            {fit ? <p className={`text-[12px] font-medium ${fit.ok ? "text-emerald-700" : "text-rose-700"}`}>{fit.label}</p> : null}
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {hit.change === "new" ? <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-900">Jauns</span> : null}
                          {hit.change === "price_changed" ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">Cena</span> : null}
                          {match.badges.map((badge) => (
                            <span key={badge.id} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.pass ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
                              {badge.pass ? "✓ " : ""}
                              {badge.label}
                            </span>
                          ))}
                          {match.percent != null ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">atbilst {match.percent}%</span>
                          ) : null}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={() => onPrepareOffer(hit)} className="inline-flex h-10 items-center rounded-full bg-[var(--color-provin-accent)] px-3 text-[13px] font-semibold text-white">
                            Sagatavot piedāvājumu
                          </button>
                          <button type="button" disabled={!canCall} onClick={() => onWhatsappText(irissOrderRoomHitShareText(hit))} className="inline-flex h-10 items-center rounded-full bg-slate-900 px-3 text-[13px] font-semibold text-white disabled:opacity-40">
                            Nosūtīt klientam
                          </button>
                          {hit.detailUrl ? (
                            <a href={hit.detailUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-3 text-[13px] font-semibold text-[var(--color-apple-text)]">
                              Atvērt portālā
                            </a>
                          ) : null}
                          <button type="button" aria-pressed={favIds.has(hit.id)} aria-label={favIds.has(hit.id) ? "Noņemt no saglabātajiem" : "Saglabāt"} onClick={() => toggleFav(hit.id)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white">
                            <Star className={`h-4 w-4 ${favIds.has(hit.id) ? "fill-amber-400 text-amber-500" : "text-slate-500"}`} aria-hidden />
                          </button>
                          {dismissed.has(hit.id) ? (
                            <button type="button" onClick={() => void setHitHidden(hit, false)} className="inline-flex h-10 items-center rounded-full border border-slate-200 px-3 text-[13px] font-semibold">
                              Atjaunot
                            </button>
                          ) : (
                            <button type="button" onClick={() => void setHitHidden(hit, true)} className="inline-flex h-10 items-center rounded-full border border-slate-200 px-3 text-[13px] font-semibold">
                              Neder
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "offers" ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[14px] text-[var(--color-provin-muted)]">Klienta portfelis · {rec.offers.length} piedāvājumi</p>
            <button type="button" onClick={onCreateOffer} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--color-provin-accent)] px-3 text-[13px] font-semibold text-white">
              <Plus className="h-4 w-4" aria-hidden />
              Jauns piedāvājums
            </button>
          </div>
          {rec.offers.length === 0 ? (
            <p className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-6 text-[14px] text-[var(--color-provin-muted)]">Šim klientam vēl nav piedāvājumu.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rec.offers.map((offer) => {
                const total = irissOrderRoomOfferTotal(offer);
                const thumb = irissOrderRoomOfferThumb(offer);
                const ready = irissOrderRoomOfferStatus(offer) === "ready";
                return (
                  <li key={offer.id} className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="h-36 w-full object-cover" />
                    ) : (
                      <div className="h-36 bg-slate-200" />
                    )}
                    <div className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[14px] font-semibold leading-snug">{offer.brandModel.trim() || offer.title}</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ready ? "bg-sky-50 text-sky-900" : "bg-slate-100 text-slate-700"}`}>
                          {ready ? "Sagatavots" : "Melnraksts"}
                        </span>
                      </div>
                      <p className="text-[18px] font-semibold">{total != null ? listingFmtEur(total) : "Cena nav"}</p>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => onEditOffer(offer)} className="inline-flex h-9 items-center rounded-full border border-slate-200 px-3 text-[13px] font-semibold">
                          Labot
                        </button>
                        <button type="button" onClick={() => onOpenOfferPdf(offer.id)} className="inline-flex h-9 items-center rounded-full border border-slate-200 px-3 text-[13px] font-semibold">
                          PDF
                        </button>
                        <button type="button" disabled={!canCall} onClick={() => onWhatsappText(offerShareText(offer))} className="inline-flex h-9 items-center rounded-full bg-[#25D366] px-3 text-[13px] font-semibold text-white disabled:opacity-40">
                          WA
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "communication" ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className={`${cardClass} space-y-3`}>
            <CardTitle>Saziņa</CardTitle>
            {history.length === 0 && !rec.notes.trim() ? (
              <p className="text-[13px] leading-snug text-[var(--color-provin-muted)]">
                Saglabātu ziņu arhīva vēl nav. Zvans, WhatsApp un e-pasts atveras ar pogām. Piezīmes paliek pasūtījumā.
              </p>
            ) : null}
            <ol className="space-y-2">
              {history.map((entry) => (
                <li key={`${entry.at}-${entry.to}`} className="max-w-[36rem] rounded-2xl bg-slate-100 px-3 py-2 text-[13px] leading-snug">
                  <span className="block text-[11px] text-[var(--color-provin-muted)]">
                    Statuss · {irissOrderRoomStamp(entry.at)}
                    {entry.by ? ` · ${entry.by}` : ""}
                  </span>
                  {irissOrderRoomStatusLabel(entry.from)} uz {irissOrderRoomStatusLabel(entry.to)}
                  {entry.reason ? ` (${entry.reason})` : ""}
                </li>
              ))}
            </ol>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Piezīmes</span>
              <textarea className={areaClass} aria-label="Piezīmes" value={rec.notes} onChange={(e) => onPatch("notes", e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Ziņa</span>
              <textarea className={areaClass} value={composer} aria-label="Ziņas teksts" onChange={(e) => setComposer(e.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={actionBtn}
                onClick={() => {
                  const next = appendIrissOrderRoomNote(rec.notes, composer, new Date().toISOString());
                  if (next === rec.notes) return;
                  onAppendNote(composer);
                  setComposer("");
                }}
              >
                Piezīme
              </button>
              <button type="button" className="inline-flex h-10 items-center rounded-full bg-[#25D366] px-3 text-[13px] font-semibold text-white disabled:opacity-40" disabled={!canCall} onClick={() => onWhatsappText(composer)}>
                Atvērt WhatsApp
              </button>
              <button type="button" className={actionBtn} disabled={!canEmail} onClick={() => openMail(composer)}>
                E-pasts
              </button>
            </div>
          </section>
          <aside className="space-y-3">
            <section className={cardClass}>
              <CardTitle>Ātrā saziņa</CardTitle>
              <p className="text-[14px] font-medium">{rec.phone.trim() || "Tālrunis nav"}</p>
              <div className="mt-2 flex flex-col gap-2">
                <button type="button" className="inline-flex h-10 items-center justify-center rounded-full bg-[#25D366] text-[13px] font-semibold text-white disabled:opacity-40" disabled={!canCall} onClick={() => onWhatsappText(composer)}>
                  WhatsApp
                </button>
                <button type="button" className={actionBtn} disabled={!canEmail} onClick={() => openMail(composer)}>
                  {rec.email.trim() || "E-pasts nav"}
                </button>
              </div>
            </section>
            <section className={cardClass}>
              <CardTitle>Šabloni</CardTitle>
              <ul className="space-y-1">
                {IRISS_ORDER_ROOM_TEMPLATES.map((template) => (
                  <li key={template.id}>
                    <button type="button" className="w-full rounded-lg px-2 py-2 text-left text-[13px] font-medium hover:bg-slate-50" onClick={() => setComposer(template.text)}>
                      {template.label}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      ) : null}

      {tab === "documents" ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onPdf} disabled={orderPdfBusy} className="inline-flex h-10 items-center rounded-full bg-[var(--color-provin-accent)] px-3 text-[13px] font-semibold text-white disabled:opacity-50">
              {orderPdfBusy ? "PDF…" : "Pasūtījuma PDF"}
            </button>
            <button
              type="button"
              className={actionBtn}
              onClick={() => {
                setTab("overview");
                window.setTimeout(() => document.getElementById("iriss-room-tame")?.scrollIntoView({ block: "start" }), 0);
              }}
            >
              Tāme
            </button>
            <button type="button" className={actionBtn} onClick={onCreateOffer}>
              Jauns piedāvājums
            </button>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <li className={cardClass}>
              <p className="text-[14px] font-semibold">Pasūtījuma PDF</p>
              <p className="mt-1 text-[12px] text-[var(--color-provin-muted)]">Esošais pasūtījuma izdruka</p>
              <button type="button" className={`${actionBtn} mt-3`} onClick={onPdf} disabled={orderPdfBusy}>
                Atvērt
              </button>
            </li>
            <li className={cardClass}>
              <p className="text-[14px] font-semibold">Izmaksu tāme</p>
              <p className="mt-1 text-[12px] text-[var(--color-provin-muted)]">Dzintarzeme Auto sadaļa pārskatā</p>
              <button
                type="button"
                className={`${actionBtn} mt-3`}
                onClick={() => {
                  setTab("overview");
                  window.setTimeout(() => document.getElementById("iriss-room-tame")?.scrollIntoView({ block: "start" }), 0);
                }}
              >
                Atvērt
              </button>
            </li>
            {rec.offers.map((offer, index) => (
              <li key={offer.id} className={cardClass}>
                <p className="text-[14px] font-semibold">{offer.title || `Piedāvājums ${index + 1}`}</p>
                <p className="mt-1 text-[12px] text-[var(--color-provin-muted)]">{offer.brandModel.trim() || "PDF no saglabātā piedāvājuma"}</p>
                <button type="button" className={`${actionBtn} mt-3`} onClick={() => onOpenOfferPdf(offer.id)}>
                  Atvērt
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-[40] flex gap-2 border-t border-[#e5e5ea] bg-[rgba(249,249,249,0.94)] px-4 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur md:hidden">
        <button type="button" disabled={orderPdfBusy} onClick={onPdf} className="flex h-[50px] flex-1 items-center justify-center rounded-xl bg-white text-[15px] font-semibold text-[var(--color-provin-accent)] shadow-[inset_0_0_0_1px_#d1d1d6]">
          {orderPdfBusy ? "PDF…" : "PDF"}
        </button>
        <button type="button" onClick={onCreateOffer} className="flex h-[50px] flex-1 items-center justify-center rounded-xl bg-[#e5e5ea] text-[15px] font-semibold text-[var(--color-apple-text)]">
          Piedāvājums
        </button>
        <button type="button" disabled={busy || orderPdfBusy} onClick={() => void onSave()} className="flex h-[50px] flex-1 items-center justify-center rounded-xl bg-[var(--color-provin-accent)] text-[15px] font-semibold text-white disabled:opacity-50">
          {busy || orderPdfBusy ? "Saglabā…" : "Saglabāt"}
        </button>
      </div>

      {criteriaOpen ? (
        <div className="fixed inset-0 z-[80] flex justify-end bg-black/40" role="presentation" onClick={() => setCriteriaOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="iriss-room-criteria-title"
            className="flex h-full w-full max-w-[440px] flex-col bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#e5e5ea] px-4 py-3">
              <div>
                <h2 id="iriss-room-criteria-title" className="text-[16px] font-semibold">
                  Klienta kritēriji
                </h2>
                <p className="text-[12px] text-[var(--color-provin-muted)]">Izmaiņas saglabājas pasūtījumā un sašaurina jau nolasītos auto.</p>
              </div>
              <button type="button" aria-label="Aizvērt" onClick={() => setCriteriaOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {(
                [
                  ["totalBudget", "Budžets līdz"],
                  ["productionYears", "Gadi"],
                  ["engineType", "Dzinējs"],
                  ["preferredColors", "Krāsa"],
                  ["transmission", "Ātrumkārba"],
                  ["driveType", "Piedziņa"],
                  ["bodyType", "Virsbūve"],
                  ["maxMileage", "Max km"],
                  ["interiorFinish", "Salons"],
                ] as const
              ).map(([key, label]) => (
                <Field
                  key={key}
                  label={label}
                  value={criteriaDraft[key]}
                  onChange={(value) => setCriteriaDraft((prev) => ({ ...prev, [key]: value }))}
                />
              ))}
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Obligātās prasības</span>
                <textarea className={areaClass} value={criteriaDraft.equipmentRequired} onChange={(e) => setCriteriaDraft((prev) => ({ ...prev, equipmentRequired: e.target.value }))} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Vēlamās prasības</span>
                <textarea className={areaClass} value={criteriaDraft.equipmentDesired} onChange={(e) => setCriteriaDraft((prev) => ({ ...prev, equipmentDesired: e.target.value }))} />
              </label>
              <div>
                <p className="mb-1 text-[11px] font-medium text-[var(--color-provin-muted)]">Izslēgt</p>
                <div className="flex flex-wrap gap-1.5">
                  {irissOrderRoomExcludeTokens(criteriaDraft.nonPreferredColors).map((token) => (
                    <button
                      key={token}
                      type="button"
                      className="rounded-full bg-rose-50 px-2 py-1 text-[12px] font-medium text-rose-800"
                      onClick={() =>
                        setCriteriaDraft((prev) => ({
                          ...prev,
                          nonPreferredColors: irissOrderRoomExcludeTokens(prev.nonPreferredColors)
                            .filter((item) => item !== token)
                            .join(", "),
                        }))
                      }
                    >
                      {token} ×
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input className={fieldClass} value={excludeDraft} aria-label="Pievienot izņēmumu" onChange={(e) => setExcludeDraft(e.target.value)} />
                  <button
                    type="button"
                    className={actionBtn}
                    onClick={() => {
                      const token = excludeDraft.trim();
                      if (!token) return;
                      const next = [...irissOrderRoomExcludeTokens(criteriaDraft.nonPreferredColors), token];
                      setCriteriaDraft((prev) => ({ ...prev, nonPreferredColors: next.join(", ") }));
                      setExcludeDraft("");
                    }}
                  >
                    Pievienot
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#e5e5ea] px-4 py-3">
              <button type="button" className={actionBtn} onClick={() => setCriteriaOpen(false)}>
                Atcelt
              </button>
              <button type="button" disabled={criteriaBusy} onClick={() => void saveCriteria()} className="inline-flex h-10 items-center rounded-full bg-[var(--color-provin-accent)] px-3 text-[13px] font-semibold text-white disabled:opacity-50">
                {criteriaBusy ? "Saglabā…" : "Saglabāt un filtrēt"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HitPhoto({ src, alt, count }: { src: string; alt: string; count: number }) {
  const [hidden, setHidden] = useState(false);
  return (
    <div className="relative h-36 w-full shrink-0 overflow-hidden rounded-xl bg-slate-200 sm:h-28 sm:w-40">
      {src && !hidden ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={() => setHidden(true)} />
      ) : null}
      {count > 1 ? <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">1/{count}</span> : null}
    </div>
  );
}
