"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AdminAiContextRawField } from "@/components/admin/AdminAiContextRawField";
import { AdminAiGenerateWithPrefill } from "@/components/admin/AdminAiGenerateWithPrefill";
import { AdminSourceBlockHeaderTools } from "@/components/admin/AdminClearSourceBlockButton";
import { AdminCollapsibleShell } from "@/components/admin/AdminCollapsibleShell";
import { AdminFieldResetButton } from "@/components/admin/AdminFieldResetButton";
import { AdminPdfIncludeToggle } from "@/components/admin/AdminPdfIncludeToggle";
import { AdminProvinLucide } from "@/components/admin/AdminProvinLucide";
import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import {
  AdminSourceCommentField,
  type AdminAiSourceCommentSlot,
} from "@/components/admin/AdminSourceCommentField";
import type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";
import type { TrafficFillLevel } from "@/lib/admin-block-traffic-status";
import { dropOrResetRow } from "@/lib/admin-drop-or-reset-row";
import { SUBHEADING_LUCIDE } from "@/lib/admin-lucide-registry";
import { SOURCE_BLOCK_LABELS, emptyOneautoBlock, type OneautoBlockState } from "@/lib/admin-source-blocks";
import { normalizeVin } from "@/lib/order-field-validation";
import {
  ONEAUTO_PRODUCTS,
  buildOneautoDisplay,
  emptyOneautoKvRow,
  emptyOneautoServiceEvent,
  formatOneautoCostEur,
  oneautoDisplayHasRows,
  oneautoPayloadIsPending,
  oneautoProductsCostCents,
  oneautoServiceHistoryIsEmpty,
  padOneautoKvRows,
  padOneautoServiceRows,
  type OneautoKvRow,
  type OneautoProductId,
  type OneautoServiceEvent,
} from "@/lib/oneauto-catalog";
import { oneautoDisplayWorksNeedLvTranslation } from "@/lib/oneauto-dealer";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

const subhead = "mb-1.5 mt-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500";

const cell = "px-1.5 py-0.5";

const addBtn =
  "mt-1.5 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:bg-slate-50";

type Props = {
  value: OneautoBlockState;
  orderVin: string;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: OneautoBlockState) => void;
  trafficFillLevel?: TrafficFillLevel;
  sessionId: string;
  pdfInclude: boolean;
  onPdfIncludeChange: (next: boolean) => void;
  aiComment?: AdminAiSourceCommentSlot;
  aiServiceHistory?: AdminAiSourceCommentSlot;
  aiOilChangeInterval?: AdminAiSourceCommentSlot;
};

function oneautoFetchErrorLv(code: string): string {
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
      return "OEM vēl apstrādā pieprasījumu. Pagaidi un spied Ielādēt datus vēlreiz. Atkārtota pārbaude parasti neiekasē jaunu maksu.";
    default:
      return "OneAutoAPI neatbildēja. Mēģini vēlreiz.";
  }
}

export function AdminOneautoSourceBlock({
  value,
  orderVin,
  readOnly,
  disabled,
  onChange,
  trafficFillLevel,
  sessionId,
  pdfInclude,
  onPdfIncludeChange,
  aiComment,
  aiServiceHistory,
  aiOilChangeInterval,
}: Props) {
  const editable = !readOnly && !disabled;
  const [busy, setBusy] = useState(false);
  const [translateBusy, setTranslateBusy] = useState(false);
  const [autoTranslateHint, setAutoTranslateHint] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoTranslateFailedKey = useRef("");
  const autoTranslateInflight = useRef(false);

  const effectiveVin = normalizeVin(value.vinOverride || orderVin);
  const estimatedCost = formatOneautoCostEur(oneautoProductsCostCents(value.selectedProducts));
  const display = useMemo(() => {
    if (oneautoDisplayHasRows(value.display)) return value.display;
    const payloads: Partial<Record<OneautoProductId, unknown>> = {};
    for (const id of Object.keys(value.results) as OneautoProductId[]) {
      payloads[id] = value.results[id]?.payload;
    }
    return buildOneautoDisplay(payloads);
  }, [value.display, value.results]);
  const cachedForVin =
    Boolean(value.lastFetchedVin) && normalizeVin(value.lastFetchedVin) === effectiveVin;
  const hasDisplay = oneautoDisplayHasRows(display);
  const historyResult = value.results.oe_service_history;
  const historyPending = Boolean(
    historyResult && (historyResult.error === "pending" || oneautoPayloadIsPending(undefined, historyResult.payload)),
  );
  const historyEmpty = Boolean(historyResult && oneautoServiceHistoryIsEmpty(historyResult.payload));
  const rawJson = useMemo(() => {
    const rows = Object.entries(value.results)
      .filter(([, row]) => row?.payload != null)
      .map(([id, row]) => ({ id, payload: row?.payload }));
    if (rows.length === 0) return "";
    try {
      return JSON.stringify(rows.length === 1 ? rows[0]?.payload : Object.fromEntries(rows.map((r) => [r.id, r.payload])), null, 2);
    } catch {
      return "";
    }
  }, [value.results]);

  const selectedSet = useMemo(() => new Set(value.selectedProducts), [value.selectedProducts]);
  const powertrainRows = padOneautoKvRows(display.powertrain);
  const equipmentRows = padOneautoKvRows(display.equipment);
  const serviceRows = padOneautoServiceRows(display.serviceTimeline);

  const patchDisplay = (next: Partial<typeof display>) => {
    onChange({ ...value, display: { ...display, ...next } });
  };

  const setKv = (key: "powertrain" | "equipment", index: number, patch: Partial<OneautoKvRow>) => {
    const rows = padOneautoKvRows(display[key]).map((row, i) => (i === index ? { ...row, ...patch } : row));
    patchDisplay({ [key]: rows });
  };

  const addKv = (key: "powertrain" | "equipment") => {
    patchDisplay({ [key]: [...padOneautoKvRows(display[key]), emptyOneautoKvRow()] });
  };

  const removeKv = (key: "powertrain" | "equipment", index: number) => {
    patchDisplay({ [key]: dropOrResetRow(padOneautoKvRows(display[key]), index, emptyOneautoKvRow) });
  };

  const setService = (index: number, patch: Partial<OneautoServiceEvent>) => {
    const rows = padOneautoServiceRows(display.serviceTimeline).map((row, i) =>
      i === index ? { ...row, ...patch } : row,
    );
    patchDisplay({ serviceTimeline: rows });
  };

  const toggleProduct = (id: OneautoProductId, checked: boolean) => {
    const next = checked
      ? [...ONEAUTO_PRODUCTS.map((p) => p.id).filter((pid) => pid === id || selectedSet.has(pid))]
      : value.selectedProducts.filter((pid) => pid !== id);
    onChange({ ...value, selectedProducts: next });
  };

  const fetchData = async () => {
    if (!editable || busy) return;
    if (value.selectedProducts.length === 0) {
      setError(oneautoFetchErrorLv("no_products_selected"));
      return;
    }
    if (cachedForVin && hasDisplay) {
      const ok = window.confirm(
        `Šim VIN jau ir saglabāti OneAuto dati. Ielādēt no jauna? Tas atkārtoti iekasēs ${estimatedCost}.`,
      );
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sources/oneautoapi", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin: effectiveVin, products: value.selectedProducts }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        vin?: string;
        costEur?: string;
        results?: OneautoBlockState["results"];
        display?: OneautoBlockState["display"];
      };
      if (!res.ok && !body.results) {
        setError(oneautoFetchErrorLv(body.error ?? "upstream_error"));
        return;
      }
      if (body.error && res.status === 402) {
        setError(oneautoFetchErrorLv("insufficient_balance"));
      } else if (body.error === "pending" || res.status === 202) {
        setError(oneautoFetchErrorLv("pending"));
      } else if (!res.ok) {
        setError(oneautoFetchErrorLv(body.error ?? "upstream_error"));
      }
      const nextResults = body.results ?? value.results;
      const payloads: Partial<Record<OneautoProductId, unknown>> = {};
      for (const id of Object.keys(nextResults) as OneautoProductId[]) {
        payloads[id] = nextResults[id]?.payload;
      }
      const nextDisplay = oneautoDisplayHasRows(body.display)
        ? body.display
        : buildOneautoDisplay(payloads);
      onChange({
        ...value,
        lastFetchedVin: body.vin ?? effectiveVin,
        fetchedAt: new Date().toISOString(),
        lastCostEur: body.costEur ?? estimatedCost,
        results: nextResults,
        display: nextDisplay ?? value.display,
        source: "oneautoapi",
      });
    } catch {
      setError(oneautoFetchErrorLv("upstream_error"));
    } finally {
      setBusy(false);
    }
  };

  const translateLv = async (
    operatorNotes: string,
    modelTier: AiAdminModelTier,
    opts?: { scope?: "works" | "all"; silent?: boolean },
  ) => {
    if (!editable || busy || translateBusy) return;
    if (!hasDisplay) {
      if (!opts?.silent) setError("Vispirms ielādē vai aizpildi tabulas.");
      return;
    }
    const scope = opts?.scope ?? "all";
    const worksKey = display.serviceTimeline.map((ev) => ev.works).join("\n");
    if (opts?.silent) autoTranslateFailedKey.current = worksKey;
    setTranslateBusy(true);
    if (opts?.silent) setAutoTranslateHint(true);
    if (!opts?.silent) setError(null);
    try {
      const res = await fetch("/api/admin/ai/oneauto-translate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          display,
          operatorNotes,
          modelTier,
          scope,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        display?: OneautoBlockState["display"];
      };
      if (!res.ok || !body.display) {
        if (opts?.silent) autoTranslateFailedKey.current = worksKey;
        if (!opts?.silent) {
          setError(
            body.error === "empty_source_data"
              ? "Nav ko tulkot - vispirms aizpildi tabulas."
              : "Tulkojums neizdevās. Mēģini vēlreiz.",
          );
        }
        return;
      }
      onChange({ ...value, display: body.display });
    } catch {
      if (opts?.silent) autoTranslateFailedKey.current = worksKey;
      if (!opts?.silent) setError("Tulkojums neizdevās. Mēģini vēlreiz.");
    } finally {
      setTranslateBusy(false);
      setAutoTranslateHint(false);
    }
  };

  useEffect(() => {
    if (!editable || busy || translateBusy || autoTranslateInflight.current) return;
    if (!oneautoDisplayWorksNeedLvTranslation(display)) return;
    const worksKey = display.serviceTimeline.map((ev) => ev.works).join("\n");
    if (autoTranslateFailedKey.current === worksKey) return;
    autoTranslateInflight.current = true;
    void translateLv("", "gemini-flash", { scope: "works", silent: true }).finally(() => {
      autoTranslateInflight.current = false;
    });
  }, [display, editable, busy, translateBusy]);

  return (
    <AdminCollapsibleShell
      sessionId={sessionId}
      blockId="oneauto"
      header={
        <AdminSourceBlockHeader
          blockKey="oneauto"
          trafficFillLevel={trafficFillLevel}
          className="mb-0 shrink-0"
        />
      }
      headerActions={
        <AdminSourceBlockHeaderTools
          sourceLabel={SOURCE_BLOCK_LABELS.oneauto}
          readOnly={readOnly}
          disabled={disabled}
          onClear={() => onChange(emptyOneautoBlock())}
        >
          <AdminPdfIncludeToggle checked={pdfInclude} onChange={onPdfIncludeChange} />
        </AdminSourceBlockHeaderTools>
      }
    >
      <div className={`flex h-full min-h-0 flex-col overflow-hidden ${trafficFillLevel ? "p-0" : "p-2"}`}>
        <div className={`min-h-0 flex-1 overflow-y-auto ${trafficFillLevel ? "px-2 pt-2" : ""}`}>
          <label className="mb-2 block">
            <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
              VIN
            </span>
            <input
              className={inp}
              value={value.vinOverride || orderVin}
              disabled={!editable}
              data-provin-handoff-vin={effectiveVin || undefined}
              spellCheck={false}
              autoCapitalize="characters"
              onChange={(e) => onChange({ ...value, vinOverride: e.target.value.toUpperCase() })}
            />
          </label>

          <fieldset className="space-y-1.5">
            <legend className={subhead}>Produkti</legend>
            {ONEAUTO_PRODUCTS.map((p) => {
              const result = value.results[p.id];
              const resultPending = Boolean(
                result &&
                  (result.error === "pending" || oneautoPayloadIsPending(undefined, result.payload)),
              );
              return (
                <label key={p.id} className="flex items-start gap-2 text-[11px] text-[var(--color-apple-text)]">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selectedSet.has(p.id)}
                    disabled={!editable || busy}
                    onChange={(e) => toggleProduct(p.id, e.target.checked)}
                  />
                  <span className="min-w-0">
                    <span className="font-medium">
                      {p.label} ({formatOneautoCostEur(p.priceCents)})
                    </span>
                    {p.hint ? (
                      <span className="ml-1 text-[var(--color-provin-muted)]">- {p.hint}</span>
                    ) : null}
                    {result ? (
                      <span
                        className={`ml-1 ${
                          resultPending ? "text-amber-700" : result.ok ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {resultPending ? "gaida OEM" : result.ok ? "ielādēts" : result.error ?? "kļūda"}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </fieldset>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-2">
            <p className="text-[11px] font-medium text-[var(--color-apple-text)]">
              Paredzamās izmaksas: {estimatedCost}
            </p>
            <button
              type="button"
              disabled={!editable || busy || !effectiveVin}
              onClick={() => void fetchData()}
              className="rounded-md bg-[var(--color-provin-accent)] px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Ielādē…" : "Ielādēt datus"}
            </button>
          </div>

          {cachedForVin && hasDisplay ? (
            <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-900">
              Saglabāti dati VIN {value.lastFetchedVin}
              {value.fetchedAt ? ` · ${value.fetchedAt.slice(0, 16).replace("T", " ")}` : ""}
              {value.lastCostEur ? ` · ${value.lastCostEur}` : ""}. Atkārtota ielāde nav nepieciešama.
            </p>
          ) : null}
          {cachedForVin && historyPending ? (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-950">
              OEM vēl nav atgriezis servisa vēsturi. Spied Ielādēt datus, lai pārbaudītu (parasti bez jaunas maksas).
            </p>
          ) : null}
          {cachedForVin && historyEmpty && !hasDisplay ? (
            <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
              Ielādēts. OEM atbilde šim VIN ir tukša: servisa ierakstu nav.
            </p>
          ) : null}
          {error ? <p className="mt-2 text-[11px] text-rose-700">{error}</p> : null}
          {autoTranslateHint ? (
            <p className="mt-2 text-[11px] text-slate-600">Tulko darbus latviski…</p>
          ) : null}

          {editable && hasDisplay ? (
            <div className="mt-2">
              <AdminAiGenerateWithPrefill
                label="Tulkot latviski"
                busy={translateBusy}
                disabled={!editable || busy}
                recommendedTier="gemini-flash"
                tiers={["gemini-flash", "gemini"]}
                dialogTitle="Papildu piezīmes tulkojumam"
                dialogHint="Pēc izvēles: piem. tikai darbus, saglabā OEM kodus. Flash vai Gemini iztulko tabulas skaidrā latviešu valodā."
                title="Iztulko ielasītos OneAuto laukus skaidrā latviešu valodā"
                onGenerate={translateLv}
              />
            </div>
          ) : null}

          <section>
            <h3 className={subhead}>
              <AdminProvinLucide icon={SUBHEADING_LUCIDE.serviceWorks} />
              Dzinēja / kārbas specifikācija
            </h3>
            <KvEditTable
              rows={powertrainRows}
              editable={editable}
              disabled={!editable}
              labelAria="Dzinēja / kārbas lauks"
              onChange={(i, patch) => setKv("powertrain", i, patch)}
              onRemove={(i) => removeKv("powertrain", i)}
            />
            {editable ? (
              <button type="button" className={addBtn} onClick={() => addKv("powertrain")}>
                Pievienot rindu
              </button>
            ) : null}
          </section>

          <section>
            <h3 className={subhead}>
              <AdminProvinLucide icon={SUBHEADING_LUCIDE.listingHistory} />
              Gatavā komplektācija
            </h3>
            <KvEditTable
              rows={equipmentRows}
              editable={editable}
              disabled={!editable}
              labelAria="Komplektācijas lauks"
              onChange={(i, patch) => setKv("equipment", i, patch)}
              onRemove={(i) => removeKv("equipment", i)}
            />
            {editable ? (
              <button type="button" className={addBtn} onClick={() => addKv("equipment")}>
                Pievienot rindu
              </button>
            ) : null}
          </section>

          <section>
            <h3 className={subhead}>
              <AdminProvinLucide icon={SUBHEADING_LUCIDE.registryTimeline} />
              Servisu vēstures laika skala
            </h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200/90">
              <table className="w-full min-w-[280px] border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-[10px] font-medium text-[var(--color-provin-muted)]">
                    <th className={cell}>Datums</th>
                    <th className={cell}>Km</th>
                    <th className={cell}>Vieta</th>
                    <th className={cell}>Darbi</th>
                    {editable ? <th className={`w-9 ${cell}`} aria-hidden /> : null}
                  </tr>
                </thead>
                <tbody>
                  {serviceRows.map((ev, i) => (
                    <tr key={`svc-${i}`} className="border-b border-slate-100 last:border-b-0">
                      <td className={cell}>
                        <input
                          className={inp}
                          value={ev.date}
                          disabled={!editable}
                          placeholder="21.10.2019"
                          aria-label={`Servisa datums, rinda ${i + 1}`}
                          onChange={(e) => setService(i, { date: e.target.value })}
                        />
                      </td>
                      <td className={cell}>
                        <input
                          className={inp}
                          value={ev.odometer}
                          disabled={!editable}
                          placeholder="69343"
                          aria-label={`Servisa km, rinda ${i + 1}`}
                          onChange={(e) => setService(i, { odometer: e.target.value })}
                        />
                      </td>
                      <td className={cell}>
                        <input
                          className={inp}
                          value={ev.place}
                          disabled={!editable}
                          placeholder="Dīleris"
                          aria-label={`Servisa vieta, rinda ${i + 1}`}
                          onChange={(e) => setService(i, { place: e.target.value })}
                        />
                      </td>
                      <td className={cell}>
                        <textarea
                          className={`${inp} min-h-[40px] resize-y`}
                          value={ev.works}
                          disabled={!editable}
                          placeholder="Eļļas maiņa"
                          rows={2}
                          aria-label={`Servisa darbi, rinda ${i + 1}`}
                          onChange={(e) => setService(i, { works: e.target.value })}
                        />
                      </td>
                      {editable ? (
                        <td className={cell}>
                          <AdminFieldResetButton
                            aria-label={`Dzēst servisa rindu ${i + 1}`}
                            onClick={() =>
                              patchDisplay({
                                serviceTimeline: dropOrResetRow(
                                  padOneautoServiceRows(display.serviceTimeline),
                                  i,
                                  emptyOneautoServiceEvent,
                                ),
                              })
                            }
                          />
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {editable ? (
              <button
                type="button"
                className={addBtn}
                onClick={() =>
                  patchDisplay({
                    serviceTimeline: [...padOneautoServiceRows(display.serviceTimeline), emptyOneautoServiceEvent()],
                  })
                }
              >
                Pievienot rindu
              </button>
            ) : null}
          </section>

          <section>
            <h3 className={subhead}>Jēlie OneAuto dati</h3>
            <textarea
              readOnly
              value={rawJson}
              placeholder="Pēc ielādes šeit būs OneAuto JSON. Ja tabulas paliek tukšas, skaties šo lauku."
              className={`${inp} min-h-[96px] font-mono text-[10px] leading-snug`}
              aria-label="Jēlie OneAuto dati"
            />
          </section>

          <AdminSourceCommentField
            label="Servisa vēsture"
            value={value.serviceHistoryNotes ?? ""}
            onChange={(html) => onChange({ ...value, serviceHistoryNotes: html })}
            readOnly={readOnly}
            disabled={disabled}
            compact
            ai={aiServiceHistory}
            aria-label="OFICIĀLĀ DĪLERA DATI — Servisa vēsture"
          />
          <AdminSourceCommentField
            label="Eļļas maiņas intervāli"
            value={value.oilChangeIntervalNotes ?? ""}
            onChange={(html) => onChange({ ...value, oilChangeIntervalNotes: html })}
            readOnly={readOnly}
            disabled={disabled}
            compact
            ai={aiOilChangeInterval}
            aria-label="OFICIĀLĀ DĪLERA DATI — Eļļas maiņas intervāli"
          />
          <AdminSourceCommentField
            value={value.comments}
            onChange={(html) => onChange({ ...value, comments: html })}
            readOnly={readOnly}
            disabled={disabled}
            compact
            ai={aiComment}
          />
          <AdminAiContextRawField
            value={value.aiContextRaw}
            onChange={(next) => onChange({ ...value, aiContextRaw: next })}
            readOnly={readOnly}
            disabled={disabled}
          />
        </div>
      </div>
    </AdminCollapsibleShell>
  );
}

function KvEditTable({
  rows,
  editable,
  disabled,
  labelAria,
  onChange,
  onRemove,
}: {
  rows: OneautoKvRow[];
  editable: boolean;
  disabled: boolean;
  labelAria: string;
  onChange: (index: number, patch: Partial<OneautoKvRow>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200/90">
      <table className="w-full min-w-[240px] border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-[10px] font-medium text-[var(--color-provin-muted)]">
            <th className={cell}>Lauks</th>
            <th className={cell}>Vērtība</th>
            {editable ? <th className={`w-9 ${cell}`} aria-hidden /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`kv-${i}`} className="border-b border-slate-100 last:border-b-0">
              <td className={`${cell} w-[38%]`}>
                <input
                  className={inp}
                  value={row.label}
                  disabled={disabled}
                  placeholder="Dzinējs"
                  aria-label={`${labelAria} nosaukums, rinda ${i + 1}`}
                  onChange={(e) => onChange(i, { label: e.target.value })}
                />
              </td>
              <td className={cell}>
                <input
                  className={inp}
                  value={row.value}
                  disabled={disabled}
                  placeholder="2.0 TDI"
                  aria-label={`${labelAria} vērtība, rinda ${i + 1}`}
                  onChange={(e) => onChange(i, { value: e.target.value })}
                />
              </td>
              {editable ? (
                <td className={cell}>
                  <AdminFieldResetButton
                    aria-label={`Dzēst ${labelAria} rindu ${i + 1}`}
                    onClick={() => onRemove(i)}
                  />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
