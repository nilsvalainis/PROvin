"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadAdminMessageTemplatesDoc } from "@/components/admin/AdminDealerSendDialog";
import { paidProductLabel } from "@/lib/admin-customer-identity";
import { normalizeWhatsAppPhoneDigits } from "@/lib/admin-whatsapp-phone";
import { isPartnerHighlightAdminOrder } from "@/lib/b2b-partner-orders";
import { dealerSendWhatsappUrl } from "@/lib/dealer-send-message";
import { renderTemplateById } from "@/lib/messages/render-template-id";
import { GOOGLE_REVIEW_URL } from "@/lib/messages/shared-blocks";
import { reportReadyVinVar } from "@/lib/messages/template-vars";
import { reviewCarLabel, reviewCarObject } from "@/lib/review-ask";
import { daysAgoLabel, formatRigaDayTime, isAwaitingReviewRequest, REVIEW_REQUEST_MAX_AGE_MS } from "@/lib/order-client-marks";
import type { SerializedAdminOrderTableRow } from "@/lib/serialize-admin-order-table";

type QueueItem = { id: string; completedAt: string | null; reviewRequestedAt: string | null };

const btn =
  "min-h-8 rounded-md border border-slate-300 bg-white px-2.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * «Gaida atsauksmes lūgumu»: izpildīti pirms ≥2 dienām (līdz 30 d.), lūgums nav sūtīts, nav B2B.
 * Poga «Lūgt atsauksmi» (E-pasts sūta serveris / WhatsApp atver ziņu) un atzīmē datumu, lai nesūta divreiz.
 */
export function AdminReviewRequestQueue({
  orders,
  orderDetailHrefBase = "/admin/orders",
  variant,
}: {
  orders: SerializedAdminOrderTableRow[];
  orderDetailHrefBase?: string;
  /** Saraksts ir divās vietās (dators / telefons) - dati tiek ielasīti tikai redzamajā. */
  variant: "desktop" | "mobile";
}) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setActive(variant === "desktop" ? mq.matches : !mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [variant]);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const candidates = useMemo(() => {
    const minCreated = Date.now() / 1000 - (REVIEW_REQUEST_MAX_AGE_MS / 1000) * 2;
    return orders
      .filter(
        (o) =>
          o.auditComplete &&
          !o.fullyReversed &&
          !o.isB2bPack &&
          !o.isB2bTopup &&
          !o.isDemo &&
          o.created >= minCreated &&
          !isPartnerHighlightAdminOrder({ partnerId: o.partnerId, partnerCompanyName: o.partnerCompanyName, notes: o.notes }),
      )
      .slice(0, 200);
  }, [orders]);
  const idsKey = candidates.map((o) => o.id).join(",");

  useEffect(() => {
    setNowMs(Date.now());
    if (!active) return;
    if (!idsKey) {
      setItems([]);
      return;
    }
    let cancelled = false;
    void fetch("/api/admin/order-client-marks", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "review_queue", ids: idsKey.split(",") }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { items?: QueueItem[] } | null) => {
        if (!cancelled) setItems(d?.items ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [idsKey, active]);

  const awaiting = useMemo(() => {
    if (nowMs == null) return [];
    const byId = new Map(candidates.map((o) => [o.id, o]));
    return items
      .filter((i) => isAwaitingReviewRequest({ completedAt: i.completedAt, reviewRequestedAt: i.reviewRequestedAt, nowMs }))
      .map((i) => ({ item: i, order: byId.get(i.id)! }))
      .filter((x) => Boolean(x.order))
      .sort((a, b) => Date.parse(b.item.completedAt ?? "") - Date.parse(a.item.completedAt ?? ""));
  }, [items, candidates, nowMs]);

  if (!active || (awaiting.length === 0 && !open)) return null;

  const markDone = (id: string, at: string) =>
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, reviewRequestedAt: at } : i)));

  const request = async (order: SerializedAdminOrderTableRow, channel: "email" | "whatsapp") => {
    setMenu(null);
    setNotice(null);
    if (channel === "whatsapp") {
      const doc = await loadAdminMessageTemplatesDoc();
      const vin = reportReadyVinVar(order.vin);
      const car = reviewCarLabel(order.makeModel, null);
      const text =
        renderTemplateById(
          "wa.review_request",
          { vin, auto: reviewCarObject("lv", car, vin), atsauksmes_saite: GOOGLE_REVIEW_URL },
          doc,
        )?.text ?? "";
      window.open(
        dealerSendWhatsappUrl(normalizeWhatsAppPhoneDigits(order.customerPhone), text),
        "_blank",
        "noopener,noreferrer",
      );
    }
    setBusy(order.id);
    try {
      const res = await fetch("/api/admin/order-client-marks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "review_request", sessionId: order.id, channel }),
      });
      const data = (await res.json().catch(() => ({}))) as { marks?: { reviewRequestedAt?: string }; error?: string };
      if (res.ok || data.error === "already_requested") {
        markDone(order.id, data.marks?.reviewRequestedAt ?? new Date().toISOString());
        setNotice(channel === "email" ? "Atsauksmes lūgums nosūtīts." : "WhatsApp atvērts.");
      } else {
        setNotice(data.error === "no_customer_email" ? "Nav klienta e-pasta." : "Neizdevās nosūtīt.");
      }
    } catch {
      setNotice("Tīkla kļūda.");
    } finally {
      setBusy(null);
    }
  };

  const base = orderDetailHrefBase.replace(/\/$/, "");

  return (
    <div className="min-w-0">
      <button
        type="button"
        aria-pressed={open}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-[12.5px] font-medium ${
          open ? "bg-[#1d1d1f] text-white" : "bg-[#e9e9ee] text-[#3a3a3c]"
        }`}
      >
        Gaida atsauksmes lūgumu
        <span className="tabular-nums font-semibold">{awaiting.length}</span>
      </button>
      {open ? (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white p-2">
          {awaiting.length === 0 ? (
            <p className="px-1 py-2 text-[12px] text-slate-500">Visiem atsauksmes lūgums nosūtīts</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {awaiting.map(({ item, order }) => (
                <li key={order.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 py-1.5 text-[12px]">
                  <Link href={`${base}/${encodeURIComponent(order.id)}`} className="min-w-0 flex-1 truncate font-medium text-slate-900 hover:underline">
                    {order.customerName || order.makeModel || order.customerEmail || order.id}
                  </Link>
                  <span className="text-slate-600">
                    {paidProductLabel({ checkoutLine: order.checkoutLine, amountTotalCents: order.amountTotal })}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">{order.vin ?? ""}</span>
                  <span className="text-slate-500">
                    {formatRigaDayTime(item.completedAt ?? "").split(" ")[0]} · {nowMs != null ? daysAgoLabel(item.completedAt ?? "", nowMs) : ""}
                  </span>
                  <span className="relative">
                    <button type="button" className={btn} disabled={busy !== null} onClick={() => setMenu(menu === order.id ? null : order.id)}>
                      {busy === order.id ? "Sūta…" : "Lūgt atsauksmi"}
                    </button>
                    {menu === order.id ? (
                      <span className="absolute right-0 z-20 mt-1 flex flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
                        <button type="button" className="px-3 py-1.5 text-left text-[12px] hover:bg-slate-50" onClick={() => void request(order, "email")}>
                          E-pasts
                        </button>
                        <button type="button" className="px-3 py-1.5 text-left text-[12px] hover:bg-slate-50" onClick={() => void request(order, "whatsapp")}>
                          WhatsApp
                        </button>
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {notice ? <p className="mt-1 px-1 text-[11px] text-slate-500">{notice}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
