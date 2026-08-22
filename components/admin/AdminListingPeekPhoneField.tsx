"use client";

import { useState } from "react";
import { AdminWhatsAppOpenButton } from "@/components/admin/AdminWhatsAppOpenButton";

/** Tālrunis + WhatsApp poga tajā pašā rindā (ātrie vērtējumi). */
export function AdminListingPeekPhoneField({ defaultValue }: { defaultValue: string }) {
  const [phone, setPhone] = useState(defaultValue);

  return (
    <label className="min-w-0">
      <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-provin-muted)]">
        Tālrunis
      </span>
      <div className="flex items-center gap-1.5">
        <input
          type="tel"
          name="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          aria-label="Tālrunis"
          autoComplete="off"
          placeholder="Nav tālruņa"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm font-medium text-[var(--color-apple-text)] outline-none focus:border-[var(--color-provin-accent)]"
        />
        <AdminWhatsAppOpenButton phone={phone} />
      </div>
    </label>
  );
}
