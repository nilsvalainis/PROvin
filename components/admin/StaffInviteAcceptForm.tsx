"use client";

import { useState } from "react";

export function StaffInviteAcceptForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/staff/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Neizdevās iestatīt paroli.");
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="text-sm text-[#4b5563]">
        Parole iestatīta. Tagad vari{" "}
        <a className="text-[#3d5bd9] underline" href="/admin/login">
          pieteikties
        </a>{" "}
        ar e-pastu.
      </p>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <label className="block text-sm">
        Jauna parole (vismaz 12 zīmes)
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={12}
          required
          className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-[16px]"
        />
      </label>
      {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-[#111827] px-4 py-3 text-[15px] font-medium text-white disabled:opacity-60"
      >
        Iestatīt paroli
      </button>
    </form>
  );
}
