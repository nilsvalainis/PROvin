"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { IrissCabinetAccessPanel } from "@/components/admin/IrissCabinetAccessPanel";
import {
  staffDeleteUserConfirm,
  staffResetPasswordConfirm,
  staffResetPasswordLabel,
  staffUserAdminActions,
  type StaffAdminActionId,
} from "@/lib/staff-admin-actions";
import {
  AUTOPARKS_V2_SECTION_SHORT_LABELS,
  IRISS_SECTION_CATALOG,
  IRISS_SECTION_LABELS,
  isAutoparksV2Section,
  type IrissSection,
} from "@/lib/staff-roles";
import type { EnvAdminPublic, StaffAuditEntry, StaffStatus, StaffUserPublic } from "@/lib/staff-types";

/** Autoparka apakštiesības: ar atkāpi zem virsraksta "Autoparks" (virsraksts pirms pirmās). */
function sectionRowLabel(id: IrissSection, label: string): string {
  return isAutoparksV2Section(id) ? AUTOPARKS_V2_SECTION_SHORT_LABELS[id] : label;
}

function AutoparksGroupHeader({ id, className }: { id: IrissSection; className: string }) {
  if (id !== "ap_pamatdati") return null;
  return <li className={className}>Autoparks</li>;
}

function uniqueSectionLabels(ids: readonly IrissSection[]): string[] {
  return [...new Set(ids.map((id) => IRISS_SECTION_LABELS[id]))];
}

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
  password_reset: "atiestatīja paroli",
  user_deleted: "izdzēsa lietotāju",
  sessions_revoked: "beidza sesijas",
  totp_enabled: "ieslēdza 2FA",
  totp_disabled: "izslēdza 2FA",
  sections_updated: "mainīja sadaļas",
  waybill_requested: "nosūtīja pavadzīmes pieprasījumu",
  waybill_retry: "atkārtoja pavadzīmes pieprasījumu",
  waybill_claimed: "Aivars paņēma pieprasījumu",
  waybill_cancelled: "atcēla pavadzīmes pieprasījumu",
  waybill_result: "Aivars atgrieza rezultātu",
  waybill_handoff_aivars: "automātika nodeva pavadzīmi Aivaram",
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
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  if (sameDay) return `šodien ${hh}:${mi}`;
  return `${hh}:${mi} · ${dd}.${mm}.${d.getFullYear()}`;
}

function statusLabel(status: DirectoryUser["status"]): { text: string; className: string } {
  if (status === "active") return { text: "Aktīvs", className: "bg-[#ECFDF3] text-[#067647]" };
  if (status === "invited") return { text: "Uzaicināts", className: "bg-[#EEF2FF] text-[#3d5bd9]" };
  return { text: "Atsaukts", className: "bg-[#FEF3F2] text-[#B42318]" };
}

function userSections(user: DirectoryUser): IrissSection[] | "admin" {
  if ("envAdmin" in user && user.envAdmin) return "admin";
  return Array.isArray(user.sections) && user.sections.length ? user.sections : ["logistika"];
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
  const [inviteSections, setInviteSections] = useState<IrissSection[]>(["logistika"]);
  const [draftSections, setDraftSections] = useState<IrissSection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [totp, setTotp] = useState<{ secret: string; otpauth: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [resetLink, setResetLink] = useState<{ email: string; url: string; emailed: boolean } | null>(null);

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
    setResetLink(null);
    setError(null);
  }, [selectedId]);

  useEffect(() => {
    if (!selected || selected.envAdmin) {
      setSessions([]);
      setDraftSections([]);
      return;
    }
    const next = userSections(selected);
    setDraftSections(next === "admin" ? [] : [...next]);
    void fetch(`/api/admin/staff/users/${encodeURIComponent(selected.id)}`, { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((data: { sessions?: SessionRow[] }) => setSessions(data.sessions ?? []));
  }, [selected]);

  function toggleDraft(id: IrissSection) {
    setDraftSections((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function toggleInvite(id: IrissSection) {
    setInviteSections((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function invite() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/staff/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, sections: inviteSections }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Neizdevās uzaicināt.");
        return;
      }
      setModal(false);
      setName("");
      setEmail("");
      setInviteSections(["logistika"]);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function act(action: string, extra?: Record<string, unknown>) {
    if (!selected || selected.envAdmin) return;
    if (action === "reset_password") {
      if (!window.confirm(staffResetPasswordConfirm(selected.name, selected.email, selected.status))) return;
    }
    if (action === "delete") {
      if (!window.confirm(staffDeleteUserConfirm(selected.name, selected.email))) return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/staff/users/${encodeURIComponent(selected.id)}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = (await res.json()) as {
        secret?: string;
        otpauth?: string;
        error?: string;
        inviteUrl?: string;
        emailed?: boolean;
      };
      if (!res.ok) {
        setError(data.error ?? "Neizdevās izpildīt darbību.");
        return;
      }
      if (action === "totp_start" && data.secret) {
        setTotp({ secret: data.secret, otpauth: data.otpauth ?? "" });
      }
      if (action === "reset_password" && data.inviteUrl) {
        setResetLink({ email: selected.email, url: data.inviteUrl, emailed: Boolean(data.emailed) });
      }
      if (action === "delete") {
        setSelectedId(null);
        setResetLink(null);
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  const current = selected ? userSections(selected) : [];
  const dirty =
    selected && !selected.envAdmin && current !== "admin"
      ? draftSections.join(",") !== current.join(",")
      : false;

  return (
    <div className="relative min-h-full w-full px-3 pb-24 pt-3 sm:px-4 sm:pb-8">
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
            Katrai personai var atzīmēt vairākas sadaļas. Navigācijā redzamas tikai atļautās, sākuma lapa - pirmā
            atzīmētā. Pārbaude notiek serverī.
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

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <section className="overflow-hidden rounded-[22px] border border-[#E5E7EB] bg-white shadow-sm">
            <div className="hidden grid-cols-[1fr_minmax(0,220px)_88px_140px] gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9aa3b2] sm:grid">
              <span>Persona</span>
              <span>Sadaļas</span>
              <span>Statuss</span>
              <span>Pēdējā pieteikšanās</span>
            </div>
            <ul>
              {directory.map((user) => {
                const st = statusLabel(user.status);
                const active = selected?.id === user.id;
                const secs = userSections(user);
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
                        <span className="block truncate text-[12px] text-[#6b7280]">
                          {user.email || "env administrators"}
                        </span>
                      </span>
                      <span className="hidden min-w-0 flex-wrap justify-end gap-1 sm:flex">
                        {secs === "admin" ? (
                          <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-medium text-[#3d5bd9]">
                            Visas (administrators)
                          </span>
                        ) : (
                          uniqueSectionLabels(secs).map((label) => (
                            <span
                              key={label}
                              className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-medium text-[#3d5bd9]"
                            >
                              {label}
                            </span>
                          ))
                        )}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.className}`}>{st.text}</span>
                      <span className="hidden w-[140px] shrink-0 text-right text-[11px] text-[#9aa3b2] lg:block">
                        {formatWhen(user.lastLoginAt)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-[22px] border border-[#E5E7EB] bg-white p-4 shadow-sm xl:hidden">
            {selected ? <UserDetailCard
              selected={selected}
              draftSections={draftSections}
              sessions={sessions}
              totp={totp}
              totpCode={totpCode}
              setTotpCode={setTotpCode}
              busy={busy}
              dirty={Boolean(dirty)}
              error={error}
              resetLink={resetLink}
              onToggle={toggleDraft}
              onSave={() => void act("set_sections", { sections: draftSections })}
              onAct={act}
            /> : null}
          </section>

          <section className="rounded-[22px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9aa3b2]">Darbību žurnāls</p>
            <ul className="mt-3 space-y-2">
              {audit.length === 0 ? (
                <li className="text-[13px] text-[#6b7280]">Vēl nav ierakstu.</li>
              ) : (
                audit.map((row) => (
                  <li key={row.id} className="flex gap-2 text-[13px]">
                    <span className="w-16 shrink-0 text-[#9aa3b2]">{formatWhen(row.createdAt).split(" · ")[0]?.replace("šodien ", "")}</span>
                    <span className="min-w-0 text-[#111827] [overflow-wrap:anywhere]">
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
        </div>

        <aside className="hidden space-y-3 xl:block">
          {selected ? (
            <UserDetailCard
              selected={selected}
              draftSections={draftSections}
              sessions={sessions}
              totp={totp}
              totpCode={totpCode}
              setTotpCode={setTotpCode}
              busy={busy}
              dirty={Boolean(dirty)}
              error={error}
              resetLink={resetLink}
              onToggle={toggleDraft}
              onSave={() => void act("set_sections", { sections: draftSections })}
              onAct={act}
            />
          ) : null}
          <IrissCabinetAccessPanel users={users} />
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
            <p className="mb-2 text-[13px] font-medium">Sadaļas</p>
            <ul className="mb-3 divide-y divide-[#F3F4F6] rounded-2xl border border-[#E5E7EB]">
              {IRISS_SECTION_CATALOG.map((row) => {
                const on = inviteSections.includes(row.id);
                return (
                  <Fragment key={row.id}>
                    <AutoparksGroupHeader id={row.id} className="px-3 py-2.5 text-[14px] font-medium" />
                    <li className={`flex items-center justify-between py-2.5 pr-3 ${isAutoparksV2Section(row.id) ? "pl-8" : "pl-3"}`}>
                      <label className="flex flex-1 items-center gap-2 text-[14px]">
                        <input type="checkbox" checked={on} onChange={() => toggleInvite(row.id)} />
                        {sectionRowLabel(row.id, row.label)}
                      </label>
                      {on && inviteSections[0] === row.id ? (
                        <span className="text-[12px] text-[#3d5bd9]">sākuma lapa</span>
                      ) : null}
                    </li>
                  </Fragment>
                );
              })}
            </ul>
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
                disabled={busy || inviteSections.length === 0}
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

export function StaffUserAdminActions({
  status,
  busy,
  onAct,
}: {
  status: StaffStatus;
  busy: boolean;
  onAct: (action: StaffAdminActionId) => void;
}) {
  const actions = staffUserAdminActions(status);
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {actions.includes("revoke_sessions") ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onAct("revoke_sessions")}
          className="rounded-full border border-[#E5E7EB] px-3 py-1.5 text-[12px]"
        >
          Beigt sesijas
        </button>
      ) : null}
      {actions.includes("reset_password") ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onAct("reset_password")}
          className="rounded-full border border-[#E5E7EB] px-3 py-1.5 text-[12px]"
        >
          {staffResetPasswordLabel(status)}
        </button>
      ) : null}
      {actions.includes("restore") ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onAct("restore")}
          className="rounded-full bg-[#111827] px-3 py-1.5 text-[12px] text-white"
        >
          Atjaunot pieeju
        </button>
      ) : null}
      {actions.includes("revoke") ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onAct("revoke")}
          className="rounded-full px-3 py-1.5 text-[12px] text-[#B42318]"
        >
          Atsaukt pieeju
        </button>
      ) : null}
      {actions.includes("delete") ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onAct("delete")}
          className="rounded-full px-3 py-1.5 text-[12px] text-[#B42318]"
        >
          Dzēst lietotāju
        </button>
      ) : null}
    </div>
  );
}

function UserDetailCard({
  selected,
  draftSections,
  sessions,
  totp,
  totpCode,
  setTotpCode,
  busy,
  dirty,
  error,
  resetLink,
  onToggle,
  onSave,
  onAct,
}: {
  selected: DirectoryUser;
  draftSections: IrissSection[];
  sessions: SessionRow[];
  totp: { secret: string; otpauth: string } | null;
  totpCode: string;
  setTotpCode: (v: string) => void;
  busy: boolean;
  dirty: boolean;
  error: string | null;
  resetLink: { email: string; url: string; emailed: boolean } | null;
  onToggle: (id: IrissSection) => void;
  onSave: () => void;
  onAct: (action: string, extra?: Record<string, unknown>) => void;
}) {
  return (
    <section className="rounded-[22px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#EEF2FF] text-[13px] font-semibold text-[#3d5bd9]">
            {initials(selected.name)}
          </span>
          <div>
            <p className="text-[15px] font-semibold">{selected.name}</p>
            <p className="text-[12px] text-[#6b7280]">{selected.email || "env administrators"}</p>
          </div>
        </div>
        {!selected.envAdmin ? (
          <button
            type="button"
            disabled={busy || !dirty || draftSections.length === 0}
            onClick={onSave}
            className="rounded-full bg-[#EEF2FF] px-3 py-1.5 text-[12px] font-medium text-[#3d5bd9] disabled:opacity-40"
          >
            Saglabāt
          </button>
        ) : null}
      </div>

      {selected.envAdmin ? (
        <p className="mt-4 text-[13px] text-[#6b7280]">Visas sadaļas (administrators). Nila env pieteikšanās paliek nemainīta.</p>
      ) : (
        <>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9aa3b2]">Pieejamās sadaļas</p>
          <ul className="mt-2 divide-y divide-[#F3F4F6]">
            {IRISS_SECTION_CATALOG.map((row) => {
              const on = draftSections.includes(row.id);
              const pos = draftSections.indexOf(row.id);
              const home = pos === 0;
              return (
                <Fragment key={row.id}>
                  <AutoparksGroupHeader id={row.id} className="py-2 text-[14px] font-medium" />
                  <li className={`flex items-center justify-between py-2 ${isAutoparksV2Section(row.id) ? "pl-5" : ""}`}>
                    <label className="flex flex-1 items-center gap-2 text-[14px]">
                      <input type="checkbox" checked={on} onChange={() => onToggle(row.id)} />
                      {sectionRowLabel(row.id, row.label)}
                    </label>
                    {home ? (
                      <span className="text-[12px] text-[#3d5bd9]">sākuma lapa</span>
                    ) : on ? (
                      <span className="text-[12px] text-[#9aa3b2]">{pos + 1}.</span>
                    ) : null}
                  </li>
                </Fragment>
              );
            })}
          </ul>
          <p className="mt-2 text-[12px] leading-relaxed text-[#6b7280]">
            Sākuma lapa - pirmā atzīmētā ({draftSections[0] ? IRISS_SECTION_LABELS[draftSections[0]] : "-"}). Cenas, klientu
            dati un šofera personas dati šīm sadaļām netiek rādīti, ja tas nav atļauts. Izmaiņas stājas spēkā nākamajā
            pieprasījumā; atvērtās sesijas redz jauno sarakstu.
          </p>
        </>
      )}

      {!selected.envAdmin ? (
        <StaffUserAdminActions status={selected.status} busy={busy} onAct={(action) => void onAct(action)} />
      ) : null}
      {!selected.envAdmin && error ? <p className="mt-2 text-[13px] text-[#B42318]">{error}</p> : null}
      {!selected.envAdmin && resetLink ? (
        <div className="mt-3 space-y-2 rounded-xl bg-[#F8FAFC] p-3">
          <p className="text-[13px] text-[#111827]">
            {resetLink.emailed
              ? `Saite nosūtīta uz ${resetLink.email}. Derīga 24 h, vienu reizi.`
              : `E-pasts nav nosūtīts. Nokopē saiti un nosūti ${resetLink.email}.`}
          </p>
          <p className="break-all font-mono text-[11px] text-[#374151]">{resetLink.url}</p>
        </div>
      ) : null}
      {sessions[0] ? <p className="mt-3 text-[12px] text-[#6b7280]">Ierīce: {sessions[0].device}</p> : null}
      {totp && !selected.envAdmin ? (
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
            onClick={() => void onAct("totp_confirm", { code: totpCode })}
          >
            Apstiprināt 2FA
          </button>
        </div>
      ) : null}
    </section>
  );
}
