"use client";

import type { ReactNode } from "react";
import { AdminClientOrdersChip } from "@/components/admin/AdminClientOrdersChip";
import { AdminSavableTextField } from "@/components/admin/AdminSavableTextField";
import { AdminWhatsAppOpenButton } from "@/components/admin/AdminWhatsAppOpenButton";
import {
  adminContactChannelLabel,
  normalizeAdminContactChannel,
  summarizeCustomerKnown,
  type CustomerHistory,
} from "@/lib/admin-customer-history";
import { formatListingPeekSubmittedAt } from "@/lib/listing-peek-deadline";
import { partnerAuditPurposeLabelLv } from "@/lib/b2b-partner-orders";

const CHANNEL_OPTIONS = [
  { value: "", label: "E-pasts" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
] as const;

function Chip({ children, tone }: { children: ReactNode; tone: "repeat" | "peek" | "telegram" }) {
  const cls =
    tone === "telegram"
      ? "border-amber-300/90 bg-amber-50 text-amber-950"
      : tone === "peek"
        ? "border-emerald-200 bg-emerald-50 text-emerald-950"
        : "border-slate-300 bg-slate-50 text-slate-800";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] ${cls}`}>
      {children}
    </span>
  );
}

export function AdminCustomerCard({
  history,
  partnerCompanyName,
  partnerAuditPurpose,
  name,
  email,
  phone,
  contactMethod,
  onName,
  onEmail,
  onPhone,
  onContactMethod,
  whatsappPrefill,
  resetVersion,
}: {
  history: CustomerHistory | null;
  partnerCompanyName?: string | null;
  partnerAuditPurpose?: "client" | "internal" | null;
  name: string;
  email: string;
  phone: string;
  contactMethod: string;
  onName: (v: string) => void;
  onEmail: (v: string) => void;
  onPhone: (v: string) => void;
  onContactMethod: (v: string) => void;
  whatsappPrefill: string;
  resetVersion: string;
}) {
  const channel = normalizeAdminContactChannel(contactMethod);
  const known = CHANNEL_OPTIONS.some((o) => o.value === channel);
  const summary = summarizeCustomerKnown(history);
  const emailOrders = (history?.otherPaid ?? []).filter((p) => p.matchVia === "email" || p.matchVia === "email_and_phone");
  const phoneOnlyOrders = (history?.otherPaid ?? []).filter((p) => p.matchVia === "phone");
  const peeks = history?.peeks ?? [];
  const toChip = (rows: typeof emailOrders) =>
    rows.map((p) => ({
      id: p.id,
      created: p.created,
      vin: p.vin,
      amountTotal: p.amountTotal,
      href: p.href,
    }));

  return (
    <div className="space-y-2 px-2 pb-2">
      {partnerCompanyName?.trim() ? (
        <div className="rounded-md bg-violet-50 px-2 py-1.5 ring-1 ring-violet-200/80">
          <p className="text-[9px] font-bold uppercase tracking-wide text-violet-800">Partnera SIA</p>
          <p className="text-[13px] font-semibold text-violet-950">{partnerCompanyName.trim()}</p>
          {partnerAuditPurposeLabelLv(partnerAuditPurpose) ? (
            <p className="mt-0.5 text-[11px] font-medium text-violet-900">
              {partnerAuditPurposeLabelLv(partnerAuditPurpose)}
            </p>
          ) : null}
        </div>
      ) : null}

      {history?.flags.repeatPaid || history?.flags.hasPeek || history?.flags.telegramGroup ? (
        <div className="flex flex-wrap gap-1">
          {history.flags.repeatPaid ? <Chip tone="repeat">Atkārtots</Chip> : null}
          {history.flags.hasPeek ? (
            <Chip tone="peek">
              {history.flags.hasSentPeekComment
                ? `Ātrais vērtējums (${history.peeks.length})`
                : "Ātrais vērtējums"}
            </Chip>
          ) : null}
          {history.flags.telegramGroup ? <Chip tone="telegram">Telegram grupa</Chip> : null}
        </div>
      ) : null}

      {summary ? (
        <p className="text-[12px] font-medium leading-snug text-[var(--color-apple-text)]">{summary}</p>
      ) : null}

      <AdminSavableTextField
        id="edit-customer-name"
        label="Vārds, uzvārds"
        value={name}
        onChange={onName}
        placeholder="Klienta vārds"
        compact
        hideToolbar
        resetVersion={resetVersion}
      />
      <AdminSavableTextField
        id="edit-customer-email"
        label="E-pasts"
        value={email}
        onChange={onEmail}
        placeholder="epasts@piemers.lv"
        compact
        hideToolbar
        resetVersion={resetVersion}
      />
      {emailOrders.length > 0 ? (
        <p className="-mt-1 flex items-center gap-1.5 px-1 text-[11.5px] text-[#8e8e93]">
          E-pasts
          <AdminClientOrdersChip items={toChip(emailOrders)} />
        </p>
      ) : null}
      <AdminSavableTextField
        id="edit-customer-phone"
        label="Tālrunis"
        value={phone}
        onChange={onPhone}
        placeholder="+371..."
        compact
        hideToolbar
        resetVersion={resetVersion}
        endAdornment={<AdminWhatsAppOpenButton phone={phone} prefillMessage={whatsappPrefill} />}
      />
      {phoneOnlyOrders.length > 0 ? (
        <p className="-mt-1 flex items-center gap-1.5 px-1 text-[11.5px] text-[#8e8e93]">
          Tālrunis
          <AdminClientOrdersChip items={toChip(phoneOnlyOrders)} />
        </p>
      ) : null}

      <label className="block min-w-0">
        <span className="mb-0.5 block text-[9px] font-medium text-[var(--color-provin-muted)]">Kontaktkanāls</span>
        <select
          id="edit-customer-channel"
          value={known ? channel : "__other"}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__other") return;
            onContactMethod(v);
          }}
          className="h-8 w-full rounded-md border border-slate-200/90 bg-white px-2 text-[12px] text-[var(--color-apple-text)] outline-none focus:ring-2 focus:ring-[var(--color-provin-accent)]/30"
        >
          {CHANNEL_OPTIONS.map((o) => (
            <option key={o.value || "email"} value={o.value}>
              {o.label}
            </option>
          ))}
          {!known ? <option value="__other">{adminContactChannelLabel(contactMethod)}</option> : null}
        </select>
      </label>

      {peeks.length > 0 ? (
        <ul className="space-y-1 rounded-lg border border-emerald-100/90 bg-emerald-50/30 px-2 py-1.5">
          {peeks.slice(0, 3).map((peek) => (
            <li key={peek.id} className="flex flex-wrap items-baseline justify-between gap-x-2 text-[11px]">
              <span className="font-medium text-[var(--color-apple-text)]">
                {formatListingPeekSubmittedAt(peek.createdAt)}
              </span>
              <span className="text-[var(--color-provin-muted)]">
                {peek.comment ? "Nosūtīts" : "Nav atbildes"}
              </span>
            </li>
          ))}
          {peeks.length > 3 ? (
            <li className="text-[10px] text-[var(--color-provin-muted)]">+{peeks.length - 3} vēsture zemāk</li>
          ) : null}
        </ul>
      ) : null}

    </div>
  );
}
