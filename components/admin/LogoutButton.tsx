"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export function LogoutButton() {
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      window.location.href = "/admin/login";
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void logout()}
      className="inline-flex w-full touch-manipulation select-none items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm font-medium text-[var(--color-provin-muted)] transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-[var(--color-apple-text)] active:scale-[0.98] active:opacity-90 disabled:opacity-70 md:text-center"
      aria-busy={busy}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" strokeWidth={2.2} aria-hidden />
      ) : null}
      <span>{busy ? "Iziet…" : "Iziet"}</span>
    </button>
  );
}
