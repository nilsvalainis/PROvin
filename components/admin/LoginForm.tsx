"use client";

import { useState } from "react";

type Props = {
  /** Lokālai izstrādei: aizpilda laukus, ja nav .env */
  devPrefill?: { username: string; password: string } | null;
};

export function LoginForm({ devPrefill = null }: Props) {
  const [username, setUsername] = useState(devPrefill?.username ?? "");
  const [password, setPassword] = useState(devPrefill?.password ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Neizdevās pieteikties");
        return;
      }
      window.location.href = "/admin";
    } catch {
      setError("Tīkla kļūda");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label htmlFor="admin-username" className="mb-2 block text-sm font-medium text-[var(--color-apple-text)]">
          Lietotājvārds
        </label>
        <input
          id="admin-username"
          name="username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[16px] text-[var(--color-apple-text)] shadow-sm outline-none ring-0 transition focus:border-[var(--color-provin-accent)] focus:ring-2 focus:ring-[var(--color-provin-accent)]/25"
          required
        />
      </div>
      <div>
        <label htmlFor="admin-password" className="mb-2 block text-sm font-medium text-[var(--color-apple-text)]">
          Parole
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[16px] text-[var(--color-apple-text)] shadow-sm outline-none ring-0 transition focus:border-[var(--color-provin-accent)] focus:ring-2 focus:ring-[var(--color-provin-accent)]/25"
          required
        />
      </div>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="provin-btn w-full rounded-full px-6 py-3.5 text-[16px] font-medium disabled:opacity-60"
      >
        {loading ? "Pārbauda…" : "Pieteikties"}
      </button>
    </form>
  );
}
