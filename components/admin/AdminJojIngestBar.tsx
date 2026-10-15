"use client";

import { useState } from "react";
import { normalizeVin } from "@/lib/order-field-validation";
import { emptyAsvJojIngest, type AsvBlockState, type AsvJojIngest } from "@/lib/asv-report";
import { appendAsvPhotoGroups, formatJojAsvCostUsd } from "@/lib/joj-asv-merge";
import { syncAsvPhotoGroupsAndFlat } from "@/lib/asv-photo-types";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

function jojFetchErrorLv(code: string): string {
  switch (code) {
    case "invalid_vin":
      return "Nederīgs VIN.";
    case "missing_joj_credentials":
      return "Serverī nav JOJ_API_KEY.";
    case "unauthorized":
      return "Admin sesija beigusies. Ielādē lapu no jauna.";
    default:
      return "JoJ API neatbildēja. Mēģini vēlreiz.";
  }
}

type JojTone = "ok" | "neutral" | "problem";

function jojIngestTone(ingest: AsvJojIngest | undefined): JojTone | null {
  if (!ingest?.lastFetchedVin) return null;
  if (ingest.status === "found") return "ok";
  if (ingest.status === "none") return "neutral";
  if (ingest.status === "skipped") return "problem";
  return "problem";
}

const STATUS_TEXT: Record<JojTone, string> = {
  ok: "text-emerald-700",
  neutral: "text-slate-600",
  problem: "text-rose-700",
};

const STATUS_DOT: Record<JojTone, string> = {
  ok: "bg-emerald-600",
  neutral: "bg-slate-400",
  problem: "bg-rose-600",
};

function jojStatusLabel(ingest: AsvJojIngest): string {
  if (ingest.status === "found") return ingest.summary || "Ir izsoles dati";
  if (ingest.status === "none") return ingest.summary || "Nav ierakstu";
  if (ingest.status === "skipped") return ingest.summary || "Nav konfigurēts";
  return ingest.summary || "Kļūda vai nezināms statuss";
}

type Props = {
  orderVin: string;
  listingUrl?: string;
  sessionId?: string;
  editable: boolean;
  value: AsvBlockState;
  onChange: (next: AsvBlockState) => void;
};

export function AdminJojIngestBar({
  orderVin,
  listingUrl = "",
  sessionId = "",
  editable,
  value,
  onChange,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vinOverride, setVinOverride] = useState("");
  const effectiveVin = normalizeVin(vinOverride || orderVin);
  const ingest = value.jojIngest;
  const estimatedCost = formatJojAsvCostUsd();
  const cachedForVin =
    Boolean(ingest?.lastFetchedVin) && normalizeVin(ingest?.lastFetchedVin ?? "") === effectiveVin;
  const tone = jojIngestTone(ingest);
  const failedCount = (ingest?.failedPhotoGroups ?? []).reduce((n, g) => n + (g.urls?.length ?? 0), 0);

  const applyJojBody = (
    body: {
      block?: AsvBlockState;
      jojIngest?: AsvJojIngest;
      storedPhotoGroups?: AsvBlockState["photoGroups"];
      failedPhotoGroups?: AsvJojIngest["failedPhotoGroups"];
    },
    prev: AsvBlockState,
  ) => {
    if (!body.block) return;
    const photoGroups = appendAsvPhotoGroups(prev.photoGroups, body.storedPhotoGroups);
    const synced = syncAsvPhotoGroupsAndFlat(
      photoGroups.length > 0 ? photoGroups : body.block.photoGroups,
    );
    const nextIngest = { ...(body.jojIngest ?? body.block.jojIngest ?? emptyAsvJojIngest()) };
    if (body.failedPhotoGroups?.length) nextIngest.failedPhotoGroups = body.failedPhotoGroups;
    else delete nextIngest.failedPhotoGroups;
    onChange({
      ...body.block,
      photoGroups: synced.photoGroups,
      photos: synced.photos,
      comments: prev.comments,
      jojIngest: nextIngest,
    });
  };

  const retryFailedPhotos = async () => {
    if (!editable || busy || failedCount === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sources/joj", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vin: effectiveVin,
          sessionId: sessionId || undefined,
          listingUrl: listingUrl || undefined,
          block: value,
          retryPhotoGroups: ingest?.failedPhotoGroups ?? [],
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        block?: AsvBlockState;
        jojIngest?: AsvJojIngest;
        storedPhotoGroups?: AsvBlockState["photoGroups"];
        failedPhotoGroups?: AsvJojIngest["failedPhotoGroups"];
        summary?: string;
      };
      if (!res.ok && !body.block) {
        setError(jojFetchErrorLv(body.error ?? "upstream_error"));
        return;
      }
      applyJojBody(body, value);
    } catch {
      setError(jojFetchErrorLv("upstream_error"));
    } finally {
      setBusy(false);
    }
  };

  const fetchData = async () => {
    if (!editable || busy) return;
    if (cachedForVin && ingest?.status === "found") {
      const ok = window.confirm(
        `Šim VIN jau ir ielādēti JoJ dati. Ielādēt no jauna? Tas atkārtoti iekasēs ${estimatedCost}.`,
      );
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sources/joj", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vin: effectiveVin,
          sessionId: sessionId || undefined,
          listingUrl: listingUrl || undefined,
          block: value,
          skipCache: cachedForVin,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        block?: AsvBlockState;
        jojIngest?: AsvJojIngest;
        storedPhotoGroups?: AsvBlockState["photoGroups"];
        failedPhotoGroups?: AsvJojIngest["failedPhotoGroups"];
        failedPhotoCount?: number;
        costUsd?: string;
        summary?: string;
      };
      if (body.error === "missing_joj_credentials") {
        setError(jojFetchErrorLv("missing_joj_credentials"));
        if (body.jojIngest) onChange({ ...value, jojIngest: body.jojIngest });
        return;
      }
      if (!res.ok && !body.block) {
        setError(jojFetchErrorLv(body.error ?? "upstream_error"));
        if (body.jojIngest) onChange({ ...value, jojIngest: body.jojIngest });
        return;
      }
      if (body.block) applyJojBody(body, value);
      if (body.error && res.status === 502) {
        setError(body.summary ? body.summary : jojFetchErrorLv("upstream_error"));
      }
    } catch {
      setError(jojFetchErrorLv("upstream_error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-3 rounded-lg border border-slate-200/90 bg-slate-50/70 px-2 py-2">
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        JoJ API (Copart / IAAI)
      </p>
      <p className="mb-2 text-[10px] leading-snug text-slate-500">
        Izsoļu lots, bojājumi, odometrs, cenas un foto. Apvienojas ar OneAuto VIN Audit tabulās zemāk.
        Cena par VIN meklēšanu: {estimatedCost} (ar kešu līdz 30 dienām).
      </p>
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
            data-provin-handoff-vin={effectiveVin || undefined}
            spellCheck={false}
            autoCapitalize="characters"
          />
        </label>
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--color-apple-text)] disabled:opacity-50"
          disabled={!editable || busy || !effectiveVin}
          onClick={() => void fetchData()}
        >
          {busy ? "Ielādē…" : `Ielādēt ${estimatedCost}`}
        </button>
      </div>
      {ingest && tone ? (
        <p className={`mt-2 flex items-center gap-1.5 text-[11px] ${STATUS_TEXT[tone]}`}>
          <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[tone]}`} aria-hidden />
          <span>
            {jojStatusLabel(ingest)}
            {cachedForVin && ingest.fetchedAt
              ? ` · ${ingest.fetchedAt.slice(0, 16).replace("T", " ")}`
              : ""}
            {ingest.lastCostUsd ? ` · ${ingest.lastCostUsd}` : ""}
          </span>
        </p>
      ) : null}
      {error ? <p className="mt-1.5 text-[10px] text-red-700">{error}</p> : null}
      {failedCount > 0 ? (
        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-red-700">
          <span>
            {failedCount} foto neizdevās ielādēt.
          </span>
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-[var(--color-apple-text)] disabled:opacity-50"
            disabled={!editable || busy}
            onClick={() => void retryFailedPhotos()}
          >
            {busy ? "Atkārto…" : "Atkārtot"}
          </button>
        </p>
      ) : null}
    </div>
  );
}
