"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { openGeneratedHtmlDocument } from "@/lib/admin-open-window";
import {
  DEALER_CHECK_DEFAULT_SELECTED,
  DEALER_CHECK_DEFAULT_TEMPLATE,
  DEALER_CHECK_SOURCES,
  DEALER_CHECK_TEMPLATE_LABEL,
  DEALER_CHECK_TEMPLATES,
  buildDealerCheckLvHtml,
  dealerCheckCanLoad,
  dealerCheckEmptyStateText,
  dealerCheckHasResult,
  dealerCheckHttp206Warning,
  dealerCheckMileageHttp206Note,
  dealerCheckSelection,
  dealerCheckServiceHistoryHttp206,
  formatDealerCheckEur,
  formatDealerCheckLoadLog,
  type DealerCheckComments,
  type DealerCheckRecord,
  type DealerCheckTemplateId,
} from "@/lib/dealer-check";
import {
  DEALER_CHECK_CSDD_LOOKUP_PATH,
  DEALER_CHECK_CSDD_TITLE,
  applyDealerCheckCsddResult,
  dealerCheckCsddLookupQuery,
  dealerCheckCsddPreviewMatchesQuery,
  dealerCheckCsddPreviewRows,
  dealerCheckHasCsddPreview,
  parseDealerCheckCsddResponse,
} from "@/lib/dealer-check-csdd";
import { isValidVin, normalizeVin, sanitizeVinInput } from "@/lib/order-field-validation";
import type { CsddTechData } from "@/lib/csdd-tech-data";
import type { OneautoProductId } from "@/lib/oneauto-catalog";

const inp =
  "w-full min-w-0 rounded-[10px] border border-[#d1d1d6] bg-white px-3 py-[10px] font-mono text-[14px] text-[#111] placeholder:text-[#8e8e93] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/25";

function errorLv(code: string): string {
  switch (code) {
    case "unauthorized":
      return "Admin sesija beigusies. Ielādē lapu no jauna.";
    case "missing_oneauto_credentials":
      return "Serverī nav ONEAUTO_API_KEY.";
    case "no_products_selected":
      return "Atzīmē vismaz vienu OneAuto avotu.";
    case "invalid_vin":
      return "Ievadi derīgu VIN vai numurzīmi.";
    case "not_found":
      return "Saglabātais pārskats nav atrasts.";
    default:
      return "Ielāde neizdevās. Mēģini vēlreiz.";
  }
}

export function AdminDealerCheckPage({
  initialVin,
  initialPlate = "",
  initialCsdd = null,
  initialCsddMessage = "",
  fromAutoparks = false,
}: {
  initialVin: string;
  initialPlate?: string;
  initialCsdd?: CsddTechData | null;
  initialCsddMessage?: string;
  fromAutoparks?: boolean;
}) {
  const [template, setTemplate] = useState<DealerCheckTemplateId>(DEALER_CHECK_DEFAULT_TEMPLATE);
  const [vin, setVin] = useState(initialVin);
  const [plate, setPlate] = useState(initialPlate);
  const [selected, setSelected] = useState<OneautoProductId[]>([...DEALER_CHECK_DEFAULT_SELECTED]);
  const [record, setRecord] = useState<DealerCheckRecord | null>(null);
  const [csddPreview, setCsddPreview] = useState<CsddTechData | null>(initialCsdd);
  const [csddBusy, setCsddBusy] = useState(false);
  const [csddError, setCsddError] = useState(initialCsddMessage);
  const [ledgerBar, setLedgerBar] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftComments, setDraftComments] = useState<DealerCheckComments>({
    serviceHistory: "",
    oilIntervals: "",
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(fromAutoparks && initialVin ? "VIN iekopēts no Autoparks. Avoti paliek izslēgti." : "");
  const csddLookupSeq = useRef(0);

  const pick = dealerCheckSelection(selected);
  const canLoad = dealerCheckCanLoad(selected) && !busy && (Boolean(normalizeVin(vin)) || Boolean(plate.trim()));

  const loadLedger = useCallback(async (vinHint?: string) => {
    const q = vinHint ? `?vin=${encodeURIComponent(vinHint)}` : "";
    const res = await fetch(`/api/admin/dealer-check${q}`, { credentials: "include" });
    const body = (await res.json().catch(() => ({}))) as {
      bar?: string;
      record?: DealerCheckRecord | null;
    };
    if (body.bar) setLedgerBar(body.bar);
    if (vinHint && body.record && !fromAutoparks) {
      setRecord(body.record);
      setDraftComments(body.record.comments);
      setTemplate(body.record.template);
      if (body.record.plate && !plate) setPlate(body.record.plate);
    }
  }, [fromAutoparks, plate]);

  useEffect(() => {
    void loadLedger(initialVin || undefined);
  }, [initialVin, loadLedger]);

  const lookupCsdd = useCallback(async (query: string, current: { vin: string; plate: string }) => {
    const seq = ++csddLookupSeq.current;
    setCsddBusy(true);
    setCsddError("");
    try {
      const res = await fetch(DEALER_CHECK_CSDD_LOOKUP_PATH, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nr1: query }),
      });
      const parsed = parseDealerCheckCsddResponse(await res.json().catch(() => null));
      if (seq !== csddLookupSeq.current) return;
      if (!res.ok || !parsed) {
        setCsddPreview(null);
        setCsddError(
          res.status === 401
            ? "Admin sesija beigusies. Ielādē lapu no jauna."
            : res.status === 400
              ? "Nav derīga VIN vai numurzīmes."
              : "Neizdevās ielādēt CSDD reģistra datus.",
        );
        return;
      }
      const applied = applyDealerCheckCsddResult(current, parsed);
      if (applied.vin && applied.vin !== current.vin) setVin(applied.vin);
      if (applied.plate && applied.plate !== current.plate) setPlate(applied.plate);
      setCsddPreview(applied.csdd);
      setCsddError(applied.found ? "" : applied.message);
    } catch {
      if (seq !== csddLookupSeq.current) return;
      setCsddPreview(null);
      setCsddError("Neizdevās savienoties ar CSDD releju.");
    } finally {
      if (seq === csddLookupSeq.current) setCsddBusy(false);
    }
  }, []);

  useEffect(() => {
    const query = dealerCheckCsddLookupQuery(plate, vin);
    if (!query) {
      if (csddPreview) setCsddPreview(null);
      return;
    }
    if (dealerCheckCsddPreviewMatchesQuery(csddPreview, query)) return;
    const t = window.setTimeout(() => {
      void lookupCsdd(query, { vin, plate });
    }, 450);
    return () => window.clearTimeout(t);
  }, [plate, vin, csddPreview, lookupCsdd]);

  function toggle(id: OneautoProductId) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function onLoad() {
    setError("");
    setNotice("");
    if (!canLoad) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/dealer-check", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vin, plate, template, products: selected }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        record?: DealerCheckRecord;
        bar?: string;
      };
      if (!res.ok || !body.record) {
        setError(errorLv(body.error ?? "upstream_error"));
        return;
      }
      setRecord(body.record);
      setDraftComments(body.record.comments);
      setEditing(false);
      if (body.bar) setLedgerBar(body.bar);
      if (body.record.vin && !isValidVin(vin)) setVin(body.record.vin);
    } catch {
      setError(errorLv("upstream_error"));
    } finally {
      setBusy(false);
    }
  }

  async function persist(patch: Record<string, unknown>) {
    if (!record) return null;
    const res = await fetch("/api/admin/dealer-check", {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: record.id, ...patch }),
    });
    const body = (await res.json().catch(() => ({}))) as { record?: DealerCheckRecord; error?: string };
    if (!res.ok || !body.record) {
      setError(errorLv(body.error ?? "upstream_error"));
      return null;
    }
    setRecord(body.record);
    setDraftComments(body.record.comments);
    return body.record;
  }

  async function onSave() {
    if (!record) return;
    setBusy(true);
    try {
      const next = await persist({ comments: draftComments, saved: true });
      if (next) setNotice("Saglabāts. Piesaistīts VIN un Autoparks, ja auto ir parkā.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!record) return;
    if (!window.confirm("Dzēst šo dīlera datu pārskatu? OneAuto maksa paliek uzskaitē.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/dealer-check?id=${encodeURIComponent(record.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = (await res.json().catch(() => ({}))) as { bar?: string; error?: string };
      if (!res.ok) {
        setError(errorLv(body.error ?? "upstream_error"));
        return;
      }
      setRecord(null);
      setDraftComments({ serviceHistory: "", oilIntervals: "" });
      setEditing(false);
      if (body.bar) setLedgerBar(body.bar);
      setNotice("Pārskats dzēsts.");
    } finally {
      setBusy(false);
    }
  }

  async function onGenerateComment() {
    if (!record) return;
    setBusy(true);
    try {
      const next = await persist({ generateComments: true });
      if (next) setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function openPdf(kind: "raw" | "lv") {
    if (!record) return;
    const fallback = kind === "lv" ? buildDealerCheckLvHtml({ ...record, comments: draftComments }) : "";
    const res = await fetch(`/api/admin/dealer-check/pdf?id=${encodeURIComponent(record.id)}&kind=${kind}`, {
      credentials: "include",
    });
    const body = (await res.json().catch(() => ({}))) as { html?: string };
    const html = body.html || fallback;
    if (html) openGeneratedHtmlDocument(html, `${record.vin}-${kind}.html`);
  }

  const http206 = record ? dealerCheckServiceHistoryHttp206(record.results) : false;
  const log = useMemo(
    () =>
      record
        ? formatDealerCheckLoadLog({
            results: record.results,
            selected: record.selectedProducts,
            fetchedAt: record.fetchedAt,
            template: record.template,
            chargedCents: record.chargedCents,
            monthKey: record.monthKey,
          })
        : "",
    [record],
  );

  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-16 pt-2 sm:px-7 sm:pt-4">
      <h1 className="text-[23px] font-semibold tracking-tight text-[#111] sm:text-[26px]">Dīlera datu pārbaude</h1>
      <p className="mb-5 mt-1 text-[13.5px] text-[#6e6e73]">Iekšējā · bez klienta pasūtījuma · ADMIN</p>

      <section className="mb-3.5 rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.5px] text-[#3a3a3c]">
          Šablons - kam paredzēts
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {DEALER_CHECK_TEMPLATES.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTemplate(id)}
              className={`rounded-full border px-3.5 py-2 text-[13.5px] font-semibold ${
                template === id ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-[#d1d1d6] bg-white text-[#111]"
              }`}
            >
              {DEALER_CHECK_TEMPLATE_LABEL[id]}
            </button>
          ))}
          <div className="w-full rounded-xl bg-[#f2f4f8] px-3.5 py-2.5 text-[13px] text-[#3a3a3c] sm:ml-auto sm:w-auto">
            {ledgerBar || "Dzintarzeme · šis mēnesis 0,00 € · 0 ielādes | Cits · 0,00 € · 0"}
          </div>
        </div>
      </section>

      <section className="mb-3.5 rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-5">
        <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.5px] text-[#3a3a3c]">Meklēšana</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-[2]">
            <span className="mb-1.5 block text-[11.5px] font-semibold text-[#6e6e73]">VIN</span>
            <input
              className={inp}
              value={vin}
              onChange={(e) => setVin(sanitizeVinInput(e.target.value))}
              placeholder="17 simboli"
              autoComplete="off"
              spellCheck={false}
              data-provin-handoff-vin
            />
          </label>
          <label className="block min-w-0 flex-1">
            <span className="mb-1.5 block text-[11.5px] font-semibold text-[#6e6e73]">Valsts numurzīme (v/n)</span>
            <input
              className={inp}
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="piem. AB-1234"
              autoComplete="off"
              spellCheck={false}
              aria-label="Valsts numurzīme"
            />
          </label>
        </div>
        {csddBusy ? (
          <p className="mt-2 text-[12.5px] text-[#6e6e73]" role="status">
            CSDD: meklē VIN pēc numurzīmes…
          </p>
        ) : null}
        {csddError ? (
          <p className="mt-2 text-[12.5px] text-[#d70015]" role="alert">
            {csddError}
          </p>
        ) : null}

        <h2 className="mb-3 mt-[18px] flex flex-wrap items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.5px] text-[#3a3a3c]">
          OneAuto avoti
          <span className="rounded-full bg-[#eef4ff] px-2 py-0.5 text-[10.5px] font-bold normal-case tracking-normal text-[#2563EB]">
            noklusējumā visi izslēgti
          </span>
        </h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {DEALER_CHECK_SOURCES.map((src) => {
            const on = selected.includes(src.id);
            return (
              <button
                key={src.id}
                type="button"
                onClick={() => toggle(src.id)}
                className={`flex items-start gap-2.5 rounded-xl border p-3 text-left ${
                  on ? "border-[#2563EB] bg-[#f3f7ff]" : "border-[#e5e5ea] bg-white"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] border-[1.5px] text-[12px] text-white ${
                    on ? "border-[#2563EB] bg-[#2563EB]" : "border-[#c7c7cc] bg-white"
                  }`}
                >
                  {on ? "✓" : ""}
                </span>
                <span>
                  <b className="block text-[13px] font-semibold text-[#111]">{src.label}</b>
                  <span className="text-[12px] text-[#6e6e73]">
                    {src.hint} · {formatDealerCheckEur(src.priceCents)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3.5 flex flex-wrap items-center gap-3">
          <span className="text-[13.5px] text-[#6e6e73]">
            Atzīmēti: {pick.count} · kopā <b className="text-[#111]">{formatDealerCheckEur(pick.cents)}</b>
          </span>
          <button
            type="button"
            disabled={!canLoad}
            onClick={() => void onLoad()}
            className="ml-auto rounded-[10px] bg-[#2563EB] px-4 py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-45"
          >
            {busy ? "Ielādē…" : `Ielādēt · ${formatDealerCheckEur(pick.cents)}`}
          </button>
        </div>
      </section>

      {error ? (
        <p className="mb-3.5 rounded-xl border border-[#f3c2c7] bg-[#fff5f5] px-3.5 py-3 text-[13px] text-[#d70015]">{error}</p>
      ) : null}
      {notice ? (
        <p className="mb-3.5 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3.5 py-3 text-[13px] text-[#166534]">{notice}</p>
      ) : null}

      {dealerCheckHasCsddPreview(csddPreview) ? (
        <AdminDealerCheckCsddPreview data={csddPreview!} />
      ) : null}

      {!dealerCheckHasResult(record) ? (
        <div className="rounded-[14px] border-[1.5px] border-dashed border-[#d1d1d6] bg-white px-6 py-10 text-center text-[13.5px] leading-6 text-[#8e8e93]">
          {dealerCheckEmptyStateText()}
        </div>
      ) : (
        <DealerCheckResult
          record={{ ...record!, comments: editing ? draftComments : record!.comments }}
          log={log}
          http206={http206}
          editing={editing}
          draftComments={draftComments}
          onDraft={setDraftComments}
          onEdit={() => setEditing(true)}
          onGenerate={() => void onGenerateComment()}
          onPdf={(k) => void openPdf(k)}
          onSave={() => void onSave()}
          onDelete={() => void onDelete()}
          busy={busy}
        />
      )}
    </div>
  );
}

function DealerCheckResult({
  record,
  log,
  http206,
  editing,
  draftComments,
  onDraft,
  onEdit,
  onGenerate,
  onPdf,
  onSave,
  onDelete,
  busy,
}: {
  record: DealerCheckRecord;
  log: string;
  http206: boolean;
  editing: boolean;
  draftComments: DealerCheckComments;
  onDraft: (c: DealerCheckComments) => void;
  onEdit: () => void;
  onGenerate: () => void;
  onPdf: (kind: "raw" | "lv") => void;
  onSave: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const v = record.vehicle;
  const warn = dealerCheckHttp206Warning();
  const kv: Array<[string, string, boolean?]> = [
    ["Marka", v.make],
    ["Modelis", v.model],
    ["Virsbūve", v.body],
    ["Dzinējs", v.engine],
    ["Pirmā reģ.", v.firstReg],
    ["Krāsa", v.color],
    ["Pārnesumkārba", v.gearbox],
    ["Ražotājs", v.manufacturer],
    ["VIN", v.vin, true],
  ];

  return (
    <>
      <div className="mb-3.5 whitespace-pre-line rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3.5 py-2.5 text-[12.5px] leading-[1.7] text-[#166534]">
        {log}
      </div>

      <section className="mb-3.5 rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-5">
        <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.5px] text-[#3a3a3c]">
          Transporta informācija
        </h2>
        <div className="grid grid-cols-2 gap-x-[18px] gap-y-3 lg:grid-cols-4">
          {kv.map(([label, value, mono]) => (
            <div key={label}>
              <span className="block text-[11px] font-semibold text-[#8e8e93]">{label}</span>
              <b className={`font-medium text-[#111] ${mono ? "font-mono" : ""}`}>{value || "-"}</b>
            </div>
          ))}
        </div>
      </section>

      <div className="mb-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-5">
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.5px] text-[#3a3a3c]">
            Nobraukuma vēsture
          </h2>
          {http206 ? (
            <div className="rounded-xl border border-[#fcd34d] bg-[#fffbeb] px-4 py-3 text-[12.5px] leading-[1.55] text-[#92400e]">
              {dealerCheckMileageHttp206Note({ mentionCsdd: true })}
            </div>
          ) : (
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr>
                  <th className="border-b border-[#e5e5ea] px-2 py-1.5 text-left text-[11px] font-semibold text-[#8e8e93]">Datums</th>
                  <th className="border-b border-[#e5e5ea] px-2 py-1.5 text-left text-[11px] font-semibold text-[#8e8e93]">Odometrs</th>
                  <th className="border-b border-[#e5e5ea] px-2 py-1.5 text-left text-[11px] font-semibold text-[#8e8e93]">Avots</th>
                </tr>
              </thead>
              <tbody>
                {record.mileageRows.map((row, i) => (
                  <tr key={`${row.date}-${i}`}>
                    <td className="border-b border-[#f2f2f7] px-2 py-2">{row.date}</td>
                    <td className="border-b border-[#f2f2f7] px-2 py-2 font-mono">{row.odometer}</td>
                    <td className="border-b border-[#f2f2f7] px-2 py-2">{row.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-5">
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.5px] text-[#3a3a3c]">Servisa vēsture</h2>
          {http206 ? (
            <div className="rounded-xl border border-[#fcd34d] bg-[#fffbeb] px-4 py-3 text-[13px] leading-[1.55] text-[#92400e]">
              <b>{warn.title}</b>
              <br />
              {warn.body}
              <div className="mt-1 text-[12px] opacity-80">
                OE Service History · 3,00 € netika iekasēti
                {record.fetchedAt ? ` · ${record.fetchedAt.slice(11, 16)}` : ""}
              </div>
            </div>
          ) : (
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr>
                  <th className="border-b border-[#e5e5ea] px-2 py-1.5 text-left text-[11px] font-semibold text-[#8e8e93]">Datums</th>
                  <th className="border-b border-[#e5e5ea] px-2 py-1.5 text-left text-[11px] font-semibold text-[#8e8e93]">Km</th>
                  <th className="border-b border-[#e5e5ea] px-2 py-1.5 text-left text-[11px] font-semibold text-[#8e8e93]">Darbi</th>
                  <th className="border-b border-[#e5e5ea] px-2 py-1.5 text-left text-[11px] font-semibold text-[#8e8e93]">Dīleris</th>
                </tr>
              </thead>
              <tbody>
                {record.serviceRows.map((row, i) => (
                  <tr key={`${row.date}-${i}`}>
                    <td className="border-b border-[#f2f2f7] px-2 py-2">{row.date}</td>
                    <td className="border-b border-[#f2f2f7] px-2 py-2 font-mono">{row.km}</td>
                    <td className="border-b border-[#f2f2f7] px-2 py-2">{row.works}</td>
                    <td className="border-b border-[#f2f2f7] px-2 py-2">{row.dealer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="mb-3.5 rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-5">
        <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.5px] text-[#3a3a3c]">Gemini komentāri</h2>
        {(["serviceHistory", "oilIntervals"] as const).map((key) => (
          <div key={key} className="mt-2.5 rounded-xl border border-[#e5e5ea] bg-[#fafafa] px-3.5 py-3">
            <b className="text-[12px] text-[#111]">
              {key === "serviceHistory" ? "Gemini: Servisa vēsture" : "Gemini: Apkopes intervāli"}
            </b>
            {editing ? (
              <textarea
                className="mt-2 min-h-[72px] w-full rounded-lg border border-[#d1d1d6] bg-white px-2 py-1.5 text-[13px] text-[#3a3a3c]"
                value={draftComments[key]}
                onChange={(e) => onDraft({ ...draftComments, [key]: e.target.value })}
              />
            ) : (
              <p className="mt-1.5 text-[13.5px] leading-[1.55] text-[#3a3a3c]">{record.comments[key]}</p>
            )}
          </div>
        ))}
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button type="button" onClick={onGenerate} disabled={busy} className="flex-1 rounded-[10px] bg-[#f2f2f7] px-4 py-2.5 text-[13.5px] font-semibold text-[#111] sm:flex-none">
            Ģenerēt komentāru
          </button>
          <button type="button" onClick={onEdit} className="flex-1 rounded-[10px] bg-[#f2f2f7] px-4 py-2.5 text-[13.5px] font-semibold text-[#111] sm:flex-none">
            Rediģēt
          </button>
        </div>
      </section>

      <section className="mb-3.5 rounded-2xl border border-dashed border-[#e5e5ea] bg-white p-4 sm:p-5">
        <h2 className="mb-3 flex flex-wrap items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.5px] text-[#3a3a3c]">
          CSDD salīdzinājums
          <span className="rounded-full bg-[#fef2f2] px-2 py-0.5 text-[10.5px] font-bold normal-case tracking-normal text-[#b91c1c]">
            Tikai iekšēji · nav PDF
          </span>
        </h2>
        <div className="grid grid-cols-2 gap-x-[18px] gap-y-3 lg:grid-cols-4">
          <CsddKv label="CSDD reģ. LV" value={record.csdd?.firstRegLv ?? ""} />
          <CsddKv label="CSDD odometrs" value={record.csdd?.odometer ?? ""} mono />
          <CsddKv label="TA derīga līdz" value={record.csdd?.inspectionUntil ?? ""} />
          <CsddKv
            label="Atbilstība"
            value={record.csdd?.matchLabel ?? "nav ar ko salīdzināt"}
            ok={record.csdd?.match === "match"}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onPdf("lv")} className="flex-1 rounded-[10px] bg-[#2563EB] px-4 py-2.5 text-[13.5px] font-semibold text-white sm:flex-none">
            Ģenerēt PDF
          </button>
          <button type="button" onClick={() => onPdf("raw")} className="flex-1 rounded-[10px] bg-[#f2f2f7] px-4 py-2.5 text-[13.5px] font-semibold text-[#111] sm:flex-none">
            Atvērt RAW
          </button>
          <button type="button" onClick={() => onPdf("lv")} className="flex-1 rounded-[10px] bg-[#f2f2f7] px-4 py-2.5 text-[13.5px] font-semibold text-[#111] sm:flex-none">
            Atvērt LV
          </button>
          <span className="hidden flex-1 sm:block" />
          <button type="button" onClick={onSave} disabled={busy} className="flex-1 rounded-[10px] bg-[#16a34a] px-4 py-2.5 text-[13.5px] font-semibold text-white sm:flex-none">
            Saglabāt
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="flex-1 rounded-[10px] border border-[#f3c2c7] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#d70015] sm:flex-none"
          >
            Dzēst
          </button>
        </div>
      </section>
    </>
  );
}

function CsddKv({
  label,
  value,
  mono,
  ok,
}: {
  label: string;
  value: string;
  mono?: boolean;
  ok?: boolean;
}) {
  return (
    <div>
      <span className="block text-[11px] font-semibold text-[#8e8e93]">{label}</span>
      <b className={`font-medium ${ok ? "text-[#16a34a]" : "text-[#111]"} ${mono ? "font-mono" : ""}`}>{value || "-"}</b>
    </div>
  );
}

export function AdminDealerCheckCsddPreview({ data }: { data: CsddTechData }) {
  const rows = dealerCheckCsddPreviewRows(data);
  if (rows.length === 0) return null;
  return (
    <section className="mb-3.5 rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-5" data-dealer-check-csdd-preview>
      <h2 className="mb-1.5 flex flex-wrap items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.5px] text-[#3a3a3c]">
        {DEALER_CHECK_CSDD_TITLE}
        <span className="rounded-full bg-[#eef4ff] px-2 py-0.5 text-[10.5px] font-bold normal-case tracking-normal text-[#2563EB]">
          Pirms OneAuto · iekšēji
        </span>
      </h2>
      <p className="mb-3 text-[12.5px] text-[#6e6e73]">
        Pilni CSDD reģistra tehniskie dati. OneAuto avoti paliek izslēgti, līdz nospied Ielādēt.
      </p>
      <div className="grid grid-cols-2 gap-x-[18px] gap-y-3 lg:grid-cols-4">
        {rows.map((row) => (
          <div key={row.key}>
            <span className="block text-[11px] font-semibold text-[#8e8e93]">{row.label}</span>
            <b className={`font-medium text-[#111] ${row.key === "vin" || row.key === "registrationNumber" ? "font-mono" : ""}`}>
              {row.value}
            </b>
          </div>
        ))}
      </div>
    </section>
  );
}
