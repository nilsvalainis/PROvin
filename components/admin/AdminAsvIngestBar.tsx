"use client";

import { useMemo, useState } from "react";
import { normalizeVin } from "@/lib/order-field-validation";
import {
  ASV_DEFAULT_PRODUCT_IDS,
  ASV_PRODUCTS,
  asvProductsCostUsdCents,
  formatAsvCostUsd,
  type AsvProductId,
} from "@/lib/asv-catalog";
import type { AsvBlockState } from "@/lib/asv-report";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

function asvFetchErrorLv(code: string): string {
  switch (code) {
    case "insufficient_balance":
      return "Nepietiekams OneAutoAPI konta atlikums.";
    case "invalid_vin":
      return "Nederīgs VIN.";
    case "missing_oneauto_credentials":
      return "Serverī nav ONEAUTO_API_KEY.";
    case "no_products_selected":
      return "Atzīmē vismaz vienu produktu.";
    case "unauthorized":
      return "Admin sesija beigusies. Ielādē lapu no jauna.";
    case "pending":
      return "VIN Audit vēl apstrādā pieprasījumu. Pagaidi un spied Ielādēt vēlreiz.";
    case "api_unavailable":
      return "Šis One Auto US produkts šobrīd nav pieejams šim ceļam. Raksti help@oneautoapi.com vai iestati ONEAUTO_ASV_VHR_PATH.";
    default:
      return "One Auto API neatbildēja. Mēģini vēlreiz.";
  }
}

type Props = {
  orderVin: string;
  sessionId?: string;
  editable: boolean;
  lastFetchedVin: string;
  hasMappedData: boolean;
  selectedProducts: AsvProductId[];
  onSelectedProductsChange: (next: AsvProductId[]) => void;
  onFetched: (block: AsvBlockState) => void;
};

export function AdminAsvIngestBar({
  orderVin,
  sessionId = "",
  editable,
  lastFetchedVin,
  hasMappedData,
  selectedProducts,
  onSelectedProductsChange,
  onFetched,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vinOverride, setVinOverride] = useState("");
  const effectiveVin = normalizeVin(vinOverride || orderVin);
  const selectedSet = useMemo(() => new Set(selectedProducts), [selectedProducts]);
  const estimatedCost = formatAsvCostUsd(asvProductsCostUsdCents(selectedProducts));
  const cachedForVin = Boolean(lastFetchedVin) && normalizeVin(lastFetchedVin) === effectiveVin;

  const toggleProduct = (id: AsvProductId, checked: boolean) => {
    const next = checked
      ? [...ASV_PRODUCTS.map((p) => p.id).filter((pid) => pid === id || selectedSet.has(pid))]
      : selectedProducts.filter((pid) => pid !== id);
    onSelectedProductsChange(next.length > 0 ? next : [...ASV_DEFAULT_PRODUCT_IDS]);
  };

  const fetchData = async () => {
    if (!editable || busy) return;
    if (selectedProducts.length === 0) {
      setError(asvFetchErrorLv("no_products_selected"));
      return;
    }
    if (cachedForVin && hasMappedData) {
      const ok = window.confirm(
        `Šim VIN jau ir saglabāti ASV dati. Ielādēt no jauna? Tas atkārtoti iekasēs ${estimatedCost}.`,
      );
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sources/asv", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vin: effectiveVin,
          products: selectedProducts,
          sessionId: sessionId || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        block?: AsvBlockState;
        costUsd?: string;
        storedPhotoGroups?: AsvBlockState["photoGroups"];
      };
      if (!res.ok && !body.block) {
        setError(asvFetchErrorLv(body.error ?? "upstream_error"));
        return;
      }
      if (body.error && res.status === 402) {
        setError(asvFetchErrorLv("insufficient_balance"));
      } else if (body.error === "pending" || res.status === 202) {
        setError(asvFetchErrorLv("pending"));
      } else if (body.error === "api_unavailable") {
        setError(asvFetchErrorLv("api_unavailable"));
      } else if (!res.ok) {
        setError(asvFetchErrorLv(body.error ?? "upstream_error"));
      }
      if (body.block) onFetched(body.block);
    } catch {
      setError(asvFetchErrorLv("upstream_error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-3 rounded-lg border border-slate-200/90 bg-slate-50/70 px-2 py-2">
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        Ielāde (VIN Audit caur One Auto)
      </p>
      <p className="mb-2 text-[10px] leading-snug text-slate-500">
        Izvēlies, ko pirkt. Lite $0.55 - skrīnings. Full $4.50 - title odometra forenzika. Cenas ir šī
        konta plānam. Ja atskaitē ir izsoļu foto, tās ielādējas automātiski.
      </p>
      <div className="mb-2 flex flex-col gap-1.5">
        {ASV_PRODUCTS.map((p) => (
          <label key={p.id} className="flex items-start gap-2 text-[11px] text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={selectedSet.has(p.id)}
              disabled={!editable || busy}
              onChange={(e) => toggleProduct(p.id, e.target.checked)}
            />
            <span>
              <span className="font-medium">{p.label}</span>
              <span className="ml-1 text-slate-500">{formatAsvCostUsd(p.priceUsdCents)}</span>
              <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">{p.hint}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[140px] flex-1 flex-col gap-0.5">
          <span className="text-[9px] font-medium uppercase tracking-wide text-slate-500">VIN (ja cits)</span>
          <input
            type="text"
            className={inp}
            value={vinOverride}
            disabled={!editable || busy}
            placeholder={orderVin || "VIN no pasūtījuma"}
            onChange={(e) => setVinOverride(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="rounded-md bg-[var(--color-provin-accent)] px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50"
          disabled={!editable || busy || !effectiveVin}
          onClick={() => void fetchData()}
        >
          {busy ? "Ielādē…" : `Ielādēt ${estimatedCost}`}
        </button>
      </div>
      {error ? <p className="mt-1.5 text-[10px] text-red-700">{error}</p> : null}
    </div>
  );
}
