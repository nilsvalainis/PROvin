"use client";

import type { ReactNode } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  computeDzintarzemeTame,
  type DzintarzemeTameCommissionVariant,
  type DzintarzemeTameExtraLine,
} from "@/lib/dzintarzeme-tame-calculator";
import { parsePriceLike } from "@/lib/iriss-price-format";
import {
  defaultIrissTameCommissionSettings,
  formatIrissTamePercent,
  parseIrissTameCommissionSettings,
  type IrissTameCommissionRates,
} from "@/lib/iriss-tame-commission";
import { irissTameBalanceAfterAdvance } from "@/lib/iriss-advance";
import {
  IRISS_GENERATED_DOCUMENT_HEADER,
  readGeneratedDocumentFromResponseHeader,
} from "@/lib/iriss-generated-documents";
import {
  defaultIrissDzintarzemeTameDraft,
  type IrissDzintarzemeTameDraft,
  type IrissGeneratedDocument,
} from "@/lib/iriss-pasutijumi-types";

const fieldClass =
  "min-h-[38px] w-full rounded-[10px] border border-[var(--iriss-line-strong)] bg-white px-2.5 text-[16px] text-[var(--iriss-ink)] outline-none focus:border-[var(--iriss-ink)] sm:text-[14px]";

type TameFixedKey = "tameTransportStr" | "tameChemicalStr" | "tamePolishingStr" | "tamePaintingStr" | "tameLeasingValuationStr";

/** Pastāvīgie pakalpojumi (atsevišķi lauki datos); forma rāda tikai aizpildītos vai pievienotos (makets 28.10). */
export const TAME_FIXED_SERVICES: ReadonlyArray<{ key: TameFixedKey; label: string }> = [
  { key: "tameTransportStr", label: "Transports" },
  { key: "tameChemicalStr", label: "Ķīmiskā tīrīšana" },
  { key: "tamePolishingStr", label: "Pulēšana" },
  { key: "tamePaintingStr", label: "Krāsošana" },
  { key: "tameLeasingValuationStr", label: "Vērtējums līzingam" },
];

/** Ātrās pogas citiem pakalpojumiem (saglabājas kā "Cits" rinda ar nosaukumu). */
export const TAME_EXTRA_PRESETS = ["Tehniskā apskate", "Riepas"] as const;

/** "1 078,00 €" - tūkstošu atstarpe arī 4 ciparu summām (lv-LV Intl to nedara). */
export function formatTameEur(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  const [int, dec] = Math.abs(v).toFixed(2).split(".");
  return `${v < 0 ? "-" : ""}${int!.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${dec} €`;
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
  onGeneratedDocument,
  sectionSave,
  advancePaidEur,
  financingPercent,
}: {
  orderId: string;
  shellCard: string;
  draft: IrissDzintarzemeTameDraft;
  orderBrandModel: string;
  onDraftChange: (next: IrissDzintarzemeTameDraft) => void;
  onGeneratedDocument?: (doc: IrissGeneratedDocument, workspaceRevision?: number) => void;
  sectionSave?: ReactNode;
  /** Pasūtījuma avanss (tas pats, ko PDF atskaita no gala summas). */
  advancePaidEur?: number;
  /** Klienta finansējuma % no pasūtījuma (tikai informācijai kopsavilkumā). */
  financingPercent?: number;
}) {
  const d = mergeDraft(draft);
  const set = useCallback((p: Partial<IrissDzintarzemeTameDraft>) => onDraftChange({ ...d, ...p }), [d, onDraftChange]);
  const [rates, setRates] = useState<IrissTameCommissionRates>(() => defaultIrissTameCommissionSettings());
  const [shownFixed, setShownFixed] = useState<Set<TameFixedKey>>(() => new Set());

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
  const atlikums = Math.round(parseEuroInput(d.tameAutoPriceStr) * (1 - Math.min(100, d.tameDepositPercent) / 100) * 100) / 100;

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
      // Tikai PDF galvenei (Nils 28.10 makets).
      year: (d.tameYearStr ?? "").trim(),
      mileageKm: (d.tameMileageStr ?? "").trim(),
    };
  }, [
    d.tameYearStr,
    d.tameMileageStr,
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
      const stored = readGeneratedDocumentFromResponseHeader(res.headers.get(IRISS_GENERATED_DOCUMENT_HEADER));
      if (stored) onGeneratedDocument?.(stored.doc, stored.workspaceRevision);
      await downloadPdfBlobFromResponse(res, "dzintarzeme-auto-tame.pdf");
    } catch (e) {
      setPdfErr(e instanceof Error ? e.message : "Neizdevās ģenerēt PDF.");
    } finally {
      setPdfBusy(false);
    }
  }, [buildPayload, onGeneratedDocument, orderId]);

  const advanceEur = Math.max(0, advancePaidEur ?? 0);
  const balance = irissTameBalanceAfterAdvance(computed.galaSumma, advanceEur);
  const commissionHint =
    variant === "A"
      ? ""
      : variant === "B"
        ? `${formatTameEur(rates.variantBBaseNet)} + ${formatIrissTamePercent(rates.variantBLoanPercent)} % no ${formatTameEur(atlikums)} = ${formatTameEur(computed.commissionNet)}`
        : `${formatTameEur(manualNet)} + ${formatIrissTamePercent(manualPct)} % no ${formatTameEur(atlikums)} = ${formatTameEur(computed.commissionNet)}`;

  const fixedVisible = TAME_FIXED_SERVICES.filter((f) => shownFixed.has(f.key) || d[f.key].trim() !== "");
  const fixedHidden = TAME_FIXED_SERVICES.filter((f) => !fixedVisible.includes(f));
  const extraPresetsHidden = TAME_EXTRA_PRESETS.filter((label) => !extras.some((x) => x.label.trim() === label));

  return (
    <section className={shellCard} aria-label="Izmaksu tāme">
      <div className="mb-3.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h3 className="text-[15px] font-bold text-[var(--iriss-ink)]">Izmaksu tāme</h3>
        <span className="text-[12px] text-[var(--iriss-ink-2)]">Dzintarzeme Auto</span>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <TameCap>Auto</TameCap>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[1.4fr_1.3fr_0.6fr_0.8fr]">
            <TameField label="Marka / modelis" className="col-span-2 sm:col-span-1">
              <input className={fieldClass} value={displayBrand} onChange={(e) => set({ tameBrandModel: e.target.value })} autoComplete="off" />
            </TameField>
            <TameField label="VIN" className="col-span-2 sm:col-span-1">
              <input className={fieldClass} value={d.tameVin} onChange={(e) => set({ tameVin: e.target.value })} autoCapitalize="characters" autoComplete="off" />
            </TameField>
            <TameField label="Gads">
              <input
                className={fieldClass}
                inputMode="numeric"
                value={d.tameYearStr ?? ""}
                onChange={(e) => set({ tameYearStr: e.target.value.replace(/[^\d]/g, "").slice(0, 4) })}
                autoComplete="off"
              />
            </TameField>
            <TameField label="Nobraukums" suffix="km">
              <input
                className={`${fieldClass} pr-9 text-right`}
                inputMode="numeric"
                value={d.tameMileageStr ?? ""}
                onChange={(e) => set({ tameMileageStr: e.target.value.replace(/[^\d ]/g, "").slice(0, 9) })}
                autoComplete="off"
              />
            </TameField>
          </div>
          <div className="mt-2.5 flex flex-wrap items-end gap-2.5">
            <TameField label="Automašīnas cena" suffix="€" className="min-w-[180px] flex-1">
              <input
                className={`${fieldClass} pr-8 text-right`}
                inputMode="decimal"
                value={d.tameAutoPriceStr}
                onChange={(e) => set({ tameAutoPriceStr: e.target.value })}
                placeholder="18 500"
                autoComplete="off"
              />
            </TameField>
            <TameSegmented
              label="PVN režīms"
              value={d.tameApplyVatAuto ? "vat" : "margin"}
              options={[
                { value: "margin", label: "Peļņas daļas režīms" },
                { value: "vat", label: "+ PVN 21 %" },
              ]}
              onChange={(v) => set({ tameApplyVatAuto: v === "vat" })}
            />
          </div>

          <div className="mt-4 border-t border-[var(--iriss-line)] pt-3.5">
            <TameCap>Komisija</TameCap>
            <TameSegmented
              value={variant}
              options={[
                { value: "A", label: "A · fiksēta", sub: formatTameEur(rates.variantANet) },
                {
                  value: "B",
                  label: "B · % no atlikuma",
                  sub: `${formatTameEur(rates.variantBBaseNet)} + ${formatIrissTamePercent(rates.variantBLoanPercent)} %`,
                },
                { value: "C", label: "C · manuāli" },
              ]}
              onChange={(v) => set({ tameCommissionVariant: v as DzintarzemeTameCommissionVariant })}
            />
            {variant !== "A" ? (
              <div className="mt-2.5 flex flex-wrap items-end gap-2.5">
                <TameField label="Priekšapmaksa" suffix="%" className="w-[120px]">
                  <input
                    className={`${fieldClass} pr-8 text-right`}
                    // Teksts ar ciparu tastatūru: `type="number"` pie "1,5" atdeva "" un lauks nodzēsās (Nils 28.10).
                    type="text"
                    inputMode="numeric"
                    value={d.tameDepositPercent}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 3);
                      set({ tameDepositPercent: raw === "" ? 0 : Math.min(100, Number.parseInt(raw, 10)) });
                    }}
                  />
                </TameField>
                {variant === "C" ? (
                  <>
                    <TameField label="Komisija" suffix="€" className="w-[130px]">
                      <input
                        className={`${fieldClass} pr-8 text-right`}
                        inputMode="decimal"
                        value={d.tameCommissionManualEurStr}
                        onChange={(e) => set({ tameCommissionManualEurStr: e.target.value })}
                      />
                    </TameField>
                    <TameField label="+ no atlikuma" suffix="%" className="w-[120px]">
                      <input
                        className={`${fieldClass} pr-8 text-right`}
                        inputMode="decimal"
                        value={d.tameCommissionManualPercentStr}
                        onChange={(e) => set({ tameCommissionManualPercentStr: e.target.value })}
                      />
                    </TameField>
                  </>
                ) : null}
                <p className="pb-2.5 text-[12px] text-[var(--iriss-ink-2)]">
                  Komisija: <b className="text-[var(--iriss-ink)]">{commissionHint}</b>
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-4 border-t border-[var(--iriss-line)] pt-3.5">
            <TameCap>
              Pakalpojumi <span className="font-medium normal-case tracking-normal text-[var(--iriss-ink-3)]">· neto, PVN 21 % pieskaitās</span>
            </TameCap>
            <div className="grid gap-1.5">
              {fixedVisible.map((f) => (
                <TameServiceRow
                  key={f.key}
                  label={<span className="flex min-h-[38px] items-center px-2.5 text-[14px] text-[var(--iriss-ink)]">{f.label}</span>}
                  value={d[f.key]}
                  onValue={(v) => set({ [f.key]: v } as Partial<IrissDzintarzemeTameDraft>)}
                  onRemove={() => {
                    setShownFixed((prev) => {
                      const next = new Set(prev);
                      next.delete(f.key);
                      return next;
                    });
                    set({ [f.key]: "" } as Partial<IrissDzintarzemeTameDraft>);
                  }}
                />
              ))}
              {extras.map((row) => (
                <TameServiceRow
                  key={row.id}
                  label={
                    <input
                      className={fieldClass}
                      value={row.label}
                      placeholder="Pakalpojums"
                      aria-label="Pakalpojuma nosaukums"
                      onChange={(e) => set({ tameExtras: extras.map((x) => (x.id === row.id ? { ...x, label: e.target.value } : x)) })}
                      autoComplete="off"
                    />
                  }
                  value={row.netStr}
                  onValue={(v) => set({ tameExtras: extras.map((x) => (x.id === row.id ? { ...x, netStr: v } : x)) })}
                  onRemove={() => set({ tameExtras: extras.filter((x) => x.id !== row.id) })}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {fixedHidden.map((f) => (
                <button key={f.key} type="button" className={addChipClass} onClick={() => setShownFixed((prev) => new Set(prev).add(f.key))}>
                  + {f.label}
                </button>
              ))}
              {extraPresetsHidden.map((label) => (
                <button
                  key={label}
                  type="button"
                  className={addChipClass}
                  onClick={() => set({ tameExtras: [...extras, { id: crypto.randomUUID(), label, netStr: "" }] })}
                >
                  + {label}
                </button>
              ))}
              <button type="button" className={addChipClass} onClick={() => set({ tameExtras: [...extras, { id: crypto.randomUUID(), label: "", netStr: "" }] })}>
                + Cits
              </button>
            </div>
            <p className="mt-3 text-[12px] text-[var(--iriss-ink-3)]">CSDD reģistrācijas un valsts nodevas tāmē netiek iekļautas.</p>
          </div>
        </div>

        <aside className="rounded-[14px] bg-[var(--iriss-surface-2)] p-4" aria-label="Tāmes kopsavilkums">
          <TameCap>Kopsavilkums</TameCap>
          <TameSumRow label="Automašīna" value={computed.autoCena} first />
          <TameSumRow label="Komisija" value={computed.commissionNet} />
          <TameSumRow label="Pakalpojumi" value={computed.servicesNetTotal} />
          <TameSumRow label="PVN 21 %" value={computed.pvnKopa} />
          <div className="mt-1 border-t border-[var(--iriss-line-strong)] pb-1.5 pt-3">
            <p className="text-[12px] text-[var(--iriss-ink-2)]">Kopā klientam</p>
            <p className="text-[26px] font-bold tracking-[-0.3px] text-[var(--iriss-ink)] [font-variant-numeric:tabular-nums]">{formatTameEur(computed.galaSumma)}</p>
          </div>
          {advanceEur > 0 ? <TameSumRow label="Avanss" value={-advanceEur} /> : null}
          {financingPercent && financingPercent > 0 ? (
            <div className="flex items-baseline justify-between border-t border-[var(--iriss-line)] py-[7px] text-[13.5px]">
              <span className="text-[var(--iriss-ink-2)]">Līzings ({financingPercent} %)</span>
              <span className="text-[var(--iriss-ink-2)]">no pasūtījuma</span>
            </div>
          ) : null}
          <TameSumRow label="Atlikums apmaksai" value={balance} strong />
          {pdfErr ? <p className="mt-2 text-[12px] text-[var(--iriss-warn)]">{pdfErr}</p> : null}
          <button
            type="button"
            disabled={pdfBusy}
            onClick={() => void onGeneratePdf()}
            className="mt-3.5 inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--iriss-ink)] bg-[var(--iriss-ink)] px-4 text-[13px] font-semibold disabled:opacity-50"
            // Globālie admin pogu stili var pārrakstīt text-white.
            style={{ color: "white" }}
          >
            {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileDown className="h-4 w-4" aria-hidden />}
            Ģenerēt PDF
          </button>
          <p className="mt-2.5 text-[12px] text-[var(--iriss-ink-3)]">Avanss un finansējums - no pasūtījuma. Saglabājas kopā ar pasūtījumu.</p>
        </aside>
      </div>
      {sectionSave}
    </section>
  );
}

const addChipClass =
  "inline-flex min-h-[28px] items-center rounded-full border border-dashed border-[var(--iriss-line-strong)] bg-white px-2.5 text-[12px] font-semibold text-[var(--iriss-ink-2)]";

function TameCap({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--iriss-ink-2)]">{children}</p>;
}

function TameField({ label, suffix, className = "", children }: { label: string; suffix?: string; className?: string; children: ReactNode }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 block text-[12px] font-semibold text-[var(--iriss-ink-2)]">{label}</span>
      <span className="relative block">
        {children}
        {suffix ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12.5px] text-[var(--iriss-ink-3)]">{suffix}</span>
        ) : null}
      </span>
    </label>
  );
}

function TameSegmented({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: string;
  options: Array<{ value: string; label: string; sub?: string }>;
  onChange: (value: string) => void;
}) {
  const seg = (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full flex-wrap gap-[3px] rounded-[11px] bg-[var(--iriss-surface-2)] p-[3px]">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`min-h-[32px] whitespace-nowrap rounded-lg px-3 text-[13px] font-semibold ${
              on ? "bg-white text-[var(--iriss-ink)] shadow-[0_0_0_1px_var(--iriss-ink)]" : "bg-transparent text-[var(--iriss-ink-2)]"
            }`}
          >
            {o.label}
            {o.sub ? <span className="ml-1.5 font-medium text-[var(--iriss-ink-3)]">{o.sub}</span> : null}
          </button>
        );
      })}
    </div>
  );
  if (!label) return seg;
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-[12px] font-semibold text-[var(--iriss-ink-2)]">{label}</span>
      {seg}
    </div>
  );
}

function TameServiceRow({
  label,
  value,
  onValue,
  onRemove,
}: {
  label: ReactNode;
  value: string;
  onValue: (value: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_130px_32px] items-center gap-2">
      <div className="min-w-0 rounded-[10px] border border-[var(--iriss-line)]">{label}</div>
      <span className="relative block">
        <input className={`${fieldClass} pr-8 text-right`} inputMode="decimal" value={value} onChange={(e) => onValue(e.target.value)} aria-label="Summa" autoComplete="off" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12.5px] text-[var(--iriss-ink-3)]">€</span>
      </span>
      <button type="button" aria-label="Noņemt" title="Noņemt" onClick={onRemove} className="h-8 w-8 rounded-lg text-[16px] text-[var(--iriss-ink-3)] hover:bg-[var(--iriss-surface-2)]">
        ×
      </button>
    </div>
  );
}

function TameSumRow({ label, value, first, strong }: { label: string; value: number; first?: boolean; strong?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-[7px] text-[13.5px] [font-variant-numeric:tabular-nums] ${first ? "" : "border-t border-[var(--iriss-line)]"} ${
        strong ? "font-bold text-[var(--iriss-ink)]" : ""
      }`}
    >
      <span className={strong ? "" : "text-[var(--iriss-ink-2)]"}>{label}</span>
      <span>{value < 0 ? `-${formatTameEur(-value)}` : formatTameEur(value)}</span>
    </div>
  );
}
