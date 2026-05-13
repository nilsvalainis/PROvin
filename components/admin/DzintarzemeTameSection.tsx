"use client";

import type { ReactNode } from "react";
import { FileDown, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  computeDzintarzemeTame,
  type DzintarzemeTameCommissionVariant,
  type DzintarzemeTameExtraLine,
} from "@/lib/dzintarzeme-tame-calculator";

const fieldClass =
  "min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[16px] text-[var(--color-apple-text)] shadow-sm outline-none transition focus:border-[var(--color-provin-accent)] focus:ring-2 focus:ring-[var(--color-provin-accent)]/25 sm:text-[15px]";

function BlockTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 border-l-4 border-[var(--color-provin-accent)] bg-[var(--color-provin-accent-soft)]/50 py-2 pl-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-provin-accent)]">
      {children}
    </h2>
  );
}

function parseEuroInput(s: string): number {
  const compact = s.trim().replace(/\s+/g, "").replace(",", ".");
  const n = Number.parseFloat(compact);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
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

type ExtraRow = { id: string; label: string; netStr: string };

export function DzintarzemeTameSection({
  orderId,
  shellCard,
  initialBrandModel,
}: {
  orderId: string;
  shellCard: string;
  initialBrandModel: string;
}) {
  const [brandModel, setBrandModel] = useState(initialBrandModel);
  const [vin, setVin] = useState("");
  const [autoPriceStr, setAutoPriceStr] = useState("");
  const [applyVatAuto, setApplyVatAuto] = useState(false);
  const [variant, setVariant] = useState<DzintarzemeTameCommissionVariant>("A");
  const [depositPercent, setDepositPercent] = useState(20);
  const [transportStr, setTransportStr] = useState("");
  const [chemicalStr, setChemicalStr] = useState("");
  const [polishingStr, setPolishingStr] = useState("");
  const [paintingStr, setPaintingStr] = useState("");
  const [extras, setExtras] = useState<ExtraRow[]>([]);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfErr, setPdfErr] = useState<string | null>(null);

  const extraLinesParsed: DzintarzemeTameExtraLine[] = useMemo(
    () =>
      extras
        .map((e) => ({ label: e.label.trim(), net: parseEuroInput(e.netStr) }))
        .filter((e) => e.label.length > 0 && e.net > 0),
    [extras],
  );

  const computed = useMemo(() => {
    return computeDzintarzemeTame({
      brandModel,
      vin,
      autoPrice: parseEuroInput(autoPriceStr),
      applyVatToAutoPrice: applyVatAuto,
      commissionVariant: variant,
      depositPercent,
      transportNet: parseEuroInput(transportStr),
      chemicalCleaningNet: parseEuroInput(chemicalStr),
      polishingNet: parseEuroInput(polishingStr),
      paintingNet: parseEuroInput(paintingStr),
      extraServices: extraLinesParsed,
    });
  }, [
    applyVatAuto,
    autoPriceStr,
    brandModel,
    chemicalStr,
    depositPercent,
    extraLinesParsed,
    paintingStr,
    polishingStr,
    transportStr,
    variant,
    vin,
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
      brandModel: brandModel.trim(),
      vin: vin.trim(),
      autoPrice: parseEuroInput(autoPriceStr),
      applyVatToAutoPrice: applyVatAuto,
      commissionVariant: variant,
      depositPercent: variant === "B" ? depositPercent : 20,
      transportNet: parseEuroInput(transportStr),
      chemicalCleaningNet: parseEuroInput(chemicalStr),
      polishingNet: parseEuroInput(polishingStr),
      paintingNet: parseEuroInput(paintingStr),
      extraServices: extraLinesParsed,
    };
  }, [
    applyVatAuto,
    autoPriceStr,
    brandModel,
    chemicalStr,
    depositPercent,
    extraLinesParsed,
    paintingStr,
    polishingStr,
    transportStr,
    variant,
    vin,
  ]);

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
      <p className="mb-4 text-[12px] leading-snug text-[var(--color-provin-muted)]">
        Šis bloks ģenerē atsevišķu Dzintarzeme Auto PDF tāmi — citas sistēmas rēķinu dati netiek izmantoti.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block min-w-0">
          <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Marka / modelis</span>
          <input className={fieldClass} value={brandModel} onChange={(e) => setBrandModel(e.target.value)} />
        </label>
        <label className="block min-w-0">
          <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">VIN</span>
          <input className={fieldClass} value={vin} onChange={(e) => setVin(e.target.value)} autoCapitalize="characters" />
        </label>
        <label className="block min-w-0 sm:col-span-2">
          <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">
            Automašīnas cena (EUR)
          </span>
          <input
            className={fieldClass}
            inputMode="decimal"
            value={autoPriceStr}
            onChange={(e) => setAutoPriceStr(e.target.value)}
            placeholder="piem. 18500"
          />
        </label>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-2 text-[13px] text-[var(--color-apple-text)]">
        <input type="checkbox" className="mt-1 shrink-0" checked={applyVatAuto} onChange={(e) => setApplyVatAuto(e.target.checked)} />
        <span>Piemērot PVN auto cenai (+21 % uz neto cenu)</span>
      </label>
      <p className="mt-1.5 text-[11px] leading-snug text-[var(--color-provin-muted)]">
        {applyVatAuto
          ? "PDF: zem „Automašīnas cena” būs mazi burti „neto cena”; PVN tikai kopsavilkumā."
          : "PDF: „Automašīnas cena” bez papildu apzīmējuma (ievadītā summa šai pozīcijai bez atsevišķa PVN rindas)."}
      </p>

      <div className="mt-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-provin-muted)]">
          Komisijas variants
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] shadow-sm">
            <input type="radio" name="dz-tame-comm" checked={variant === "A"} onChange={() => setVariant("A")} />
            A — 1&nbsp;190,00 EUR (neto)
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] shadow-sm">
            <input type="radio" name="dz-tame-comm" checked={variant === "B"} onChange={() => setVariant("B")} />
            B — 990,00 EUR (neto) + 3,5 % no atlikuma
          </label>
        </div>
      </div>

      {variant === "B" ? (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-provin-muted)]">
            Iemaksas procents (B variants)
          </p>
          <div className="flex flex-wrap gap-2">
            {[20, 40, 60].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setDepositPercent(p)}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold shadow-sm transition ${
                  depositPercent === p
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
              value={depositPercent}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  setDepositPercent(0);
                  return;
                }
                const v = Number.parseInt(raw, 10);
                if (!Number.isFinite(v)) return;
                setDepositPercent(Math.min(100, Math.max(0, v)));
              }}
            />
          </label>
        </div>
      ) : null}

      <div className="mt-6">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-provin-muted)]">
          Papildus pakalpojumi (neto, EUR)
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block min-w-0">
            <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Transportēšana</span>
            <input
              className={fieldClass}
              inputMode="decimal"
              value={transportStr}
              onChange={(e) => setTransportStr(e.target.value)}
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Ķīmiskā tīrīšana</span>
            <input
              className={fieldClass}
              inputMode="decimal"
              value={chemicalStr}
              onChange={(e) => setChemicalStr(e.target.value)}
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Pulēšana</span>
            <input
              className={fieldClass}
              inputMode="decimal"
              value={polishingStr}
              onChange={(e) => setPolishingStr(e.target.value)}
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Krāsošana</span>
            <input
              className={fieldClass}
              inputMode="decimal"
              value={paintingStr}
              onChange={(e) => setPaintingStr(e.target.value)}
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
                  setExtras((xs) => xs.map((x) => (x.id === row.id ? { ...x, label: e.target.value } : x)))
                }
              />
            </label>
            <label className="block w-full min-w-0 sm:w-36">
              <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Neto EUR</span>
              <input
                className={fieldClass}
                inputMode="decimal"
                value={row.netStr}
                onChange={(e) =>
                  setExtras((xs) => xs.map((x) => (x.id === row.id ? { ...x, netStr: e.target.value } : x)))
                }
              />
            </label>
            <button
              type="button"
              title="Noņemt"
              aria-label="Noņemt rindu"
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
              onClick={() => setExtras((xs) => xs.filter((x) => x.id !== row.id))}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setExtras((xs) => [...xs, { id: crypto.randomUUID(), label: "", netStr: "" }])}
          className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 bg-slate-50/80 px-3 py-2 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Pievienot citu
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200/90 bg-slate-50/80 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-provin-muted)]">
          Klientam redzamā gala summa
        </p>
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
    </section>
  );
}
