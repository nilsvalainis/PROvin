"use client";

import { useState } from "react";
import { ADMIN_B2B_BTN_SOLID } from "@/components/admin/AdminB2bAction";
import { ADMIN_PARTNER_INPUT_CLASS, ADMIN_PARTNER_LABEL_CLASS } from "@/lib/admin-b2b-partner-form";
import type { B2bPartnerEmbedSettings, B2bPartnerEmbedTone } from "@/lib/b2b-partner-embed";

export type AdminPartnerBusinessSale = { id: string; created: number; amountCents: number; vin: string };

function formatSaleAt(sec: number): string {
  return new Intl.DateTimeFormat("lv-LV", { timeZone: "Europe/Riga", day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(sec * 1000),
  );
}

function embedSnippet(partnerId: string, tone: B2bPartnerEmbedTone): string {
  return [
    `<div data-provin-business data-partner="${partnerId}"${tone === "dark" ? ' data-tone="dark"' : ""}></div>`,
    `<script async src="https://www.provin.lv/embed/provin-business.js"></script>`,
  ].join("\n");
}

/** PRO admin: PROVIN Business poga partnera vietnē (domēni, logo, tonis). */
export function AdminB2bPartnerEmbed({
  partnerId,
  initial,
  sales,
}: {
  partnerId: string;
  initial: B2bPartnerEmbedSettings;
  /** null = Stripe uzskaiti neizdevās nolasīt. */
  sales: AdminPartnerBusinessSale[] | null;
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [domains, setDomains] = useState(initial.domains.join("\n"));
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [logoOnDarkUrl, setLogoOnDarkUrl] = useState(initial.logoOnDarkUrl);
  const [logoOnLightUrl, setLogoOnLightUrl] = useState(initial.logoOnLightUrl);
  const [buttonTone, setButtonTone] = useState<B2bPartnerEmbedTone>(initial.buttonTone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const save = async () => {
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const res = await fetch(`/api/admin/partners/${encodeURIComponent(partnerId)}/embed`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, domains, displayName, logoOnDarkUrl, logoOnLightUrl, buttonTone }),
      });
      const data = (await res.json().catch(() => ({}))) as { embed?: B2bPartnerEmbedSettings; message?: string };
      if (!res.ok || !data.embed) {
        setError(data.message ?? "Neizdevās saglabāt.");
        return;
      }
      setEnabled(data.embed.enabled);
      setDomains(data.embed.domains.join("\n"));
      setDisplayName(data.embed.displayName);
      setLogoOnDarkUrl(data.embed.logoOnDarkUrl);
      setLogoOnLightUrl(data.embed.logoOnLightUrl);
      setButtonTone(data.embed.buttonTone);
      setSaved("Saglabāts.");
    } catch {
      setError("Neizdevās saglabāt.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_2px_24px_rgba(15,23,42,0.05)]">
      <h2 className="text-sm font-semibold text-slate-800">Business poga partnera vietnē</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        Poga partnera auto sludinājumā ved uz PROVIN Business datu atskaiti (69,99 €). Saite strādā tikai no šeit
        norādītajiem domēniem.
      </p>

      <label className="mt-4 flex items-center gap-2.5 text-sm text-slate-800">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-[var(--color-provin-accent)] focus:ring-[var(--color-provin-accent)]"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Poga ieslēgta
      </label>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block min-w-0">
          <span className={ADMIN_PARTNER_LABEL_CLASS}>Domēni (katrs savā rindā, līdz 5)</span>
          <textarea
            className={`${ADMIN_PARTNER_INPUT_CLASS} min-h-[88px] py-2`}
            value={domains}
            placeholder="percunbrauc.lv"
            onChange={(e) => setDomains(e.target.value)}
          />
          <span className="mt-1 block text-[11px] text-slate-500">Apakšdomēni (www, ru.) der automātiski.</span>
        </label>
        <div className="grid gap-3">
          <label className="block min-w-0">
            <span className={ADMIN_PARTNER_LABEL_CLASS}>Nosaukums lapā</span>
            <input
              className={ADMIN_PARTNER_INPUT_CLASS}
              value={displayName}
              placeholder="Pērc un brauc"
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label className="block min-w-0">
            <span className={ADMIN_PARTNER_LABEL_CLASS}>Pogas tonis partnera vietnē</span>
            <select
              className={ADMIN_PARTNER_INPUT_CLASS}
              value={buttonTone}
              onChange={(e) => setButtonTone(e.target.value === "dark" ? "dark" : "light")}
            >
              <option value="light">Balts</option>
              <option value="dark">Tumšs</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {(
          [
            ["Logo tumšam fonam (https)", logoOnDarkUrl, setLogoOnDarkUrl, "bg-[#0b0b0d]"],
            ["Logo gaišam fonam (https)", logoOnLightUrl, setLogoOnLightUrl, "bg-slate-100"],
          ] as const
        ).map(([label, value, set, bg]) => (
          <label key={label} className="block min-w-0">
            <span className={ADMIN_PARTNER_LABEL_CLASS}>{label}</span>
            <input
              className={ADMIN_PARTNER_INPUT_CLASS}
              value={value}
              placeholder="https://..."
              onChange={(e) => set(e.target.value)}
            />
            <span className={`mt-2 flex h-14 items-center justify-center rounded-xl ${bg}`}>
              {/^https:\/\//.test(value) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={value} alt="" className="max-h-8 max-w-[70%] object-contain" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-[11px] text-slate-400">Nav logo</span>
              )}
            </span>
          </label>
        ))}
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {saved && !error ? <p className="mt-3 text-sm text-emerald-700">{saved}</p> : null}
      <button type="button" className={`${ADMIN_B2B_BTN_SOLID} mt-4`} disabled={busy} onClick={() => void save()}>
        Saglabāt
      </button>

      <div className="mt-6 border-t border-slate-200/80 pt-5">
        <h3 className="text-sm font-semibold text-slate-800">Kods partnera vietnei</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Ievietot auto sludinājuma lapā, vietā, kur jābūt pogai. VIN poga atrod pati sludinājuma adresē vai lapas
          tekstā aiz «VIN» (vai data-vin=&quot;...&quot;). Ja VIN publiski nav, poga netiek rādīta. Neobligāti: data-title, data-img, data-year, data-km, data-fuel, data-gear,
          data-height, data-radius. VIN vai numurzīmei jābūt sludinājuma lapas kodā.
        </p>
        <pre className="mt-3 overflow-x-auto whitespace-pre rounded-xl bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
          {embedSnippet(partnerId, buttonTone)}
        </pre>
      </div>

      <div className="mt-6 border-t border-slate-200/80 pt-5">
        <h3 className="text-sm font-semibold text-slate-800">Pirkumi caur pogu</h3>
        {sales == null ? (
          <p className="mt-2 text-sm text-slate-500">Neizdevās nolasīt Stripe datus.</p>
        ) : sales.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Vēl nav pirkumu.</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-slate-500">
              Kopā: {sales.length} ·{" "}
              {(sales.reduce((n, x) => n + x.amountCents, 0) / 100).toFixed(2).replace(".", ",")} €
            </p>
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {sales.map((x) => (
                <li key={x.id} className="flex justify-between gap-3 py-2">
                  <span className="tabular-nums text-slate-500">{formatSaleAt(x.created)}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-slate-800">{x.vin || "-"}</span>
                  <span className="tabular-nums text-slate-800">{(x.amountCents / 100).toFixed(2).replace(".", ",")} €</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
