"use client";

import type { ReactNode } from "react";
import { IrissSectionHeading } from "@/components/admin/IrissSectionHeading";
import { FileDown, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  computeDzintarzemeTame,
  type DzintarzemeTameCommissionVariant,
  type DzintarzemeTameExtraLine,
} from "@/lib/dzintarzeme-tame-calculator";
import { parsePriceLike } from "@/lib/iriss-price-format";
import {
  defaultIrissTameCommissionSettings,
  formatIrissTameMoney,
  formatIrissTamePercent,
  parseIrissTameCommissionSettings,
  type IrissTameCommissionRates,
} from "@/lib/iriss-tame-commission";
import {
  defaultIrissDzintarzemeTameDraft,
  type IrissDzintarzemeTameDraft,
} from "@/lib/iriss-pasutijumi-types";

const fieldClass =
  "min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[16px] text-[var(--color-apple-text)] shadow-sm outline-none transition focus:border-[var(--color-provin-accent)] focus:ring-2 focus:ring-[var(--color-provin-accent)]/25 sm:text-[15px]";

function BlockTitle({ children }: { children: ReactNode }) {
  return <IrissSectionHeading>{children}</IrissSectionHeading>;
}

function mergeDraft(d: IrissDzintarzemeTameDraft): IrissDzintarzemeTameDraft {
  return { ...defaultIrissDzintarzemeTameDraft(), ...d };
}

function parseEuroInput(s: string): number {
  return Math.max(0, parsePriceLike(s));
}

async function downloadPdfBlobFromResponse(res: Response, fallbackName: string): Promise<void> {
  const cd = res.headers.get("Content-Disposition");
  let name = fallbackName;
  if (cd) {
    const star = /filename\*=UTF-8''([^;\s]+)/i.exec(cd);
    const quoted = /filename="([^"]+)"/i.exec(cd);
    try {
      if (star?.[1]) name = decodeURIComponent(star[1]);
      else if (quoted?.[1]) name = quoted[1];
    } catch {
      /* keep fallback */
    }
  }
  const blob = await res.blob();
  if (blob.size < 32) throw new Error("empty_pdf");
  const objectUrl = URL.createObjectURL(blob);
  const safeName = /\.pdf$/i.test(name) ? name : `${name}.pdf`;
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = safeName;
  a.target = "_self";
  a.rel = "noopener";
  a.hidden = true;
  a.style.cssText = "display:none;position:fixed;left:-9999px;top:0;";
  document.body.appendChild(a);
  try {
    a.click();
  } catch {
    window.location.assign(objectUrl);
  }
  const mobileCoarse =
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px) and (pointer: coarse)").matches;
  const revokeMs = mobileCoarse ? 120_000 : 12_000;
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(objectUrl);
  }, revokeMs);
}

export function DzintarzemeTameSection({
  orderId,
  shellCard,
  draft,
  orderBrandModel,
  onDraftChange,
  sectionSave,
}: {
  orderId: string;
  shellCard: string;
  draft: IrissDzintarzemeTameDraft;
  orderBrandModel: string;
  onDraftChange: (next: IrissDzintarzemeTameDraft) => void;
  sectionSave?: ReactNode;
}) {
  const d = mergeDraft(draft);
  const set = useCallback((p: Partial<IrissDzintarzemeTameDraft>) => onDraftChange({ ...d, ...p }), [d, onDraftChange]);
  const [rates, setRates] = useState<IrissTameCommissionRates>(() => defaultIrissTameCommissionSettings());

  useEffect(() => {
    let cancel = false;
    void fetch("/api/admin/iriss-settings", { credentials: "include", cache: "no-store" })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((body: unknown) => {
        if (cancel || !body) return;
        setRates(parseIrissTameCommissionSettings(body));
      })
      .catch(() => {
        /* paliek noklusējums 1190 / 990 + 3,5 % */
      });
    return () => {
      cancel = true;
    };
  }, []);

  const displayBrand = d.tameBrandModel.trim() !== "" ? d.tameBrandModel : orderBrandModel;

  const extras = d.tameExtras;
  const extraLinesParsed: DzintarzemeTameExtraLine[] = useMemo(
    () =>
      extras
        .map((e) => ({ label: e.label.trim(), net: parseEuroInput(e.netStr) }))
        .filter((e) => e.label.length > 0 && e.net > 0),
    [extras],
  );

  const variant = d.tameCommissionVariant as DzintarzemeTameCommissionVariant;
  const manualNet = parseEuroInput(d.tameCommissionManualEurStr);
  const manualPctRaw = parseEuroInput(d.tameCommissionManualPercentStr.replace(",", "."));
  const manualPct = Number.isFinite(manualPctRaw) ? Math.min(100, Math.max(0, manualPctRaw)) : 0;

  const computed = useMemo(() => {
    return computeDzintarzemeTame({
      brandModel: displayBrand.trim(),
      vin: d.tameVin.trim(),
      autoPrice: parseEuroInput(d.tameAutoPriceStr),
      applyVatToAutoPrice: d.tameApplyVatAuto,
      commissionVariant: variant,
      depositPercent: variant === "A" ? 20 : d.tameDepositPercent,
      commissionManualNet: manualNet,
      commissionManualPercent: manualPct,
      transportNet: parseEuroInput(d.tameTransportStr),
      chemicalCleaningNet: parseEuroInput(d.tameChemicalStr),
      polishingNet: parseEuroInput(d.tamePolishingStr),
      paintingNet: parseEuroInput(d.tamePaintingStr),
      leasingValuationNet: parseEuroInput(d.tameLeasingValuationStr),
      extraServices: extraLinesParsed,
    }, rates);
  }, [
    displayBrand,
    d.tameApplyVatAuto,
    d.tameAutoPriceStr,
    d.tameChemicalStr,
    d.tameDepositPercent,
    d.tameLeasingValuationStr,
    d.tamePaintingStr,
    d.tamePolishingStr,
    d.tameTransportStr,
    d.tameCommissionManualEurStr,
    d.tameCommissionManualPercentStr,
    d.tameVin,
    extraLinesParsed,
    manualNet,
    manualPct,
    rates,
    variant,
  ]);

  const fmt = useMemo(
    () =>
      new Intl.NumberFormat("lv-LV", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [],
  );

  const buildPayload = useCallback(() => {
    return {
      brandModel: displayBrand.trim(),
      vin: d.tameVin.trim(),
      autoPrice: parseEuroInput(d.tameAutoPriceStr),
      applyVatToAutoPrice: d.tameApplyVatAuto,
      commissionVariant: variant,
      depositPercent: variant === "A" ? 20 : d.tameDepositPercent,
      commissionManualNet: manualNet,
      commissionManualPercent: manualPct,
      transportNet: parseEuroInput(d.tameTransportStr),
      chemicalCleaningNet: parseEuroInput(d.tameChemicalStr),
      polishingNet: parseEuroInput(d.tamePolishingStr),
      paintingNet: parseEuroInput(d.tamePaintingStr),
      leasingValuationNet: parseEuroInput(d.tameLeasingValuationStr),
      extraServices: extraLinesParsed,
    };
  }, [
    displayBrand,
    d.tameApplyVatAuto,
    d.tameAutoPriceStr,
    d.tameChemicalStr,
    d.tameDepositPercent,
    d.tameLeasingValuationStr,
    d.tamePaintingStr,
    d.tamePolishingStr,
    d.tameTransportStr,
    d.tameCommissionManualEurStr,
    d.tameCommissionManualPercentStr,
    d.tameVin,
    extraLinesParsed,
    manualNet,
    manualPct,
    variant,
  ]);

  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfErr, setPdfErr] = useState<string | null>(null);

  const onGeneratePdf = useCallback(async () => {
    setPdfErr(null);
    setPdfBusy(true);
    try {
      const res = await fetch(`/api/admin/iriss-pasutijumi/${encodeURIComponent(orderId)}/dzintarzeme-tame`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/pdf" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        let msg = `Kļūda ${res.status}`;
        try {
          const j = (await res.json()) as { error?: string };
          if (typeof j.error === "string") msg = j.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      await downloadPdfBlobFromResponse(res, "dzintarzeme-auto-tame.pdf");
    } catch (e) {
      setPdfErr(e instanceof Error ? e.message : "Neizdevās ģenerēt PDF.");
    } finally {
      setPdfBusy(false);
    }
  }, [buildPayload, orderId]);

  return (
    <section className={shellCard}>
      <BlockTitle>Izmaksu tāme (Dzintarzeme Auto)</BlockTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block min-w-0">
          <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Marka / modelis</span>
          <input
            className={fieldClass}
            value={displayBrand}
            onChange={(e) => set({ tameBrandModel: e.target.value })}
            autoComplete="off"
          />
        </label>
        <label className="block min-w-0">
          <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">VIN</span>
          <input
            className={fieldClass}
            value={d.tameVin}
            onChange={(e) => set({ tameVin: e.target.value })}
            autoCapitalize="characters"
            autoComplete="off"
          />
        </label>
        <label className="block min-w-0 sm:col-span-2">
          <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">
            Automašīnas cena (EUR)
          </span>
          <input
            className={fieldClass}
            inputMode="decimal"
            value={d.tameAutoPriceStr}
            onChange={(e) => set({ tameAutoPriceStr: e.target.value })}
            placeholder="piem. 18500"
            autoComplete="off"
          />
        </label>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-2 text-[13px] text-[var(--color-apple-text)]">
        <input
          type="checkbox"
          className="mt-1 shrink-0"
          checked={d.tameApplyVatAuto}
          onChange={(e) => set({ tameApplyVatAuto: e.target.checked })}
        />
        <span>Piemērot PVN 21%</span>
      </label>

      <div className="mt-5">
        <IrissSectionHeading>Komisijas variants</IrissSectionHeading>
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-3">
          <label
            className={`cursor-pointer rounded-xl border bg-white p-3 text-[13px] shadow-sm ${
              d.tameCommissionVariant === "A" ? "border-[#93c5fd] bg-[#eff6ff]/40" : "border-slate-200"
            }`}
          >
            <span className="font-semibold">A · fiksēta</span>
            <p className="mt-1 text-[12px] text-[var(--color-provin-muted)]">{formatIrissTameMoney(rates.variantANet)} EUR neto</p>
            <input
              type="radio"
              className="mt-2"
              name="dz-tame-comm"
              checked={d.tameCommissionVariant === "A"}
              onChange={() => set({ tameCommissionVariant: "A" })}
            />
          </label>
          <label
            className={`cursor-pointer rounded-xl border bg-white p-3 text-[13px] shadow-sm ${
              d.tameCommissionVariant === "B" ? "border-[#93c5fd] bg-[#eff6ff]/40" : "border-slate-200"
            }`}
          >
            <span className="font-semibold">B · % no atlikuma</span>
            <p className="mt-1 text-[12px] text-[var(--color-provin-muted)]">
              {formatIrissTameMoney(rates.variantBBaseNet)} EUR + {formatIrissTamePercent(rates.variantBLoanPercent)} %
            </p>
            <input
              type="radio"
              className="mt-2"
              name="dz-tame-comm"
              checked={d.tameCommissionVariant === "B"}
              onChange={() => set({ tameCommissionVariant: "B" })}
            />
          </label>
          <div
            className={`rounded-xl border bg-white p-3 text-[13px] shadow-sm ${
              d.tameCommissionVariant === "C" ? "border-[#fcd34d] bg-[#fffbeb]/50" : "border-slate-200"
            }`}
          >
            <span className="font-semibold">C · manuāli</span>
            <label className="mt-2 block">
              <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Komisija EUR</span>
              <input
                className={fieldClass}
                inputMode="decimal"
                value={d.tameCommissionManualEurStr}
                onChange={(e) => set({ tameCommissionManualEurStr: e.target.value, tameCommissionVariant: "C" })}
              />
            </label>
            <label className="mt-2 block">
              <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Komisija %</span>
              <input
                className={fieldClass}
                inputMode="decimal"
                value={d.tameCommissionManualPercentStr}
                onChange={(e) => set({ tameCommissionManualPercentStr: e.target.value, tameCommissionVariant: "C" })}
              />
            </label>
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="dz-tame-comm"
                checked={d.tameCommissionVariant === "C"}
                onChange={() => set({ tameCommissionVariant: "C" })}
              />
              Izvēlēts
            </label>
          </div>
        </div>
      </div>

      {d.tameCommissionVariant === "B" || d.tameCommissionVariant === "C" ? (
        <div className="mt-4">
          <IrissSectionHeading>Iemaksas procents ({d.tameCommissionVariant} variants)</IrissSectionHeading>
          <div className="flex flex-wrap gap-2">
            {[20, 40, 60].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => set({ tameDepositPercent: p })}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold shadow-sm transition ${
                  d.tameDepositPercent === p
                    ? "border-[var(--color-provin-accent)] bg-[var(--color-provin-accent-soft)] text-[var(--color-provin-accent)]"
                    : "border-slate-200 bg-white text-[var(--color-apple-text)] hover:bg-slate-50"
                }`}
              >
                {p}%
              </button>
            ))}
          </div>
          <label className="mt-3 block max-w-xs">
            <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Manuāli (%)</span>
            <input
              className={fieldClass}
              type="number"
              min={0}
              max={100}
              step={1}
              value={d.tameDepositPercent}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  set({ tameDepositPercent: 0 });
                  return;
                }
                const v = Number.parseInt(raw, 10);
                if (!Number.isFinite(v)) return;
                set({ tameDepositPercent: Math.min(100, Math.max(0, v)) });
              }}
            />
          </label>
        </div>
      ) : null}

      <div className="mt-6">
        <IrissSectionHeading>Papildus pakalpojumi (neto, EUR)</IrissSectionHeading>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block min-w-0">
            <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Transporta pakalpojumi</span>
            <input
              className={fieldClass}
              inputMode="decimal"
              value={d.tameTransportStr}
              onChange={(e) => set({ tameTransportStr: e.target.value })}
              autoComplete="off"
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Ķīmiskā tīrīšana</span>
            <input
              className={fieldClass}
              inputMode="decimal"
              value={d.tameChemicalStr}
              onChange={(e) => set({ tameChemicalStr: e.target.value })}
              autoComplete="off"
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Pulēšana</span>
            <input
              className={fieldClass}
              inputMode="decimal"
              value={d.tamePolishingStr}
              onChange={(e) => set({ tamePolishingStr: e.target.value })}
              autoComplete="off"
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Krāsošana</span>
            <input
              className={fieldClass}
              inputMode="decimal"
              value={d.tamePaintingStr}
              onChange={(e) => set({ tamePaintingStr: e.target.value })}
              autoComplete="off"
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Vērtējums līzingam</span>
            <input
              className={fieldClass}
              inputMode="decimal"
              value={d.tameLeasingValuationStr}
              onChange={(e) => set({ tameLeasingValuationStr: e.target.value })}
              autoComplete="off"
            />
          </label>
        </div>
      </div>

      <div className="mt-4">
        {extras.map((row) => (
          <div key={row.id} className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="block min-w-0 flex-1">
              <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Cits pakalpojums</span>
              <input
                className={fieldClass}
                value={row.label}
                onChange={(e) =>
                  set({
                    tameExtras: extras.map((x) => (x.id === row.id ? { ...x, label: e.target.value } : x)),
                  })
                }
                autoComplete="off"
              />
            </label>
            <label className="block w-full min-w-0 sm:w-36">
              <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Neto EUR</span>
              <input
                className={fieldClass}
                inputMode="decimal"
                value={row.netStr}
                onChange={(e) =>
                  set({
                    tameExtras: extras.map((x) => (x.id === row.id ? { ...x, netStr: e.target.value } : x)),
                  })
                }
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              title="Noņemt"
              aria-label="Noņemt rindu"
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
              onClick={() => set({ tameExtras: extras.filter((x) => x.id !== row.id) })}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            set({
              tameExtras: [...extras, { id: crypto.randomUUID(), label: "", netStr: "" }],
            })
          }
          className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 bg-slate-50/80 px-3 py-2 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Pievienot citu
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200/90 bg-slate-50/80 p-4">
        <IrissSectionHeading className="mb-2">Klientam redzamā gala summa</IrissSectionHeading>
        <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--color-apple-text)]">{fmt.format(computed.galaSumma)}</p>
        <dl className="mt-3 grid gap-1 text-[12px] text-[var(--color-provin-muted)]">
          <div className="flex justify-between gap-3">
            <dt>Kopā bez PVN (neto bāze)</dt>
            <dd className="font-medium text-[var(--color-apple-text)]">{fmt.format(computed.summaBezPVN)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>PVN 21 %</dt>
            <dd className="font-medium text-[var(--color-apple-text)]">{fmt.format(computed.pvnKopa)}</dd>
          </div>
        </dl>
      </div>

      {pdfErr ? <p className="mt-3 text-[12px] text-red-700">{pdfErr}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pdfBusy}
          onClick={() => void onGeneratePdf()}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-[var(--color-provin-accent)] bg-[var(--color-provin-accent)] px-5 text-[13px] font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
        >
          {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileDown className="h-4 w-4" aria-hidden />}
          Ģenerēt Dzintarzeme Auto tāmi
        </button>
      </div>
      {sectionSave}
    </section>
  );
}
