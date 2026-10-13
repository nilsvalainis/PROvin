"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buildCheckcarVinReportUrl, CHECKCAR_VIN_HOME_URL, normalizeVinForServiceUrls } from "@/lib/admin-vin-urls";
import { fmtLv, QE_TONE_DOT, type CardTone, type SourceCardModel } from "@/lib/quick-eval-cards";
import type { QuickEvalCandidateView } from "@/lib/quick-eval-service";
import type { VinHistoryEntry } from "@/lib/vin-history";
import { AdminVinHistoryList } from "@/components/admin/AdminVinHistoryList";
import { quickEvalNordicSearchLinks } from "@/lib/quick-eval-vin-scan";
import type { VinScanIndicator } from "@/lib/vin-scan/types";
import { decodeVinLocal } from "@/lib/vin-scan/vin-decode";

const FACT_TONE = { ok: "text-emerald-700", warn: "text-amber-700", bad: "text-rose-700" } as const;

const btn =
  "inline-flex items-center justify-center rounded-[9px] border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--color-apple-text)] hover:bg-slate-50 disabled:opacity-50";
const btnSm =
  "inline-flex items-center rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-[var(--color-apple-text)] hover:bg-slate-50 disabled:opacity-50";
const btnPri =
  "inline-flex items-center justify-center rounded-[9px] border border-[var(--color-provin-accent)] bg-[var(--color-provin-accent)] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[var(--color-provin-accent-hover)] disabled:opacity-50";

async function postAction(peekId: string, body: Record<string, unknown>) {
  const res = await fetch("/api/admin/quick-evals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ peekId, ...body }),
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, j };
}

function copiedText(j: Record<string, unknown>): string {
  const copied = Array.isArray(j.copied) ? j.copied.length : 0;
  const conflicts = Array.isArray(j.conflicts) ? (j.conflicts as string[]) : [];
  return `Pārnesti bloki: ${copied}.${conflicts.length ? ` Atšķiras (paliek esošais): ${conflicts.join(", ")}.` : ""}`;
}

// ── Eksports ─────────────────────────────────────────────────────────

export function AdminQuickEvalExportMenu({
  peekId,
  candidates,
  exports,
  className = "",
  dropUp = false,
  triggerClassName,
  triggerLabel = "Eksportēt uz pasūtījumu ▾",
}: {
  dropUp?: boolean;
  /** Labās malas joslai: kompakta poga. */
  triggerClassName?: string;
  triggerLabel?: string;
  peekId: string;
  candidates: QuickEvalCandidateView[];
  exports: Array<{ sessionId: string; at: string; mode: string }>;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const done = new Map(exports.map((e) => [e.sessionId, e]));
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" className={triggerClassName ?? `${btnPri} w-full`} onClick={() => setOpen((v) => !v)}>
        {triggerLabel}
      </button>
      {open ? (
        <div className={`absolute right-0 z-30 ${dropUp ? "bottom-full mb-1" : "mt-1"} w-[22rem] max-w-[90vw] rounded-xl border border-slate-200 bg-white p-2 text-[12px] shadow-lg`}>
          {candidates.length === 0 ? (
            <p className="px-1 py-1 text-[var(--color-provin-muted)]">Nav atbilstoša apmaksāta pasūtījuma (VIN / e-pasts / tālrunis).</p>
          ) : (
            <ul className="space-y-1">
              {candidates.map((c) => {
                const prev = done.get(c.id);
                return (
                  <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg px-1 py-1 hover:bg-slate-50">
                    <span className="min-w-0">
                      <a href={`/admin/orders/${c.id}`} className="font-semibold text-[var(--color-provin-accent)] hover:underline">
                        {fmtLv(new Date(c.createdMs).toISOString(), false)}
                      </a>{" "}
                      <span className="text-[var(--color-apple-text)]">{c.name || c.email || "—"}</span>
                      <span className="block text-[10.5px] text-[var(--color-provin-muted)]">
                        {c.vin ? `${c.vin} · ` : ""}sakrīt: {c.matchedBy.join(", ")}
                        {prev ? ` · jau eksportēts ${fmtLv(prev.at)}` : ""}
                      </span>
                    </span>
                    <button
                      type="button"
                      className={btnSm}
                      disabled={busy !== null}
                      onClick={async () => {
                        setBusy(c.id);
                        const r = await postAction(peekId, { action: "export", sessionId: c.id });
                        setMsg(r.ok ? copiedText(r.j) : `Kļūda: ${String(r.j.error ?? "")}`);
                        setBusy(null);
                        router.refresh();
                      }}
                    >
                      {busy === c.id ? "…" : prev ? "Vēlreiz" : "Eksportēt"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {msg ? <p className="mt-1 border-t border-slate-100 px-1 pt-1">{msg}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

// ── VIN jau pārbaudīts ───────────────────────────────────────────────

export function AdminQuickEvalVinBar({ peekId, entries }: { peekId: string; entries: VinHistoryEntry[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (entries.length === 0) return null;
  return (
    <div className="mt-2.5 space-y-1">
      <AdminVinHistoryList
        entries={entries}
        busyId={busy}
        onReuse={async (fromId) => {
          setBusy(fromId);
          const r = await postAction(peekId, { action: "reuse", fromId });
          setMsg(r.ok ? copiedText(r.j) : `Kļūda: ${String(r.j.error ?? "")}`);
          setBusy(null);
          router.refresh();
        }}
      />
      {msg ? <p className="px-1 text-[11px] text-[#3a3a3c]">{msg}</p> : null}
    </div>
  );
}

// ── Avotu kartītes ───────────────────────────────────────────────────

const SCAN_TONE: Record<string, CardTone> = { found: "ok", none: "none", unknown: "warn", manual: "none", skipped: "none", needs_input: "none" };

/** CC-VIN foto skaits: PROVIN skripts pārlūkā atver checkcar.vin fonā un atgriež skaitu. */
function CcVinChip({ peekId, vin, count, at }: { peekId: string; vin: string; count: number | null | undefined; at?: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "checking" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const effective = normalizeVinForServiceUrls(vin);
  const href = buildCheckcarVinReportUrl(effective) ?? CHECKCAR_VIN_HOME_URL;
  useEffect(() => {
    const onResult = (event: Event) => {
      const d = (event as CustomEvent<{ vin?: string; count?: number; error?: string }>).detail;
      if (!d || normalizeVinForServiceUrls(d.vin ?? "") !== effective) return;
      if (d.error) {
        setState("error");
        setErr(d.error);
        void postAction(peekId, { action: "ccvin", count: null, error: d.error });
        return;
      }
      const n = typeof d.count === "number" ? d.count : 0;
      setState("idle");
      void postAction(peekId, { action: "ccvin", count: n }).then(() => router.refresh());
      if (n > 0) window.setTimeout(() => popupRef.current?.focus(), 900);
    };
    document.addEventListener("provin-cc-photo", onResult);
    return () => document.removeEventListener("provin-cc-photo", onResult);
  }, [effective, peekId, router]);
  const tone: CardTone = typeof count === "number" ? (count > 0 ? "ok" : "none") : state === "error" ? "warn" : "pending";
  const label =
    state === "checking"
      ? "pārbauda…"
      : typeof count === "number"
        ? `${count} foto`
        : state === "error"
          ? err || "nav atbildes"
          : "pārbaudīt foto";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-provin-cc-photo-probe="1"
      data-provin-handoff-vin={effective || undefined}
      title={at ? `Pārbaudīts ${fmtLv(at)}. Klikšķis atver checkcar.vin jaunā cilnē.` : "Atver checkcar.vin jaunā cilnē un nolasa foto skaitu"}
      className="inline-flex items-center gap-1.5 rounded-[9px] border border-slate-200 bg-white px-2.5 py-1 text-[12px] text-[var(--color-apple-text)] hover:bg-slate-50"
      onClick={(e) => {
        if (!effective || effective.length < 11) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        const popup = window.open(href, "_blank");
        popupRef.current = popup;
        if (!popup) {
          setState("error");
          setErr("pārlūks bloķēja cilni");
          return;
        }
        if (!document.documentElement.getAttribute("data-provin-userscript")) {
          setState("error");
          setErr("PROVIN skripts nav ieslēgts");
          return;
        }
        setState("checking");
        window.setTimeout(() => setState((s) => (s === "checking" ? "error" : s)), 65000);
      }}
    >
      <i className={`inline-block h-2 w-2 rounded-full ${QE_TONE_DOT[tone]}`} />
      <b>CC-VIN</b> {label} ↗
    </a>
  );
}

/** VIN SCAN indikatori, kuriem jau ir sava kartīte (nedublē). */
const SCAN_HAS_OWN_CARD = new Set(["tjekbil", "mnt_ee", "lkf_ee", "carinfo", "csdd", "listing_history"]);

type GridCard = {
  key: string;
  title: string;
  tone: CardTone;
  meta: string;
  link: string | null;
  facts: { label: string; value: string; tone?: "ok" | "warn" | "bad" }[];
  more: string | null;
  extra?: React.ReactNode;
};

type EmptyRow = {
  key: string;
  title: string;
  message: string;
  retry: string | null;
  link: string | null;
  ltab?: boolean;
};

const QE_DOT_HEX: Record<CardTone, string> = { ok: "#34c759", warn: "#ff9f0a", bad: "#ff3b30", none: "#c7c7cc", pending: "#c7c7cc" };

/** Variants A: vienāda kartīte — galvene (punkts + avots + laiks), līdz 6 rindām, „Detaļas” sakļauts. */
function QeCard({ c }: { c: GridCard }) {
  const shown = c.facts.slice(0, 6);
  const rest = c.facts.slice(6);
  return (
    <section className="flex h-full min-h-[214px] flex-col rounded-xl bg-white text-[12px] shadow-[0_0_0_0.5px_rgba(0,0,0,0.1)]">
      <header className="flex items-center gap-1.5 border-b border-[#f0f0f2] px-3 py-2">
        <i className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: QE_DOT_HEX[c.tone] }} aria-hidden />
        <h4 className="min-w-0 truncate text-[12.5px] font-semibold text-[#1d1d1f]">{c.title}</h4>
        <span className="ml-auto shrink-0 text-[11px] text-[#aeaeb2]">{c.meta}</span>
        {c.link ? (
          <a href={c.link} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[11px] text-[#8e8e93] hover:text-[#1d1d1f]" title="Atvērt avotu jaunā cilnē">
            ↗
          </a>
        ) : null}
      </header>
      <dl className="m-0 flex-1 px-3 py-1.5">
        {shown.map((f) => (
          <div key={f.label} className="flex h-[22px] items-center justify-between gap-3">
            <dt className="shrink-0 text-[#8e8e93]">{f.label}</dt>
            <dd className={`m-0 min-w-0 truncate text-right font-medium ${f.tone ? FACT_TONE[f.tone] : "text-[#1d1d1f]"}`} title={f.value}>
              {f.value}
            </dd>
          </div>
        ))}
        {c.extra ? <div className="mt-1.5">{c.extra}</div> : null}
      </dl>
      <details className="border-t border-[#f0f0f2] px-3 py-1.5 text-[11.5px] text-[#8e8e93]">
        <summary className="cursor-pointer select-none">Detaļas</summary>
        <div className="mt-1 space-y-0.5 text-[#3a3a3c]">
          {rest.map((f) => (
            <p key={f.label} className="m-0">
              <span className="text-[#8e8e93]">{f.label}:</span> {f.value}
            </p>
          ))}
          {c.more ? <p className="m-0 whitespace-pre-line">{c.more}</p> : null}
          {rest.length === 0 && !c.more ? <p className="m-0 text-[#aeaeb2]">Vairāk datu nav.</p> : null}
        </div>
      </details>
    </section>
  );
}

function EmptyRowItem({ r, peekId }: { r: EmptyRow; peekId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async (body: Record<string, unknown>) => {
    setBusy(true);
    await postAction(peekId, body);
    setBusy(false);
    router.refresh();
  };
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5">
      <i className="inline-block h-1.5 w-1.5 rounded-full bg-[#c7c7cc]" aria-hidden />
      <span className="font-medium text-[#1d1d1f]">{r.title}</span>
      <span className="min-w-0 flex-1 truncate text-[#8e8e93]" title={r.message}>
        {r.message}
      </span>
      {r.link ? (
        <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#8e8e93] hover:text-[#1d1d1f]">
          Atvērt ↗
        </a>
      ) : null}
      {r.ltab ? (
        <>
          <button type="button" disabled={busy} className={btnSm} onClick={() => void run({ action: "ltab", mark: "clean" })}>
            Nav zaudējumu
          </button>
          <button type="button" disabled={busy} className={btnSm} onClick={() => void run({ action: "ltab", mark: "claims" })}>
            Ir zaudējumi
          </button>
        </>
      ) : r.retry ? (
        <button type="button" disabled={busy} className={btnSm} onClick={() => void run({ action: "refresh", only: r.retry })}>
          {busy ? "Ielasa…" : "Mēģināt vēlreiz"}
        </button>
      ) : null}
    </li>
  );
}

/**
 * Avotu režģis (variants A): kartītes TIKAI avotiem ar datiem; tukšie / kļūdainie / „nav atrasts” —
 * vienā sakļautā rindā „Bez datiem (N)” ar atkārtošanu katram. VIN SCAN avoti (pilnais katalogs:
 * WMI dekodēšana, tjekbil.dk, esyn.dk, nummerplade.net u.c.) rādās kā parastas kartītes, ja atrada datus.
 * CC-VIN — sava kartīte (ir/nav dati, foto skaits, saite). Pēc atkārtotas ielādes jaunie dati parādās
 * automātiski (router.refresh, kamēr kāds avots vēl ielādējas — periodiski).
 */
export function AdminQuickEvalSourceGrid({
  peekId,
  vin,
  cards,
  vinScan,
  ccVin,
}: {
  peekId: string;
  vin: string;
  cards: SourceCardModel[];
  vinScan: { at: string; indicators: VinScanIndicator[] } | null;
  ccVin: { at: string; count: number | null } | null;
}) {
  const router = useRouter();
  const data: GridCard[] = [];
  const empty: EmptyRow[] = [];
  for (const c of cards) {
    const meta = c.fetchedAt ? fmtLv(c.fetchedAt) : c.id === "ltab" ? "manuāli" : "nav ielasīts";
    if (c.facts.length > 0) {
      data.push({ key: c.id, title: c.title, tone: c.tone, meta, link: c.link, facts: c.facts, more: c.message });
    } else {
      empty.push({
        key: c.id,
        title: c.title,
        message: c.message || (c.tone === "pending" ? "Ielādējas…" : "Nav datu"),
        retry: c.retryPart,
        link: c.link,
        ltab: c.id === "ltab",
      });
    }
  }
  const ccHas = typeof ccVin?.count === "number" && ccVin.count > 0;
  const ccHref = buildCheckcarVinReportUrl(normalizeVinForServiceUrls(vin)) ?? CHECKCAR_VIN_HOME_URL;
  data.push({
    key: "cc_vin",
    title: "CC-VIN",
    tone: ccHas ? "ok" : typeof ccVin?.count === "number" ? "none" : "pending",
    meta: ccVin?.at ? fmtLv(ccVin.at) : "nav pārbaudīts",
    link: ccHref,
    facts: [
      { label: "Dati", value: typeof ccVin?.count === "number" ? (ccHas ? "Ir" : "Nav") : "—", ...(ccHas ? { tone: "ok" as const } : {}) },
      { label: "Foto", value: typeof ccVin?.count === "number" ? String(ccVin.count) : "—" },
    ],
    more: "checkcar.vin — atveras jaunā cilnē; foto skaitu nolasa PROVIN skripts.",
    extra: <CcVinChip peekId={peekId} vin={vin} count={ccVin?.count} at={ccVin?.at} />,
  });
  const nordic = quickEvalNordicSearchLinks(vin);
  const nordicOnDecodeCard = Boolean(vinScan?.indicators.some((i) => i.id === "vin_decode" && i.status === "found"));
  const scanMeta = vinScan ? fmtLv(vinScan.at) : "nav ielasīts";
  for (const i of vinScan?.indicators ?? []) {
    if (SCAN_HAS_OWN_CARD.has(i.id)) continue;
    const title = i.country && i.country !== "EU" ? `${i.label} · ${i.country}` : i.label;
    if (i.status === "found") {
      const facts: GridCard["facts"] = [];
      if (i.id === "vin_decode") {
        const decoded = decodeVinLocal(vin);
        if (decoded.wmi) facts.push({ label: "WMI", value: decoded.wmi });
        if (decoded.countryName) facts.push({ label: "Valsts", value: decoded.countryName });
      }
      if (i.vehicle && (i.vehicle.make || i.vehicle.model)) facts.push({ label: "Auto", value: [i.vehicle.make, i.vehicle.model].filter(Boolean).join(" ") });
      if (i.vehicle?.year) facts.push({ label: "Gads", value: i.vehicle.year });
      const lastMileage = i.mileage?.[i.mileage.length - 1];
      if (lastMileage) facts.push({ label: "Nobraukums", value: `${lastMileage.odometer}${lastMileage.date ? ` (${lastMileage.date})` : ""}` });
      if (i.mileage && i.mileage.length > 1) facts.push({ label: "Ieraksti", value: String(i.mileage.length) });
      if (typeof i.media?.photoCount === "number") facts.push({ label: "Foto", value: String(i.media.photoCount) });
      facts.push({ label: "Rezultāts", value: i.summary });
      data.push({
        key: `scan:${i.id}`,
        title,
        tone: SCAN_TONE[i.status] ?? "ok",
        meta: scanMeta,
        link: i.openUrl,
        facts,
        more: i.detail || null,
        extra:
          i.id === "vin_decode" && nordic.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {nordic.map((link) => (
                <a
                  key={link.id}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-provin-handoff-vin={vin || undefined}
                  className={btnSm}
                >
                  {link.label}
                </a>
              ))}
            </div>
          ) : undefined,
      });
    } else {
      empty.push({ key: `scan:${i.id}`, title, message: i.summary || "Nav atrasts", retry: "vin_scan", link: i.openUrl });
    }
  }
  if (!vinScan) empty.push({ key: "scan", title: "Publiskie reģistri (VIN SCAN)", message: "Vēl nav skenēts", retry: "vin_scan", link: null });

  const pending = cards.some((c) => c.tone === "pending");
  useEffect(() => {
    if (!pending) return;
    let n = 0;
    const t = window.setInterval(() => {
      n += 1;
      router.refresh();
      if (n >= 20) window.clearInterval(t);
    }, 4000);
    return () => window.clearInterval(t);
  }, [pending, router]);

  return (
    <div className="mt-3 space-y-3">
      {!nordicOnDecodeCard && nordic.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {nordic.map((link) => (
            <a
              key={link.id}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              data-provin-handoff-vin={vin || undefined}
              className={btnSm}
            >
              {link.label}
            </a>
          ))}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.map((c) => (
          <QeCard key={c.key} c={c} />
        ))}
      </div>
      {empty.length > 0 ? (
        <details className="rounded-xl bg-white px-3 py-2 text-[12px] shadow-[0_0_0_0.5px_rgba(0,0,0,0.1)]">
          <summary className="cursor-pointer select-none font-semibold text-[#3a3a3c]">
            Bez datiem ({empty.length}) <span className="font-normal text-[#aeaeb2]">· nav atrasts, kļūda vai jāpārbauda pašam</span>
          </summary>
          <ul className="mt-1 divide-y divide-[#f0f0f2]">
            {empty.map((r) => (
              <EmptyRowItem key={r.key} r={r} peekId={peekId} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

export function AdminQuickEvalRefreshAll({ peekId }: { peekId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={btn}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await postAction(peekId, { action: "refresh" });
        setBusy(false);
        router.refresh();
      }}
    >
      {busy ? "Ielasa visus avotus…" : "Atjaunot visus avotus"}
    </button>
  );
}

export function AdminCopyVinButton({ vin }: { vin: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={btn}
      disabled={!vin}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(vin);
          setDone(true);
          window.setTimeout(() => setDone(false), 1200);
        } catch {
          /* ignore */
        }
      }}
    >
      {done ? "Nokopēts ✓" : "Kopēt VIN"}
    </button>
  );
}
