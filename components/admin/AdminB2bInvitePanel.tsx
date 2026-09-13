"use client";

import { useState } from "react";

type InviteRow = {
  token: string;
  createdAt: string;
  expiresAt: string;
  path: string;
};

export function AdminB2bInvitePanel() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastPath, setLastPath] = useState("");
  const [copied, setCopied] = useState(false);

  const createInvite = async () => {
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const res = await fetch("/api/admin/partners/invites", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string; invite?: InviteRow };
      if (!res.ok || !data.invite?.path) {
        setError("Neizdevās izveidot ielūgumu.");
        return;
      }
      const absolute =
        typeof window !== "undefined" ? `${window.location.origin}/lv${data.invite.path}` : data.invite.path;
      setLastPath(absolute);
    } catch {
      setError("Neizdevās izveidot ielūgumu.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!lastPath) return;
    try {
      await navigator.clipboard.writeText(lastPath);
      setCopied(true);
    } catch {
      setError("Neizdevās nokopēt saiti.");
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_2px_24px_rgba(15,23,42,0.05)]">
      <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">Ielūguma saite</h2>
      <p className="mt-1 text-[13px] text-[var(--color-provin-muted)]">
        Partneris reģistrējas pats pa unikālo saiti. Publiska reģistrācija paliek slēgta. Saite derīga 14 dienas.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void createInvite()}
          className="inline-flex rounded-full bg-[var(--color-provin-accent)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--color-provin-accent-hover)] disabled:opacity-50"
        >
          {busy ? "Veido…" : "Izveidot ielūgumu"}
        </button>
        {lastPath ? (
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800"
          >
            {copied ? "Nokopēts" : "Kopēt saiti"}
          </button>
        ) : null}
      </div>
      {lastPath ? (
        <p className="mt-2 break-all font-mono text-[11px] text-[var(--color-apple-text)]">{lastPath}</p>
      ) : null}
      {error ? <p className="mt-2 text-[12px] text-amber-800">{error}</p> : null}
    </div>
  );
}
