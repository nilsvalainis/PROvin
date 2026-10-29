"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useModalBackdropClose } from "@/hooks/useModalBackdropClose";
import { useAdminScrollLock } from "@/lib/admin-scroll-lock";
import { IrissAuctionLogo } from "@/components/admin/IrissAuctionLogo";
import type { IrissAuctionLogoKey } from "@/lib/iriss-auction-logos";
import { isHttpUrlForOpen } from "@/lib/iriss-listing-links";
import { labelIrissListingLinkRows } from "@/lib/iriss-listing-link-lists";
import { IRISS_LISTING_CARD_ACTION_ORDER } from "@/lib/iriss-listing-card-actions";
import type { IrissListingOrderBrief } from "@/lib/iriss-listings-orders";
import { formatIrissEurWhole } from "@/lib/iriss-price-format";
import { IRISS_PASUTIJUMS_LIST_STATUS_LV } from "@/lib/iriss-pasutijumi-types";

const STATUS_LABEL = IRISS_PASUTIJUMS_LIST_STATUS_LV;

function fmtBudget(n: number | null, raw: string): string {
  if (n != null) return formatIrissEurWhole(n);
  const t = raw.trim();
  if (!t || t === "-") return "nav norādīts";
  return t;
}

function previewLogoKey(label: string): IrissAuctionLogoKey | null {
  if (label.startsWith("Mobile")) return "mobile";
  if (label.startsWith("Autobid")) return "autobid";
  if (label.startsWith("Openlane")) return "openline";
  if (label.startsWith("Auto1")) return "auto1";
  if (label.startsWith("eCarsTrade")) return "ecarstrade";
  return null;
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
    { label: "eCarsTrade", hrefs: order.listingLinkEcarstrade },
    { label: "Cita", hrefs: order.listingLinksOther },
  ]).filter((x) => isHttpUrlForOpen(x.href));
  const engine = [order.engineType, order.powerKwLabel].filter(Boolean).join(" · ");
  return (
    <article className="space-y-3 rounded-xl border border-[var(--iriss-line)] bg-white p-3">
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
          <ul className="mt-1 space-y-1.5">
            {links.map((l) => {
              const logoKey = previewLogoKey(l.label);
              return (
                <li key={`${l.label}-${l.href}`}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={l.label}
                    className="inline-flex items-center gap-1.5 bg-transparent text-[13px] font-medium text-[var(--color-provin-accent)] hover:opacity-80"
                  >
                    {logoKey ? (
                      <>
                        <IrissAuctionLogo platform={logoKey} fallback={l.label} size="md" />
                        <span className="sr-only">{l.label}</span>
                      </>
                    ) : (
                      l.label
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <Link
        href={order.id.startsWith("scan:") ? `/admin/iriss/scan/${encodeURIComponent(order.id.slice(5))}` : `/admin/iriss/pasutijumi/${encodeURIComponent(order.id)}`}
        className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--iriss-graphite)] px-5 text-[13px] font-semibold text-[var(--iriss-on-graphite)]"
      >
        {order.id.startsWith("scan:") ? "Atvērt SCAN" : "Atvērt pasūtījumu"}
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
  useAdminScrollLock(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const backdropClose = useModalBackdropClose(onClose);

  if (orders.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="iriss-order-preview-title">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Aizvērt" {...backdropClose} />
      <div className="relative z-[61] max-h-[88vh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-2xl border border-[var(--iriss-line)] bg-[var(--iriss-surface-2)] p-3 pb-[max(16px,env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl sm:p-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 id="iriss-order-preview-title" className="text-[17px] font-bold text-[var(--iriss-ink)]">
            {IRISS_LISTING_CARD_ACTION_ORDER}{orders.length > 1 ? ` (${orders.length})` : ""}
          </h2>
          <span className="grow" />
          <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-lg border border-[var(--iriss-line)] bg-white text-lg" aria-label="Aizvērt">
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
