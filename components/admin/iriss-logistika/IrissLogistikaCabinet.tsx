"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IrissAuctionLogo } from "@/components/admin/iriss-logistika/IrissAuctionLogo";
import { IrissCreateOfferButton } from "@/components/admin/IrissCreateOfferButton";
import {
  CABINET_DOC_GROUP_LABEL,
  CABINET_DOC_TYPE_LABEL,
  CABINET_LOCAL_PREFS_KEY,
  CABINET_PICKUP_STAGE_LV,
  cabinetDocumentSourceChip,
  cabinetDocumentsSummary,
  cabinetPhaseForStage,
  defaultPickupStageFromOrderStatus,
  readCabinetPrefsFromStorage,
  resolveCabinetSectionOpen,
  serviceInvoiceUploadSection,
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
import { parsePriceLike } from "@/lib/iriss-price-format";
import {
  formatLogisticsAddress,
  formatLogisticsDate,
  formatLogisticsEur,
  isLogisticsOrderStatus,
  isLogisticsPipelineStatus,
  LOGISTICS_ORDER_STATUS_LV,
  LOGISTICS_PIPELINE_STATUSES,
  type LogisticsGeocodeStatus,
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

const A_SLOT_TYPES: CabinetDocType[] = ["purchase_confirm", "car_invoice"];
const B_SLOT_TYPES: CabinetDocType[] = ["pickup_pdf", "cmr", "transport_request_confirm", "transport_invoice"];
const C_SLOT_TYPES: CabinetDocType[] = ["service_invoice", "csdd_status"];

const A_UPLOAD_TYPES: CabinetDocType[] = ["purchase_confirm", "car_invoice", "auction_invoice", "service_invoice"];
const B_UPLOAD_TYPES: CabinetDocType[] = ["pickup_pdf", "cmr", "transport_request_confirm", "transport_invoice"];
const C_UPLOAD_TYPES: CabinetDocType[] = ["service_invoice", "csdd_status", "note"];

/** Servisa rēķins drīkst iet uz A (brīvi) vai C (pēc atvešanas, redzams loģistikai) - pārējiem tipiem sadaļa ir fiksēta. */
function sectionForDocType(type: CabinetDocType, arrived: boolean): CabinetSectionId {
  if (type === "service_invoice") return serviceInvoiceUploadSection(arrived);
  if (B_UPLOAD_TYPES.includes(type)) return "B";
  if (type === "csdd_status" || type === "note") return "C";
  return "A";
}

function formatTransportCostInput(n: number | null): string {
  return n == null ? "" : formatLogisticsEur(n);
}

/** Čips pie "Atrašanās vieta" - tikai tad, kad adrese ir ievadīta. "pending"/"failed" bez adreses paliek tukši (vēl nekas nav ierakstīts). */
function locationChip(status: LogisticsGeocodeStatus): { label: string; tone: "ok" | "warn" } | null {
  switch (status) {
    case "ok":
      return { label: "Precizēts", tone: "ok" };
    case "manuali":
      return { label: "Manuāli · gaida precizējumu", tone: "warn" };
    case "neprecizs":
      return { label: "Aptuvens · pilsētas līmenis", tone: "warn" };
    default:
      return null;
  }
}

export function IrissLogistikaCabinet({ order, groupedPoints, onAssignPoint, onPatchOrder, onOrderUpdated, canCreateOffer = false }: Props) {
  // Nelasām localStorage renderēšanas laikā: serveris renderē bez tā, tāpēc hidratācija nesakrīt.
  const [prefs, setPrefs] = useState<Record<string, string>>({});
  const [documents, setDocuments] = useState<CabinetDocument[]>([]);
  const [pickup, setPickup] = useState<CabinetPickup | null>(null);
  const [uploading, setUploading] = useState<CabinetSectionId | null>(null);
  const [pickupCode, setPickupCode] = useState(order.pickupRef);
  const [note, setNote] = useState(order.notes);
  const [parkingUntil, setParkingUntil] = useState(order.freeParkingUntil);
  const [pickupDate, setPickupDate] = useState(order.pickupDate);
  const [transportCost, setTransportCost] = useState(formatTransportCostInput(order.transportCostEur));
  const [pickupAddress, setPickupAddress] = useState(order.pickupAddress || formatLogisticsAddress(order.pickupSnapshot ?? {}));
  const [geoNotice, setGeoNotice] = useState("");
  const [geocodeBusy, setGeocodeBusy] = useState(false);
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
    setPickupDate(order.pickupDate);
    setTransportCost(formatTransportCostInput(order.transportCostEur));
    setPickupAddress(order.pickupAddress || formatLogisticsAddress(order.pickupSnapshot ?? {}));
  }, [
    order.id,
    order.pickupRef,
    order.notes,
    order.freeParkingUntil,
    order.pickupDate,
    order.transportCostEur,
    order.pickupAddress,
    order.pickupSnapshot,
  ]);

  // Atsevišķi no citu lauku sinhronizācijas: citādi saglabāšana (kas pati maina order.pickupAddress) uzreiz nodzēstu tikko uzrādīto ģeokodēšanas kļūdu.
  useEffect(() => {
    setGeoNotice("");
  }, [order.id]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const stage: CabinetPickupStage = pickup?.stage ?? defaultPickupStageFromOrderStatus(order.status);
  const arrived = stage === "arrived";

  // Vienotā "Dokumenti" sadaļa paliek uz veco "B" preferences atslēgu (atvērta/ceļā, aizvērta pēc atvešanas pēc noklusējuma).
  const docsOpen = useMemo(() => resolveCabinetSectionOpen(prefs, "B", stage), [prefs, stage]);

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

  const toggleDocs = useCallback(() => {
    const phase = cabinetPhaseForStage(stage);
    const nextOpen = !docsOpen;
    const key = `cabinet.section.B.${phase}`;
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
      body: JSON.stringify({ section: "B", phase, value }),
    });
  }, [docsOpen, stage]);

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

  /** Pickup datumu drīkst mainīt tikai ar roku kabinetā - nekas to vairs automātiski neaizpilda. */
  async function savePickupDate(next: string) {
    setPickupDate(next);
    await saveOrderFields({ pickupDate: next });
  }

  /** Adrese ar roku kabinetā - vienmēr "manuali" (precīzu "ok" status uzliek tikai turpmākā vakara precizēšana, ārpus šī uzdevuma). */
  async function saveLocation(nextAddress: string) {
    const trimmed = nextAddress.trim();
    const current = (order.pickupAddress || formatLogisticsAddress(order.pickupSnapshot ?? {})).trim();
    if (trimmed === current) return;
    setGeoNotice("");
    if (!trimmed) {
      await saveOrderFields({ pickupAddress: "", pickupLat: null, pickupLng: null, geocodeStatus: "pending" });
      return;
    }
    setGeocodeBusy(true);
    try {
      const res = await fetch("/api/admin/iriss-logistics/geocode", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: trimmed }),
      });
      const body = (await res.json()) as { ok?: boolean; lat?: number; lng?: number; notice?: string };
      if (!body.ok) {
        setGeoNotice(body.notice || "Adresi neizdevās ģeokodēt - saglabāts tikai teksts.");
        await saveOrderFields({ pickupAddress: trimmed, pickupLat: null, pickupLng: null, geocodeStatus: "manuali" });
        return;
      }
      await saveOrderFields({
        pickupAddress: trimmed,
        pickupLat: body.lat ?? null,
        pickupLng: body.lng ?? null,
        geocodeStatus: "manuali",
      });
    } catch {
      setGeoNotice("Ģeokodēšana neizdevās - saglabāts tikai teksts.");
      await saveOrderFields({ pickupAddress: trimmed, pickupLat: null, pickupLng: null, geocodeStatus: "manuali" });
    } finally {
      setGeocodeBusy(false);
    }
  }

  async function savePickupCode(nextCode: string) {
    const saved = await saveOrderFields({ pickupRef: nextCode });
    const res = await fetch(`/api/admin/iriss-logistics/orders/${encodeURIComponent(order.id)}/pickup`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pickupCode: nextCode, pickupDate }),
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
      body: JSON.stringify({ stage: next, pickupCode: pickupCode || order.pickupRef, pickupDate }),
    });
    const body = (await res.json()) as { pickup?: CabinetPickup };
    if (body.pickup) setPickup(body.pickup);
  }

  async function uploadFile(section: CabinetSectionId, type: CabinetDocType, file: File) {
    setUploading(section);
    try {
      const form = new FormData();
      form.set("section", section);
      form.set("type", type);
      form.set("file", file);
      const res = await fetch(`/api/admin/iriss-logistics/orders/${encodeURIComponent(order.id)}/documents`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const body = (await res.json()) as { document?: CabinetDocument; duplicate?: boolean; order?: LogisticsOrder };
      if (body.document && !body.duplicate) setDocuments((prev) => [...prev, body.document!]);
      if (body.order) onOrderUpdated(body.order);
    } finally {
      setUploading(null);
    }
  }

  const dirUrl = order.pickupLat != null && order.pickupLng != null ? logisticsGoogleMapsDirUrl([{ lat: order.pickupLat, lng: order.pickupLng }]) : "";
  const docsA = documents.filter((d) => d.section === "A" && !d.deletedAt);
  const docsB = documents.filter((d) => d.section === "B" && !d.deletedAt);
  const docsC = documents.filter((d) => d.section === "C" && !d.deletedAt);
  const pickupPdf = docsB.find((d) => d.type === "pickup_pdf");

  const uploadTypes: CabinetDocType[] = [];
  {
    const add = (t: CabinetDocType) => {
      if (!uploadTypes.includes(t)) uploadTypes.push(t);
    };
    if (access.sections.includes("A")) A_UPLOAD_TYPES.forEach(add);
    if (access.sections.includes("B")) B_UPLOAD_TYPES.forEach(add);
    if (access.sections.includes("C") && arrived) {
      C_UPLOAD_TYPES.filter((t) => t !== "service_invoice" || !access.hideSums).forEach(add);
    }
  }

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

      {/* Kompakta forma: pamatlauki 2 kolonnās, nevis 4 pilnas rindas. */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="block text-[11px] text-[var(--ink2)]">
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
        <label className="block text-[11px] text-[var(--ink2)]">
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
        <label className="block text-[11px] text-[var(--ink2)]">
          Pickup datums
          <span className="mt-1 flex items-center gap-1.5">
            <input
              type="date"
              disabled={!access.write}
              value={pickupDate.slice(0, 10)}
              onChange={(e) => {
                const next = e.target.value;
                if (next === (order.pickupDate || "").slice(0, 10)) {
                  setPickupDate(next);
                  return;
                }
                void savePickupDate(next);
              }}
              className="h-10 w-full rounded-xl border border-[#e5e7eb] px-2 text-[13px]"
            />
            {access.write && pickupDate ? (
              <button type="button" onClick={() => void savePickupDate("")} className="shrink-0 text-[11px] font-semibold text-[var(--ink3)] underline">
                Notīrīt
              </button>
            ) : null}
          </span>
          {!pickupDate ? <span className="mt-1 block text-[10.5px] text-[var(--ink3)]">tukšs - gaida e-pastu/Auto1</span> : null}
        </label>
        <label className="block text-[11px] text-[var(--ink2)]">
          Bezmaksas stāvv. līdz
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
              <span className={`mt-1 block text-[11px] font-semibold ${timer.overdue ? "text-red-700" : "text-emerald-700"}`}>{timer.label}</span>
            );
          })()}
        </label>
      </div>

      {/* Atrašanās vieta: adrese ar roku pēc pirkuma, uzreiz redzama kartē "Punkti" pēc ģeokodēšanas. Vakarā precizēs izsoles adrese. */}
      <div className="mt-2.5 rounded-[14px] border border-[#eef1f4] bg-white px-[11px] pb-[11px] pt-2.5">
        <div className="flex items-center justify-between gap-1.5">
          <p className="text-[13px] font-semibold">Atrašanās vieta</p>
          {(() => {
            const chip = pickupAddress.trim() ? locationChip(order.geocodeStatus) : null;
            if (!chip) return null;
            const bg = chip.tone === "ok" ? "bg-[var(--iriss-log-ok-bg)]" : "bg-[var(--iriss-log-warn-bg)]";
            const fg = chip.tone === "ok" ? "text-[var(--iriss-log-ok-dot)]" : "text-[var(--iriss-log-warn-dot)]";
            const dot = chip.tone === "ok" ? "bg-[var(--iriss-log-ok-dot)]" : "bg-[var(--iriss-log-warn-dot)]";
            return (
              <span className={`inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[10.5px] font-bold ${bg} ${fg}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                {chip.label}
              </span>
            );
          })()}
        </div>
        <div className="mt-1.5 flex h-9 items-center gap-1.5 rounded-xl border border-[#e5e7eb] px-2.5">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0 text-[#9a9faa]">
            <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
            <circle cx="12" cy="9.5" r="2.5" />
          </svg>
          <input
            value={pickupAddress}
            disabled={!access.write || geocodeBusy}
            onChange={(e) => setPickupAddress(e.target.value)}
            onBlur={() => void saveLocation(pickupAddress)}
            placeholder="Pilsēta, valsts (piem. Venlo, Nīderlande)"
            className="min-w-0 flex-1 border-none bg-transparent text-[12.5px] outline-none disabled:text-[var(--ink3)]"
          />
        </div>
        <p className="mt-1 text-[10.5px] text-[var(--ink3)]">
          {geoNotice || 'Ievadīta pēc pirkuma - tūlīt redzama kartē "Punkti". Vakarā precizēsim ar izsoles adresi.'}
        </p>
      </div>

      <label className="mt-2 block text-[12px] text-[var(--ink2)]">
        Piezīme
        <textarea
          value={note}
          disabled={!access.write}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (!access.write || note.trim() === (order.notes || "").trim()) return;
            void saveOrderFields({ notes: note });
          }}
          rows={2}
          className="mt-1 w-full rounded-xl border border-[#e5e7eb] px-2 py-2 text-[13px]"
        />
      </label>

      {/* Vienota "Dokumenti" sadaļa: visi dokumentu veidi vienuviet, grupēti ar maziem virsrakstiem. */}
      {accessReady ? (
        <section className="iriss-log-cab-sec mt-3">
          <button type="button" className="iriss-log-cab-head" onClick={toggleDocs} aria-expanded={docsOpen}>
            <span className="iriss-log-cab-letter">D</span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-[13.5px] font-semibold">Dokumenti</span>
              <span className="block text-[12px] text-[var(--ink3)]">{cabinetDocumentsSummary(documents)}</span>
            </span>
            <span className={`iriss-log-cab-chip ${arrived ? "done" : "on"}`}>{arrived ? "pabeigts" : CABINET_PICKUP_STAGE_LV[stage]}</span>
            <span className="text-[var(--ink3)]">{docsOpen ? "⌃" : "⌄"}</span>
          </button>

          {docsOpen ? (
            <div className="px-2 pb-3 pt-1">
              {access.sections.includes("A") ? (
                <DocGroup
                  label={CABINET_DOC_GROUP_LABEL.A}
                  slotTypes={A_SLOT_TYPES}
                  extraDocs={docsA.filter((d) => !A_SLOT_TYPES.includes(d.type))}
                  docsForType={(t) => docsA.filter((d) => d.type === t)}
                  canAdd={(t) => access.write && (t !== "service_invoice" || !access.hideSums)}
                  onUpload={(t, file) => void uploadFile(sectionForDocType(t, arrived), t, file)}
                />
              ) : null}

              {access.sections.includes("B") ? (
                <>
                  <p className="mt-3.5 mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink3)]">
                    {CABINET_DOC_GROUP_LABEL.B}
                  </p>
                  <div className="mb-2 rounded-xl border border-[#eef1f4] bg-white px-3 py-2">
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
                    {!arrived && access.write ? (
                      <button type="button" onClick={() => void setStage("arrived")} className="mt-2 h-8 rounded-full border border-[#e5e7eb] px-3 text-[12px] font-semibold">
                        Atzīmēt kā Atvests
                      </button>
                    ) : null}
                    <dl className="mt-2 grid grid-cols-[6rem_1fr] gap-y-1 text-[12.5px]">
                      <dt className="text-[var(--ink2)]">Darba laiks</dt>
                      <dd>{order.pickupSnapshot?.hoursText || "-"}</dd>
                    </dl>
                    <label className="mt-2 block text-[11px] text-[var(--ink2)]">
                      Punkts
                      <select
                        value={order.pickupPointId}
                        disabled={!access.write}
                        onChange={(e) => onAssignPoint(order.id, e.target.value)}
                        className="mt-1 h-9 w-full rounded-lg border border-[#e5e7eb] px-2 text-[12.5px]"
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
                  </div>
                  <DocGroup
                    label=""
                    slotTypes={B_SLOT_TYPES}
                    extraDocs={docsB.filter((d) => !B_SLOT_TYPES.includes(d.type))}
                    docsForType={(t) => docsB.filter((d) => d.type === t)}
                    canAdd={() => access.write}
                    onUpload={(t, file) => void uploadFile("B", t, file)}
                    transportCostAuto={order.transportCostAuto}
                    transportCostEur={order.transportCostEur}
                  />
                </>
              ) : null}

              {access.sections.includes("C") ? (
                <DocGroup
                  label={CABINET_DOC_GROUP_LABEL.C}
                  slotTypes={C_SLOT_TYPES}
                  extraDocs={docsC.filter((d) => !C_SLOT_TYPES.includes(d.type))}
                  docsForType={(t) => docsC.filter((d) => d.type === t)}
                  canAdd={(t) => {
                    if (!access.write) return false;
                    if (t === "service_invoice") return !access.hideSums;
                    return arrived;
                  }}
                  addHint={(t) => (t !== "service_invoice" && !arrived ? "atbloķēsies, kad statuss būs Atvests" : "")}
                  onUpload={(t, file) => void uploadFile(sectionForDocType(t, arrived), t, file)}
                />
              ) : null}

              {access.write && uploadTypes.length > 0 ? (
                <UploadRow
                  types={uploadTypes}
                  busy={uploading !== null}
                  onUpload={(type, file) => void uploadFile(sectionForDocType(type, arrived), type, file)}
                />
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Pašizmaksas transports: automātiski no Auto1 Transport Invoice PDF, ar manuālu override. */}
      <div className="mt-3 rounded-xl border border-[#eef1f4] px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-semibold">Pašizmaksas transports</p>
          {order.transportCostAuto && order.transportCostEur != null ? (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              auto-aizpildīts
            </span>
          ) : null}
        </div>
        {access.write ? (
          <input
            type="text"
            inputMode="decimal"
            value={transportCost}
            onChange={(e) => setTransportCost(e.target.value)}
            onBlur={() => {
              const trimmed = transportCost.trim();
              const parsed = trimmed ? parsePriceLike(trimmed) : null;
              if (parsed === order.transportCostEur) {
                setTransportCost(formatTransportCostInput(order.transportCostEur));
                return;
              }
              setTransportCost(formatTransportCostInput(parsed));
              void saveOrderFields({ transportCostEur: parsed, transportCostAuto: false });
            }}
            placeholder="-"
            className="mt-1.5 h-9 w-full rounded-lg border border-[#e5e7eb] px-2 text-[13px] font-semibold"
          />
        ) : (
          <p className="mt-1.5 text-[13px] font-semibold">{order.transportCostEur != null ? formatLogisticsEur(order.transportCostEur) : "-"}</p>
        )}
        <p className="mt-1 text-[11px] text-[var(--ink3)]">No Auto1 Transport Invoice PDF. Ja PDF nav vai summa neatpazīta - ievadi ar roku.</p>
      </div>

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
      </div>

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

function DocGroup({
  label,
  slotTypes,
  extraDocs,
  docsForType,
  canAdd,
  addHint,
  onUpload,
  transportCostAuto,
  transportCostEur,
}: {
  label: string;
  slotTypes: CabinetDocType[];
  extraDocs: CabinetDocument[];
  docsForType: (t: CabinetDocType) => CabinetDocument[];
  canAdd: (t: CabinetDocType) => boolean;
  addHint?: (t: CabinetDocType) => string;
  onUpload: (t: CabinetDocType, file: File) => void;
  transportCostAuto?: boolean;
  transportCostEur?: number | null;
}) {
  return (
    <div>
      {label ? <p className="mt-3.5 mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink3)]">{label}</p> : null}
      <ul className="space-y-1">
        {slotTypes.map((type) => {
          const docs = docsForType(type);
          if (docs.length === 0) {
            const allowed = canAdd(type);
            const hint = addHint?.(type) ?? "";
            return (
              <DocMissingRow
                key={type}
                label={CABINET_DOC_TYPE_LABEL[type]}
                hint={hint}
                onUpload={allowed ? (file) => onUpload(type, file) : undefined}
              />
            );
          }
          return docs.map((doc) => (
            <DocPresentRow
              key={doc.id}
              doc={doc}
              badge={
                doc.type === "transport_invoice" && transportCostAuto && transportCostEur != null
                  ? `summa ${formatLogisticsEur(transportCostEur)} nolasīta automātiski`
                  : ""
              }
            />
          ));
        })}
        {extraDocs.map((doc) => (
          <DocPresentRow key={doc.id} doc={doc} />
        ))}
      </ul>
    </div>
  );
}

function DocPresentRow({ doc, badge }: { doc: CabinetDocument; badge?: string }) {
  const chip = cabinetDocumentSourceChip(doc.source);
  return (
    <li className="flex items-center justify-between gap-2 rounded-xl border border-[#eef1f4] bg-white px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold">{doc.title}</p>
        <p className="truncate text-[11.5px] text-[var(--ink2)]">
          {chip ? <span className="iriss-log-status-chip mr-1">{chip}</span> : null}
          {doc.createdAt ? formatLogisticsDate(doc.createdAt.slice(0, 10)) : ""}
        </p>
        {badge ? (
          <p className="mt-0.5 flex items-center gap-1 text-[10.5px] font-bold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {badge}
          </p>
        ) : null}
      </div>
      {doc.blobPath ? (
        <a
          href={`/api/admin/iriss-logistics/documents/${encodeURIComponent(doc.id)}`}
          target="_blank"
          rel="noreferrer"
          className="iriss-log-btn-sec h-8 shrink-0 px-2.5 text-[12px]"
        >
          Atvērt
        </a>
      ) : null}
    </li>
  );
}

function DocMissingRow({ label, hint, onUpload }: { label: string; hint: string; onUpload?: (file: File) => void }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-[#d2d2d7] px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[var(--ink3)]">{label}</p>
        {hint ? <p className="truncate text-[11px] text-[var(--ink3)]">{hint}</p> : null}
      </div>
      {onUpload ? (
        <label className="iriss-log-btn-sec h-8 shrink-0 cursor-pointer px-2.5 text-[12px]">
          + Pievienot
          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = "";
            }}
          />
        </label>
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
  const safeType = types.includes(type) ? type : (types[0] ?? "other");
  return (
    <div
      className="iriss-log-doc-drop mt-3"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) onUpload(safeType, file);
      }}
    >
      <p>Ievilc failu vai izvēlies. PDF, JPG, PNG līdz 20 MB.</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <select value={safeType} onChange={(e) => setType(e.target.value as CabinetDocType)} className="h-8 rounded-[10px] border border-[#e5e7eb] px-2 text-[12px]">
          {types.map((t) => (
            <option key={t} value={t}>
              {CABINET_DOC_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <label className="h-8 cursor-pointer rounded-[10px] bg-[var(--btn-dark-bg,#111)] px-3 text-[12px] font-semibold leading-8 text-white">
          {busy ? "Augšupielādē..." : "+ Augšupielādēt dokumentu"}
          <input
            type="file"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(safeType, file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}
