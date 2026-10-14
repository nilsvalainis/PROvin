"use client";

import { useState } from "react";
import {
  irissCompanyLogoSrc,
  type IrissCompanySettings,
} from "@/lib/iriss-company-settings";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-[var(--color-apple-text)] outline-none focus:border-[var(--color-provin-accent)]";

export function IrissCompanySettingsClient({ initial }: { initial: IrissCompanySettings }) {
  const [form, setForm] = useState<IrissCompanySettings>(initial);
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function patch<K extends keyof IrissCompanySettings>(key: K, value: IrissCompanySettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSave() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/iriss-settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: form, logoDataUrl: logoDataUrl || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { form?: IrissCompanySettings; error?: string };
      if (!res.ok) {
        setMsg(data.error || "Neizdevās saglabāt.");
        return;
      }
      if (data.form) setForm(data.form);
      setLogoDataUrl("");
      setMsg("Saglabāts.");
    } catch {
      setMsg("Tīkla kļūda.");
    } finally {
      setBusy(false);
    }
  }

  const logoSrc = logoDataUrl || irissCompanyLogoSrc(form);

  return (
    <div className="space-y-4">
      <header>
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
          IRISS · IESTATĪJUMI
        </p>
        <h1 className="mt-1 text-[1.35rem] font-semibold tracking-tight text-[var(--color-apple-text)]">
          Uzņēmuma iestatījumi
        </h1>
        <p className="mt-1 text-[13px] text-[var(--color-provin-muted)]">
          Logo, rekvizīti, komisija, transports, izsoles maksa, neparedzētie, PVN un PDF teksti. Noklusējums paliek ĪRISS
          pašreizējās vērtības.
        </p>
      </header>

      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-500">Logo</h2>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt={form.logoAlt || "Logo"} className="h-12 w-auto max-w-[220px] object-contain" />
          <label className="inline-flex cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-[var(--color-provin-accent)]">
            Augšupielādēt logo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.currentTarget.value = "";
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  if (typeof reader.result === "string") setLogoDataUrl(reader.result);
                };
                reader.readAsDataURL(file);
              }}
            />
          </label>
        </div>
        <div className="mt-3">
          <Field label="Logo paraksts">
            <input className={inputClass} value={form.logoAlt} onChange={(e) => patch("logoAlt", e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-500">Rekvizīti un kontakti</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Juridiskais nosaukums">
            <input className={inputClass} value={form.legalName} onChange={(e) => patch("legalName", e.target.value)} placeholder="SIA IRISS" />
          </Field>
          <Field label="Publiskais zīmols">
            <input className={inputClass} value={form.publicBrand} onChange={(e) => patch("publicBrand", e.target.value)} placeholder="ĪRISS" />
          </Field>
          <Field label="Reģ. nr.">
            <input className={inputClass} value={form.regNo} onChange={(e) => patch("regNo", e.target.value)} />
          </Field>
          <Field label="Tālrunis">
            <input className={inputClass} value={form.phone} onChange={(e) => patch("phone", e.target.value)} />
          </Field>
          <Field label="E-pasts">
            <input className={inputClass} value={form.email} onChange={(e) => patch("email", e.target.value)} />
          </Field>
          <Field label="Mājaslapa">
            <input className={inputClass} value={form.website} onChange={(e) => patch("website", e.target.value)} />
          </Field>
          <Field label="Juridiskā adrese">
            <input className={inputClass} value={form.legalAddress} onChange={(e) => patch("legalAddress", e.target.value)} />
          </Field>
          <Field label="Biroja adrese">
            <input className={inputClass} value={form.officeAddress} onChange={(e) => patch("officeAddress", e.target.value)} />
          </Field>
          <Field label="Banka">
            <input className={inputClass} value={form.bank} onChange={(e) => patch("bank", e.target.value)} />
          </Field>
          <Field label="Kontakti (papildu)">
            <input className={inputClass} value={form.contacts} onChange={(e) => patch("contacts", e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-500">Izmaksas un PVN</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Komisija, €">
            <input type="number" className={inputClass} value={form.commission} onChange={(e) => patch("commission", Number(e.target.value) || 0)} />
          </Field>
          <Field label="Transports, €">
            <input type="number" className={inputClass} value={form.transport} onChange={(e) => patch("transport", Number(e.target.value) || 0)} />
          </Field>
          <Field label="Izsoles maksa, €">
            <input type="number" className={inputClass} value={form.auctionFee} onChange={(e) => patch("auctionFee", Number(e.target.value) || 0)} />
          </Field>
          <Field label="Neparedzētie, €">
            <input type="number" className={inputClass} value={form.contingency} onChange={(e) => patch("contingency", Number(e.target.value) || 0)} />
          </Field>
          <Field label="PVN, %">
            <input type="number" className={inputClass} value={form.vatPercent} onChange={(e) => patch("vatPercent", Number(e.target.value) || 0)} />
          </Field>
          <Field label="Depozīts, €">
            <input type="number" className={inputClass} value={form.depositEur} onChange={(e) => patch("depositEur", Number(e.target.value) || 0)} />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-500">PDF kājene un noteikumi</h2>
        <p className="mt-1 text-[12px] text-slate-500">
          Ja kājenes rindas atstāj tukšas, paliek līdzšinējais env teksts. Noteikumos ir CSDD un depozīta teksts.
        </p>
        <div className="mt-3 space-y-3">
          <Field label="PDF kājene (viena rinda = viena līnija)">
            <textarea
              className={`${inputClass} h-32 py-2`}
              value={form.footerLines.join("\n")}
              onChange={(e) => patch("footerLines", e.target.value.split(/\r?\n/))}
              placeholder={"SIA IRISS\nReģ. nr.: …\nTālrunis: …"}
            />
          </Field>
          <Field label="Papildu kājenes teksts">
            <textarea className={`${inputClass} h-20 py-2`} value={form.pdfExtraFooter} onChange={(e) => patch("pdfExtraFooter", e.target.value)} />
          </Field>
          <Field label="PDF noteikumi (CSDD, depozīts u.c.)">
            <textarea className={`${inputClass} h-72 py-2 font-mono text-[12px]`} value={form.termsText} onChange={(e) => patch("termsText", e.target.value)} />
          </Field>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onSave()}
          className="rounded-lg bg-[var(--color-provin-accent)] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saglabā…" : "Saglabāt"}
        </button>
        {msg ? <p className="text-[13px] text-slate-600">{msg}</p> : null}
      </div>
    </div>
  );
}
