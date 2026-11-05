"use client";

import { useState } from "react";
import { ADMIN_B2B_BTN, ADMIN_B2B_BTN_SOLID, AdminB2bActionLabel } from "@/components/admin/AdminB2bAction";
import { ADMIN_PARTNER_INPUT_CLASS, ADMIN_PARTNER_LABEL_CLASS } from "@/lib/admin-b2b-partner-form";
import {
  B2B_WALLET_PRODUCT_IDS,
  B2B_WALLET_PRODUCTS,
  formatB2bWalletEuro,
  type B2bWalletPriceOverrides,
  type B2bWalletProductId,
  type B2bWalletTxnKind,
} from "@/lib/b2b-wallet";
import type { B2bWalletView } from "@/lib/b2b-wallet-view";

const PRODUCT_LABEL: Record<B2bWalletProductId, string> = {
  business: "PROVIN Business",
  dealer_raw: "Dīlera dati (RAW)",
  dealer_pro: "Dīlera dati (PRO)",
};

const KIND_LABEL: Record<B2bWalletTxnKind, string> = {
  topup: "Papildinājums",
  purchase: "Pirkums",
  refund: "Atmaksa",
  adjust: "Korekcija",
};

function centsInput(cents: number | null): string {
  return cents == null ? "" : (cents / 100).toFixed(2).replace(".", ",");
}

function formatAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("lv-LV", {
    timeZone: "Europe/Riga",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function newKey(): string {
  return `adm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function AdminB2bPartnerWallet({
  partnerId,
  initialWallet,
  initialOverrides,
  initialHidden,
}: {
  partnerId: string;
  initialWallet: B2bWalletView;
  initialOverrides: B2bWalletPriceOverrides;
  initialHidden: readonly B2bWalletProductId[];
}) {
  const [wallet, setWallet] = useState(initialWallet);
  const [hidden, setHidden] = useState<B2bWalletProductId[]>([...initialHidden]);
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [visibilityError, setVisibilityError] = useState("");
  const [visibilitySaved, setVisibilitySaved] = useState("");
  const [prices, setPrices] = useState<Record<B2bWalletProductId, string>>({
    business: centsInput(initialOverrides.business),
    dealer_raw: centsInput(initialOverrides.dealer_raw),
    dealer_pro: centsInput(initialOverrides.dealer_pro),
  });
  const [priceError, setPriceError] = useState("");
  const [priceSaved, setPriceSaved] = useState("");
  const [priceBusy, setPriceBusy] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustKey, setAdjustKey] = useState(newKey);
  const [adjustError, setAdjustError] = useState("");
  const [adjustSaved, setAdjustSaved] = useState("");
  const [adjustBusy, setAdjustBusy] = useState(false);

  const url = `/api/admin/partners/${encodeURIComponent(partnerId)}/wallet`;

  const savePrices = async (reset: boolean) => {
    setPriceBusy(true);
    setPriceError("");
    setPriceSaved("");
    try {
      const res = await fetch(url, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reset ? { reset: true } : { prices }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        wallet?: B2bWalletView;
        overrides?: B2bWalletPriceOverrides;
        message?: string;
      };
      if (!res.ok || !data.wallet || !data.overrides) {
        setPriceError(data.message ?? "Neizdevās saglabāt cenas.");
        return;
      }
      setWallet(data.wallet);
      setPrices({
        business: centsInput(data.overrides.business),
        dealer_raw: centsInput(data.overrides.dealer_raw),
        dealer_pro: centsInput(data.overrides.dealer_pro),
      });
      setPriceSaved(reset ? "Atjaunotas noklusējuma cenas." : "Cenas saglabātas.");
    } catch {
      setPriceError("Neizdevās saglabāt cenas.");
    } finally {
      setPriceBusy(false);
    }
  };

  const toggleVisible = async (product: B2bWalletProductId, visible: boolean) => {
    const next = B2B_WALLET_PRODUCT_IDS.filter((id) => (id === product ? !visible : hidden.includes(id)));
    setVisibilityBusy(true);
    setVisibilityError("");
    setVisibilitySaved("");
    try {
      const res = await fetch(url, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: next }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        wallet?: B2bWalletView;
        hidden?: B2bWalletProductId[];
      };
      if (!res.ok || !data.wallet || !data.hidden) {
        setVisibilityError("Neizdevās saglabāt redzamību.");
        return;
      }
      setWallet(data.wallet);
      setHidden(data.hidden);
      setVisibilitySaved(
        visible ? `${PRODUCT_LABEL[product]}: rāda partnerim.` : `${PRODUCT_LABEL[product]}: paslēpts partnerim.`,
      );
    } catch {
      setVisibilityError("Neizdevās saglabāt redzamību.");
    } finally {
      setVisibilityBusy(false);
    }
  };

  const adjust = async () => {
    setAdjustBusy(true);
    setAdjustError("");
    setAdjustSaved("");
    try {
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: adjustAmount, note: adjustNote, key: adjustKey }),
      });
      const data = (await res.json().catch(() => ({}))) as { wallet?: B2bWalletView; message?: string };
      if (!res.ok || !data.wallet) {
        setAdjustError(data.message ?? "Neizdevās koriģēt atlikumu.");
        return;
      }
      setWallet(data.wallet);
      setAdjustAmount("");
      setAdjustNote("");
      setAdjustKey(newKey());
      setAdjustSaved("Atlikums koriģēts.");
    } catch {
      setAdjustError("Neizdevās koriģēt atlikumu.");
    } finally {
      setAdjustBusy(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_2px_24px_rgba(15,23,42,0.05)]">
      <h2 className="text-sm font-semibold text-slate-800">Konta atlikums</h2>
      <dl className="mt-3 grid grid-cols-3 gap-3">
        {[
          { label: "Atlikums", value: wallet.balanceCents },
          { label: "Papildināts kopā", value: wallet.topupTotalCents },
          { label: "Iztērēts", value: wallet.spentTotalCents },
        ].map((item) => (
          <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2.5">
            <dt className={ADMIN_PARTNER_LABEL_CLASS}>{item.label}</dt>
            <dd className="text-lg font-semibold tabular-nums text-slate-900">{formatB2bWalletEuro(item.value)}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 border-t border-slate-200/80 pt-5">
        <h3 className="text-sm font-semibold text-slate-800">Pieejamie pakalpojumi</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Paslēptu pakalpojumu partneris portālā neredz un nevar pasūtīt. Izmaiņas saglabājas uzreiz.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {B2B_WALLET_PRODUCT_IDS.map((product) => (
            <label key={product} className="flex items-center gap-2.5 text-sm text-slate-800">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-[var(--color-provin-accent)] focus:ring-[var(--color-provin-accent)]"
                checked={!hidden.includes(product)}
                disabled={visibilityBusy}
                onChange={(event) => void toggleVisible(product, event.target.checked)}
                data-product={product}
              />
              {PRODUCT_LABEL[product]}
            </label>
          ))}
        </div>
        {visibilityError ? <p className="mt-3 text-sm text-red-600">{visibilityError}</p> : null}
        {visibilitySaved && !visibilityError ? (
          <p className="mt-3 text-sm text-emerald-700">{visibilitySaved}</p>
        ) : null}
      </div>

      <div className="mt-6 border-t border-slate-200/80 pt-5">
        <h3 className="text-sm font-semibold text-slate-800">Individuālās cenas</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {B2B_WALLET_PRODUCT_IDS.map((product) => {
            const spec = B2B_WALLET_PRODUCTS[product];
            return (
              <label key={product} className="block min-w-0">
                <span className={ADMIN_PARTNER_LABEL_CLASS}>{PRODUCT_LABEL[product]} (€)</span>
                <input
                  className={ADMIN_PARTNER_INPUT_CLASS}
                  value={prices[product]}
                  onChange={(event) => {
                    setPrices((prev) => ({ ...prev, [product]: event.target.value }));
                    setPriceError("");
                    setPriceSaved("");
                  }}
                  placeholder={centsInput(spec.defaultCents)}
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
          Ja lauks ir tukšs, piemēro noklusējuma cenu, ko jaunam partnerim piešķir automātiski. Katra pirkuma cenu
          noskaita no partnera atlikuma.
        </p>
        {priceError ? <p className="mt-3 text-sm text-red-600">{priceError}</p> : null}
        {priceSaved && !priceError ? <p className="mt-3 text-sm text-emerald-700">{priceSaved}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={ADMIN_B2B_BTN_SOLID} disabled={priceBusy} onClick={() => void savePrices(false)}>
            <AdminB2bActionLabel>{priceBusy ? "Saglabā…" : "Saglabāt cenas"}</AdminB2bActionLabel>
          </button>
          <button type="button" className={ADMIN_B2B_BTN} disabled={priceBusy} onClick={() => void savePrices(true)}>
            <AdminB2bActionLabel>Atjaunot noklusējuma cenas</AdminB2bActionLabel>
          </button>
        </div>
      </div>

      <div className="mt-6 border-t border-slate-200/80 pt-5">
        <h3 className="text-sm font-semibold text-slate-800">Atlikuma korekcija</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Piem. manuāla atmaksa: 19,99 (pieskaita) vai -19,99 (noņem). Piezīme ir obligāta un redzama darījumu vēsturē.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_1fr]">
          <label className="block min-w-0">
            <span className={ADMIN_PARTNER_LABEL_CLASS}>Summa (€)</span>
            <input
              className={ADMIN_PARTNER_INPUT_CLASS}
              value={adjustAmount}
              onChange={(event) => {
                setAdjustAmount(event.target.value);
                setAdjustError("");
                setAdjustSaved("");
              }}
              placeholder="19,99"
              inputMode="decimal"
            />
          </label>
          <label className="block min-w-0">
            <span className={ADMIN_PARTNER_LABEL_CLASS}>Piezīme</span>
            <input
              className={ADMIN_PARTNER_INPUT_CLASS}
              value={adjustNote}
              onChange={(event) => {
                setAdjustNote(event.target.value);
                setAdjustError("");
              }}
              maxLength={300}
              placeholder="Atmaksa par VIN ..."
            />
          </label>
        </div>
        {adjustError ? <p className="mt-3 text-sm text-red-600">{adjustError}</p> : null}
        {adjustSaved && !adjustError ? <p className="mt-3 text-sm text-emerald-700">{adjustSaved}</p> : null}
        <button
          type="button"
          className={`${ADMIN_B2B_BTN_SOLID} mt-4`}
          disabled={adjustBusy || !adjustAmount.trim() || !adjustNote.trim()}
          onClick={() => void adjust()}
        >
          <AdminB2bActionLabel>{adjustBusy ? "Saglabā…" : "Koriģēt atlikumu"}</AdminB2bActionLabel>
        </button>
      </div>

      <div className="mt-6 border-t border-slate-200/80 pt-5">
        <h3 className="text-sm font-semibold text-slate-800">Darījumu vēsture</h3>
        {wallet.txns.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">Darījumu vēl nav.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-slate-500">
                  <th className="pb-2 pr-3">Laiks</th>
                  <th className="pb-2 pr-3">Darījums</th>
                  <th className="pb-2 pr-3">Detaļas</th>
                  <th className="pb-2 pr-3 text-right">Summa</th>
                  <th className="pb-2 text-right">Atlikums</th>
                </tr>
              </thead>
              <tbody>
                {wallet.txns.map((txn) => (
                  <tr key={txn.id} className="border-t border-slate-100 align-top">
                    <td className="whitespace-nowrap py-2 pr-3 text-slate-500">{formatAt(txn.at)}</td>
                    <td className="py-2 pr-3 font-medium text-slate-800">{KIND_LABEL[txn.kind]}</td>
                    <td className="py-2 pr-3 text-slate-600">
                      {[
                        txn.product ? PRODUCT_LABEL[txn.product] : "",
                        txn.vin ?? "",
                        txn.orderId ?? "",
                        txn.note ?? "",
                      ]
                        .filter(Boolean)
                        .join(" · ") || "-"}
                    </td>
                    <td
                      className={`whitespace-nowrap py-2 pr-3 text-right font-semibold tabular-nums ${txn.amountCents >= 0 ? "text-emerald-700" : "text-slate-900"}`}
                    >
                      {txn.amountCents > 0 ? "+" : ""}
                      {formatB2bWalletEuro(txn.amountCents)}
                    </td>
                    <td className="whitespace-nowrap py-2 text-right tabular-nums text-slate-600">
                      {formatB2bWalletEuro(txn.balanceAfterCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
