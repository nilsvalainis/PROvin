"use client";

import { useState } from "react";
import type { AutoparksLinkAction } from "@/lib/iriss-autoparks-transit";

const KIND_LV: Record<AutoparksLinkAction["kind"], string> = {
  linked: "jau sasaistīts",
  link_vin: "sasaistīt ar esošu auto (VIN)",
  create: "izveidot Autoparkā «Ceļā»",
};

/**
 * Migrācija (Nils 27.10): aktīvie Loģistikas auto -> Autoparks posms «Ceļā». Vispirms plāns (nekas netiek rakstīts),
 * tad poga ar apstiprinājumu. Tikai administratoram (API to pārbauda arī pats).
 */
export function IrissLogistikaAutoparksLink() {
  const [plan, setPlan] = useState<AutoparksLinkAction[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const todo = (plan ?? []).filter((p) => p.kind !== "linked");

  async function check() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin/iriss-logistics/autoparks/sasaiste", { credentials: "include", cache: "no-store" }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { plan?: AutoparksLinkAction[] } | null;
    setBusy(false);
    if (!res?.ok || !data?.plan) return setMsg("Neizdevās nolasīt.");
    setPlan(data.plan);
  }

  async function apply() {
    if (!window.confirm(`Sasaistīt ${todo.length} auto ar Autoparku? Jaunie auto būs ar statusu «Ceļā».`)) return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin/iriss-logistics/autoparks/sasaiste", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apply: true }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { linked?: number; created?: number; plan?: AutoparksLinkAction[] } | null;
    setBusy(false);
    if (!res?.ok || !data) return setMsg("Neizdevās sasaistīt.");
    setPlan(data.plan ?? null);
    setMsg(`Gatavs: izveidoti ${data.created ?? 0}, sasaistīti ${data.linked ?? 0}.`);
  }

  return (
    <section className="rounded-[14px] bg-white p-4" aria-labelledby="iriss-log-ap-link">
      <h2 id="iriss-log-ap-link" className="text-[15px] font-semibold">
        Autoparka sasaiste
      </h2>
      <p className="mt-1 text-[13px] text-[var(--iriss-ink-2)]">
        Aktīvie Loģistikas auto kļūst par Autoparka auto ar statusu «Ceļā». Vispirms pārbaude - nekas netiek mainīts.
      </p>
      {plan ? (
        <ul className="mt-3 divide-y divide-[var(--iriss-log-line)] text-[13.5px]">
          {plan.map((p) => (
            <li key={p.orderId} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 truncate font-medium">{p.title}</span>
              <span className="shrink-0 text-[var(--iriss-ink-2)]">{KIND_LV[p.kind]}</span>
            </li>
          ))}
          {plan.length === 0 ? <li className="py-2 text-[var(--iriss-ink-2)]">Nav aktīvu Loģistikas auto.</li> : null}
        </ul>
      ) : null}
      {msg ? (
        <p className="mt-2 text-[13px] font-medium" role="status">
          {msg}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="iriss-btn iriss-btn--secondary iriss-btn--sm" disabled={busy} onClick={() => void check()}>
          Pārbaudīt
        </button>
        {plan && todo.length > 0 ? (
          <button type="button" className="iriss-btn iriss-btn--primary iriss-btn--sm" disabled={busy} onClick={() => void apply()}>
            Sasaistīt {todo.length} auto
          </button>
        ) : null}
      </div>
    </section>
  );
}
