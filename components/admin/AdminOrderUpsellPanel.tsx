"use client";

import { useCallback, useEffect, useState } from "react";
import { openWhatsAppChat } from "@/lib/admin-whatsapp-phone";
import type { OrderUpsellKind } from "@/lib/order-upsell";

type Quote = {
  kind: OrderUpsellKind;
  label: string;
  chargeCents: number;
  priorCents: number;
  targetCents: number;
};

type Applied = {
  badge: string;
  targetCents: number;
} | null;

type Draft = {
  kind: OrderUpsellKind;
  url: string;
  email: string;
  phone: string;
  subject: string;
  emailText: string;
  whatsappText: string;
};

const btn =
  "rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

export function AdminOrderUpsellPanel({
  sessionId,
  placement,
}: {
  sessionId: string;
  placement: "dealer" | "mini";
}) {
  const [available, setAvailable] = useState<Quote[]>([]);
  const [applied, setApplied] = useState<Applied>(null);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/order-upsell?sessionId=${encodeURIComponent(sessionId)}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { available?: Quote[]; applied?: Applied };
      setAvailable(Array.isArray(data.available) ? data.available : []);
      setApplied(data.applied ?? null);
    } catch {
      /* josla nav kritiska */
    } finally {
      setLoaded(true);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const quotes =
    placement === "dealer"
      ? available.filter((q) => q.kind === "dealer_to_audit")
      : available.filter((q) => q.kind === "mini_to_dealer" || q.kind === "mini_to_audit");
  const showApplied =
    placement === "dealer"
      ? Boolean(applied && !applied.badge.startsWith("Dīleris"))
      : Boolean(applied);

  if (!loaded || (quotes.length === 0 && !showApplied)) return null;

  async function openDraft(kind: OrderUpsellKind) {
    setBusy(kind);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/order-upsell", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, kind }),
      });
      const data = (await res.json().catch(() => ({}))) as Draft & { error?: string };
      if (!res.ok) {
        setNotice("Piedāvājumu neizdevās sagatavot.");
        return;
      }
      setDraft({
        kind,
        url: data.url,
        email: data.email ?? "",
        phone: data.phone ?? "",
        subject: data.subject ?? "",
        emailText: data.emailText ?? "",
        whatsappText: data.whatsappText ?? "",
      });
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
      const res = await fetch("/api/admin/order-upsell/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          kind: draft.kind,
          to: draft.email,
          subject: draft.subject,
          text: draft.emailText,
        }),
      });
      if (!res.ok) {
        setNotice("E-pastu neizdevās nosūtīt.");
        return;
      }
      setNotice("E-pasts nosūtīts.");
      setDraft(null);
    } catch {
      setNotice("Tīkla kļūda.");
    } finally {
      setBusy(null);
    }
  }

  async function mark(kind: OrderUpsellKind, label: string) {
    if (!window.confirm(`Atzīmēt piepirkumu bez saites?\n${label}\nPasūtījums kļūs neizpildīts ar jaunām 48 h.`)) {
      return;
    }
    setBusy(`mark:${kind}`);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/order-upsell/mark", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, kind }),
      });
      if (!res.ok) {
        setNotice("Piepirkumu neizdevās atzīmēt.");
        return;
      }
      setNotice("Piepirkums atzīmēts. Pasūtījums ir neizpildīts, 48 h no šī brīža.");
      await load();
    } catch {
      setNotice("Tīkla kļūda.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mb-2 rounded-lg border border-sky-200/90 bg-sky-50/50 px-2 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-sky-800">Piepirkums esošajam pasūtījumam</p>
      {showApplied && applied ? (
        <p className="mt-1 text-[11px] text-sky-950">{applied.badge}. Iepriekš ievadītie dati paliek.</p>
      ) : null}
      {quotes.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {quotes.map((q) => (
            <span key={q.kind} className="inline-flex flex-wrap gap-1">
              <button type="button" className={btn} disabled={busy !== null} onClick={() => void openDraft(q.kind)}>
                {busy === q.kind ? "Gatavo…" : q.label}
              </button>
              <button
                type="button"
                className={btn}
                disabled={busy !== null}
                onClick={() => void mark(q.kind, q.label)}
              >
                Atzīmēt bez saites
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {notice ? <p className="mt-1 text-[11px] text-sky-950">{notice}</p> : null}

      {draft ? (
        <div className="mt-2 space-y-2 rounded-md border border-sky-200 bg-white p-2">
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
            <button type="button" className={btn} disabled={busy !== null || !draft.email} onClick={() => void sendEmail()}>
              {busy === "send" ? "Sūta…" : "Nosūtīt e-pastu"}
            </button>
            <button
              type="button"
              className={btn}
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
            <button type="button" className={btn} onClick={() => setDraft(null)}>
              Aizvērt
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
