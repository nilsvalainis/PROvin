"use client";

import { useState } from "react";
import { ADMIN_PARTNER_INPUT_CLASS, ADMIN_PARTNER_LABEL_CLASS } from "@/lib/admin-b2b-partner-form";
import {
  B2B_INVITE_LEGACY_LABELS,
  B2B_INVITE_WALLET_LABELS,
  b2bInviteHasCustomPricing,
  b2bInviteLegacyDefaultCents,
  b2bInvitePriceSummary,
  type B2bInvitePricing,
} from "@/lib/b2b-partner-invite";
import { B2B_WALLET_PRODUCT_IDS, B2B_WALLET_PRODUCTS, formatB2bWalletEuro } from "@/lib/b2b-wallet";

type InviteRow = {
  token: string;
  createdAt: string;
  expiresAt: string;
  path: string;
  walletPrices?: B2bInvitePricing["walletPrices"];
  prices?: B2bInvitePricing["prices"];
};

const emptyWallet = { business: "", dealer_raw: "", dealer_pro: "" };
const emptyPacks = { business1: "", business10: "", dealer1: "", dealer10: "" };

function centsPlaceholder(cents: number): string {
  return formatB2bWalletEuro(cents).replace(" €", "");
}

export function AdminB2bInvitePanel() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastInvite, setLastInvite] = useState<InviteRow | null>(null);
  const [lastPath, setLastPath] = useState("");
  const [copied, setCopied] = useState(false);
  const [walletPrices, setWalletPrices] = useState(emptyWallet);
  const [packPrices, setPackPrices] = useState(emptyPacks);

  const createInvite = async () => {
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const res = await fetch("/api/admin/partners/invites", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletPrices, prices: packPrices }),
      });
      const data = (await res.json()) as { error?: string; message?: string; invite?: InviteRow };
      if (!res.ok || !data.invite?.path) {
        setError(data.message || "Neizdevās izveidot ielūgumu.");
        return;
      }
      const absolute =
        typeof window !== "undefined" ? `${window.location.origin}/lv${data.invite.path}` : data.invite.path;
      setLastInvite(data.invite);
      setLastPath(absolute);
    } catch {
      setError("Neizdevās izveidot ielūgumu.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!lastPath) return;
    try {
      await navigator.clipboard.writeText(lastPath);
      setCopied(true);
    } catch {
      setError("Neizdevās nokopēt saiti.");
    }
  };

  const createdPricing =
    lastInvite?.walletPrices && lastInvite.prices
      ? { walletPrices: lastInvite.walletPrices, prices: lastInvite.prices }
      : null;
  const summary = createdPricing ? b2bInvitePriceSummary(createdPricing) : [];

  return (
    <div className="mt-6 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_2px_24px_rgba(15,23,42,0.05)]">
      <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">Ielūguma saite</h2>
      <p className="mt-1 text-[13px] text-[var(--color-provin-muted)]">
        Partneris reģistrējas pats pa unikālo saiti. Publiska reģistrācija paliek slēgta. Saite derīga 14 dienas.
      </p>

      <div className="mt-5 border-t border-slate-200/80 pt-5">
        <h3 className="text-sm font-semibold text-slate-800">Individuālās cenas</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {B2B_WALLET_PRODUCT_IDS.map((product) => {
            const spec = B2B_WALLET_PRODUCTS[product];
            return (
              <label key={product} className="block min-w-0">
                <span className={ADMIN_PARTNER_LABEL_CLASS}>{B2B_INVITE_WALLET_LABELS[product]} (€)</span>
                <input
                  className={ADMIN_PARTNER_INPUT_CLASS}
                  value={walletPrices[product]}
                  onChange={(event) => {
                    setWalletPrices((prev) => ({ ...prev, [product]: event.target.value }));
                    setError("");
                  }}
                  placeholder={centsPlaceholder(spec.defaultCents)}
                  inputMode="decimal"
                />
                <span className="mt-1 block text-[11px] text-slate-500">
                  Noklusējums: {formatB2bWalletEuro(spec.defaultCents)} · min. {formatB2bWalletEuro(spec.minCents)}
                </span>
              </label>
            );
          })}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Ja lauks ir tukšs, piemēro noklusējuma cenu, ko jaunam partnerim piešķir automātiski. Cenas paliek ielūgumā,
          ne saitē. Partneris tās reģistrācijā neredz un nevar mainīt.
        </p>
      </div>

      <div className="mt-5 border-t border-slate-200/80 pt-5">
        <h3 className="text-sm font-semibold text-slate-800">Veco kredītu paku cenas</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Tukša cena = kataloga noklusējums (
          {formatB2bWalletEuro(b2bInviteLegacyDefaultCents("business1"))} /{" "}
          {formatB2bWalletEuro(b2bInviteLegacyDefaultCents("business10"))} Audits;{" "}
          {formatB2bWalletEuro(b2bInviteLegacyDefaultCents("dealer1"))} /{" "}
          {formatB2bWalletEuro(b2bInviteLegacyDefaultCents("dealer10"))} Dīlera).
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(["business1", "business10", "dealer1", "dealer10"] as const).map((key) => (
            <label key={key} className="block min-w-0">
              <span className={ADMIN_PARTNER_LABEL_CLASS}>{B2B_INVITE_LEGACY_LABELS[key]} (€)</span>
              <input
                className={ADMIN_PARTNER_INPUT_CLASS}
                value={packPrices[key]}
                onChange={(event) => {
                  setPackPrices((prev) => ({ ...prev, [key]: event.target.value }));
                  setError("");
                }}
                placeholder={centsPlaceholder(b2bInviteLegacyDefaultCents(key))}
                inputMode="decimal"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void createInvite()}
          className="inline-flex items-center rounded-full bg-[var(--color-provin-accent)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--color-provin-accent-hover)] disabled:opacity-50 max-md:min-h-11 max-md:px-5 max-md:text-[15px]"
        >
          {busy ? "Veido…" : "Izveidot ielūgumu"}
        </button>
        {lastPath ? (
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800"
          >
            {copied ? "Nokopēts" : "Kopēt saiti"}
          </button>
        ) : null}
      </div>
      {lastPath ? (
        <p className="mt-2 break-all font-mono text-[11px] text-[var(--color-apple-text)]">{lastPath}</p>
      ) : null}
      {summary.length > 0 ? (
        <div className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            {createdPricing && b2bInviteHasCustomPricing(createdPricing)
              ? "Cenas šajā ielūgumā"
              : "Šajā ielūgumā kataloga noklusējuma cenas"}
          </p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {summary.map((line) => (
              <li key={line.id} className="text-[12px] text-slate-700">
                <span className="text-slate-500">{line.label}:</span>{" "}
                <span className="tabular-nums font-medium text-slate-900">{line.display}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-[12px] text-amber-800">{error}</p> : null}
    </div>
  );
}
