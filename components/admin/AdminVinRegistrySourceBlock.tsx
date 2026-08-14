"use client";

import { useState } from "react";
import { AdminCollapsibleShell } from "@/components/admin/AdminCollapsibleShell";
import { AdminCountryCombobox } from "@/components/admin/AdminCountryCombobox";
import { AdminGeminiContextRawField } from "@/components/admin/AdminGeminiContextRawField";
import { AdminPdfIncludeToggle } from "@/components/admin/AdminPdfIncludeToggle";
import { AdminProvinLucide } from "@/components/admin/AdminProvinLucide";
import {
  AdminSourceCommentField,
  type AdminGeminiSourceCommentSlot,
} from "@/components/admin/AdminSourceCommentField";
import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import { CountryFlagWithCode } from "@/components/admin/CountryFlagWithCode";
import { LossAmountFieldChrome } from "@/components/admin/LossAmountFieldChrome";
import type { TrafficFillLevel } from "@/lib/admin-block-traffic-status";
import { SUBHEADING_LUCIDE } from "@/lib/admin-lucide-registry";
import { ADMIN_RAW_UNPROCESSED_MAX_LEN } from "@/lib/admin-raw-field-limits";
import {
  CSDD_MILEAGE_UNIFIED_TITLE,
  NEGADIJUMU_VESTURE_TITLE,
  emptyVinRegistryIncidentRow,
  emptyVinRegistryMileageRow,
  repairVinRegistryBlock,
  sortVinRegistryMileage,
  SOURCE_BLOCK_LABELS,
  type VinRegistryBlockKey,
  type VinRegistryBlockState,
  type VinRegistryIncidentRow,
  type VinRegistryMileageRow,
} from "@/lib/admin-source-blocks";
import { normalizeLossAmountEurDisplay } from "@/lib/loss-amount-format";
import { AdminClearOdometerButton } from "@/components/admin/AdminClearOdometerButton";
import {
  clearVinRegistryOdometerReadings,
  countVinRegistryOdometerReadings,
} from "@/lib/admin-clear-odometer-readings";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";
const cell = "px-1.5 py-0.5";
const areaCls =
  "w-full resize-y rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-provin-accent)]/20";
const labelCls = "mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]";

/** Katram avotam — ko tas praktiski dod un kur ir robežas. */
const SOURCE_HINT: Record<VinRegistryBlockKey, string> = {
  tjekbil:
    "Dānijas reģistrs (DMR, Færdselsstyrelsen, Motorstyrelsen): odometra žurnāls, apskates, izmantošanas veids, līzings, Bilbogen ķīlas. Publiski nav īpašnieku vārdu.",
  mnt_ee:
    "Igaunijas Transpordiamet „Sõiduki taustakontroll”: nobraukums, izmantošanas vēsture, ierobežojumi. Prasa reCAPTCHA — ielāde tikai lokāli.",
  lkf_ee:
    "Igaunijas Liikluskindlustuse Fond „Kahjukontroll”: OCTA atlīdzības gadījumi. Summas publiski netiek rādītas; prasa reCAPTCHA.",
  carinfo: "car.info agregators (Skandināvija, DACH): nobraukums pa valstīm, īpašnieki, statusi — bezmaksas daļa.",
};

type Props = {
  blockKey: VinRegistryBlockKey;
  value: VinRegistryBlockState;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: VinRegistryBlockState) => void;
  trafficFillLevel?: TrafficFillLevel;
  sessionId: string;
  /** Pasūtījuma VIN automātiskajai ielādei. */
  vin: string;
  geminiComment?: AdminGeminiSourceCommentSlot;
  pdfInclude?: boolean;
  onPdfIncludeChange?: (next: boolean) => void;
};

export async function requestVinRegistryFetch(
  source: VinRegistryBlockKey,
  vin: string,
  regMark = "",
): Promise<{ ok: true; found: boolean; message: string; block: VinRegistryBlockState } | { ok: false; error: string }> {
  const res = await fetch("/api/admin/vin-sources/fetch", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vin, source, regMark }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    found?: boolean;
    message?: string;
    block?: VinRegistryBlockState;
    error?: string;
    detail?: string;
  };
  if (!res.ok || !data.ok || !data.block) {
    return { ok: false, error: data.detail ?? data.error ?? `Ielāde neizdevās (HTTP ${res.status})` };
  }
  return {
    ok: true,
    found: data.found === true,
    message: data.message ?? (data.found ? "Dati ielasīti" : "Dati netika atrasti"),
    block: repairVinRegistryBlock(data.block),
  };
}

export function AdminVinRegistrySourceBlock({
  blockKey,
  value,
  readOnly,
  disabled,
  onChange,
  trafficFillLevel,
  sessionId,
  vin,
  geminiComment,
  pdfInclude,
  onPdfIncludeChange,
}: Props) {
  const block = repairVinRegistryBlock(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const mileage = block.mileage.length > 0 ? block.mileage : [emptyVinRegistryMileageRow()];
  const incidents = block.incidents.length > 0 ? block.incidents : [emptyVinRegistryIncidentRow()];
  const label = SOURCE_BLOCK_LABELS[blockKey];

  const setMileageRow = (index: number, patch: Partial<VinRegistryMileageRow>) => {
    const rows = mileage.map((r, i) => (i === index ? { ...r, ...patch } : r));
    onChange({ ...block, mileage: sortVinRegistryMileage(rows) });
  };

  const setIncidentRow = (index: number, patch: Partial<VinRegistryIncidentRow>) => {
    onChange({ ...block, incidents: incidents.map((r, i) => (i === index ? { ...r, ...patch } : r)) });
  };

  const removeIncidentRow = (index: number) => {
    if (incidents.length <= 1) return;
    onChange({ ...block, incidents: incidents.filter((_, i) => i !== index) });
  };

  const loadByVin = async () => {
    setError(null);
    setStatus(null);
    const cleanVin = vin.trim();
    if (!cleanVin) {
      setError("Pasūtījumā nav VIN — ievadi to pārskata sadaļā.");
      return;
    }
    setBusy(true);
    try {
      const data = await requestVinRegistryFetch(blockKey, cleanVin);
      if (!data.ok) {
        setError(data.error);
        return;
      }
      // operatora komentārs un AI konteksts saglabājas — pārrakstām tikai avota datus
      onChange({
        ...data.block,
        comments: block.comments,
        geminiContextRaw: block.geminiContextRaw,
      });
      setStatus(data.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ielāde neizdevās");
    } finally {
      setBusy(false);
    }
  };

  const textField = (
    key: "ownersSummary" | "statusRecords" | "autoNotes" | "rawUnprocessedData",
    fieldLabel: string,
    placeholder: string,
    rows: number,
  ) => (
    <div className="mt-3">
      <label className={labelCls} htmlFor={`${blockKey}-${key}`}>
        {fieldLabel}
      </label>
      {readOnly ? (
        <div className="min-h-[40px] whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-slate-100 px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]">
          {block[key].trim() || "—"}
        </div>
      ) : (
        <textarea
          id={`${blockKey}-${key}`}
          className={areaCls}
          rows={rows}
          disabled={disabled}
          placeholder={placeholder}
          value={block[key]}
          onChange={(e) => onChange({ ...block, [key]: e.target.value.slice(0, ADMIN_RAW_UNPROCESSED_MAX_LEN) })}
        />
      )}
    </div>
  );

  const inner = (
    <div className="flex min-h-0 flex-col overflow-hidden p-2">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <p className="mb-1.5 rounded-md border border-slate-200/90 bg-slate-50/90 px-2 py-1.5 text-[10px] leading-snug text-slate-600">
          {SOURCE_HINT[blockKey]}
        </p>

        {!readOnly ? (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => void loadByVin()}
              className="rounded-md border border-[var(--color-provin-accent)]/40 bg-[var(--color-provin-accent-soft)]/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-apple-text)] transition hover:bg-[var(--color-provin-accent-soft)]/70 disabled:opacity-50"
            >
              {busy ? "Ielasu…" : "Ielasīt pēc VIN"}
            </button>
            <span className="font-mono text-[10px] text-slate-500">{vin.trim() || "— nav VIN —"}</span>
            {block.fetchedAt ? (
              <span className="text-[10px] text-slate-400">
                Pēdējā ielāde: {new Date(block.fetchedAt).toLocaleString("lv-LV")}
              </span>
            ) : null}
          </div>
        ) : null}
        {status ? (
          <p className="mb-2 text-[10px] font-medium text-emerald-700" role="status">
            {status}
          </p>
        ) : null}
        {error ? (
          <p className="mb-2 text-[10px] font-medium text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <p className="mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
          <AdminProvinLucide icon={SUBHEADING_LUCIDE.mileage} />
          {CSDD_MILEAGE_UNIFIED_TITLE}
        </p>
        <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-slate-200/90">
          <table className="w-full min-w-[320px] border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-[10px] font-medium text-[var(--color-provin-muted)]">
                <th className={cell}>Datums</th>
                <th className={cell}>Odometrs (km)</th>
                <th className={cell}>Valsts</th>
                <th className={cell}>Ieraksta avots</th>
              </tr>
            </thead>
            <tbody>
              {mileage.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-b-0">
                  <td className={`${cell} align-top`}>
                    {readOnly ? (
                      <span className="text-[var(--color-provin-muted)]">{row.date.trim() || "—"}</span>
                    ) : (
                      <input
                        type="text"
                        className={inp}
                        value={row.date}
                        disabled={disabled}
                        placeholder="2023-05-14"
                        onChange={(e) => setMileageRow(i, { date: e.target.value })}
                        aria-label={`${label} nobraukuma datums ${i + 1}`}
                      />
                    )}
                  </td>
                  <td className={`${cell} align-top`}>
                    {readOnly ? (
                      <span className="text-[var(--color-provin-muted)]">{row.odometer.trim() || "—"}</span>
                    ) : (
                      <input
                        type="text"
                        inputMode="numeric"
                        className={inp}
                        value={row.odometer}
                        disabled={disabled}
                        onChange={(e) => setMileageRow(i, { odometer: e.target.value.replace(/[^\d]/g, "") })}
                        aria-label={`${label} odometrs ${i + 1}`}
                      />
                    )}
                  </td>
                  <td className={`${cell} align-top`}>
                    {readOnly ? (
                      <CountryFlagWithCode countryLabel={row.country.trim() || "—"} />
                    ) : (
                      <AdminCountryCombobox
                        className={inp}
                        value={row.country}
                        disabled={disabled}
                        onChange={(next) => setMileageRow(i, { country: next })}
                        aria-label={`${label} valsts ${i + 1}`}
                      />
                    )}
                  </td>
                  <td className={`${cell} align-top`}>
                    {readOnly ? (
                      <span className="text-[var(--color-provin-muted)]">{row.origin.trim() || "—"}</span>
                    ) : (
                      <input
                        type="text"
                        className={inp}
                        value={row.origin}
                        disabled={disabled}
                        placeholder="reģistrs / apskate"
                        onChange={(e) => setMileageRow(i, { origin: e.target.value })}
                        aria-label={`${label} ieraksta avots ${i + 1}`}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!readOnly && !disabled ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:bg-slate-50"
              onClick={() => onChange({ ...block, mileage: [...mileage, emptyVinRegistryMileageRow()] })}
            >
              + Rinda
            </button>
            <AdminClearOdometerButton
              sourceLabel={label}
              count={countVinRegistryOdometerReadings(block)}
              onClear={() => onChange(clearVinRegistryOdometerReadings(block))}
            />
          </div>
        ) : null}

        <div className="mt-4 border-t border-slate-200 pt-3">
          <p className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            <AdminProvinLucide icon={SUBHEADING_LUCIDE.incidents} />
            {NEGADIJUMU_VESTURE_TITLE}
          </p>
          <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-slate-200/90">
            <table className="w-full min-w-[320px] border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-[10px] font-medium text-[var(--color-provin-muted)]">
                  <th className={cell}>Datums</th>
                  <th className={cell}>Summa (ja pieejama)</th>
                  <th className={cell}>Valsts</th>
                  <th className={cell}>Apraksts</th>
                  {!readOnly ? <th className={`w-9 ${cell}`} aria-hidden /> : null}
                </tr>
              </thead>
              <tbody>
                {incidents.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-b-0">
                    <td className={`${cell} align-top`}>
                      {readOnly ? (
                        <span className="text-[var(--color-provin-muted)]">{row.date.trim() || "—"}</span>
                      ) : (
                        <input
                          type="text"
                          className={inp}
                          value={row.date}
                          disabled={disabled}
                          onChange={(e) => setIncidentRow(i, { date: e.target.value })}
                          aria-label={`${label} negadījuma datums ${i + 1}`}
                        />
                      )}
                    </td>
                    <td className={`${cell} align-top`}>
                      <LossAmountFieldChrome value={row.amount}>
                        {readOnly ? (
                          <span className={row.amount.trim() ? "font-semibold" : "text-[var(--color-provin-muted)]"}>
                            {row.amount.trim() || "—"}
                          </span>
                        ) : (
                          <input
                            type="text"
                            className={`${inp} max-w-full border-0 bg-transparent shadow-none ring-0 focus:ring-0`}
                            placeholder="2930.00 €"
                            value={row.amount}
                            disabled={disabled}
                            onChange={(e) => setIncidentRow(i, { amount: e.target.value })}
                            onBlur={(e) => {
                              const n = normalizeLossAmountEurDisplay(e.target.value);
                              if (n !== e.target.value.trim()) setIncidentRow(i, { amount: n });
                            }}
                            aria-label={`${label} zaudējumu summa ${i + 1}`}
                          />
                        )}
                      </LossAmountFieldChrome>
                    </td>
                    <td className={`${cell} align-top`}>
                      {readOnly ? (
                        <CountryFlagWithCode countryLabel={row.country.trim() || "—"} />
                      ) : (
                        <AdminCountryCombobox
                          className={inp}
                          value={row.country}
                          disabled={disabled}
                          onChange={(next) => setIncidentRow(i, { country: next })}
                          aria-label={`${label} negadījuma valsts ${i + 1}`}
                        />
                      )}
                    </td>
                    <td className={`${cell} align-top`}>
                      {readOnly ? (
                        <span className="text-[var(--color-provin-muted)]">{row.note.trim() || "—"}</span>
                      ) : (
                        <input
                          type="text"
                          className={inp}
                          value={row.note}
                          disabled={disabled}
                          onChange={(e) => setIncidentRow(i, { note: e.target.value })}
                          aria-label={`${label} negadījuma apraksts ${i + 1}`}
                        />
                      )}
                    </td>
                    {!readOnly ? (
                      <td className={`${cell} align-top`}>
                        {incidents.length > 1 ? (
                          <button
                            type="button"
                            disabled={disabled}
                            className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                            onClick={() => removeIncidentRow(i)}
                            title="Noņemt rindu"
                          >
                            ×
                          </button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!readOnly && !disabled ? (
            <button
              type="button"
              className="mt-1.5 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:bg-slate-50"
              onClick={() => onChange({ ...block, incidents: [...incidents, emptyVinRegistryIncidentRow()] })}
            >
              + Rinda
            </button>
          ) : null}
        </div>

        {textField(
          "ownersSummary",
          "Īpašnieku skaits un reģistrācijas darbības",
          "Piem.: aplēstais īpašnieku skaits, pirmā reģistrācija, reģistrācijas / izslēgšanas datumi…",
          4,
        )}
        {textField(
          "statusRecords",
          "Statusi: TAXI, īre bez vadītāja, autoskola, līzings",
          "Izmantošanas veids, komerciālie statusi, ierobežojumi, arests / ķīla…",
          3,
        )}
        {textField(
          "autoNotes",
          "Piezīmes — anomālijas, brīdinājumi, sarkanie karogi",
          "Automātiski atrastie brīdinājumi; var papildināt manuāli…",
          4,
        )}
        {textField("rawUnprocessedData", "RAW dati (avota valodā)", "Neapstrādātā avota atbilde…", 5)}
      </div>

      <div className="mt-auto w-full min-w-0 shrink-0 pt-2">
        <AdminSourceCommentField
          value={block.comments}
          onChange={(next) => onChange({ ...block, comments: next })}
          readOnly={readOnly}
          disabled={disabled}
          compact
          gemini={geminiComment}
          aria-label={`${label} komentāri`}
        />
        <AdminGeminiContextRawField
          value={block.geminiContextRaw}
          onChange={(next) => onChange({ ...block, geminiContextRaw: next })}
          readOnly={readOnly}
          disabled={disabled}
          ariaLabel={`${label} — Gemini AI papildu konteksts`}
        />
      </div>
    </div>
  );

  return (
    <AdminCollapsibleShell
      sessionId={sessionId}
      blockId={`vin-registry-${blockKey}`}
      header={
        <AdminSourceBlockHeader blockKey={blockKey} trafficFillLevel={trafficFillLevel} className="shrink-0 mb-0" />
      }
      headerActions={
        onPdfIncludeChange ? <AdminPdfIncludeToggle checked={pdfInclude ?? true} onChange={onPdfIncludeChange} /> : undefined
      }
    >
      {inner}
    </AdminCollapsibleShell>
  );
}

type EstoniaPairProps = {
  mnt: VinRegistryBlockState;
  lkf: VinRegistryBlockState;
  onChangeMnt: (next: VinRegistryBlockState) => void;
  onChangeLkf: (next: VinRegistryBlockState) => void;
  trafficMnt?: TrafficFillLevel;
  trafficLkf?: TrafficFillLevel;
  pdfIncludeMnt: boolean;
  pdfIncludeLkf: boolean;
  onPdfIncludeMnt: (next: boolean) => void;
  onPdfIncludeLkf: (next: boolean) => void;
  geminiMnt?: AdminGeminiSourceCommentSlot;
  geminiLkf?: AdminGeminiSourceCommentSlot;
  sessionId: string;
  vin: string;
  readOnly: boolean;
  disabled?: boolean;
};

/** mnt.ee + lkf.ee vienā sadaļā, blakus. */
export function AdminEstoniaVinRegistryPair({
  mnt,
  lkf,
  onChangeMnt,
  onChangeLkf,
  trafficMnt,
  trafficLkf,
  pdfIncludeMnt,
  pdfIncludeLkf,
  onPdfIncludeMnt,
  onPdfIncludeLkf,
  geminiMnt,
  geminiLkf,
  sessionId,
  vin,
  readOnly,
  disabled,
}: EstoniaPairProps) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const loadBoth = async () => {
    const cleanVin = vin.trim();
    if (!cleanVin) {
      setStatus("Pasūtījumā nav VIN — ievadi to pārskata sadaļā.");
      return;
    }
    setBusy(true);
    setStatus("Ielasu Transpordiamet…");
    try {
      const mntRes = await requestVinRegistryFetch("mnt_ee", cleanVin);
      if (mntRes.ok) {
        onChangeMnt({ ...mntRes.block, comments: mnt.comments, geminiContextRaw: mnt.geminiContextRaw });
      }
      setStatus("Ielasu LKF kahjukontroll…");
      const lkfRes = await requestVinRegistryFetch("lkf_ee", cleanVin);
      if (lkfRes.ok) {
        onChangeLkf({ ...lkfRes.block, comments: lkf.comments, geminiContextRaw: lkf.geminiContextRaw });
      }
      const parts = [
        mntRes.ok ? `MNT: ${mntRes.message}` : `MNT: ${mntRes.error}`,
        lkfRes.ok ? `LKF: ${lkfRes.message}` : `LKF: ${lkfRes.error}`,
      ];
      setStatus(parts.join(" · "));
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Ielāde neizdevās");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-1.5">
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => void loadBoth()}
            className="rounded-md border border-[var(--color-provin-accent)]/40 bg-[var(--color-provin-accent-soft)]/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-apple-text)] transition hover:bg-[var(--color-provin-accent-soft)]/70 disabled:opacity-50"
          >
            {busy ? "Ielasu…" : "Ielasīt abus pēc VIN"}
          </button>
          <span className="font-mono text-[10px] text-slate-500">{vin.trim() || "— nav VIN —"}</span>
          {status ? (
            <span className="text-[10px] text-slate-600" role="status">
              {status}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="grid min-h-0 min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
        <div id="admin-order-block-mnt-ee" className="flex min-h-0 min-w-0 flex-col">
          <AdminVinRegistrySourceBlock
            blockKey="mnt_ee"
            value={mnt}
            readOnly={readOnly}
            disabled={disabled}
            onChange={onChangeMnt}
            trafficFillLevel={trafficMnt}
            sessionId={sessionId}
            vin={vin}
            geminiComment={geminiMnt}
            pdfInclude={pdfIncludeMnt}
            onPdfIncludeChange={onPdfIncludeMnt}
          />
        </div>
        <div id="admin-order-block-lkf-ee" className="flex min-h-0 min-w-0 flex-col">
          <AdminVinRegistrySourceBlock
            blockKey="lkf_ee"
            value={lkf}
            readOnly={readOnly}
            disabled={disabled}
            onChange={onChangeLkf}
            trafficFillLevel={trafficLkf}
            sessionId={sessionId}
            vin={vin}
            geminiComment={geminiLkf}
            pdfInclude={pdfIncludeLkf}
            onPdfIncludeChange={onPdfIncludeLkf}
          />
        </div>
      </div>
    </div>
  );
}
