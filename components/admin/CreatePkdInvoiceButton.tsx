"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreatePkdInvoiceButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function createInvoice() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/pkd-commission-invoice/create", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || typeof j.id !== "string") {
        const base = typeof j.error === "string" ? j.error : `Kļūda ${r.status}`;
        const detail = typeof j.detail === "string" ? j.detail : "";
        setErr(detail ? `${base}: ${detail}` : base);
        return;
      }
      router.push(`/admin/commission-invoice/${encodeURIComponent(j.id)}`);
      router.refresh();
    } catch {
      setErr("Neizdevās izveidot jaunu rēķinu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={createInvoice}
        disabled={busy}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--color-provin-accent)] px-5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50"
      >
        {busy ? "Veido..." : "Izveidot jaunu rēķinu"}
      </button>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
    </div>
  );
}
