"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";
import {
  ADMIN_PARTNER_INPUT_CLASS,
  ADMIN_PARTNER_LABEL_CLASS,
  adminPartnerApiError,
} from "@/lib/admin-b2b-partner-form";

const empty = {
  companyName: "",
  companyReg: "",
  companyAddress: "",
  contactName: "",
  email: "",
  phone: "",
  password: "",
};

export function AdminB2bPartnerCreateForm() {
  const router = useRouter();
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof empty) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
    setError("");
  };

  const onSubmit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/partners", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string; partner?: { id: string } };
      if (!res.ok || !data.partner?.id) {
        setError(adminPartnerApiError(data.error));
        return;
      }
      setForm(empty);
      router.push(`/admin/partneri/${encodeURIComponent(data.partner.id)}`);
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
      <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">Jauns partneris</h2>
      <p className="mt-1 text-[13px] text-[var(--color-provin-muted)]">
        Paroli paziņo dīlerim pats. Ielūguma e-pasts šajā versijā netiek sūtīts.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
          <input className={ADMIN_PARTNER_INPUT_CLASS} value={form.email} onChange={set("email")} type="email" autoComplete="off" />
        </label>
        <label className="block min-w-0">
          <span className={ADMIN_PARTNER_LABEL_CLASS}>Parole</span>
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
      <button
        type="submit"
        disabled={busy}
        className="mt-4 inline-flex rounded-full bg-[var(--color-provin-accent)] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--color-provin-accent-hover)] disabled:opacity-60"
      >
        {busy ? "Saglabā…" : "Izveidot partneri"}
      </button>
    </form>
  );
}
