"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AdminChangeHistoryButton } from "@/components/admin/AdminChangeHistoryButton";
import { SharedOrderCriteriaForm } from "@/components/shared/SharedOrderCriteriaForm";
import { B2B_DEMO_APP_PREFIX } from "@/lib/b2b-demo-host";
import {
  B2B_DEMO_DEAL_DETAIL_OPTIONS,
  B2B_DEMO_ORDER_STATUSES,
  B2B_DEMO_ORDER_STATUS_LV,
  type B2bDemoOffer,
  type B2bDemoOrder,
  type B2bDemoOrderListPage,
  type B2bDemoOrderListRow,
  type B2bDemoOrderStatus,
} from "@/lib/b2b-demo-types";

function newClientOfferId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `off_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function emptyClientOffer(title: string): B2bDemoOffer {
  const now = new Date().toISOString();
  return {
    offerId: newClientOfferId(),
    title,
    brandModel: "",
    vin: "",
    firstRegistration: "",
    odometerReading: "",
    transmission: "",
    location: "",
    hasFullServiceHistory: false,
    hasFactoryPaint: false,
    hasNoRustBody: false,
    hasSecondWheelSet: false,
    specialNotes: "",
    visualAssessment: "",
    technicalAssessment: "",
    summary: "",
    carPrice: "",
    deliveryPrice: "",
    commissionFee: "",
    offerValidDays: "",
    validUntil: "",
    createdAt: now,
    updatedAt: now,
  };
}

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-[#F26522] focus:ring-2 focus:ring-[#F26522]/25";

const sectionClass = "rounded-2xl border border-slate-200 bg-white p-4 space-y-3";

export function B2bDemoOrdersList({ initial }: { initial: B2bDemoOrderListPage }) {
  const [page, setPage] = useState(initial);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function load(nextPage: number, nextStatus: string) {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(nextPage), limit: String(initial.limit || 30) });
      if (nextStatus) qs.set("status", nextStatus);
      const res = await fetch(`/api/b2b-demo/orders?${qs}`, { credentials: "include" });
      const data = (await res.json()) as B2bDemoOrderListPage & { error?: string };
      if (res.ok && Array.isArray(data.rows)) setPage(data);
    } finally {
      setLoading(false);
    }
  }

  const from = page.total === 0 ? 0 : (page.page - 1) * page.limit + 1;
  const to = Math.min(page.page * page.limit, page.total);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          label="Visi"
          active={!status}
          onClick={() => {
            setStatus("");
            void load(1, "");
          }}
        />
        {B2B_DEMO_ORDER_STATUSES.map((s) => (
          <FilterChip
            key={s}
            label={B2B_DEMO_ORDER_STATUS_LV[s]}
            active={status === s}
            onClick={() => {
              setStatus(s);
              void load(1, s);
            }}
          />
        ))}
      </div>
      {page.rows.length === 0 ? (
        <p className="text-sm text-slate-500">Šim dīlerim vēl nav pasūtījumu. Citu tenantu dati šeit nav redzami.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
          {page.rows.map((row) => (
            <OrderRow key={row.orderId} row={row} />
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          {loading ? "Ielādē…" : page.total ? `Rāda ${from}-${to} no ${page.total}` : "Nav ierakstu"}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={loading || page.page <= 1}
            className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40"
            onClick={() => void load(page.page - 1, status)}
          >
            Iepriekšējā
          </button>
          <button
            type="button"
            disabled={loading || page.page * page.limit >= page.total}
            className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40"
            onClick={() => void load(page.page + 1, status)}
          >
            Nākamā
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full bg-[#F26522] px-3 py-1 text-[12px] font-semibold text-white"
          : "rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200"
      }
    >
      {label}
    </button>
  );
}

function OrderRow({ row }: { row: B2bDemoOrderListRow }) {
  return (
    <li>
      <Link href={`${B2B_DEMO_APP_PREFIX}/pasutijumi/${row.orderId}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
        <span>
          <span className="block font-medium">{row.brandModel || "Bez modeļa"}</span>
          <span className="text-sm text-slate-500">
            {row.clientName || "Bez klienta"}
            {row.vin ? ` · ${row.vin}` : ""}
            {row.totalBudget ? ` · ${row.totalBudget}` : ""}
          </span>
        </span>
        <span className="text-xs uppercase text-slate-500">{B2B_DEMO_ORDER_STATUS_LV[row.status]}</span>
      </Link>
    </li>
  );
}

const emptyOrder = (): B2bDemoOrder => ({
  tenantId: "tnt_placeholder",
  orderId: "ord_placeholder",
  clientName: "",
  clientFirstName: "",
  clientLastName: "",
  phone: "",
  email: "",
  orderDate: new Date().toISOString().slice(0, 10),
  brandModel: "",
  vin: "",
  productionYears: "",
  totalBudget: "",
  engineType: "",
  transmission: "",
  bodyType: "",
  driveType: "",
  seatCount: "",
  maxMileage: "",
  preferredColors: "",
  nonPreferredColors: "",
  interiorFinish: "",
  dealLeasingOrCredit: false,
  dealClientFinancing100: false,
  dealClientFinancing20: false,
  dealVat21Required: false,
  dealServiceStartDeposit: false,
  dealEkki: false,
  equipmentRequired: "",
  equipmentDesired: "",
  note: "",
  status: "active",
  offers: [],
  createdAt: "",
  updatedAt: "",
});

export function B2bDemoOrderForm({
  initial,
  mode,
}: {
  initial?: B2bDemoOrder;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [order, setOrder] = useState<B2bDemoOrder>(initial ?? emptyOrder());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [openOffer, setOpenOffer] = useState<string | null>(initial?.offers[0]?.offerId ?? null);

  function patch<K extends keyof B2bDemoOrder>(key: K, value: B2bDemoOrder[K]) {
    setOrder((prev) => ({ ...prev, [key]: value }));
  }

  const payload = useMemo(
    () => ({
      clientFirstName: order.clientFirstName,
      clientLastName: order.clientLastName,
      clientName: `${order.clientFirstName} ${order.clientLastName}`.trim() || order.clientName,
      phone: order.phone,
      email: order.email,
      orderDate: order.orderDate,
      brandModel: order.brandModel,
      vin: order.vin,
      productionYears: order.productionYears,
      totalBudget: order.totalBudget,
      engineType: order.engineType,
      transmission: order.transmission,
      bodyType: order.bodyType,
      driveType: order.driveType,
      seatCount: order.seatCount,
      maxMileage: order.maxMileage,
      preferredColors: order.preferredColors,
      nonPreferredColors: order.nonPreferredColors,
      interiorFinish: order.interiorFinish,
      dealLeasingOrCredit: order.dealLeasingOrCredit,
      dealClientFinancing100: order.dealClientFinancing100,
      dealClientFinancing20: order.dealClientFinancing20,
      dealVat21Required: order.dealVat21Required,
      dealServiceStartDeposit: order.dealServiceStartDeposit,
      dealEkki: order.dealEkki,
      equipmentRequired: order.equipmentRequired,
      equipmentDesired: order.equipmentDesired,
      note: order.note,
      status: order.status,
      offers: order.offers,
    }),
    [order],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const url =
        mode === "create" ? "/api/b2b-demo/orders" : `/api/b2b-demo/orders/${encodeURIComponent(initial!.orderId)}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string; order?: B2bDemoOrder };
      if (!res.ok || !data.order) {
        setError(data.error ?? "Neizdevās saglabāt.");
        return;
      }
      setOrder(data.order);
      router.push(`${B2B_DEMO_APP_PREFIX}/pasutijumi/${data.order.orderId}`);
      router.refresh();
    } catch {
      setError("Tīkla kļūda.");
    } finally {
      setLoading(false);
    }
  }

  function addOffer() {
    const next = emptyClientOffer(`Piedāvājums ${order.offers.length + 1}`);
    setOrder((prev) => ({ ...prev, offers: [...prev.offers, next] }));
    setOpenOffer(next.offerId);
  }

  function updateOffer(offerId: string, patchOffer: Partial<B2bDemoOffer>) {
    setOrder((prev) => ({
      ...prev,
      offers: prev.offers.map((row) => (row.offerId === offerId ? { ...row, ...patchOffer } : row)),
    }));
  }

  function removeOffer(offerId: string) {
    setOrder((prev) => ({ ...prev, offers: prev.offers.filter((row) => row.offerId !== offerId) }));
    setOpenOffer((cur) => (cur === offerId ? null : cur));
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <section className={sectionClass}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Klienta dati</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Vārds" value={order.clientFirstName} onChange={(v) => patch("clientFirstName", v)} />
          <Field label="Uzvārds" value={order.clientLastName} onChange={(v) => patch("clientLastName", v)} />
          <Field label="Tālrunis" value={order.phone} onChange={(v) => patch("phone", v)} />
          <Field label="E-pasts" value={order.email} onChange={(v) => patch("email", v)} />
          <Field label="Pasūtījuma datums" value={order.orderDate} onChange={(v) => patch("orderDate", v)} type="date" />
          <label className="block text-sm font-medium">
            Statuss
            <select className={`${fieldClass} mt-1`} value={order.status} onChange={(e) => patch("status", e.target.value as B2bDemoOrderStatus)}>
              {B2B_DEMO_ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {B2B_DEMO_ORDER_STATUS_LV[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Auto</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Marka / modelis" value={order.brandModel} onChange={(v) => patch("brandModel", v)} />
          <Field label="VIN" value={order.vin} onChange={(v) => patch("vin", v.toUpperCase())} />
          <Field label="Ražošanas gadi" value={order.productionYears} onChange={(v) => patch("productionYears", v)} />
          <Field label="Kopējais budžets" value={order.totalBudget} onChange={(v) => patch("totalBudget", v)} />
          <Field label="Dzinēja tips" value={order.engineType} onChange={(v) => patch("engineType", v)} />
          <Field label="Ātrumkārba" value={order.transmission} onChange={(v) => patch("transmission", v)} />
          <Field label="Virsbūves tips" value={order.bodyType} onChange={(v) => patch("bodyType", v)} />
          <Field label="Piedziņas tips" value={order.driveType} onChange={(v) => patch("driveType", v)} />
          <Field label="Sēdvietu skaits" value={order.seatCount} onChange={(v) => patch("seatCount", v)} />
          <Field label="Maks. nobraukums" value={order.maxMileage} onChange={(v) => patch("maxMileage", v)} />
          <Field label="Vēlamās krāsas" value={order.preferredColors} onChange={(v) => patch("preferredColors", v)} />
          <Field label="Nevēlamās krāsas" value={order.nonPreferredColors} onChange={(v) => patch("nonPreferredColors", v)} />
          <div className="sm:col-span-2">
            <Field label="Salona apdare" value={order.interiorFinish} onChange={(v) => patch("interiorFinish", v)} />
          </div>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {B2B_DEMO_DEAL_DETAIL_OPTIONS.map((opt) => (
            <label key={opt.key} className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(order[opt.key])}
                onChange={(e) => patch(opt.key, e.target.checked)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </section>

      <SharedOrderCriteriaForm source={order} />

      <section className={sectionClass}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Aprīkojums un piezīmes</h2>
        <Area label="Obligātās prasības" value={order.equipmentRequired} onChange={(v) => patch("equipmentRequired", v)} />
        <Area label="Vēlamās prasības" value={order.equipmentDesired} onChange={(v) => patch("equipmentDesired", v)} />
        <Area label="Piezīmes" value={order.note} onChange={(v) => patch("note", v)} />
      </section>

      {mode === "edit" && initial ? (
        <section className={sectionClass}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Piedāvājumi</h2>
            <button type="button" onClick={addOffer} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold">
              Jauns piedāvājums
            </button>
          </div>
          {order.offers.length === 0 ? <p className="text-sm text-slate-500">Vēl nav piedāvājumu.</p> : null}
          {order.offers.map((offer, idx) => (
            <OfferEditor
              key={offer.offerId}
              offer={offer}
              index={idx}
              open={openOffer === offer.offerId}
              onToggle={() => setOpenOffer((cur) => (cur === offer.offerId ? null : offer.offerId))}
              onChange={(patchOffer) => updateOffer(offer.offerId, patchOffer)}
              onRemove={() => removeOffer(offer.offerId)}
              orderId={initial.orderId}
            />
          ))}
        </section>
      ) : (
        <p className="text-sm text-slate-500">Piedāvājuma PDF pieejams pēc saglabāšanas, no šī dīlera iestatījumiem.</p>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={loading} className="rounded-xl bg-[#F26522] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {loading ? "Saglabā…" : "Saglabāt"}
        </button>
        {mode === "edit" && initial ? (
          <>
            <a
              href={`/api/b2b-demo/orders/${encodeURIComponent(initial.orderId)}/pdf?view=1`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold"
            >
              Pasūtījuma PDF
            </a>
            <AdminChangeHistoryButton
              kind="b2b-order"
              recordId={initial.orderId}
              endpoint={`/api/b2b-demo/orders/${encodeURIComponent(initial.orderId)}/history`}
              onRestored={(body) => {
                const record = body.record;
                if (!record) return;
                setOrder((prev) => ({ ...prev, ...(record as B2bDemoOrder) }));
              }}
            />
          </>
        ) : null}
      </div>
    </form>
  );
}

function OfferEditor({
  offer,
  index,
  open,
  onToggle,
  onChange,
  onRemove,
  orderId,
}: {
  offer: B2bDemoOffer;
  index: number;
  open: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<B2bDemoOffer>) => void;
  onRemove: () => void;
  orderId: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onToggle} className="text-left text-sm font-semibold">
          {offer.title || `Piedāvājums ${index + 1}`}
        </button>
        <div className="flex gap-2">
          <a
            href={`/api/b2b-demo/orders/${encodeURIComponent(orderId)}/offer/${encodeURIComponent(offer.offerId)}/pdf?view=1`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-200 px-2 py-1 text-[12px] font-semibold"
          >
            PDF
          </a>
          <button type="button" onClick={onRemove} className="rounded-lg border border-red-200 px-2 py-1 text-[12px] font-semibold text-red-700">
            Dzēst
          </button>
        </div>
      </div>
      {open ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Virsraksts" value={offer.title} onChange={(v) => onChange({ title: v })} />
          <Field label="Marka / modelis" value={offer.brandModel} onChange={(v) => onChange({ brandModel: v })} />
          <Field label="VIN" value={offer.vin} onChange={(v) => onChange({ vin: v.toUpperCase() })} />
          <Field label="Pirmā reģistrācija" value={offer.firstRegistration} onChange={(v) => onChange({ firstRegistration: v })} />
          <Field label="Nobraukums" value={offer.odometerReading} onChange={(v) => onChange({ odometerReading: v })} />
          <Field label="Ātrumkārba" value={offer.transmission} onChange={(v) => onChange({ transmission: v })} />
          <div className="sm:col-span-2">
            <Field label="Atrašanās vieta" value={offer.location} onChange={(v) => onChange({ location: v })} />
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={offer.hasFullServiceHistory} onChange={(e) => onChange({ hasFullServiceHistory: e.target.checked })} />
            Pilna servisa vēsture
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={offer.hasFactoryPaint} onChange={(e) => onChange({ hasFactoryPaint: e.target.checked })} />
            Rūpnīcas krāsojums
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={offer.hasNoRustBody} onChange={(e) => onChange({ hasNoRustBody: e.target.checked })} />
            Virsbūve bez rūsas
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={offer.hasSecondWheelSet} onChange={(e) => onChange({ hasSecondWheelSet: e.target.checked })} />
            Otrs riteņu komplekts
          </label>
          <div className="sm:col-span-2">
            <Area label="Īpašas atzīmes" value={offer.specialNotes} onChange={(v) => onChange({ specialNotes: v })} />
          </div>
          <Area label="Vizuālais novērtējums" value={offer.visualAssessment} onChange={(v) => onChange({ visualAssessment: v })} />
          <Area label="Tehniskais novērtējums" value={offer.technicalAssessment} onChange={(v) => onChange({ technicalAssessment: v })} />
          <div className="sm:col-span-2">
            <Area label="Kopsavilkums" value={offer.summary} onChange={(v) => onChange({ summary: v })} />
          </div>
          <Field label="Automašīnas cena" value={offer.carPrice} onChange={(v) => onChange({ carPrice: v })} />
          <Field label="Piegādes cena (tukšs = no iestatījumiem)" value={offer.deliveryPrice} onChange={(v) => onChange({ deliveryPrice: v })} />
          <Field label="Komisija (tukšs = no iestatījumiem)" value={offer.commissionFee} onChange={(v) => onChange({ commissionFee: v })} />
          <Field label="Spēkā līdz" value={offer.validUntil} onChange={(v) => onChange({ validUntil: v })} type="date" />
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input className={`${fieldClass} mt-1`} value={value} type={type} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Area({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <textarea className={`${fieldClass} mt-1 min-h-24`} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
