"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ADMIN_PARTNER_INPUT_CLASS,
  ADMIN_PARTNER_LABEL_CLASS,
} from "@/lib/admin-b2b-partner-form";
import type { B2bDemoAdminTenantRow } from "@/lib/b2b-demo-types";

type CreateResponse = {
  tenant?: { tenantId: string; slug: string; name: string };
  owner?: { email: string; userId: string };
  generatedPassword?: string | null;
  error?: string;
};

type OwnerResponse = {
  user?: { email: string; userId: string; role: string };
  generatedPassword?: string | null;
  error?: string;
};

const fieldClass = ADMIN_PARTNER_INPUT_CLASS;
const labelClass = ADMIN_PARTNER_LABEL_CLASS;

export function AdminB2bDemoTenantsPanel() {
  const [tenants, setTenants] = useState<B2bDemoAdminTenantRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [revealedPassword, setRevealedPassword] = useState<{ label: string; password: string } | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");

  const [ownerTargetId, setOwnerTargetId] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addName, setAddName] = useState("");
  const [addPassword, setAddPassword] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    const res = await fetch("/api/admin/b2b-demo/tenants", { credentials: "include", cache: "no-store" });
    const data = (await res.json()) as { tenants?: B2bDemoAdminTenantRow[]; error?: string };
    if (!res.ok) {
      setLoadError(data.error || "Neizdevās ielādēt dīlerus.");
      return;
    }
    setTenants(data.tenants ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async () => {
    setBusy(true);
    setFormError("");
    setRevealedPassword(null);
    try {
      const res = await fetch("/api/admin/b2b-demo/tenants", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug: slug.trim() || undefined,
          ownerEmail,
          ownerName: ownerName.trim() || undefined,
          ownerPassword: ownerPassword.trim() || undefined,
        }),
      });
      const data = (await res.json()) as CreateResponse;
      if (!res.ok || !data.tenant) {
        setFormError(data.error || "Neizdevās izveidot dīleri.");
        return;
      }
      setName("");
      setSlug("");
      setOwnerEmail("");
      setOwnerName("");
      setOwnerPassword("");
      if (data.generatedPassword) {
        setRevealedPassword({
          label: `${data.owner?.email ?? ownerEmail} (${data.tenant.slug})`,
          password: data.generatedPassword,
        });
      }
      await load();
    } catch {
      setFormError("Neizdevās izveidot dīleri.");
    } finally {
      setBusy(false);
    }
  };

  const onAddOwner = async () => {
    if (!ownerTargetId) {
      setFormError("Izvēlies dīleri.");
      return;
    }
    setBusy(true);
    setFormError("");
    setRevealedPassword(null);
    try {
      const res = await fetch(`/api/admin/b2b-demo/tenants/${encodeURIComponent(ownerTargetId)}/owners`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: addEmail,
          name: addName.trim() || undefined,
          password: addPassword.trim() || undefined,
        }),
      });
      const data = (await res.json()) as OwnerResponse;
      if (!res.ok || !data.user) {
        setFormError(data.error || "Neizdevās pievienot īpašnieku.");
        return;
      }
      setAddEmail("");
      setAddName("");
      setAddPassword("");
      if (data.generatedPassword) {
        setRevealedPassword({
          label: data.user.email,
          password: data.generatedPassword,
        });
      }
      await load();
    } catch {
      setFormError("Neizdevās pievienot īpašnieku.");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (row: B2bDemoAdminTenantRow) => {
    const ok = window.confirm(
      `Dzēst dīleri "${row.name}" (${row.slug}) kopā ar visiem Blob failiem un e-pasta indeksu? Šo nevar atsaukt.`,
    );
    if (!ok) return;
    setBusy(true);
    setFormError("");
    try {
      const res = await fetch(`/api/admin/b2b-demo/tenants/${encodeURIComponent(row.tenantId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setFormError(data.error || "Neizdevās dzēst.");
        return;
      }
      await load();
    } catch {
      setFormError("Neizdevās dzēst.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 space-y-6">
      {loadError ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{loadError}</p>
      ) : null}
      {formError ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{formError}</p>
      ) : null}
      {revealedPassword ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
          <p className="font-semibold">Parole rādīta tikai šoreiz</p>
          <p className="mt-1 text-[13px]">{revealedPassword.label}</p>
          <code className="mt-2 block break-all rounded bg-white px-2 py-1 font-mono text-[13px]">
            {revealedPassword.password}
          </code>
        </div>
      ) : null}

      <form
        className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_2px_24px_rgba(15,23,42,0.05)]"
        onSubmit={(event) => {
          event.preventDefault();
          void onCreate();
        }}
      >
        <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">Jauns dīleris</h2>
        <p className="mt-1 text-[13px] text-[var(--color-provin-muted)]">
          Tukši iestatījumi (bez ĪRISS komisijas skaitļiem). Ja paroli neatstāj, tā tiek ģenerēta un rādīta vienreiz.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block min-w-0">
            <span className={labelClass}>Uzņēmums</span>
            <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="block min-w-0">
            <span className={labelClass}>Slugs (neobligāti)</span>
            <input className={fieldClass} value={slug} onChange={(e) => setSlug(e.target.value)} />
          </label>
          <label className="block min-w-0">
            <span className={labelClass}>Īpašnieka e-pasts</span>
            <input
              className={fieldClass}
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              required
            />
          </label>
          <label className="block min-w-0">
            <span className={labelClass}>Īpašnieka vārds</span>
            <input className={fieldClass} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          </label>
          <label className="block min-w-0 sm:col-span-2">
            <span className={labelClass}>Parole (tukšs = ģenerēt)</span>
            <input
              className={fieldClass}
              type="text"
              autoComplete="off"
              value={ownerPassword}
              onChange={(e) => setOwnerPassword(e.target.value)}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="mt-4 rounded-lg bg-[var(--color-provin-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Izveidot
        </button>
      </form>

      <form
        className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_2px_24px_rgba(15,23,42,0.05)]"
        onSubmit={(event) => {
          event.preventDefault();
          void onAddOwner();
        }}
      >
        <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">Pievienot īpašnieku</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block min-w-0 sm:col-span-2">
            <span className={labelClass}>Dīleris</span>
            <select
              className={fieldClass}
              value={ownerTargetId}
              onChange={(e) => setOwnerTargetId(e.target.value)}
              required
            >
              <option value="">Izvēlies…</option>
              {tenants.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>
                  {t.name} ({t.slug})
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            <span className={labelClass}>E-pasts</span>
            <input
              className={fieldClass}
              type="email"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              required
            />
          </label>
          <label className="block min-w-0">
            <span className={labelClass}>Vārds</span>
            <input className={fieldClass} value={addName} onChange={(e) => setAddName(e.target.value)} />
          </label>
          <label className="block min-w-0 sm:col-span-2">
            <span className={labelClass}>Parole (tukšs = ģenerēt)</span>
            <input
              className={fieldClass}
              type="text"
              autoComplete="off"
              value={addPassword}
              onChange={(e) => setAddPassword(e.target.value)}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={busy || tenants.length === 0}
          className="mt-4 rounded-lg bg-[var(--color-provin-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Pievienot īpašnieku
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_2px_24px_rgba(15,23,42,0.05)]">
        {tenants.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-provin-muted)]">Nav dīleru.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {tenants.map((row) => (
              <li key={row.tenantId} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--color-apple-text)]">{row.name}</p>
                  <p className="mt-0.5 font-mono text-[12px] text-[var(--color-provin-muted)]">
                    {row.slug} · {row.tenantId}
                  </p>
                  <ul className="mt-2 space-y-0.5 text-[13px] text-[var(--color-apple-text)]">
                    {row.users.map((u) => (
                      <li key={u.userId}>
                        {u.email} ({u.role})
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onDelete(row)}
                  className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  Dzēst
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
