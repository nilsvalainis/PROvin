"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";
import {
  ADMIN_PARTNER_INPUT_CLASS,
  ADMIN_PARTNER_LABEL_CLASS,
  adminPartnerApiError,
} from "@/lib/admin-b2b-partner-form";
import {
  centsToEuroInput,
  euroTextToCents,
  type B2bPartnerPublicProfile,
} from "@/lib/b2b-partner-account";
import { B2B_BUSINESS_PACKS, B2B_DEALER_PACKS, formatB2bEuroFromCents } from "@/lib/b2b-partner-copy";

export function AdminB2bPartnerEditForm({ partner }: { partner: B2bPartnerPublicProfile }) {
  const router = useRouter();
  const [form, setForm] = useState({
    companyName: partner.companyName,
    companyReg: partner.companyReg,
    companyAddress: partner.companyAddress,
    contactName: partner.contactName,
    email: partner.email,
    phone: partner.phone,
    password: "",
    status: partner.status,
    dealerEnabled: partner.dealerEnabled === true,
    priceBusiness1: centsToEuroInput(partner.prices?.business1 ?? null),
    priceBusiness10: centsToEuroInput(partner.prices?.business10 ?? null),
    priceDealer1: centsToEuroInput(partner.prices?.dealer1 ?? null),
    priceDealer10: centsToEuroInput(partner.prices?.dealer10 ?? null),
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value =
      key === "dealerEnabled" && event.target instanceof HTMLInputElement && event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
    setSaved(false);
  };

  const onSubmit = async () => {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const b1 = euroTextToCents(form.priceBusiness1);
      const b10 = euroTextToCents(form.priceBusiness10);
      const d1 = euroTextToCents(form.priceDealer1);
      const d10 = euroTextToCents(form.priceDealer10);
      if (b1 === "invalid" || b10 === "invalid" || d1 === "invalid" || d10 === "invalid") {
        setError("Cenas formāts: piem. 79,99 (tukšs = kataloga noklusējums).");
        return;
      }
      const body: Record<string, unknown> = {
        companyName: form.companyName,
        companyReg: form.companyReg,
        companyAddress: form.companyAddress,
        contactName: form.contactName,
        email: form.email,
        phone: form.phone,
        status: form.status,
        dealerEnabled: form.dealerEnabled,
        prices: {
          business1: b1,
          business10: b10,
          dealer1: d1,
          dealer10: d10,
        },
      };
      if (form.password.trim()) body.password = form.password;
      const res = await fetch(`/api/admin/partners/${encodeURIComponent(partner.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(adminPartnerApiError(data.error));
        return;
      }
      setForm((prev) => ({ ...prev, password: "" }));
      setSaved(true);
      router.refresh();
    } catch {
      setError("Neizdevās saglabāt.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="mt-6 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_2px_24px_rgba(15,23,42,0.05)]"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block min-w-0">
          <span className={ADMIN_PARTNER_LABEL_CLASS}>Uzņēmums</span>
          <input className={ADMIN_PARTNER_INPUT_CLASS} value={form.companyName} onChange={set("companyName")} />
        </label>
        <label className="block min-w-0">
          <span className={ADMIN_PARTNER_LABEL_CLASS}>Reģ. nr.</span>
          <input className={ADMIN_PARTNER_INPUT_CLASS} value={form.companyReg} onChange={set("companyReg")} />
        </label>
        <label className="block min-w-0 sm:col-span-2">
          <span className={ADMIN_PARTNER_LABEL_CLASS}>Adrese</span>
          <input className={ADMIN_PARTNER_INPUT_CLASS} value={form.companyAddress} onChange={set("companyAddress")} />
        </label>
        <label className="block min-w-0">
          <span className={ADMIN_PARTNER_LABEL_CLASS}>Kontaktpersona</span>
          <input className={ADMIN_PARTNER_INPUT_CLASS} value={form.contactName} onChange={set("contactName")} />
        </label>
        <label className="block min-w-0">
          <span className={ADMIN_PARTNER_LABEL_CLASS}>Tālrunis</span>
          <input className={ADMIN_PARTNER_INPUT_CLASS} value={form.phone} onChange={set("phone")} type="tel" />
        </label>
        <label className="block min-w-0">
          <span className={ADMIN_PARTNER_LABEL_CLASS}>E-pasts</span>
          <input className={ADMIN_PARTNER_INPUT_CLASS} value={form.email} onChange={set("email")} type="email" />
        </label>
        <label className="block min-w-0">
          <span className={ADMIN_PARTNER_LABEL_CLASS}>Statuss</span>
          <select className={ADMIN_PARTNER_INPUT_CLASS} value={form.status} onChange={set("status")}>
            <option value="active">Aktīvs</option>
            <option value="disabled">Bloķēts</option>
          </select>
        </label>
        <label className="block min-w-0 sm:col-span-2">
          <span className={ADMIN_PARTNER_LABEL_CLASS}>Jauna parole (nav obligāti)</span>
          <input
            className={ADMIN_PARTNER_INPUT_CLASS}
            value={form.password}
            onChange={set("password")}
            type="password"
            autoComplete="new-password"
          />
        </label>
      </div>

      <div className="mt-6 border-t border-slate-200/80 pt-5">
        <h3 className="text-sm font-semibold text-slate-800">Pakalpojumi un cenas</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Dīlera dati pēc noklusējuma izslēgti. Tukša cena = kataloga noklusējums (
          {formatB2bEuroFromCents(B2B_BUSINESS_PACKS[0]!.unitCents)} / {formatB2bEuroFromCents(B2B_BUSINESS_PACKS[1]!.unitCents)}{" "}
          Audits; {formatB2bEuroFromCents(B2B_DEALER_PACKS[0]!.unitCents)} /{" "}
          {formatB2bEuroFromCents(B2B_DEALER_PACKS[1]!.unitCents)} Dīlera).
        </p>

        <label className="mt-4 flex items-center gap-2.5 text-sm text-slate-800">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-[var(--color-provin-accent)] focus:ring-[var(--color-provin-accent)]"
            checked={form.dealerEnabled}
            onChange={set("dealerEnabled")}
          />
          Rādīt Dīlera datus šim partnerim
        </label>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block min-w-0">
            <span className={ADMIN_PARTNER_LABEL_CLASS}>Audits · 1 gab. (€)</span>
            <input
              className={ADMIN_PARTNER_INPUT_CLASS}
              value={form.priceBusiness1}
              onChange={set("priceBusiness1")}
              placeholder={formatB2bEuroFromCents(B2B_BUSINESS_PACKS[0]!.unitCents).replace(" €", "")}
              inputMode="decimal"
            />
          </label>
          <label className="block min-w-0">
            <span className={ADMIN_PARTNER_LABEL_CLASS}>Audits · 10 gab. (€ / gab.)</span>
            <input
              className={ADMIN_PARTNER_INPUT_CLASS}
              value={form.priceBusiness10}
              onChange={set("priceBusiness10")}
              placeholder={formatB2bEuroFromCents(B2B_BUSINESS_PACKS[1]!.unitCents).replace(" €", "")}
              inputMode="decimal"
            />
          </label>
          <label className={`block min-w-0 ${form.dealerEnabled ? "" : "opacity-45"}`}>
            <span className={ADMIN_PARTNER_LABEL_CLASS}>Dīlera · 1 gab. (€)</span>
            <input
              className={ADMIN_PARTNER_INPUT_CLASS}
              value={form.priceDealer1}
              onChange={set("priceDealer1")}
              placeholder={formatB2bEuroFromCents(B2B_DEALER_PACKS[0]!.unitCents).replace(" €", "")}
              inputMode="decimal"
              disabled={!form.dealerEnabled}
            />
          </label>
          <label className={`block min-w-0 ${form.dealerEnabled ? "" : "opacity-45"}`}>
            <span className={ADMIN_PARTNER_LABEL_CLASS}>Dīlera · 10 gab. (€ / gab.)</span>
            <input
              className={ADMIN_PARTNER_INPUT_CLASS}
              value={form.priceDealer10}
              onChange={set("priceDealer10")}
              placeholder={formatB2bEuroFromCents(B2B_DEALER_PACKS[1]!.unitCents).replace(" €", "")}
              inputMode="decimal"
              disabled={!form.dealerEnabled}
            />
          </label>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {saved && !error ? <p className="mt-3 text-sm text-emerald-700">Saglabāts.</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="mt-4 inline-flex rounded-full bg-[var(--color-provin-accent)] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--color-provin-accent-hover)] disabled:opacity-60"
      >
        {busy ? "Saglabā…" : "Saglabāt"}
      </button>
    </form>
  );
}
