"use client";

import { ADMIN_PRO_TONE } from "@/lib/admin-pro-tones";
import { useCallback, useEffect, useState } from "react";
import { openWhatsAppChat } from "@/lib/admin-whatsapp-phone";
import { formatManualOrderPayAmount, parseManualOrderPayAmountToCents } from "@/lib/manual-order-payment";

type Prefill = {
  email: string;
  phone: string;
  customerName: string;
  amountCents: number | null;
  serviceName: string;
  paid: boolean;
  paidAt: string | null;
  paidStripeSessionId: string | null;
  checkoutUrl: string | null;
};

type Draft = {
  url: string;
  email: string;
  phone: string;
  subject: string;
  emailText: string;
  whatsappText: string;
};

const btn =
  "rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

function amountInputFromCents(cents: number | null): string {
  if (cents == null || !Number.isFinite(cents) || cents <= 0) return "";
  return formatManualOrderPayAmount(cents).replace(" €", "");
}

function replacePayUrl(text: string, prev: string, next: string): string {
  if (prev && text.includes(prev)) return text.split(prev).join(next);
  return text;
}

export function AdminManualOrderPaymentPanel({ sessionId }: { sessionId: string }) {
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [amountText, setAmountText] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/manual-orders/checkout?sessionId=${encodeURIComponent(sessionId)}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as Partial<Prefill>;
      const next: Prefill = {
        email: typeof data.email === "string" ? data.email : "",
        phone: typeof data.phone === "string" ? data.phone : "",
        customerName: typeof data.customerName === "string" ? data.customerName : "",
        amountCents: typeof data.amountCents === "number" ? data.amountCents : null,
        serviceName: typeof data.serviceName === "string" ? data.serviceName : "PROVIN AUDITS",
        paid: data.paid === true,
        paidAt: typeof data.paidAt === "string" ? data.paidAt : null,
        paidStripeSessionId: typeof data.paidStripeSessionId === "string" ? data.paidStripeSessionId : null,
        checkoutUrl: typeof data.checkoutUrl === "string" ? data.checkoutUrl : null,
      };
      setPrefill(next);
      setAmountText((prev) => prev || amountInputFromCents(next.amountCents));
      setServiceName((prev) => prev || next.serviceName);
    } catch {
      /* josla nav kritiska */
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createLink() {
    const amountCents = parseManualOrderPayAmountToCents(amountText);
    const name = serviceName.trim();
    if (amountCents == null || !name) {
      setNotice("Ievadi summu (EUR) un pakalpojuma nosaukumu.");
      return;
    }
    setBusy("create");
    setNotice(null);
    try {
      const res = await fetch("/api/admin/manual-orders/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          amountCents,
          serviceName: name,
          email: draft?.email || prefill?.email || "",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Draft & { error?: string };
      if (!res.ok) {
        if (data.error === "already_paid") {
          setNotice("Šis pasūtījums jau ir apmaksāts.");
          await load();
        } else if (data.error === "missing_amount" || data.error === "invalid_amount") {
          setNotice("Summa nav derīga. Ievadi pozitīvu EUR summu.");
        } else if (data.error === "missing_name" || data.error === "invalid_name") {
          setNotice("Pakalpojuma nosaukums ir obligāts.");
        } else if (data.error === "stripe_config") {
          setNotice("Stripe nav iestatīts. Apmaksas saiti nevar izveidot.");
        } else {
          setNotice("Apmaksas saiti neizdevās izveidot.");
        }
        return;
      }
      setDraft({
        url: data.url,
        email: data.email || prefill?.email || "",
        phone: data.phone || prefill?.phone || "",
        subject: data.subject ?? "",
        emailText: data.emailText ?? "",
        whatsappText: data.whatsappText ?? "",
      });
      setNotice("Apmaksas saite gatava. Jauna pasūtījuma rinda netiek veidota.");
    } catch {
      setNotice("Tīkla kļūda.");
    } finally {
      setBusy(null);
    }
  }

  async function sendEmail() {
    if (!draft) return;
    setBusy("send");
    setNotice(null);
    try {
      const res = await fetch("/api/admin/manual-orders/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          to: draft.email,
          subject: draft.subject,
          text: draft.emailText,
          url: draft.url,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (data.error === "invalid_email") {
          setNotice("Nav derīga klienta e-pasta.");
        } else {
          setNotice("E-pastu neizdevās nosūtīt.");
        }
        return;
      }
      setNotice("E-pasts nosūtīts.");
    } catch {
      setNotice("Tīkla kļūda.");
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    const url = draft?.url || prefill?.checkoutUrl;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Saite nokopēta.");
    } catch {
      setNotice("Saiti neizdevās nokopēt.");
    }
  }

  if (!prefill) return null;

  return (
    <section className="mb-2 rounded-lg border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] px-2 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-600">
        Apmaksas pieprasījums
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500">
        Stripe saite esošajam manuālajam pasūtījumam. Pēc apmaksas paliek šis pats id.
      </p>
      {prefill.paid ? (
        <p className="mt-1 text-[11px] text-sky-950">
          Apmaksāts
          {prefill.amountCents != null ? ` ${formatManualOrderPayAmount(prefill.amountCents)}` : ""}
          {prefill.paidAt ? ` · ${prefill.paidAt.slice(0, 10)}` : ""}
          {prefill.paidStripeSessionId ? ` · ${prefill.paidStripeSessionId}` : ""}.
        </p>
      ) : (
        <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
          <label className="block text-[10px] font-medium text-slate-500">
            Summa (EUR)
            <input
              className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-[12px]"
              inputMode="decimal"
              placeholder="99,99"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
            />
          </label>
          <label className="block text-[10px] font-medium text-slate-500 sm:col-span-2">
            Pakalpojuma nosaukums
            <input
              className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-[12px]"
              placeholder="PROVIN AUDITS - Audi A3"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="button"
              className={`${btn} ${ADMIN_PRO_TONE.money}`}
              disabled={busy !== null}
              onClick={() => void createLink()}
            >
              {busy === "create" ? "Gatavo…" : "Izveidot apmaksas saiti"}
            </button>
          </div>
        </div>
      )}
      {notice ? <p className="mt-1 text-[11px] text-sky-950">{notice}</p> : null}

      {draft ? (
        <div className="mt-2 space-y-2 rounded-md border border-sky-200 bg-white p-2">
          <p className="text-[10px] text-slate-500">
            Priekšskatījums. Klientam aiziet tikai pēc pogas „Sūtīt”.
          </p>
          <label className="block text-[10px] font-medium text-slate-500">
            E-pasts
            <input
              className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-[12px]"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          </label>
          <label className="block text-[10px] font-medium text-slate-500">
            Tēma
            <input
              className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-[12px]"
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
            />
          </label>
          <label className="block text-[10px] font-medium text-slate-500">
            Maksājuma saite
            <input
              className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-[12px]"
              value={draft.url}
              onChange={(e) => {
                const next = e.target.value;
                const prev = draft.url;
                setDraft({
                  ...draft,
                  url: next,
                  emailText: replacePayUrl(draft.emailText, prev, next),
                  whatsappText: replacePayUrl(draft.whatsappText, prev, next),
                });
              }}
            />
          </label>
          <label className="block text-[10px] font-medium text-slate-500">
            E-pasta teksts
            <textarea
              className="mt-0.5 min-h-36 w-full rounded border border-slate-200 px-2 py-1 text-[12px] leading-snug"
              value={draft.emailText}
              onChange={(e) => setDraft({ ...draft, emailText: e.target.value })}
            />
          </label>
          <label className="block text-[10px] font-medium text-slate-500">
            WhatsApp teksts
            <textarea
              className="mt-0.5 min-h-28 w-full rounded border border-slate-200 px-2 py-1 text-[12px] leading-snug"
              value={draft.whatsappText}
              onChange={(e) => setDraft({ ...draft, whatsappText: e.target.value })}
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={`${btn} ${ADMIN_PRO_TONE.client}`}
              disabled={busy !== null || !draft.email}
              onClick={() => void sendEmail()}
            >
              {busy === "send" ? "Sūta…" : "Sūtīt"}
            </button>
            <button
              type="button"
              className={`${btn} ${ADMIN_PRO_TONE.client}`}
              disabled={!draft.phone}
              title={draft.phone ? "Atvērt WhatsApp" : "Nav klienta tālruņa"}
              onClick={() => {
                const text = draft.whatsappText.includes(draft.url)
                  ? draft.whatsappText
                  : `${draft.whatsappText.trim()}\n\nApmaksāt: ${draft.url}`;
                openWhatsAppChat(draft.phone, text);
              }}
            >
              Atvērt WhatsApp
            </button>
            <button type="button" className={btn} onClick={() => void copyLink()}>
              Kopēt saiti
            </button>
            <button type="button" className={btn} onClick={() => setDraft(null)}>
              Aizvērt
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
