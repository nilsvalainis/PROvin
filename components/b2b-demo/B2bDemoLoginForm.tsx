"use client";

import { useState } from "react";
import { B2B_DEMO_APP_PREFIX } from "@/lib/b2b-demo-host";

type Props = {
  allowBootstrap: boolean;
  devPrefill?: { email: string; password: string } | null;
};

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[16px] text-[#1d1d1f] shadow-sm outline-none focus:border-[#F26522] focus:ring-2 focus:ring-[#F26522]/25";

export function B2bDemoLoginForm({ allowBootstrap, devPrefill = null }: Props) {
  const [mode, setMode] = useState<"login" | "bootstrap">(allowBootstrap ? "bootstrap" : "login");
  const [email, setEmail] = useState(devPrefill?.email ?? "");
  const [password, setPassword] = useState(devPrefill?.password ?? "");
  const [companyName, setCompanyName] = useState("Demo dīleris");
  const [ownerName, setOwnerName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const url = mode === "bootstrap" ? "/api/b2b-demo/bootstrap" : "/api/b2b-demo/login";
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "bootstrap" ? { email, password, companyName, ownerName } : { email, password },
        ),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Neizdevās pieteikties.");
        return;
      }
      window.location.href = `${B2B_DEMO_APP_PREFIX}/pasutijumi`;
    } catch {
      setError("Tīkla kļūda.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      {allowBootstrap ? (
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            className={mode === "bootstrap" ? "font-semibold text-[#F26522]" : "text-slate-500"}
            onClick={() => setMode("bootstrap")}
          >
            Pirmais dīleris
          </button>
          <button
            type="button"
            className={mode === "login" ? "font-semibold text-[#F26522]" : "text-slate-500"}
            onClick={() => setMode("login")}
          >
            Pieteikties
          </button>
        </div>
      ) : null}
      {mode === "bootstrap" ? (
        <>
          <label className="block text-sm font-medium">
            Uzņēmuma nosaukums
            <input className={`${fieldClass} mt-1`} value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
          </label>
          <label className="block text-sm font-medium">
            Īpašnieka vārds
            <input className={`${fieldClass} mt-1`} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          </label>
        </>
      ) : null}
      <label className="block text-sm font-medium">
        E-pasts
        <input
          className={`${fieldClass} mt-1`}
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label className="block text-sm font-medium">
        Parole
        <input
          className={`${fieldClass} mt-1`}
          type="password"
          autoComplete={mode === "bootstrap" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-[#F26522] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading ? "Gaida…" : mode === "bootstrap" ? "Izveidot dīleri un ieiet" : "Ieiet"}
      </button>
    </form>
  );
}
