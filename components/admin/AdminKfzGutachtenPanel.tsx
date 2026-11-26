"use client";

import { ExternalLink, FileUp, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { CitiAvotiBlockState, WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import {
  applyKfzAtToCitiAvoti,
  findKfzAtSectionIndex,
  parseKfzSearchListText,
  readKfzAtStore,
} from "@/lib/kfzgutachten/apply-citi";
import { resolveKfzFirstRegistration } from "@/lib/kfzgutachten/first-registration";
import {
  KFZ_AT_GUTACHTEN_PRICE_EUR,
  KFZ_AT_SECTION_LABEL,
  kfzExactDateDdMmYyyy,
  kfzgutachtenSearchUrl,
} from "@/lib/kfzgutachten/kfzgutachten";
import type { KfzGutachtenReport } from "@/lib/kfzgutachten/parse-gutachten";
import {
  KFZ_AT_LIST_ACK_EVENT,
  KFZ_AT_LIST_EVENT,
  parseKfzAtUserscriptDetail,
} from "@/lib/kfzgutachten/userscript-bridge";

const inp =
  "min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";
const btn =
  "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-apple-text)] hover:bg-slate-50 disabled:opacity-50";

type Props = {
  vin: string;
  /** Pasūtījuma sessionId - «Atvērt sarakstu» saitē, lai PROVIN skripts sarakstu nosūta tieši šim pasūtījumam. */
  sessionId?: string;
  value: CitiAvotiBlockState;
  onChange: (next: CitiAvotiBlockState) => void;
  getSourceBlocks?: () => WorkspaceSourceBlocks;
  disabled?: boolean;
};

/** Citi avoti: Austrijas §57a apskates - saite uz bezmaksas sarakstu, saraksta ielīmēšana, nopirkto atzinumu PDF. */
export function AdminKfzGutachtenPanel({ vin, sessionId, value, onChange, getSourceBlocks, disabled }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [manualDate, setManualDate] = useState<string | null>(null);
  const [listPaste, setListPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Bloki mainās nemainīgi (jauns objekts pie labojuma) - pārrēķinām tikai, kad mainās datuma avoti.
  const blocks = getSourceBlocks?.();
  const resolution = useMemo(() => {
    if (!blocks) return null;
    try {
      return resolveKfzFirstRegistration({ ...blocks, citi_avoti: value });
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks?.csdd, blocks?.auto_records, blocks?.autodna, blocks?.carvertical, blocks?.cc_vin, blocks?.traficom_fi, blocks?.finnik, value]);

  const store = useMemo(() => {
    const idx = findKfzAtSectionIndex(value);
    return idx >= 0 ? readKfzAtStore(value.sections[idx]) : null;
  }, [value]);

  const dateText = manualDate ?? resolution?.date ?? "";
  const exact = kfzExactDateDdMmYyyy(dateText);
  const chosen = resolution?.candidates.find((c) => c.date === exact);
  const url = kfzgutachtenSearchUrl(vin, exact, sessionId);

  const apply = (add: { reports?: KfzGutachtenReport[]; list?: ReturnType<typeof parseKfzSearchListText> }) => {
    const res = applyKfzAtToCitiAvoti(value, add, { vin });
    onChange(res.block);
    const parts = [
      res.addedListRows > 0 ? `${res.addedListRows} apskates sarakstā` : "",
      res.addedReports > 0 ? `${res.addedReports} atzinumi ielasīti` : "",
    ].filter(Boolean);
    setNotice(parts.length ? `${parts.join(" · ")}.` : "Jaunu ierakstu nav.");
    setError(res.warnings.length ? res.warnings.join(" ") : null);
  };

  // PROVIN skripts (kfzgutachten.at pēc «Suchen») -> saraksts šim pasūtījumam bez ielīmēšanas.
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  });
  const handledAtRef = useRef(0);
  useEffect(() => {
    if (disabled || !sessionId) return;
    const orderVin = vin.trim().toUpperCase();
    const onList = (ev: Event) => {
      const d = parseKfzAtUserscriptDetail((ev as CustomEvent).detail);
      if (!d || d.sessionId !== sessionId || d.vin !== orderVin) return;
      const rows = parseKfzSearchListText(d.text, orderVin);
      if (handledAtRef.current !== d.at) {
        handledAtRef.current = d.at;
        if (rows.length > 0) applyRef.current({ list: rows });
      }
      document.dispatchEvent(
        new CustomEvent(KFZ_AT_LIST_ACK_EVENT, { detail: { sessionId, vin: orderVin, at: d.at, added: rows.length } }),
      );
    };
    document.addEventListener(KFZ_AT_LIST_EVENT, onList);
    return () => document.removeEventListener(KFZ_AT_LIST_EVENT, onList);
  }, [disabled, sessionId, vin]);

  // 26.11: saraksts ielasās automātiski (releja Chrome, VIN + 1. reģ. datums). Viens pieprasījums uz VIN + datumu;
  // ja relejs ielicis rindā - pajautā vēlreiz pēc ~2,5 min (rezultāts relejā kešā 7 d). Neko nepērk.
  const [auto, setAuto] = useState<{ key: string; status: string; summary: string } | null>(null);
  const autoKeyRef = useRef("");
  const hasList = (store?.list.length ?? 0) > 0;
  const autoKey = !disabled && exact && vin.trim() && !hasList ? `${vin.trim().toUpperCase()}|${exact}` : "";
  useEffect(() => {
    if (!autoKey || autoKeyRef.current === autoKey) return;
    autoKeyRef.current = autoKey;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const [autoVin, autoDate] = autoKey.split("|");
    const ask = async (attempt: number) => {
      setAuto({ key: autoKey, status: "checking", summary: "kfzgutachten.at: pārbauda…" });
      try {
        const res = await fetch("/api/admin/kfzgutachten/list", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ vin: autoVin, date: autoDate }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          status?: string;
          summary?: string;
          queued?: boolean;
          rows?: ReturnType<typeof parseKfzSearchListText>;
        };
        if (stop) return;
        if (!res.ok) {
          setAuto({ key: autoKey, status: "unchecked", summary: `kfzgutachten.at: nav pārbaudīts (HTTP ${res.status})` });
          return;
        }
        if (data.status === "found" && (data.rows ?? []).length > 0) applyRef.current({ list: data.rows });
        setAuto({ key: autoKey, status: data.status ?? "unchecked", summary: data.summary ?? "" });
        if (data.queued && attempt < 4) timer = setTimeout(() => void ask(attempt + 1), 150_000);
      } catch {
        if (!stop) setAuto({ key: autoKey, status: "unchecked", summary: "kfzgutachten.at: nav pārbaudīts (savienojums neizdevās)" });
      }
    };
    void ask(0);
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
      // Cits VIN / datums vai bloks aizvērts - nākamreiz drīkst jautāt vēlreiz.
      autoKeyRef.current = "";
    };
  }, [autoKey]);

  const uploadPdfs = async (files: File[]) => {
    if (disabled || busy || files.length === 0) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      const res = await fetch("/api/admin/kfzgutachten/parse", { method: "POST", body: fd, credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { reports?: KfzGutachtenReport[]; warnings?: string[]; detail?: string };
      if (!res.ok) {
        setError(data.detail || `Kļūda (HTTP ${res.status})`);
        return;
      }
      if ((data.reports ?? []).length > 0) apply({ reports: data.reports });
      if ((data.warnings ?? []).length > 0) setError((data.warnings ?? []).join(" "));
    } catch {
      setError("Neizdevās savienoties ar serveri");
    } finally {
      setBusy(false);
    }
  };

  if (!vin.trim()) return null;

  return (
    <div className="mb-3 rounded-lg border border-slate-300 bg-white/70 p-2 shadow-sm" aria-label={KFZ_AT_SECTION_LABEL}>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-800">{KFZ_AT_SECTION_LABEL}</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[10px] font-medium text-[var(--color-provin-muted)]" htmlFor="kfz-at-first-reg">
          1. reģistrācija
        </label>
        <input
          id="kfz-at-first-reg"
          type="text"
          inputMode="numeric"
          className={`${inp} w-[110px]`}
          placeholder="TT.MM.GGGG"
          value={dateText}
          disabled={disabled}
          onChange={(e) => setManualDate(e.target.value.slice(0, 10))}
        />
        {exact ? (
          <a className={btn} href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3 w-3" aria-hidden />
            Atvērt sarakstu
          </a>
        ) : null}
        <span className="text-[10px] text-[var(--color-provin-muted)]">Atzinums {KFZ_AT_GUTACHTEN_PRICE_EUR} gab.</span>
      </div>
      {!exact ? (
        <p className="mt-1 text-[10px] font-medium text-red-600">
          Vajag precīzu datumu{resolution?.partial ? ` (avotos tikai ${resolution.partial})` : ""}
        </p>
      ) : (
        <p className="mt-1 text-[10px] text-[var(--color-provin-muted)]">
          {chosen ? chosen.source : "Ievadīts ar roku"}
          {chosen?.maybeNational ? <span className="text-amber-700"> - var būt Latvijas datums</span> : null}
        </p>
      )}
      {(resolution?.candidates.length ?? 0) > 1 ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {resolution!.candidates
            .filter((c) => c.date !== exact)
            .map((c) => (
              <button key={c.date} type="button" className={btn} disabled={disabled} onClick={() => setManualDate(c.date)} title={c.source}>
                {c.date}
              </button>
            ))}
        </div>
      ) : null}

      {auto && auto.key === autoKey && auto.summary ? (
        <p
          className={`mt-1 text-[10px] ${auto.status === "unchecked" ? "font-medium text-red-600" : "text-[var(--color-provin-muted)]"}`}
          role="status"
        >
          {auto.summary}
        </p>
      ) : null}
      {store && (store.list.length > 0 || store.reports.length > 0) ? (
        <p className="mt-1.5 text-[10px] font-medium text-slate-700">
          {store.list.length > 0 ? `${store.list.length} apskates sarakstā` : ""}
          {store.list.length > 0 && store.reports.length > 0 ? " · " : ""}
          {store.reports.length > 0 ? `${store.reports.length} atzinumi ielasīti` : ""}
        </p>
      ) : null}

      {!disabled ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <textarea
              className={`${inp} w-full min-h-[48px] resize-y`}
              rows={2}
              placeholder="Ielīmē sarakstu (Suchergebnisse)"
              value={listPaste}
              onChange={(e) => setListPaste(e.target.value.slice(0, 20_000))}
              aria-label="kfzgutachten.at saraksts"
            />
            <button
              type="button"
              className={`${btn} mt-1`}
              disabled={!listPaste.trim()}
              onClick={() => {
                const rows = parseKfzSearchListText(listPaste, vin);
                if (rows.length === 0) {
                  setError("Sarakstā nav atpazīta neviena apskate šim VIN.");
                  return;
                }
                apply({ list: rows });
                setListPaste("");
              }}
            >
              Ielasīt sarakstu
            </button>
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="sr-only"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                void uploadPdfs(files);
              }}
            />
            <button
              type="button"
              className="flex w-full min-h-[48px] items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-slate-300/90 bg-slate-50/80 px-2 text-[11px] font-medium text-[var(--color-apple-text)] hover:border-slate-400 disabled:opacity-50"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void uploadPdfs(Array.from(e.dataTransfer.files ?? []));
              }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileUp className="h-4 w-4" aria-hidden />}
              Atzinumu PDF
            </button>
          </div>
        </div>
      ) : null}
      {notice ? <p className="mt-1 text-[10px] text-emerald-800/90" role="status">{notice}</p> : null}
      {error ? <p className="mt-1 text-[10px] text-red-600" role="alert">{error}</p> : null}
    </div>
  );
}
