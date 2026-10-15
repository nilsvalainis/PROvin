"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { B2B_DEMO_APP_PREFIX } from "@/lib/b2b-demo-host";
import type { B2bDemoOrder, B2bDemoOrderStatus } from "@/lib/b2b-demo-types";

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-[#F26522] focus:ring-2 focus:ring-[#F26522]/25";

export function B2bDemoOrdersList({ orders }: { orders: B2bDemoOrder[] }) {
  if (orders.length === 0) {
    return <p className="text-sm text-slate-500">Šim dīlerim vēl nav pasūtījumu. Citu tenantu dati šeit nav redzami.</p>;
  }
  return (
    <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
      {orders.map((row) => (
        <li key={row.orderId}>
          <Link href={`${B2B_DEMO_APP_PREFIX}/pasutijumi/${row.orderId}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
            <span>
              <span className="block font-medium">{row.brandModel || "Bez modeļa"}</span>
              <span className="text-sm text-slate-500">{row.clientName || "Bez klienta"}{row.vin ? ` · ${row.vin}` : ""}</span>
            </span>
            <span className="text-xs uppercase text-slate-500">{row.status}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function B2bDemoOrderForm({
  initial,
  mode,
}: {
  initial?: B2bDemoOrder;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [clientName, setClientName] = useState(initial?.clientName ?? "");
  const [brandModel, setBrandModel] = useState(initial?.brandModel ?? "");
  const [vin, setVin] = useState(initial?.vin ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [status, setStatus] = useState<B2bDemoOrderStatus>(initial?.status ?? "active");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const url =
        mode === "create"
          ? "/api/b2b-demo/orders"
          : `/api/b2b-demo/orders/${encodeURIComponent(initial!.orderId)}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, brandModel, vin, note, status }),
      });
      const data = (await res.json()) as { error?: string; order?: B2bDemoOrder };
      if (!res.ok || !data.order) {
        setError(data.error ?? "Neizdevās saglabāt.");
        return;
      }
      router.push(`${B2B_DEMO_APP_PREFIX}/pasutijumi/${data.order.orderId}`);
      router.refresh();
    } catch {
      setError("Tīkla kļūda.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
      <label className="block text-sm font-medium">
        Klients
        <input className={`${fieldClass} mt-1`} value={clientName} onChange={(e) => setClientName(e.target.value)} />
      </label>
      <label className="block text-sm font-medium">
        Marka / modelis
        <input className={`${fieldClass} mt-1`} value={brandModel} onChange={(e) => setBrandModel(e.target.value)} />
      </label>
      <label className="block text-sm font-medium">
        VIN
        <input className={`${fieldClass} mt-1`} value={vin} onChange={(e) => setVin(e.target.value)} />
      </label>
      <label className="block text-sm font-medium">
        Piezīme
        <textarea className={`${fieldClass} mt-1 min-h-24`} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <label className="block text-sm font-medium">
        Statuss
        <select className={`${fieldClass} mt-1`} value={status} onChange={(e) => setStatus(e.target.value as B2bDemoOrderStatus)}>
          <option value="active">Aktīvs</option>
          <option value="completed">Pabeigts</option>
          <option value="inactive">Neaktīvs</option>
        </select>
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button type="submit" disabled={loading} className="rounded-xl bg-[#F26522] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        {loading ? "Saglabā…" : "Saglabāt"}
      </button>
    </form>
  );
}
