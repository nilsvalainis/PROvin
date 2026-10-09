"use client";

import Link from "next/link";
import { useEffect } from "react";
import { isHttpUrlForOpen } from "@/lib/iriss-listing-links";
import { labelIrissListingLinkRows } from "@/lib/iriss-listing-link-lists";
import type { IrissListingOrderBrief } from "@/lib/iriss-listings-orders";
import type { IrissPasutijumsListStatus } from "@/lib/iriss-pasutijumi-types";

const STATUS_LABEL: Record<IrissPasutijumsListStatus, string> = {
  active: "Aktīvs",
  completed: "Izpildīts",
  inactive: "Neaktīvs",
};

function fmtBudget(n: number | null, raw: string): string {
  if (n != null) return `${Math.round(n).toLocaleString("lv-LV")} €`;
  const t = raw.trim();
  if (!t || t === "-") return "nav norādīts";
  return t;
}

function Field({ label, value }: { label: string; value: string }) {
  const t = value.trim();
  return (
    <div className="grid gap-0.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="whitespace-pre-wrap text-[13px] text-[var(--color-apple-text)]">{t || "-"}</dd>
    </div>
  );
}

function OrderPreviewBody({ order }: { order: IrissListingOrderBrief }) {
  const links = labelIrissListingLinkRows([
    { label: "Mobile", hrefs: order.listingLinkMobile },
    { label: "Autobid", hrefs: order.listingLinkAutobid },
    { label: "Openlane", hrefs: order.listingLinkOpenline },
    { label: "Auto1", hrefs: order.listingLinkAuto1 },
    { label: "Cita", hrefs: order.listingLinksOther },
  ]).filter((x) => isHttpUrlForOpen(x.href));
  const engine = [order.engineType, order.powerKwLabel].filter(Boolean).join(" · ");
  return (
    <article className="space-y-3 rounded-xl border border-[#E5E7EB] bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-[var(--color-apple-text)]">{order.clientName}</h3>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
          {STATUS_LABEL[order.listStatus]}
        </span>
      </div>
      <dl className="grid gap-2.5 sm:grid-cols-2">
        <Field label="Kontakti" value={[order.phone, order.email].filter(Boolean).join(" · ")} />
        <Field label="Marka / modelis" value={order.brandModel} />
        <Field label="Gads" value={order.productionYears} />
        <Field label="Budžets" value={fmtBudget(order.budget, order.budgetRaw)} />
        <Field label="Krāsa" value={order.preferredColors} />
        <Field label="Dzinējs / kW" value={engine} />
        <Field label="Ātrumkārba" value={order.transmission} />
        <Field label="Obligātais aprīkojums" value={order.equipmentRequired} />
        <Field label="Vēlamais aprīkojums" value={order.equipmentDesired} />
        <div className="sm:col-span-2">
          <Field label="Piezīmes" value={order.notes} />
        </div>
      </dl>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Meklējumu saites</div>
        {links.length === 0 ? (
          <p className="mt-1 text-[13px] text-slate-500">Nav piesaistītu saišu</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {links.map((l) => (
              <li key={`${l.label}-${l.href}`}>
                <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium text-[var(--color-provin-accent)] hover:underline">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Link
        href={`/admin/iriss/pasutijumi/${encodeURIComponent(order.id)}`}
        className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--color-provin-accent)] px-4 text-[13px] font-semibold text-[var(--color-provin-accent)]"
      >
        Atvērt pasūtījumu
      </Link>
    </article>
  );
}

export function IrissListingOrderPreview({
  orders,
  onClose,
}: {
  orders: readonly IrissListingOrderBrief[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (orders.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="iriss-order-preview-title">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Aizvērt" onClick={onClose} />
      <div className="relative z-[61] max-h-[88vh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-2xl border border-[#E5E7EB] bg-[#F8F8F9] p-3 pb-[max(16px,env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl sm:p-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 id="iriss-order-preview-title" className="text-[14px] font-semibold text-[var(--color-apple-text)]">
            Pasūtījums{orders.length > 1 ? ` (${orders.length})` : ""}
          </h2>
          <span className="grow" />
          <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-lg border border-[#E5E7EB] bg-white text-lg" aria-label="Aizvērt">
            ✕
          </button>
        </div>
        <div className="space-y-3">
          {orders.map((o) => (
            <OrderPreviewBody key={o.id} order={o} />
          ))}
        </div>
      </div>
    </div>
  );
}
