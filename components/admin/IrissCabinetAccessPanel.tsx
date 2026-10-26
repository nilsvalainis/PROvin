"use client";

import { formatRigaIsoShort } from "@/lib/riga-datetime";
import { useCallback, useEffect, useState } from "react";
import {
  CABINET_ACCESS_ROLES,
  type CabinetAccessRole,
} from "@/lib/iriss-logistics-cabinet-access";
import { CABINET_SECTIONS, type CabinetAccessRule, type CabinetSectionId } from "@/lib/iriss-logistics-cabinet";
import type { StaffUserPublic } from "@/lib/staff-types";

const ROLE_LV: Record<CabinetAccessRole, string> = {
  logistika: "Loģistika",
  gramatvede: "Grāmatvede",
  serviss: "Serviss",
};

type AuditRow = { id: string; at: string; actorId: string; action: string; detail: string; carId: string; docType: string };

export function IrissCabinetAccessPanel({ users }: { users: StaffUserPublic[] }) {
  const [rules, setRules] = useState<CabinetAccessRule[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<CabinetAccessRole | "">("gramatvede");
  const [carId, setCarId] = useState("");
  const [section, setSection] = useState<CabinetSectionId | "">("");
  const [docType, setDocType] = useState<"invoices" | "">("");
  const [allow, setAllow] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/iriss-logistics/cabinet-access", { credentials: "include", cache: "no-store" });
    const data = (await res.json()) as { rules?: CabinetAccessRule[]; audit?: AuditRow[] };
    setRules(data.rules ?? []);
    setAudit(data.audit ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    try {
      await fetch("/api/admin/iriss-logistics/cabinet-access", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role, carId: carId.trim(), section, docType, allow }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await fetch("/api/admin/iriss-logistics/cabinet-access", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 rounded-[22px] border border-[var(--iriss-line)] bg-white p-4 shadow-sm">
      <h2 className="text-[15px] font-semibold">Kabineta pieeja (A/B/C × dokumenta tips)</h2>
      <p className="mt-1 text-[12px] leading-relaxed text-[var(--iriss-ink-2)]">
        Noklusējums: Loģistika neredz A un rēķinus, Grāmatvede tikai lasa A rēķinus un C piešķirtajiem auto, Serviss
        neredz rēķinus. Piešķirt auto: lietotājs + Grāmatvede + auto ID, sadaļa Visas, tips Visi, Atļaut. Pārbaude ir
        servera pusē; skatījumi paliek auditā.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-[12px] text-[var(--iriss-ink-2)]">
          Lietotājs (tukšs = loma)
          <select value={userId} onChange={(e) => setUserId(e.target.value)} className="mt-1 h-9 w-full rounded-xl border border-[var(--iriss-line)] px-2 text-[13px]">
            <option value="">Visi šīs lomas</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px] text-[var(--iriss-ink-2)]">
          Loma
          <select value={role} onChange={(e) => setRole(e.target.value as CabinetAccessRole | "")} className="mt-1 h-9 w-full rounded-xl border border-[var(--iriss-line)] px-2 text-[13px]">
            <option value="">-</option>
            {CABINET_ACCESS_ROLES.map((id) => (
              <option key={id} value={id}>
                {ROLE_LV[id]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px] text-[var(--iriss-ink-2)]">
          Auto ID (tukšs = visi)
          <input
            value={carId}
            onChange={(e) => setCarId(e.target.value)}
            placeholder="lo-"
            className="mt-1 h-9 w-full rounded-xl border border-[var(--iriss-line)] px-2 text-[13px]"
          />
        </label>
        <label className="text-[12px] text-[var(--iriss-ink-2)]">
          Sadaļa
          <select value={section} onChange={(e) => setSection(e.target.value as CabinetSectionId | "")} className="mt-1 h-9 w-full rounded-xl border border-[var(--iriss-line)] px-2 text-[13px]">
            <option value="">Visas</option>
            {CABINET_SECTIONS.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px] text-[var(--iriss-ink-2)]">
          Tips
          <select value={docType} onChange={(e) => setDocType(e.target.value as "invoices" | "")} className="mt-1 h-9 w-full rounded-xl border border-[var(--iriss-line)] px-2 text-[13px]">
            <option value="invoices">Rēķini</option>
            <option value="">Visi tipi</option>
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={allow} onChange={(e) => setAllow(e.target.checked)} />
          Atļaut
        </label>
        <button
          type="button"
          disabled={busy || (!userId && !role)}
          onClick={() => void save()}
          className="rounded-full bg-[var(--iriss-graphite)] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40"
        >
          Saglabāt likumu
        </button>
      </div>
      <ul className="mt-3 divide-y divide-[#F3F4F6] text-[13px]">
        {rules.length === 0 ? <li className="py-2 text-[var(--iriss-ink-2)]">Nav pārrakstījumu. Strādā lomu noklusējumi.</li> : null}
        {rules.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-2 py-2">
            <span>
              {row.userId || ROLE_LV[(row.role as CabinetAccessRole) || "logistika"] || row.role}
              {row.carId ? ` · ${row.carId}` : ""} · {row.section || "visas"} · {row.docType || "visi"} ·{" "}
              {row.allow ? "atļaut" : "aizliegt"}
            </span>
            <button type="button" className="text-[12px] text-[#B42318]" onClick={() => void remove(row.id)}>
              Dzēst
            </button>
          </li>
        ))}
      </ul>
      {audit.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--iriss-ink-3)]">Audits</p>
          <ul className="mt-1 space-y-1 text-[12px] text-[var(--iriss-ink-2)]">
            {audit.slice(0, 8).map((row) => (
              <li key={row.id}>
                {formatRigaIsoShort(row.at)} · {row.action} · {row.docType || row.detail}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
