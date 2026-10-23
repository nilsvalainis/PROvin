"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IrissAuctionLogo } from "@/components/admin/iriss-logistika/IrissAuctionLogo";
import { IrissCreateOfferButton } from "@/components/admin/IrissCreateOfferButton";
import {
  CABINET_DOC_TYPE_LABEL,
  CABINET_LOCAL_PREFS_KEY,
  CABINET_PICKUP_STAGE_LV,
  CABINET_SECTIONS,
  CABINET_SECTION_LABEL,
  cabinetDocumentSourceChip,
  cabinetPhaseForStage,
  cabinetSectionSummary,
  defaultPickupStageFromOrderStatus,
  readCabinetPrefsFromStorage,
  resolveCabinetSectionOpen,
  type CabinetDocType,
  type CabinetDocument,
  type CabinetPickup,
  type CabinetPickupStage,
  type CabinetSectionId,
} from "@/lib/iriss-logistics-cabinet";
import type { CabinetAccessView } from "@/lib/iriss-logistics-cabinet-access";
import { isLogisticsOrderArchived } from "@/lib/iriss-logistics-archive";
import { logisticsGoogleMapsDirUrl } from "@/lib/iriss-logistics-maps-dir";
import { logisticsParkingDeadlineTimer } from "@/lib/iriss-logistics-parking-timer";
import {
  formatLogisticsAddress,
  formatLogisticsDate,
  formatLogisticsEur,
  isLogisticsOrderStatus,
  isLogisticsPipelineStatus,
  LOGISTICS_ORDER_STATUS_LV,
  LOGISTICS_PIPELINE_STATUSES,
  type LogisticsOrder,
  type LogisticsPoint,
} from "@/lib/iriss-logistics-types";

type GroupedPoints = { auction: string; rows: LogisticsPoint[] }[];

/** localStorage var būt bloķēts (privātais režīms, iframe). Tad prefs paliek tikai serverī. */
function readStoredCabinetPrefs(): Record<string, string> {
  try {
    return readCabinetPrefsFromStorage(window.localStorage.getItem(CABINET_LOCAL_PREFS_KEY));
  } catch {
    return {};
  }
}

function writeStoredCabinetPrefs(prefs: Record<string, string>) {
  try {
    window.localStorage.setItem(CABINET_LOCAL_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignorē: serveris joprojām glabā iestatījumus.
  }
}

type Props = {
  order: LogisticsOrder;
  groupedPoints: GroupedPoints;
  onAssignPoint: (orderId: string, pickupPointId: string) => void;
  onPatchOrder: (id: string, action: "wake" | "picked_up" | "delivered") => void;
  onOrderUpdated: (order: LogisticsOrder) => void;
  /** Ar Pasūtījumu tiesību - "Izveidot piedāvājumu" (forma ar auto datiem un /STOCK bildēm). */
  canCreateOffer?: boolean;
};

const A_UPLOAD_TYPES: CabinetDocType[] = ["purchase_confirm", "car_invoice", "auction_invoice", "service_invoice"];
const C_UPLOAD_TYPES: CabinetDocType[] = ["service_invoice", "csdd_status", "note"];

export function IrissLogistikaCabinet({ order, groupedPoints, onAssignPoint, onPatchOrder, onOrderUpdated, canCreateOffer = false }: Props) {
  // Nelasām localStorage renderēšanas laikā: serveris renderē bez tā, tāpēc hidratācija nesakrīt.
  const [prefs, setPrefs] = useState<Record<string, string>>({});
  const [documents, setDocuments] = useState<CabinetDocument[]>([]);
  const [pickup, setPickup] = useState<CabinetPickup | null>(null);
  const [uploading, setUploading] = useState<CabinetSectionId | null>(null);
  const [pickupCode, setPickupCode] = useState(order.pickupRef);
  const [note, setNote] = useState(order.notes);
  const [parkingUntil, setParkingUntil] = useState(order.freeParkingUntil);
  const [access, setAccess] = useState<CabinetAccessView>({
    write: false,
    hideSums: true,
    admin: false,
    sections: [],
  });
  const [accessReady, setAccessReady] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setPickupCode(order.pickupRef);
    setNote(order.notes);
    setParkingUntil(order.freeParkingUntil);
  }, [order.id, order.pickupRef, order.notes, order.freeParkingUntil]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const stage: CabinetPickupStage = pickup?.stage ?? defaultPickupStageFromOrderStatus(order.status);
  const arrived = stage === "arrived";

  const open = useMemo(
    () => ({
      A: resolveCabinetSectionOpen(prefs, "A", stage),
      B: resolveCabinetSectionOpen(prefs, "B", stage),
      C: resolveCabinetSectionOpen(prefs, "C", stage),
    }),
    [prefs, stage],
  );

  useEffect(() => {
    setPrefs(readStoredCabinetPrefs());
    let cancelled = false;
    void fetch("/api/admin/iriss-logistics/cabinet-prefs", { credentials: "include" })
      .then((res) => res.json() as Promise<{ prefs?: Record<string, string> }>)
      .then((body) => {
        if (cancelled || !body.prefs) return;
        setPrefs((prev) => {
          const next = { ...prev, ...body.prefs };
          writeStoredCabinetPrefs(next);
          return next;
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/admin/iriss-logistics/orders/${encodeURIComponent(order.id)}/cabinet`, { credentials: "include" })
      .then((res) => res.json() as Promise<{ documents?: CabinetDocument[]; pickup?: CabinetPickup; access?: CabinetAccessView }>)
      .then((body) => {
        if (cancelled) return;
        setDocuments(body.documents ?? []);
        setPickup(body.pickup ?? null);
        if (body.access) setAccess(body.access);
        setAccessReady(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [order.id]);

  const toggleSection = useCallback(
    (section: CabinetSectionId) => {
      const phase = cabinetPhaseForStage(stage);
      const nextOpen = !open[section];
      const key = `cabinet.section.${section}.${phase}`;
      const value = nextOpen ? "open" : "closed";
      setPrefs((prev) => {
        const next = { ...prev, [key]: value };
        writeStoredCabinetPrefs(next);
        return next;
      });
      void fetch("/api/admin/iriss-logistics/cabinet-prefs", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, phase, value }),
      });
    },
    [open, stage],
  );

  async function saveOrderFields(patch: Partial<LogisticsOrder>) {
    const res = await fetch(`/api/admin/iriss-logistics/orders/${encodeURIComponent(order.id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body = (await res.json()) as { order?: LogisticsOrder };
    if (body.order) onOrderUpdated(body.order);
    return body.order;
  }

  async function savePickupCode(nextCode: string) {
    const saved = await saveOrderFields({ pickupRef: nextCode });
    const res = await fetch(`/api/admin/iriss-logistics/orders/${encodeURIComponent(order.id)}/pickup`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pickupCode: nextCode, pickupDate: order.pickupDate }),
    });
    const body = (await res.json()) as { pickup?: CabinetPickup };
    if (body.pickup) setPickup(body.pickup);
    return saved;
  }

  async function setStage(next: CabinetPickupStage) {
    const res = await fetch(`/api/admin/iriss-logistics/orders/${encodeURIComponent(order.id)}/pickup`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: next, pickupCode: pickupCode || order.pickupRef, pickupDate: order.pickupDate }),
    });
    const body = (await res.json()) as { pickup?: CabinetPickup };
    if (body.pickup) setPickup(body.pickup);
  }

  async function uploadFile(section: CabinetSectionId, type: CabinetDocType, file: File, extra?: { sourceUrl?: string; docNumber?: string }) {
    setUploading(section);
    try {
      const form = new FormData();
      form.set("section", section);
      form.set("type", type);
      form.set("file", file);
      if (extra?.sourceUrl) form.set("sourceUrl", extra.sourceUrl);
      if (extra?.docNumber) form.set("docNumber", extra.docNumber);
      const res = await fetch(`/api/admin/iriss-logistics/orders/${encodeURIComponent(order.id)}/documents`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const body = (await res.json()) as { document?: CabinetDocument; duplicate?: boolean };
      if (body.document && !body.duplicate) setDocuments((prev) => [...prev, body.document!]);
    } finally {
      setUploading(null);
    }
  }

  const dirUrl = order.pickupLat != null && order.pickupLng != null ? logisticsGoogleMapsDirUrl([{ lat: order.pickupLat, lng: order.pickupLng }]) : "";
  const docsA = documents.filter((d) => d.section === "A");
  const docsB = documents.filter((d) => d.section === "B");
  const docsC = documents.filter((d) => d.section === "C");
  const pickupPdf = docsB.find((d) => d.type === "pickup_pdf");
  const pickupCmr = docsB.find((d) => d.type === "cmr");

  return (
    <aside className="iriss-log-no-print rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink3)]">Auto kabinets</p>
      <div className="mt-1 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[18px] font-semibold leading-tight">{order.title || `${order.make} ${order.model}`}</h2>
          <p className="flex flex-wrap items-center gap-1.5 font-mono text-[12px] text-[var(--ink2)]">
            <span>{order.vin}</span>
            {order.stockNo ? <span>lot {order.stockNo}</span> : null}
            {order.auction ? <IrissAuctionLogo name={order.auction} /> : null}
          </p>
        </div>
        {order.auctionUrl || order.listingUrl ? (
          <a
            href={order.auctionUrl || order.listingUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center rounded-full border border-[#e5e7eb] px-3 text-[12px] font-semibold"
          >
            {order.source === "private" ? "Sludinājums" : "Atvērt izsolē"}
          </a>
        ) : null}
      </div>
      <p className="mt-3 rounded-xl bg-[#f8fafc] px-3 py-2 text-[13px]">
        {order.createdAt ? `Nopirkts ${formatLogisticsDate(order.createdAt.slice(0, 10))}` : LOGISTICS_ORDER_STATUS_LV[order.status]}
        {!access.hideSums && order.priceEur != null ? ` · apmaksāts ${formatLogisticsEur(order.priceEur)}` : ""}
        {order.pickupDate ? ` · pickup ${formatLogisticsDate(order.pickupDate)}` : ""}
      </p>

      {canCreateOffer ? (
        <div className="mt-3">
          <IrissCreateOfferButton from="logistics" id={order.id} />
        </div>
      ) : null}

      {access.admin ? (
        <p className="mt-2 text-[12px]">
          <Link href="/admin/iriss/iestatijumi/lietotaji" className="font-semibold text-[var(--acc)]">
            Grāmatveža piekļuve
          </Link>
        </p>
      ) : null}

      <div className="mt-3 grid gap-2">
        <label className="block text-[12px] text-[var(--ink2)]">
          Statuss
          <select
            value={order.status}
            disabled={!access.write || isLogisticsOrderArchived(order)}
            onChange={(e) => {
              const next = e.target.value;
              if (isLogisticsOrderStatus(next)) void saveOrderFields({ status: next });
            }}
            className="mt-1 h-10 w-full rounded-xl border border-[#e5e7eb] px-2 text-[13px]"
          >
            {!isLogisticsPipelineStatus(order.status) ? (
              <option value={order.status}>{LOGISTICS_ORDER_STATUS_LV[order.status]}</option>
            ) : null}
            {LOGISTICS_PIPELINE_STATUSES.map((key) => (
              <option key={key} value={key}>
                {LOGISTICS_ORDER_STATUS_LV[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[12px] text-[var(--ink2)]">
          Pickup kods
          <input
            value={pickupCode}
            disabled={!access.write}
            onChange={(e) => setPickupCode(e.target.value)}
            onBlur={() => {
              if (!access.write || pickupCode.trim() === (order.pickupRef || "").trim()) return;
              void savePickupCode(pickupCode.trim());
            }}
            className="mt-1 h-10 w-full rounded-xl border border-[#e5e7eb] px-2 font-mono text-[13px]"
          />
        </label>
        <label className="block text-[12px] text-[var(--ink2)]">
          Bezmaksas stāvvieta līdz
          <input
            type="date"
            disabled={!access.write}
            value={parkingUntil.slice(0, 10)}
            onChange={(e) => {
              const next = e.target.value;
              setParkingUntil(next);
              if (!access.write || next === (order.freeParkingUntil || "").slice(0, 10)) return;
              void saveOrderFields({ freeParkingUntil: next });
            }}
            className="mt-1 h-10 w-full rounded-xl border border-[#e5e7eb] px-2 text-[13px]"
          />
          {(() => {
            const timer = logisticsParkingDeadlineTimer(parkingUntil, new Date(nowMs));
            if (!timer.label) return null;
            return (
              <span className={`mt-1 block text-[12px] font-semibold ${timer.overdue ? "text-red-700" : "text-emerald-700"}`}>
                {timer.label}
              </span>
            );
          })()}
        </label>
        <label className="block text-[12px] text-[var(--ink2)]">
          Piezīme
          <textarea
            value={note}
            disabled={!access.write}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if (!access.write || note.trim() === (order.notes || "").trim()) return;
              void saveOrderFields({ notes: note });
            }}
            rows={3}
            className="mt-1 w-full rounded-xl border border-[#e5e7eb] px-2 py-2 text-[13px]"
          />
        </label>
      </div>

      {accessReady
        ? CABINET_SECTIONS.filter((section) => access.sections.includes(section)).map((section) => (
        <section key={section} className="iriss-log-cab-sec mt-3">
          <button type="button" className="iriss-log-cab-head" onClick={() => toggleSection(section)} aria-expanded={open[section]}>
            <span className="iriss-log-cab-letter">{section}</span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-[13.5px] font-semibold">{CABINET_SECTION_LABEL[section]}</span>
              <span className="block text-[12px] text-[var(--ink3)]">
                {section === "A"
                  ? cabinetSectionSummary("A", docsA)
                  : section === "B"
                    ? `${order.auction || "Pickup"}${order.pickupDate ? ` · pickup ${formatLogisticsDate(order.pickupDate)}` : ""}`
                    : arrived
                      ? `atblokēta ${pickup?.arrivedAt ? formatLogisticsDate(pickup.arrivedAt) : ""}`
                      : "atbloķēsies, kad statuss būs Atvests"}
              </span>
            </span>
            {section === "B" ? (
              <span className={`iriss-log-cab-chip ${arrived ? "done" : "on"}`}>
                {arrived ? "pabeigts" : CABINET_PICKUP_STAGE_LV[stage]}
              </span>
            ) : null}
            {section === "C" && arrived ? <span className="iriss-log-cab-chip done">Atvests</span> : null}
            {section === "C" && !arrived ? <span className="text-[11px] text-[var(--ink3)]">slēgts</span> : null}
            <span className="text-[var(--ink3)]">{open[section] ? "⌃" : "⌄"}</span>
          </button>

          {open[section] && section === "A" ? (
            <div className="px-1 pb-2 pt-1">
              <ul className="space-y-1.5">
                {docsA.map((d) => (
                  <DocRow key={d.id} doc={d} />
                ))}
                {docsA.length === 0 ? <li className="px-2 py-2 text-[12.5px] text-[var(--ink2)]">Nav augšupielādētu dokumentu.</li> : null}
              </ul>
              {access.write ? (
                <UploadRow
                  types={A_UPLOAD_TYPES}
                  busy={uploading === "A"}
                  onUpload={(type, file) => void uploadFile("A", type, file)}
                />
              ) : null}
            </div>
          ) : null}

          {open[section] && section === "B" ? (
            <div className="px-1 pb-2 pt-1">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink3)]">Statuss</p>
              <div className="grid grid-cols-3 gap-1 rounded-full bg-[#f3f4f6] p-1">
                {(["waiting", "planned", "in_transit"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    disabled={!access.write || arrived}
                    onClick={() => void setStage(key)}
                    className={`h-8 rounded-full text-[12px] font-semibold ${stage === key && !arrived ? "bg-white shadow-sm" : "text-[var(--ink3)]"}`}
                  >
                    {CABINET_PICKUP_STAGE_LV[key]}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[12px] text-[var(--ink2)]">Atvests atbloķē sadaļu C un pārvieto auto uz Autoparku.</p>
              {!arrived && access.write ? (
                <button type="button" onClick={() => void setStage("arrived")} className="mt-2 h-8 rounded-full border border-[#e5e7eb] px-3 text-[12px] font-semibold">
                  Atzīmēt kā Atvests
                </button>
              ) : null}

              <div className="mt-3 rounded-xl border border-[#eef1f4] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-semibold">Pickup dokuments</p>
                    <p className="text-[12px] text-[var(--ink2)]">
                      {pickupPdf ? pickupPdf.title : "Auto1 ekrānuzņēmums (PDF)"}
                      {pickupPdf?.createdAt ? ` · ${formatLogisticsDate(pickupPdf.createdAt.slice(0, 10))}` : ""}
                    </p>
                  </div>
                  {pickupPdf ? (
                    <a href={`/api/admin/iriss-logistics/documents/${encodeURIComponent(pickupPdf.id)}`} target="_blank" rel="noreferrer" className="rounded-full border border-[#e5e7eb] px-2.5 py-1 text-[12px] font-semibold">
                      Atvērt
                    </a>
                  ) : access.write ? (
                    <label className="rounded-full border border-[#e5e7eb] px-2.5 py-1 text-[12px] font-semibold">
                      Augšupielādēt
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadFile("B", "pickup_pdf", file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  ) : (
                    <span className="rounded-full border border-[#e5e7eb] px-2.5 py-1 text-[12px] text-[var(--ink3)]">tikai lasīšana</span>
                  )}
                </div>
                {pickupPdf ? <p className="mt-1 text-[11px] font-semibold text-emerald-700">kods redzams</p> : <p className="mt-1 text-[11px] text-[var(--ink3)]">nav pickup dokumenta</p>}
              </div>

              <div className="mt-2 rounded-xl border border-dashed border-[#d2d2d7] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-semibold">CMR</p>
                    <p className="text-[12px] text-[var(--ink2)]">
                      {pickupCmr ? pickupCmr.title : "Nav pievienots - vajadzīgs tikai, ja parasti to izsniedz"}
                    </p>
                  </div>
                  {pickupCmr ? (
                    <a href={`/api/admin/iriss-logistics/documents/${encodeURIComponent(pickupCmr.id)}`} target="_blank" rel="noreferrer" className="iriss-log-btn-sec h-8 px-2.5 text-[12px]">
                      Atvērt
                    </a>
                  ) : access.write ? (
                    <label className="iriss-log-btn-sec h-8 px-2.5 text-[12px]">
                      Augšupielādēt PDF
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadFile("B", "cmr", file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  ) : null}
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-[7.5rem_1fr] gap-y-1 text-[13px]">
                <dt className="text-[var(--ink2)]">Pickup kods</dt>
                <dd className="font-semibold">{pickup?.pickupCode || order.pickupRef || "-"}</dd>
                <dt className="text-[var(--ink2)]">Pickup datums</dt>
                <dd>{order.pickupDate ? formatLogisticsDate(order.pickupDate) : "-"}</dd>
                <dt className="text-[var(--ink2)]">Vieta</dt>
                <dd>{order.pickupAddress || formatLogisticsAddress(order.pickupSnapshot ?? {}) || "-"}</dd>
                <dt className="text-[var(--ink2)]">Darba laiks</dt>
                <dd>{order.pickupSnapshot?.hoursText || "-"}</dd>
              </dl>
              <label className="mt-2 block text-[12px] text-[var(--ink2)]">
                Punkts
                <select
                  value={order.pickupPointId}
                  disabled={!access.write}
                  onChange={(e) => onAssignPoint(order.id, e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-[#e5e7eb] px-2 text-[13px]"
                >
                  <option value="">Nav izvēlēts</option>
                  {groupedPoints.map((g) => (
                    <optgroup key={g.auction} label={g.auction}>
                      {g.rows.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {pickupPdf ? (
                  <a href={`/api/admin/iriss-logistics/documents/${encodeURIComponent(pickupPdf.id)}`} target="_blank" rel="noreferrer" className="iriss-log-cab-btn">
                    Atvērt pickup dokumentu
                  </a>
                ) : (
                  <span className="iriss-log-cab-btn opacity-50">Atvērt pickup dokumentu</span>
                )}
                {dirUrl ? (
                  <a href={dirUrl} target="_blank" rel="noreferrer" className="iriss-log-cab-btn">
                    Pievienot maršrutam
                  </a>
                ) : (
                  <span className="iriss-log-cab-btn opacity-50">Pievienot maršrutam</span>
                )}
                {order.auctionUrl || order.listingUrl ? (
                  <a href={order.auctionUrl || order.listingUrl} target="_blank" rel="noreferrer" className="iriss-log-cab-btn">
                    Atvērt izsolē
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}

          {open[section] && section === "C" ? (
            <div className={`px-1 pb-2 pt-1 ${arrived ? "" : "opacity-55"}`}>
              {!arrived ? <p className="px-2 py-2 text-[12.5px] text-[var(--ink2)]">Atbloķēsies, kad statuss būs Atvests.</p> : null}
              <ul className="space-y-1.5">
                {docsC.map((d) => (
                  <DocRow key={d.id} doc={d} />
                ))}
              </ul>
              {arrived && access.write ? (
                <UploadRow
                  types={C_UPLOAD_TYPES.filter((t) => t !== "service_invoice" || !access.hideSums)}
                  busy={uploading === "C"}
                  onUpload={(type, file) => void uploadFile("C", type, file)}
                />
              ) : null}
            </div>
          ) : null}
        </section>
      ))
        : null}

      {access.write ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {isLogisticsOrderArchived(order) ? (
            <button type="button" onClick={() => onPatchOrder(order.id, "wake")} className="h-9 rounded-full bg-[var(--ink)] px-3 text-[12.5px] font-semibold text-white">
              Pamodināt
            </button>
          ) : (
            <>
              <button type="button" onClick={() => onPatchOrder(order.id, "picked_up")} className="h-9 rounded-full border border-[#e5e7eb] px-3 text-[12.5px] font-semibold">
                Izņemts
              </button>
              <button type="button" onClick={() => onPatchOrder(order.id, "delivered")} className="h-9 rounded-full bg-[var(--ink)] px-3 text-[12.5px] font-semibold text-white">
                Piegādāts
              </button>
            </>
          )}
        </div>
      ) : null}
    </aside>
  );
}

function DocRow({ doc }: { doc: CabinetDocument }) {
  const chip = cabinetDocumentSourceChip(doc.source);
  return (
    <li className="flex items-center justify-between gap-2 rounded-xl bg-[#f8fafc] px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold">{doc.title}</p>
        <p className="truncate text-[11px] text-[var(--ink2)]">
          {chip ? <span className="iriss-log-status-chip mr-1">{chip}</span> : null}
          {doc.source === "upload" ? "Pievienots manuāli" : doc.source}
          {doc.createdAt ? ` · ${formatLogisticsDate(doc.createdAt.slice(0, 10))}` : ""}
        </p>
      </div>
      {doc.blobPath ? (
        <a href={`/api/admin/iriss-logistics/documents/${encodeURIComponent(doc.id)}`} target="_blank" rel="noreferrer" className="shrink-0 rounded-full border border-[#e5e7eb] px-2.5 py-1 text-[12px] font-semibold">
          Atvērt
        </a>
      ) : null}
    </li>
  );
}

function UploadRow({
  types,
  busy,
  onUpload,
}: {
  types: CabinetDocType[];
  busy: boolean;
  onUpload: (type: CabinetDocType, file: File) => void;
}) {
  const [type, setType] = useState<CabinetDocType>(types[0] ?? "other");
  return (
    <div
      className="iriss-log-doc-drop mt-2"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) onUpload(type, file);
      }}
    >
      <p>Ievilc failu vai izvēlies. PDF, JPG, PNG līdz 20 MB.</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <select value={type} onChange={(e) => setType(e.target.value as CabinetDocType)} className="h-8 rounded-[10px] border border-[#e5e7eb] px-2 text-[12px]">
          {types.map((t) => (
            <option key={t} value={t}>
              {CABINET_DOC_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <label className="h-8 cursor-pointer rounded-[10px] bg-[var(--btn-dark-bg,#111)] px-3 text-[12px] font-semibold leading-8 text-white">
          {busy ? "Augšupielādē..." : "Augšupielādēt"}
          <input
            type="file"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(type, file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}
