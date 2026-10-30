"use client";

import { useEffect, useState } from "react";
import { ROUTE_TEMPLATE_TYPE_LV, ROUTE_TEMPLATE_TYPES, type CargoRouteTemplate, type RouteTemplateType } from "@/lib/iriss-logistics-cargo-plan";

export function IrissLogistikaRouteTemplatesPanel() {
  const [items, setItems] = useState<CargoRouteTemplate[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [type, setType] = useState<RouteTemplateType>("other");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const res = await fetch("/api/admin/iriss-logistics/route-templates", { credentials: "include", cache: "no-store" });
    const body = (await res.json()) as { templates?: CargoRouteTemplate[] };
    setItems(body.templates ?? []);
  }

  useEffect(() => {
    void reload();
  }, []);

  async function add() {
    if (!name.trim() || !address.trim()) return;
    setBusy(true);
    const res = await fetch("/api/admin/iriss-logistics/route-templates", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, address, type }),
    });
    const body = (await res.json()) as { notice?: string; template?: CargoRouteTemplate };
    setBusy(false);
    if (!res.ok) {
      setNotice(body.notice || "Šablonu neizdevās saglabāt.");
      return;
    }
    setName("");
    setAddress("");
    setNotice("");
    await reload();
  }

  return (
    <section id="iriss-log-route-templates" className="rounded-[14px] bg-white p-4">
      <h2 className="text-[15px] font-semibold">Maršruta šabloni</h2>
      <p className="mt-1 text-[13px] text-[var(--iriss-ink-2)]">
        Ģeokodē vienreiz. Maršrutā izmanto saglabātās koordinātes. Osta, robeža vai cits punkts.
      </p>
      <ul className="mt-3 divide-y divide-[var(--iriss-log-line)]">
        {items.map((tpl) => (
          <li key={tpl.id} className="flex items-start gap-2 py-2">
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold">{tpl.name}</span>
              <span className="block text-[12px] text-[var(--iriss-ink-2)]">
                {tpl.address} · {ROUTE_TEMPLATE_TYPE_LV[tpl.type]}
              </span>
            </span>
            <button
              type="button"
              className="iriss-log-btn-sec h-8 px-2.5 text-[12px]"
              onClick={async () => {
                await fetch(`/api/admin/iriss-logistics/route-templates/${encodeURIComponent(tpl.id)}`, {
                  method: "DELETE",
                  credentials: "include",
                });
                await reload();
              }}
            >
              Dzēst
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_8rem_auto]">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nosaukums" className="h-10 rounded-[10px] border border-[var(--iriss-log-line)] px-3 text-[13px]" />
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Adrese" className="h-10 rounded-[10px] border border-[var(--iriss-log-line)] px-3 text-[13px]" />
        <select value={type} onChange={(e) => setType(e.target.value as RouteTemplateType)} className="h-10 rounded-[10px] border border-[var(--iriss-log-line)] px-2 text-[13px]">
          {ROUTE_TEMPLATE_TYPES.map((t) => (
            <option key={t} value={t}>
              {ROUTE_TEMPLATE_TYPE_LV[t]}
            </option>
          ))}
        </select>
        <button type="button" className="iriss-log-btn-dark" disabled={busy} onClick={() => void add()}>
          {busy ? "Saglabā..." : "Pievienot"}
        </button>
      </div>
      {notice ? <p className="mt-2 text-[12px] text-[var(--iriss-log-bad)]">{notice}</p> : null}
    </section>
  );
}
