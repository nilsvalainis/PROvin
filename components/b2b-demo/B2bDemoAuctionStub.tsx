"use client";

import { useState } from "react";
import type { B2bDemoAuctionPlatform, B2bDemoAuctionSessionStatus } from "@/lib/b2b-demo-types";

export function B2bDemoAuctionStub({ items }: { items: B2bDemoAuctionSessionStatus[] }) {
  const [rows, setRows] = useState(items);
  const [platform, setPlatform] = useState<B2bDemoAuctionPlatform>("openlane");
  const [sessionBlob, setSessionBlob] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/b2b-demo/auction-sessions", { credentials: "include", cache: "no-store" });
    const data = (await res.json()) as { items?: B2bDemoAuctionSessionStatus[]; error?: string };
    if (data.items) setRows(data.items);
  }

  async function save() {
    setError(null);
    setNote(null);
    const res = await fetch("/api/b2b-demo/auction-sessions", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, sessionBlob }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Neizdevās saglabāt sesiju.");
      return;
    }
    setSessionBlob("");
    setNote("Šifrētā sesija saglabāta tikai šim dīlerim. Parole netika pieņemta.");
    await refresh();
  }

  async function clear(p: B2bDemoAuctionPlatform) {
    setError(null);
    await fetch(`/api/b2b-demo/auction-sessions?platform=${p}`, { method: "DELETE", credentials: "include" });
    await refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-slate-600">
        Paroles netiek glabātas. Dīleris pats ielogojas izolētā pārlūka profilā. Mēs pieņemam tikai necaurspīdīgu
        sessionBlob un glabājam to šifrētu ar tenant atslēgu. ĪRISS releja sesijas šim produktam nav pieejamas.
        Nolasišana / scraping vēl nav ieviesta.
      </p>
      <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
        {rows.map((row) => (
          <li key={row.platform} className="flex items-center justify-between px-4 py-3">
            <span>
              <span className="block font-medium uppercase">{row.platform}</span>
              <span className="text-sm text-slate-500">
                {row.connected ? `Pieslēgts${row.updatedAt ? ` · ${row.updatedAt}` : ""}` : "Nav sesijas"}
              </span>
            </span>
            {row.connected ? (
              <button type="button" className="text-sm text-slate-500 hover:text-black" onClick={() => void clear(row.platform)}>
                Dzēst
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="space-y-3 rounded-2xl border border-dashed border-slate-300 bg-white p-4">
        <p className="text-sm font-medium">Stubs: saglabāt šifrētu sesiju (ne paroli)</p>
        <select
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
          value={platform}
          onChange={(e) => setPlatform(e.target.value as B2bDemoAuctionPlatform)}
        >
          <option value="openlane">Openlane</option>
          <option value="auto1">Auto1</option>
          <option value="autobid">Autobid</option>
        </select>
        <textarea
          className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5"
          placeholder="sessionBlob (sīkdatnes / tokens, ne parole)"
          value={sessionBlob}
          onChange={(e) => setSessionBlob(e.target.value)}
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {note ? <p className="text-sm text-emerald-700">{note}</p> : null}
        <button type="button" onClick={() => void save()} className="rounded-xl bg-[#F26522] px-4 py-2.5 text-sm font-semibold text-white">
          Šifrēt un saglabāt
        </button>
      </div>
    </div>
  );
}
