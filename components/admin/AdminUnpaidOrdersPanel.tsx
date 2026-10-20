"use client";

import { Loader2, MoreHorizontal } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminBodyPortal } from "@/components/admin/AdminBodyPortal";
import { AdminOrdersViewSwitch } from "@/components/admin/AdminOrdersViewSwitch";
import { AdminMobileSheet, AdminMobileTopBar } from "@/components/admin/mobile/AdminMobileChrome";
import { useAdminScrollLock } from "@/lib/admin-scroll-lock";
import { formatMoneyEur } from "@/lib/format-money";
import type { UnpaidOrderRow } from "@/lib/admin-unpaid-orders-core";

const CALM_TAG =
  "inline-flex items-center rounded-[5px] border border-[#e5e5ea] px-1.5 py-px text-[11px] font-medium text-[#8e8e93] whitespace-nowrap";
const RIGA_DATETIME = new Intl.DateTimeFormat("lv-LV", {
  timeZone: "Europe/Riga",
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export type AdminUnpaidOrderView = UnpaidOrderRow & { stripeDashboardUrl: string };

function formatRemindedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Riga",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}.${get("month")}. ${get("hour")}:${get("minute")}`;
}

function UnpaidTag({ row }: { row: AdminUnpaidOrderView }) {
  if (row.remindedAt) {
    return <span className={CALM_TAG}>Atgādināts {formatRemindedAt(row.remindedAt)}</span>;
  }
  return <span className={CALM_TAG}>Neapmaksāts {row.ageHours} h</span>;
}

export function AdminUnpaidOrdersPanel({
  orders,
  stripeError,
}: {
  orders: AdminUnpaidOrderView[];
  stripeError: string | null;
}) {
  const router = useRouter();
  const pendingCount = useMemo(() => orders.filter((o) => !o.remindedAt).length, [orders]);

  const sendDisabledTitle = (row: AdminUnpaidOrderView): string | undefined => {
    if (!row.hasValidEmail) return "Nav e-pasta";
    if (row.remindedAt) return "Atgādinājums jau nosūtīts";
    return undefined;
  };
  const [menuId, setMenuId] = useState<string | null>(null);
  const [preview, setPreview] = useState<AdminUnpaidOrderView | null>(null);
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [to, setTo] = useState("");
  const [attemptCount, setAttemptCount] = useState(1);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useAdminScrollLock(Boolean(preview));

  const openPreview = useCallback(async (row: AdminUnpaidOrderView) => {
    setPreview(row);
    setError(null);
    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/admin/unpaid-orders/${encodeURIComponent(row.sessionId)}/preview`, {
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        to?: string;
        subject?: string;
        text?: string;
        attemptCount?: number;
      };
      if (!res.ok) {
        setError("Neizdevās ielādēt priekšskatījumu.");
        return;
      }
      setTo(typeof data.to === "string" ? data.to : row.email);
      setSubject(typeof data.subject === "string" ? data.subject : "");
      setText(typeof data.text === "string" ? data.text : "");
      setAttemptCount(typeof data.attemptCount === "number" ? data.attemptCount : row.attemptCount);
    } catch {
      setError("Tīkla kļūda");
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  const send = useCallback(async () => {
    if (!preview) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/unpaid-orders/${encodeURIComponent(preview.sessionId)}/remind`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, text }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(
          data.error === "already_reminded"
            ? "Atgādinājums šim pasūtījumam jau nosūtīts."
            : data.error === "already_paid"
              ? "Šim e-pastam vai VIN jau ir apmaksāts pasūtījums."
              : data.error === "smtp_not_configured"
                ? "SMTP nav iestatīts."
                : "Neizdevās nosūtīt.",
        );
        return;
      }
      setPreview(null);
      router.refresh();
    } catch {
      setError("Tīkla kļūda");
    } finally {
      setSending(false);
    }
  }, [preview, subject, text, router]);

  const hide = useCallback(
    async (row: AdminUnpaidOrderView) => {
      setMenuId(null);
      await fetch(`/api/admin/unpaid-orders/${encodeURIComponent(row.sessionId)}/hide`, {
        method: "POST",
        credentials: "include",
      });
      router.refresh();
    },
    [router],
  );

  const copyLink = useCallback(async (url: string | null) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
  }, []);

  const hug = "w-[1%] whitespace-nowrap";
  const menuRow = orders.find((o) => o.sessionId === menuId) ?? null;

  return (
    <>
      <div className="mt-2 hidden items-center gap-2 md:flex">
        <AdminOrdersViewSwitch pendingCount={pendingCount} />
      </div>

      <div className="md:hidden">
        <AdminMobileTopBar title="Pasūtījumi">
          <div className="mt-3">
            <AdminOrdersViewSwitch pendingCount={pendingCount} />
          </div>
        </AdminMobileTopBar>
        {stripeError ? (
          <p className="px-4 pt-2 text-[13px] text-[#8e8e93]">{stripeError}</p>
        ) : null}
        {orders.length === 0 ? (
          <p className="px-4 pt-6 text-center text-[14px] text-[#8e8e93]">Nav neapmaksātu pasūtījumu šajā logā.</p>
        ) : (
          <ul className="mt-2 space-y-2 px-4">
            {orders.map((o) => (
              <li key={o.sessionId} className="am-row relative rounded-[18px] bg-[var(--surface)] p-3 shadow-[var(--am-card-shadow)]">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate font-mono text-[13px] text-[var(--label)]">{o.vin || "VIN nav"}</p>
                  <UnpaidTag row={o} />
                </div>
                <p className="mt-0.5 truncate text-[13px] text-[var(--label-secondary)]">
                  {o.productName}
                  {o.email ? ` · ${o.email}` : " · Nav e-pasta"}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[13px] tabular-nums text-[var(--label-secondary)]">
                    {RIGA_DATETIME.format(new Date(o.created * 1000))} · {formatMoneyEur(o.amountTotal, o.currency)}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={!o.remindable}
                      title={sendDisabledTitle(o)}
                      onClick={() => void openPreview(o)}
                      className="inline-flex h-8 items-center rounded-lg bg-[#1d1d1f] px-2.5 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Sūtīt atgādinājumu
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--fill-secondary)] text-[var(--label-secondary)]"
                      aria-label="Vairāk"
                      onClick={() => setMenuId(o.sessionId)}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 hidden overflow-hidden rounded-xl bg-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.1)] md:block">
        {stripeError ? <p className="px-4 py-2 text-[13px] text-[#8e8e93]">{stripeError}</p> : null}
        {orders.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[#86868b]">Nav neapmaksātu pasūtījumu šajā logā (24 h - 7 dienas).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#6e6e73]">
                  <th className={`${hug} py-2.5 pl-4 pr-4`}>Statuss</th>
                  <th className={`${hug} py-2.5 pr-4`}>VIN</th>
                  <th className={`${hug} py-2.5 pr-4`}>Produkts</th>
                  <th className="py-2.5 pr-4">E-pasts</th>
                  <th className={`${hug} py-2.5 pr-4`}>Datums</th>
                  <th className={`${hug} py-2.5 pr-4 text-right`}>Summa</th>
                  <th className={`${hug} py-2.5 pr-4 text-right`}>Darbība</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.sessionId} className="h-[46px] whitespace-nowrap border-t border-[#f0f0f2]">
                    <td className={`${hug} py-1 pl-4 pr-4`}>
                      <UnpaidTag row={o} />
                    </td>
                    <td className={`${hug} py-1 pr-4 font-mono text-[12px] text-[#3a3a3c]`}>{o.vin || "-"}</td>
                    <td className={`${hug} py-1 pr-4 text-[13px] text-[#3a3a3c]`}>{o.productName}</td>
                    <td className="max-w-[360px] truncate py-1 pr-4 text-[13.5px] text-[#1d1d1f]">
                      {o.email || <span className="text-[#8e8e93]">Nav e-pasta</span>}
                    </td>
                    <td className={`${hug} py-1 pr-4 text-[13px] tabular-nums text-[#3a3a3c]`}>
                      {RIGA_DATETIME.format(new Date(o.created * 1000))}
                    </td>
                    <td className={`${hug} py-1 pr-4 text-right text-[14px] font-semibold tabular-nums text-[#1d1d1f]`}>
                      {formatMoneyEur(o.amountTotal, o.currency)}
                    </td>
                    <td className={`${hug} py-1 pr-4 text-right`}>
                      <span className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={!o.remindable}
                          title={sendDisabledTitle(o)}
                          onClick={() => void openPreview(o)}
                          className="inline-flex h-7 items-center rounded-lg bg-[#1d1d1f] px-2.5 text-[12.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Sūtīt atgādinājumu
                        </button>
                        <details className="relative">
                          <summary className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-lg border border-[#e5e5ea] text-[#8e8e93] [&::-webkit-details-marker]:hidden">
                            <MoreHorizontal className="h-4 w-4" />
                          </summary>
                          <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-[#e5e5ea] bg-white p-1 text-left text-[13px] shadow-lg">
                            <button
                              type="button"
                              disabled={!o.paymentPublicUrl}
                              className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-[#f5f5f7] disabled:opacity-40"
                              onClick={() => void copyLink(o.paymentPublicUrl)}
                            >
                              Kopēt saiti
                            </button>
                            <a
                              href={o.stripeDashboardUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block rounded-md px-2 py-1.5 hover:bg-[#f5f5f7]"
                            >
                              Atvērt Stripe
                            </a>
                            <button
                              type="button"
                              className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-[#f5f5f7]"
                              onClick={() => void hide(o)}
                            >
                              Paslēpt
                            </button>
                          </div>
                        </details>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AdminMobileSheet open={Boolean(menuRow)} title="Darbības" onClose={() => setMenuId(null)}>
        {menuRow ? (
          <div className="space-y-2">
            <button
              type="button"
              disabled={!menuRow.paymentPublicUrl}
              className="am-press flex h-[50px] w-full items-center rounded-[18px] bg-[var(--fill-secondary)] px-4 text-[16px] text-[var(--label)] disabled:opacity-40"
              onClick={() => {
                void copyLink(menuRow.paymentPublicUrl);
                setMenuId(null);
              }}
            >
              Kopēt saiti
            </button>
            <a
              href={menuRow.stripeDashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="am-press flex h-[50px] w-full items-center rounded-[18px] bg-[var(--fill-secondary)] px-4 text-[16px] text-[var(--label)]"
              onClick={() => setMenuId(null)}
            >
              Atvērt Stripe
            </a>
            <button
              type="button"
              className="am-press flex h-[50px] w-full items-center rounded-[18px] bg-[var(--fill-secondary)] px-4 text-[16px] text-[var(--label)]"
              onClick={() => void hide(menuRow)}
            >
              Paslēpt
            </button>
          </div>
        ) : null}
      </AdminMobileSheet>

      {preview ? (
        <AdminBodyPortal>
          <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
            <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl sm:p-5">
              <p className="text-[15px] font-semibold text-[#1d1d1f]">Atgādinājums</p>
              <p className="mt-1 text-[13px] text-[#8e8e93]">
                Kam: {to}
                {attemptCount > 1 ? ` · ${attemptCount} mēģinājumi` : ""}
              </p>
              {loadingPreview ? (
                <p className="mt-4 flex items-center gap-2 text-[13px] text-[#8e8e93]">
                  <Loader2 className="h-4 w-4 animate-spin" /> Ielādē…
                </p>
              ) : (
                <>
                  <label className="mt-3 mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93]">
                    Temats
                  </label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] px-3 text-[13px] text-[#1d1d1f] outline-none focus:border-[#1d1d1f] focus:bg-white"
                  />
                  <label className="mt-3 mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93]">
                    Teksts
                  </label>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={12}
                    className="w-full rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] px-3 py-2 text-[13px] leading-relaxed text-[#1d1d1f] outline-none focus:border-[#1d1d1f] focus:bg-white"
                  />
                  <p className="mt-2 text-[12px] text-[#8e8e93]">
                    Saite: nosūtot tiks izveidota jauna 72 h pasūtījuma saite (provin.lv/apmaksa/…), kas ved uz
                    /lv/pasutit, nevis beigušos Stripe sesiju.
                  </p>
                </>
              )}
              {error ? <p className="mt-2 text-[13px] text-red-600">{error}</p> : null}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="inline-flex h-8 items-center rounded-lg px-3 text-[13px] text-[#3a3a3c]"
                  onClick={() => setPreview(null)}
                  disabled={sending}
                >
                  Atcelt
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 items-center rounded-lg bg-[#1d1d1f] px-3 text-[13px] font-semibold text-white disabled:opacity-40"
                  onClick={() => void send()}
                  disabled={sending || loadingPreview || !preview.remindable}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sūtīt"}
                </button>
              </div>
            </div>
          </div>
        </AdminBodyPortal>
      ) : null}
    </>
  );
}
