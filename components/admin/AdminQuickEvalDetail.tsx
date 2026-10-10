"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buildCheckcarVinReportUrl, CHECKCAR_VIN_HOME_URL, normalizeVinForServiceUrls } from "@/lib/admin-vin-urls";
import { fmtLv, QE_TONE_BAR, QE_TONE_DOT, type CardTone, type SourceCardModel } from "@/lib/quick-eval-cards";
import type { QuickEvalCandidateView } from "@/lib/quick-eval-service";
import type { VinHistoryEntry } from "@/lib/vin-history";
import type { VinScanIndicator } from "@/lib/vin-scan/types";

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
}: {
  dropUp?: boolean;
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
      <button type="button" className={`${btnPri} w-full`} onClick={() => setOpen((v) => !v)}>
        Eksportēt uz pasūtījumu ▾
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
    <div className="mt-2.5 rounded-xl border border-[#bcd7f7] bg-[var(--color-provin-accent-soft)] px-3.5 py-2.5 text-[12.5px] text-[#0b3d80]">
      <p className="font-semibold">Šis VIN jau pārbaudīts ({entries.length}). Klienta dati netiek kopēti.</p>
      <ul className="mt-1 space-y-1.5">
        {entries.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              <b>{e.kind === "order" ? "Pasūtījums" : "Ātrais vērtējums"}</b> {fmtLv(e.createdAt, false)} · {e.who}
              {e.status ? ` · ${e.status}` : ""} —{" "}
              {e.labels.length > 0 ? (
                <>
                  nopirkts <b>{e.labels.join(", ")}</b>, saglabāts {fmtLv(e.savedAt, false)}
                </>
              ) : e.dataKeys.length > 0 ? (
                "tikai bezmaksas avoti"
              ) : (
                "datu nav"
              )}
            </span>
            {e.purchasedKeys.length > 0 ? (
              <button
                type="button"
                className={btnPri}
                disabled={busy !== null}
                onClick={async () => {
                  setBusy(e.id);
                  const r = await postAction(peekId, { action: "reuse", fromId: e.id });
                  setMsg(r.ok ? copiedText(r.j) : `Kļūda: ${String(r.j.error ?? "")}`);
                  setBusy(null);
                  router.refresh();
                }}
              >
                {busy === e.id ? "Pārnes…" : "Izmantot nopirktos datus"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {msg ? <p className="mt-1">{msg}</p> : null}
    </div>
  );
}

// ── Avotu kartītes ───────────────────────────────────────────────────

function CardShell({
  tone,
  title,
  meta,
  link,
  linkLabel,
  wide = false,
  children,
}: {
  tone: CardTone;
  title: string;
  meta: string;
  link: string | null;
  linkLabel: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border border-slate-200 border-t-4 ${QE_TONE_BAR[tone]} ${tone === "none" || tone === "pending" ? "bg-[var(--color-provin-surface)]" : "bg-white"} px-3 py-2.5 text-[12px] ${wide ? "sm:col-span-2" : ""}`}
    >
      <header className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2">
        <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--color-apple-text)]">
          <i className={`inline-block h-2 w-2 rounded-full ${QE_TONE_DOT[tone]}`} />
          {title}
        </h4>
        <span className="text-[10px] text-[var(--color-provin-muted)]">
          {meta}
          {link ? (
            <>
              {" · "}
              <a href={link} target="_blank" rel="noopener noreferrer" className="text-[var(--color-provin-accent)] hover:underline">
                {linkLabel} ↗
              </a>
            </>
          ) : null}
        </span>
      </header>
      {children}
    </section>
  );
}

function SourceCard({ card, peekId }: { card: SourceCardModel; peekId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const isLtab = card.id === "ltab";
  return (
    <CardShell
      tone={card.tone}
      title={card.title}
      meta={card.fetchedAt ? fmtLv(card.fetchedAt) : isLtab ? "manuāli" : "nav ielasīts"}
      link={card.link}
      linkLabel={card.sourceLabel}
    >
      {card.facts.length > 0 ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1">
          {card.facts.map((f) => (
            <div key={f.label} className="contents">
              <dt className="text-[var(--color-provin-muted)]">{f.label}</dt>
              <dd className={`m-0 font-semibold ${f.tone ? FACT_TONE[f.tone] : "text-[var(--color-apple-text)]"}`}>{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {card.message ? (
        <p className={`m-0 ${card.tone === "bad" ? "font-semibold text-rose-700" : "text-[var(--color-provin-muted)]"}`}>{card.message}</p>
      ) : null}
      {isLtab ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(["clean", "claims"] as const).map((mark) => (
            <button
              key={mark}
              type="button"
              disabled={busy}
              className={`${btnSm} ${mark === "clean" ? "bg-emerald-50" : "bg-amber-50"}`}
              onClick={async () => {
                setBusy(true);
                await postAction(peekId, { action: "ltab", mark });
                setBusy(false);
                router.refresh();
              }}
            >
              {mark === "clean" ? "Nav zaudējumu" : "Ir zaudējumi"}
            </button>
          ))}
        </div>
      ) : card.retryPart && (card.tone === "bad" || card.tone === "pending" || card.tone === "none") ? (
        <div className="mt-2">
          <button
            type="button"
            disabled={busy}
            className={btnSm}
            onClick={async () => {
              setBusy(true);
              await postAction(peekId, { action: "refresh", only: card.retryPart });
              setBusy(false);
              router.refresh();
            }}
          >
            {busy ? "Ielasa…" : "Mēģināt vēlreiz"}
          </button>
        </div>
      ) : null}
    </CardShell>
  );
}

const SCAN_TONE: Record<string, CardTone> = { found: "ok", none: "none", unknown: "warn", manual: "none", skipped: "none" };

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
  const [busy, setBusy] = useState(false);
  const scanTone: CardTone = !vinScan
    ? "pending"
    : vinScan.indicators.some((i) => i.status === "found")
      ? "warn"
      : "none";
  return (
    <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <SourceCard key={c.id} card={c} peekId={peekId} />
      ))}
      <CardShell
        tone={scanTone}
        title="Pieejamība maksas avotos · VIN SCAN"
        meta={vinScan ? `${fmtLv(vinScan.at)} · bez pirkuma` : "nav ielasīts"}
        link={null}
        linkLabel=""
        wide
      >
        <div className="flex flex-wrap gap-1.5">
          <CcVinChip peekId={peekId} vin={vin} count={ccVin?.count} at={ccVin?.at} />
          {(vinScan?.indicators ?? []).map((i) => {
            const tone = SCAN_TONE[i.status] ?? "none";
            const inner = (
              <>
                <i className={`inline-block h-2 w-2 rounded-full ${QE_TONE_DOT[tone]}`} />
                <b>{i.label}</b> {i.summary.length > 38 ? `${i.summary.slice(0, 38)}…` : i.summary}
                {i.openUrl ? " ↗" : ""}
              </>
            );
            const cls = `inline-flex items-center gap-1.5 rounded-[9px] border border-slate-200 px-2.5 py-1 text-[12px] text-[var(--color-apple-text)] ${tone === "ok" ? "bg-emerald-50" : tone === "warn" ? "bg-amber-50" : "bg-white"}`;
            return i.openUrl ? (
              <a key={i.id} href={i.openUrl} target="_blank" rel="noopener noreferrer" className={`${cls} hover:bg-slate-50`} title={i.detail || i.summary}>
                {inner}
              </a>
            ) : (
              <span key={i.id} className={cls} title={i.detail || i.summary}>
                {inner}
              </span>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-[11px] text-[var(--color-provin-muted)]">
            Maksas datus ātrajā vērtējumā nepērk. Saite atver avotu jaunā cilnē.
          </p>
          <button
            type="button"
            className={btnSm}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await postAction(peekId, { action: "refresh", only: "vin_scan" });
              setBusy(false);
              router.refresh();
            }}
          >
            {busy ? "Skenē…" : vinScan ? "Skenēt vēlreiz" : "Skenēt"}
          </button>
        </div>
      </CardShell>
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
