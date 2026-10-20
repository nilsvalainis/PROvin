"use client";

import { useCallback, useMemo, useState } from "react";
import { logisticsAuctionSourceEnabledCount } from "@/lib/iriss-logistics-auction-sources";
import type { LogisticsAuctionSource } from "@/lib/iriss-logistics-types";

type Props = {
  initialSources: LogisticsAuctionSource[];
  compact?: boolean;
};

export function IrissLogistikaAuctionSourcesPanel({ initialSources, compact }: Props) {
  const [sources, setSources] = useState(initialSources);
  const [draftName, setDraftName] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const enabledCount = useMemo(() => logisticsAuctionSourceEnabledCount(sources), [sources]);

  const patchSource = useCallback(async (id: string, body: Record<string, unknown>) => {
    setBusyId(id);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/iriss-logistics/auction-sources/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { source?: LogisticsAuctionSource; error?: string };
      if (!res.ok || !json.source) {
        setMsg(json.error === "not_found" ? "Avots nav atrasts." : "Saglabāšana neizdevās.");
        return;
      }
      setSources((prev) => prev.map((s) => (s.id === id ? json.source! : s)));
    } catch {
      setMsg("Saglabāšana neizdevās.");
    } finally {
      setBusyId(null);
    }
  }, []);

  async function addSource() {
    const name = draftName.trim();
    if (!name) {
      setMsg("Norādi izsoles nosaukumu.");
      return;
    }
    setBusyId("new");
    setMsg("");
    try {
      const res = await fetch("/api/admin/iriss-logistics/auction-sources", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url: draftUrl, enabled: true }),
      });
      const json = (await res.json()) as { source?: LogisticsAuctionSource; error?: string };
      if (!res.ok || !json.source) {
        setMsg(json.error === "name_required" ? "Norādi izsoles nosaukumu." : "Neizdevās pievienot avotu.");
        return;
      }
      setSources((prev) => [...prev, json.source!]);
      setDraftName("");
      setDraftUrl("");
    } catch {
      setMsg("Neizdevās pievienot avotu.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeSource(id: string) {
    setBusyId(id);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/iriss-logistics/auction-sources/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        setMsg("Iebūvēto avotu nevar dzēst. Izslēdz to.");
        return;
      }
      setSources((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setMsg("Neizdevās dzēst avotu.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className={compact ? "" : "rounded-2xl bg-white p-4 shadow-sm"}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Izsoļu avoti</h2>
          <p className="mt-1 text-[13px] leading-snug text-[var(--ink2,#6b7280)]">
            Pirkumu / pasūtījumu saite un filtri katrai izsolei. Jaunus avotus var pievienot šeit, bez koda. Nav
            maksas API. Copart.de pēc noklusējuma ir izslēgts.
          </p>
        </div>
        <p className="text-[12px] tabular-nums text-[var(--ink3,#9a9faa)]">
          {enabledCount} ieslēgti · {sources.length}
        </p>
      </div>

      <ul className="mt-3 space-y-2">
        {sources.map((source) => (
          <li
            key={source.id}
            className={`rounded-xl border border-[#e5e7eb] p-3 ${source.enabled ? "bg-white" : "bg-[#f8fafc] opacity-70"}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 text-[13px] font-semibold">
                <input
                  type="checkbox"
                  checked={source.enabled}
                  disabled={busyId === source.id}
                  onChange={(e) => void patchSource(source.id, { enabled: e.target.checked })}
                  aria-label={`${source.name} ieslēgts`}
                />
                <input
                  value={source.name}
                  onChange={(e) =>
                    setSources((prev) => prev.map((s) => (s.id === source.id ? { ...s, name: e.target.value } : s)))
                  }
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name) void patchSource(source.id, { name });
                  }}
                  className="min-w-[8rem] flex-1 bg-transparent text-[13.5px] font-semibold outline-none"
                />
              </label>
              {source.url ? (
                <a href={source.url} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-[var(--acc,#3d5bd9)]">
                  Atvērt
                </a>
              ) : null}
              {!source.builtin ? (
                <button
                  type="button"
                  className="ml-auto text-[12px] text-[#9a9faa]"
                  onClick={() => void removeSource(source.id)}
                >
                  Dzēst
                </button>
              ) : (
                <span className="ml-auto text-[11px] text-[#9a9faa]">{source.enabled ? "aktīvs" : "izslēgts"}</span>
              )}
            </div>
            <label className="mt-2 block text-[11px] font-medium text-[#6b7280]">
              Saite (pirkumi / pasūtījumi)
              <input
                value={source.url}
                onChange={(e) =>
                  setSources((prev) => prev.map((s) => (s.id === source.id ? { ...s, url: e.target.value } : s)))
                }
                onBlur={(e) => void patchSource(source.id, { url: e.target.value })}
                placeholder="https://..."
                className="mt-1 h-9 w-full rounded-lg border border-[#e5e7eb] px-2.5 text-[13px]"
              />
            </label>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <label className="block text-[11px] font-medium text-[#6b7280]">
                Konts
                <input
                  value={source.filters.account}
                  onChange={(e) =>
                    setSources((prev) =>
                      prev.map((s) =>
                        s.id === source.id ? { ...s, filters: { ...s.filters, account: e.target.value } } : s,
                      ),
                    )
                  }
                  onBlur={() => void patchSource(source.id, { filters: source.filters })}
                  placeholder="konts / dīleris"
                  className="mt-1 h-9 w-full rounded-lg border border-[#e5e7eb] px-2.5 text-[13px]"
                />
              </label>
              <label className="block text-[11px] font-medium text-[#6b7280]">
                Statuss
                <input
                  value={source.filters.status}
                  onChange={(e) =>
                    setSources((prev) =>
                      prev.map((s) =>
                        s.id === source.id ? { ...s, filters: { ...s.filters, status: e.target.value } } : s,
                      ),
                    )
                  }
                  onBlur={() => void patchSource(source.id, { filters: source.filters })}
                  placeholder="won, my orders"
                  className="mt-1 h-9 w-full rounded-lg border border-[#e5e7eb] px-2.5 text-[13px]"
                />
              </label>
              <label className="block text-[11px] font-medium text-[#6b7280]">
                Atslēgvārdi
                <input
                  value={source.filters.keywords}
                  onChange={(e) =>
                    setSources((prev) =>
                      prev.map((s) =>
                        s.id === source.id ? { ...s, filters: { ...s.filters, keywords: e.target.value } } : s,
                      ),
                    )
                  }
                  onBlur={() => void patchSource(source.id, { filters: source.filters })}
                  placeholder="transporter, VIN"
                  className="mt-1 h-9 w-full rounded-lg border border-[#e5e7eb] px-2.5 text-[13px]"
                />
              </label>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 rounded-xl border border-dashed border-[#d1d5db] p-3">
        <p className="text-[12px] font-semibold">+ Jauns avots</p>
        <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,12rem)_1fr_auto]">
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Nosaukums (piem. BCA)"
            className="h-9 rounded-lg border border-[#e5e7eb] px-2.5 text-[13px]"
          />
          <input
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            placeholder="Pirkumu / pasūtījumu saite"
            className="h-9 rounded-lg border border-[#e5e7eb] px-2.5 text-[13px]"
          />
          <button
            type="button"
            onClick={() => void addSource()}
            disabled={busyId === "new"}
            className="h-9 rounded-lg bg-[var(--ink,#111)] px-3 text-[12.5px] font-semibold text-white"
          >
            Pievienot
          </button>
        </div>
      </div>
      {msg ? <p className="mt-2 text-[12px] text-[var(--bad,#c0392b)]">{msg}</p> : null}
    </section>
  );
}
