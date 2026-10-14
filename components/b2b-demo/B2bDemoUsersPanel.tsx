"use client";

import { useState } from "react";
import type { B2bDemoUserPublic } from "@/lib/b2b-demo-types";

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-[#F26522] focus:ring-2 focus:ring-[#F26522]/25";

export function B2bDemoUsersPanel({ users }: { users: B2bDemoUserPublic[] }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState(users);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/b2b-demo/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password }),
      });
      const data = (await res.json()) as { error?: string; user?: B2bDemoUserPublic };
      if (!res.ok || !data.user) {
        setError(data.error ?? "Neizdevās pievienot.");
        return;
      }
      setList((prev) => [...prev, data.user!].sort((a, b) => a.email.localeCompare(b.email, "lv")));
      setEmail("");
      setName("");
      setPassword("");
    } catch {
      setError("Tīkla kļūda.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
        {list.map((u) => (
          <li key={u.userId} className="flex items-center justify-between px-4 py-3">
            <span>
              <span className="block font-medium">{u.name}</span>
              <span className="text-sm text-slate-500">{u.email}</span>
            </span>
            <span className="text-xs uppercase text-slate-500">{u.role === "owner" ? "īpašnieks" : "darbinieks"}</span>
          </li>
        ))}
      </ul>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold">Pievienot darbinieku</h2>
        <input className={fieldClass} placeholder="Vārds" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={fieldClass} type="email" placeholder="E-pasts" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className={fieldClass} type="password" placeholder="Parole (min. 8)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button type="submit" disabled={loading} className="rounded-xl bg-[#F26522] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {loading ? "Pievieno…" : "Pievienot"}
        </button>
      </form>
    </div>
  );
}
