"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FUTURE_ROLE_DESCRIPTIONS,
  STAFF_ROLE_DESCRIPTIONS,
  STAFF_ROLE_LABELS,
  type StaffRole,
} from "@/lib/staff-roles";
import type { EnvAdminPublic, StaffAuditEntry, StaffUserPublic } from "@/lib/staff-types";

type SessionRow = { id: string; createdAt: string; lastSeenAt: string; ip: string; device: string };
type DirectoryUser = (StaffUserPublic & { envAdmin?: false }) | (EnvAdminPublic & { envAdmin: true });

const AUDIT_LABEL: Record<StaffAuditEntry["action"], string> = {
  login_success: "pieteicās",
  login_failure: "neveiksmīgs pieteikšanās mēģinājums",
  login_lock: "pieteikšanās bloķēta",
  invite_created: "uzaicināja",
  invite_accepted: "pieņēma uzaicinājumu",
  access_revoked: "atsauca pieeju",
  access_restored: "atjaunoja pieeju",
  sessions_revoked: "beidza sesijas",
  totp_enabled: "ieslēdza 2FA",
  totp_disabled: "izslēdza 2FA",
  point_viewed: "skatīja punktus",
  point_edited: "laboja punktu",
  print: "drukāja karti",
  route_export: "sastādīja maršrutu",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return letters.toUpperCase() || "?";
}

function formatWhen(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mi} · ${dd}.${mm}.${d.getFullYear()}`;
}

function statusLabel(status: DirectoryUser["status"]): { text: string; className: string } {
  if (status === "active") return { text: "Aktīvs", className: "bg-[#ECFDF3] text-[#067647]" };
  if (status === "invited") return { text: "Uzaicināts", className: "bg-[#EEF2FF] text-[#3d5bd9]" };
  return { text: "Atsaukts", className: "bg-[#FEF3F2] text-[#B42318]" };
}

function roleLabel(user: DirectoryUser): string {
  if ("envAdmin" in user && user.envAdmin) return "Administrators";
  return STAFF_ROLE_LABELS[user.role as StaffRole] ?? user.role;
}

export function IrissStaffUsersClient() {
  const [admin, setAdmin] = useState<EnvAdminPublic | null>(null);
  const [users, setUsers] = useState<StaffUserPublic[]>([]);
  const [audit, setAudit] = useState<StaffAuditEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("logistics");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [totp, setTotp] = useState<{ secret: string; otpauth: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");

  const directory = useMemo<DirectoryUser[]>(() => {
    const rows: DirectoryUser[] = [];
    if (admin) rows.push(admin);
    for (const u of users) rows.push(u);
    return rows;
  }, [admin, users]);

  const selected = directory.find((u) => u.id === selectedId) ?? directory[0] ?? null;

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/staff/users", { credentials: "include", cache: "no-store" });
    const data = (await res.json()) as { admin?: EnvAdminPublic; users?: StaffUserPublic[]; audit?: StaffAuditEntry[] };
    if (data.admin) setAdmin(data.admin);
    setUsers(data.users ?? []);
    setAudit(data.audit ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected || selected.envAdmin) {
      setSessions([]);
      return;
    }
    void fetch(`/api/admin/staff/users/${encodeURIComponent(selected.id)}`, { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((data: { sessions?: SessionRow[] }) => setSessions(data.sessions ?? []));
  }, [selected]);

  async function invite() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/staff/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Neizdevās uzaicināt.");
        return;
      }
      setModal(false);
      setName("");
      setEmail("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function act(action: string, extra?: Record<string, string>) {
    if (!selected || selected.envAdmin) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/staff/users/${encodeURIComponent(selected.id)}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = (await res.json()) as { secret?: string; otpauth?: string; error?: string };
      if (action === "totp_start" && data.secret) {
        setTotp({ secret: data.secret, otpauth: data.otpauth ?? "" });
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-full w-full bg-[#F4F6F9] px-3 pb-24 pt-3 sm:px-4 sm:pb-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[1.35rem] font-semibold tracking-tight text-[#111827] sm:text-[1.5rem]">
              Lietotāji un pieeja
            </h1>
            <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#3d5bd9]">
              IRISS
            </span>
          </div>
          <p className="mt-1.5 max-w-xl text-[13px] text-[#6b7280]">
            Citas personas redz tikai savai lomai atļauto. Lomu pārvalda serveris katrā pieprasījumā.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal(true)}
          className="rounded-full bg-[#111827] px-4 py-2 text-[13px] font-medium text-white"
        >
          + Pievienot personu
        </button>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <section className="overflow-hidden rounded-[22px] border border-[#E5E7EB] bg-white shadow-sm">
            <ul>
              {directory.map((user) => {
                const st = statusLabel(user.status);
                const active = selected?.id === user.id;
                return (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(user.id)}
                      className={`flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left ${
                        active ? "border-[#3d5bd9] bg-[#F8FAFF]" : "border-transparent"
                      }`}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EEF2FF] text-[12px] font-semibold text-[#3d5bd9]">
                        {initials(user.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-[#111827]">{user.name}</span>
                        <span className="block truncate text-[12px] text-[#6b7280]">{user.email || "env administrators"}</span>
                      </span>
                      <span className="hidden text-[12px] text-[#6b7280] sm:block">{roleLabel(user)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.className}`}>{st.text}</span>
                      <span className="hidden text-[11px] text-[#9aa3b2] lg:block">{formatWhen(user.lastLoginAt)}</span>
                      <span className="hidden text-[11px] text-[#9aa3b2] xl:block">{user.totpEnabled ? "2FA" : "-"}</span>
                      {!user.envAdmin && user.status !== "revoked" ? (
                        <span className="hidden text-[12px] text-[#B42318] md:inline">Atsaukt pieeju</span>
                      ) : null}
                      {!user.envAdmin && user.status === "revoked" ? (
                        <span className="hidden text-[12px] text-[#067647] md:inline">Atjaunot</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-[22px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9aa3b2]">Lomas</p>
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-[14px] font-medium">Loģistika</p>
                <p className="text-[13px] text-[#6b7280]">{STAFF_ROLE_DESCRIPTIONS.logistics}</p>
              </div>
              {FUTURE_ROLE_DESCRIPTIONS.map((row) => (
                <div key={row.title}>
                  <p className="text-[14px] font-medium">{row.title}</p>
                  <p className="text-[13px] text-[#6b7280]">{row.body}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-3">
          {selected ? (
            <section className="rounded-[22px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#EEF2FF] text-[13px] font-semibold text-[#3d5bd9]">
                  {initials(selected.name)}
                </span>
                <div>
                  <p className="text-[15px] font-semibold">{selected.name}</p>
                  <p className="text-[12px] text-[#6b7280]">{roleLabel(selected)}</p>
                </div>
              </div>
              <dl className="mt-4 space-y-2 text-[13px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-[#9aa3b2]">Pēdējā pieteikšanās</dt>
                  <dd>{formatWhen(selected.lastLoginAt)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#9aa3b2]">2FA</dt>
                  <dd>{selected.totpEnabled ? "Ieslēgta" : "Nav"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#9aa3b2]">Sesijas</dt>
                  <dd>{selected.envAdmin ? "Env HMAC" : `${selected.sessionCount} aktīvas`}</dd>
                </div>
              </dl>
              {sessions[0] ? (
                <p className="mt-3 text-[12px] text-[#6b7280]">Ierīce: {sessions[0].device}</p>
              ) : null}
              {!selected.envAdmin ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act("revoke_sessions")}
                    className="rounded-full border border-[#E5E7EB] px-3 py-1.5 text-[12px]"
                  >
                    Beigt sesijas
                  </button>
                  {selected.status === "revoked" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void act("restore")}
                      className="rounded-full bg-[#111827] px-3 py-1.5 text-[12px] text-white"
                    >
                      Atjaunot pieeju
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void act("revoke")}
                      className="rounded-full px-3 py-1.5 text-[12px] text-[#B42318]"
                    >
                      Atsaukt pieeju
                    </button>
                  )}
                  {!selected.totpEnabled ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void act("totp_start")}
                      className="rounded-full border border-[#E5E7EB] px-3 py-1.5 text-[12px]"
                    >
                      Ieslēgt 2FA
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-[12px] text-[#9aa3b2]">Nila env pieteikšanās paliek nemainīta.</p>
              )}
              {totp && selected && !selected.envAdmin ? (
                <div className="mt-3 space-y-2 rounded-xl bg-[#F8FAFC] p-3">
                  <p className="break-all font-mono text-[11px]">{totp.secret}</p>
                  <input
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[16px]"
                    placeholder="6 ciparu kods"
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    className="rounded-full bg-[#111827] px-3 py-1.5 text-[12px] text-white"
                    onClick={() => void act("totp_confirm", { code: totpCode })}
                  >
                    Apstiprināt 2FA
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-[22px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9aa3b2]">Darbību žurnāls</p>
            <ul className="mt-3 space-y-2">
              {audit.length === 0 ? (
                <li className="text-[13px] text-[#6b7280]">Vēl nav ierakstu.</li>
              ) : (
                audit.map((row) => (
                  <li key={row.id} className="flex gap-2 text-[13px]">
                    <span className="w-16 shrink-0 text-[#9aa3b2]">{formatWhen(row.createdAt).split(" · ")[0]}</span>
                    <span className="min-w-0 text-[#111827]">
                      {row.userId === "env-admin"
                        ? admin?.name || "Administrators"
                        : users.find((u) => u.id === row.userId)?.name || row.userId}{" "}
                      {AUDIT_LABEL[row.action]}
                      {typeof row.meta.email === "string" ? ` ${row.meta.email}` : ""}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </aside>
      </div>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a66] p-4">
          <div className="w-full max-w-md rounded-[24px] bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-[18px] font-semibold">Pievienot personu</h2>
              <button type="button" onClick={() => setModal(false)} className="text-[#6b7280]" aria-label="Aizvērt">
                ×
              </button>
            </div>
            <label className="mb-3 block text-[13px]">
              Vārds, uzvārds
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-[16px]"
              />
            </label>
            <label className="mb-3 block text-[13px]">
              E-pasts
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-[16px]"
              />
            </label>
            <label className="mb-3 block text-[13px]">
              Loma
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as StaffRole)}
                className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-[16px]"
              >
                <option value="logistics">Loģistika</option>
              </select>
            </label>
            <p className="text-[12px] leading-relaxed text-[#6b7280]">
              Persona saņem vienreizēju uzaicinājuma saiti (derīga 24 h), pēc tam iestata paroli un 2FA. Uzaicinājums tiek
              nosūtīts tikai pēc šīs apstiprināšanas.
            </p>
            {error ? <p className="mt-2 text-[13px] text-[#B42318]">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setModal(false)} className="rounded-full px-4 py-2 text-[13px]">
                Atcelt
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void invite()}
                className="rounded-full bg-[#111827] px-4 py-2 text-[13px] font-medium text-white"
              >
                Izveidot uzaicinājumu
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
