"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";
import { ADMIN_B2B_BTN_SOLID, AdminB2bActionLabel } from "@/components/admin/AdminB2bAction";
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
  const [open, setOpen] = useState(false);
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

  if (!open) {
    return (
      <div className="mt-6">
        <button type="button" className={ADMIN_B2B_BTN_SOLID} onClick={() => setOpen(true)}>
          <AdminB2bActionLabel>+ Jauns partneris</AdminB2bActionLabel>
        </button>
      </div>
    );
  }

  return (
    <form
      className="mt-6 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_2px_24px_rgba(15,23,42,0.05)]"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">Jauns partneris</h2>
        <button
          type="button"
          className="text-[12px] font-semibold text-slate-500 hover:text-slate-800"
          onClick={() => setOpen(false)}
        >
          Aizvērt
        </button>
      </div>
      <p className="mt-1 text-[13px] text-[var(--color-provin-muted)]">
        Paroli paziņo dīlerim pats. Ielūguma e-pasts šajā versijā netiek sūtīts.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block min-w-0">
          <span className={ADMIN_PARTNER_LABEL_CLASS}>Uzņēmums</span>
          <input className={ADMIN_PARTNER_INPUT_CLASS} value={form.companyName} onChange={set("companyName")} />
        </label>
        <label className="block min-w-0">
          <span className={ADMIN_PARTNER_LABEL_CLASS}>Reģ. Nr.</span>
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
        className={`${ADMIN_B2B_BTN_SOLID} mt-4`}
      >
        <AdminB2bActionLabel>{busy ? "Saglabā…" : "Izveidot partneri"}</AdminB2bActionLabel>
      </button>
    </form>
  );
}
