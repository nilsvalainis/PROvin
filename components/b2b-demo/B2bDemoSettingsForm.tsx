"use client";

import { useState } from "react";
import type { B2bDemoSettings, B2bDemoVatMode } from "@/lib/b2b-demo-types";

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-[#F26522] focus:ring-2 focus:ring-[#F26522]/25";

type Props = {
  initial: B2bDemoSettings;
  readOnly: boolean;
};

export function B2bDemoSettingsForm({ initial, readOnly }: Props) {
  const [settings, setSettings] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof B2bDemoSettings>(key: K, value: B2bDemoSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/b2b-demo/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = (await res.json()) as { error?: string; settings?: B2bDemoSettings };
      if (!res.ok || !data.settings) {
        setError(data.error ?? "Neizdevās saglabāt.");
        return;
      }
      setSettings(data.settings);
      setSaved(true);
    } catch {
      setError("Tīkla kļūda.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-6">
      <section className="grid gap-3 md:grid-cols-2">
        <h2 className="md:col-span-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Rekvizīti</h2>
        <Field label="Logo URL (https)" value={settings.logoUrl} onChange={(v) => set("logoUrl", v)} readOnly={readOnly} />
        <Field label="Uzņēmums" value={settings.companyName} onChange={(v) => set("companyName", v)} readOnly={readOnly} />
        <Field label="Reģ. nr." value={settings.companyReg} onChange={(v) => set("companyReg", v)} readOnly={readOnly} />
        <Field label="PVN nr." value={settings.vatNumber} onChange={(v) => set("vatNumber", v)} readOnly={readOnly} />
        <Field label="Banka" value={settings.bank} onChange={(v) => set("bank", v)} readOnly={readOnly} />
        <Field label="Adrese" value={settings.address} onChange={(v) => set("address", v)} readOnly={readOnly} />
        <Field label="Tālrunis" value={settings.phone} onChange={(v) => set("phone", v)} readOnly={readOnly} />
        <Field label="E-pasts" value={settings.email} onChange={(v) => set("email", v)} readOnly={readOnly} />
      </section>
      <section className="grid gap-3 md:grid-cols-2">
        <h2 className="md:col-span-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Izmaksas un PVN</h2>
        <Money label="Komisija, €" value={settings.commissionEur} onChange={(v) => set("commissionEur", v)} readOnly={readOnly} />
        <Money label="Transports, €" value={settings.transportEur} onChange={(v) => set("transportEur", v)} readOnly={readOnly} />
        <Money label="Izsoles fee, €" value={settings.auctionFeeEur} onChange={(v) => set("auctionFeeEur", v)} readOnly={readOnly} />
        <Money label="Neparedzētie, €" value={settings.unexpectedEur} onChange={(v) => set("unexpectedEur", v)} readOnly={readOnly} />
        <label className="block text-sm font-medium md:col-span-2">
          PVN režīms
          <select
            className={`${fieldClass} mt-1`}
            value={settings.vatMode}
            disabled={readOnly}
            onChange={(e) => set("vatMode", e.target.value as B2bDemoVatMode)}
          >
            <option value="none">Bez PVN</option>
            <option value="standard">Standarta</option>
            <option value="margin">Marža</option>
          </select>
        </label>
      </section>
      <section className="grid gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">PDF teksti</h2>
        <Area label="Kājene" value={settings.pdfFooterText} onChange={(v) => set("pdfFooterText", v)} readOnly={readOnly} />
        <Area label="Noteikumi" value={settings.pdfTermsText} onChange={(v) => set("pdfTermsText", v)} readOnly={readOnly} />
        <Area label="Depozīts" value={settings.pdfDepositText} onChange={(v) => set("pdfDepositText", v)} readOnly={readOnly} />
      </section>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-700">Saglabāts.</p> : null}
      {readOnly ? (
        <p className="text-sm text-slate-500">Tikai īpašnieks var mainīt iestatījumus.</p>
      ) : (
        <button type="submit" disabled={loading} className="rounded-xl bg-[#F26522] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {loading ? "Saglabā…" : "Saglabāt iestatījumus"}
        </button>
      )}
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input className={`${fieldClass} mt-1`} value={value} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Money({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  readOnly: boolean;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        className={`${fieldClass} mt-1`}
        type="number"
        min={0}
        step="0.01"
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <textarea className={`${fieldClass} mt-1 min-h-28`} value={value} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
