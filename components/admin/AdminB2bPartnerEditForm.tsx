"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";
import {
  ADMIN_PARTNER_INPUT_CLASS,
  ADMIN_PARTNER_LABEL_CLASS,
  adminPartnerApiError,
} from "@/lib/admin-b2b-partner-form";
import type { B2bPartnerPublicProfile, B2bPartnerStatus } from "@/lib/b2b-partner-account";

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
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
    setError("");
    setSaved(false);
  };

  const onSubmit = async () => {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const body: Record<string, string> = {
        companyName: form.companyName,
        companyReg: form.companyReg,
        companyAddress: form.companyAddress,
        contactName: form.contactName,
        email: form.email,
        phone: form.phone,
        status: form.status,
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
          <select
            className={ADMIN_PARTNER_INPUT_CLASS}
            value={form.status}
            onChange={set("status")}
          >
            <option value={"active" satisfies B2bPartnerStatus}>Aktīvs</option>
            <option value={"disabled" satisfies B2bPartnerStatus}>Bloķēts</option>
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
