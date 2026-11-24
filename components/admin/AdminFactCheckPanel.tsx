"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { AdminFlashMaxReviewPanel } from "@/components/admin/AdminFlashMaxReviewPanel";
import { AdminResponsiveModal } from "@/components/admin/AdminResponsiveModal";
import { useModalBackdropClose } from "@/hooks/useModalBackdropClose";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { FACT_CHECK_AI_FIX_MAX_FLAGS } from "@/lib/fact-check-ai-fix";
import { postFactCheckAiFix } from "@/lib/fact-check-ai-fix-client";
import {
  applyFlashMaxReviewFinding,
  type FlashMaxReviewFinding,
  type FlashMaxReviewState,
} from "@/lib/flash-max-final-review";
import { adminProBtn } from "@/lib/admin-pro-tones";
import {
  factCheckDismissKey,
  isIntervalWarningFlag,
  visibleFactCheckFlags,
} from "@/lib/admin-fact-check-client";
import {
  FACT_CHECK_HELP_LV,
  factCheckActionLine,
  factCheckLevelLabel,
  suggestFactCheckFix,
} from "@/lib/fact-check-suggested-fix";
import type { FactCheckFlag } from "@/lib/unit-facts/types";

export function AdminFactCheckButton({
  busy,
  disabled,
  onClick,
}: {
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={adminProBtn("neutral")}
      disabled={disabled || busy}
      onClick={onClick}
      title="Pārbaudīt komentāra faktus pret pasūtījuma datiem (tekstu nemaina)"
      aria-busy={busy}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden /> : null}
      Pārbaudīt faktus
    </button>
  );
}

function FlagCard({
  flag,
  onDismiss,
  onApplyFix,
  onAiFix,
  aiBusy,
}: {
  flag: FactCheckFlag;
  onDismiss: (flag: FactCheckFlag) => void;
  onApplyFix?: (flag: FactCheckFlag) => void;
  /** AI labojums (diff skatā), ja nav deterministiskā šablona. */
  onAiFix?: (flag: FactCheckFlag) => void;
  aiBusy?: boolean;
}) {
  const [showFix, setShowFix] = useState(false);
  const isError = flag.level === "E";
  const isInfo = flag.level === "I";
  const suggestion = suggestFactCheckFix(flag);
  return (
    <div
      className={`rounded-lg border px-2.5 py-2 ${
        isError
          ? "border-red-200/90 bg-red-50 text-red-950"
          : isInfo
            ? "border-slate-200 bg-white/70 text-slate-600"
            : "border-amber-200/80 bg-amber-50/80 text-amber-950"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-[10px] font-bold tracking-wide ${isError ? "text-red-800" : isInfo ? "text-slate-500" : "text-amber-800"}`}>
          {factCheckLevelLabel(flag.level)}
        </p>
        <span className="inline-flex shrink-0 flex-wrap items-center justify-end gap-1">
          {suggestion && onApplyFix ? (
            <button
              type="button"
              className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:bg-white/70"
              onClick={() => setShowFix(true)}
            >
              Labot
            </button>
          ) : onAiFix ? (
            <button
              type="button"
              data-fact-fix-ai=""
              className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:bg-white/70 disabled:opacity-40"
              disabled={aiBusy}
              onClick={() => onAiFix(flag)}
            >
              Labot
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:bg-white/70"
            onClick={() => onDismiss(flag)}
          >
            Ignorēt
          </button>
        </span>
      </div>
      <p className="mt-0.5 text-[11px] leading-snug">{flag.sentence}</p>
      <p className="mt-1 text-[11px] leading-snug opacity-90">{flag.message}</p>
      <p className="mt-1 text-[10px] leading-snug font-medium opacity-80">{factCheckActionLine(flag)}</p>
      {showFix && suggestion && onApplyFix ? (
        <div className="mt-1.5 rounded-md border border-black/10 bg-white/80 px-2 py-1.5">
          <p className="text-[10px] font-semibold text-[var(--color-apple-text)]">Ieteiktais labojums</p>
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-apple-text)]">{suggestion.preview}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <button
              type="button"
              className={adminProBtn("primary")}
              onClick={() => {
                onApplyFix(flag);
                setShowFix(false);
              }}
            >
              Apstiprināt
            </button>
            <button type="button" className={adminProBtn("neutral")} onClick={() => setShowFix(false)}>
              Atcelt
            </button>
          </div>
        </div>
      ) : null}
      {flag.sources?.some((s) => s.url || s.title) ? (
        <ul className="mt-1 space-y-0.5">
          {flag.sources.map((s, i) => (
            <li key={`${s.title}-${i}`} className="text-[10px] leading-snug">
              {s.url ? (
                <a href={s.url} target="_blank" rel="noreferrer" className="underline decoration-dotted">
                  {s.title}
                </a>
              ) : (
                s.title
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** «Labot» ar AI: lauka teksts, kur piemērot pieņemtos labojumus, un pasūtījuma dati faktu lapai. */
export type FactCheckAiFixConfig = {
  allowed: boolean;
  fieldLabel?: string;
  /** Pašreizējais lauka teksts (HTML vai vienkāršs). */
  text: string;
  buildPayload: () => Record<string, unknown>;
  /** Pieņemtā labojuma rezultāts (vienkāršs teksts). */
  onApplyText: (plain: string) => void;
};

function normSentence(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Karodziņi, kuru teikums pēc labojuma vairs nav tekstā - tos var paslēpt. */
export function factCheckFlagsResolvedByText(flags: readonly FactCheckFlag[], nextPlain: string): FactCheckFlag[] {
  const hay = normSentence(nextPlain);
  return flags.filter((f) => {
    const s = normSentence(f.sentence ?? "");
    return s.length > 0 && !hay.includes(s);
  });
}

export function AdminFactCheckPanel({
  flags,
  dismissed,
  onDismiss,
  onApplyFix,
  aiFix,
}: {
  flags: readonly FactCheckFlag[] | undefined;
  dismissed: ReadonlySet<string> | readonly string[];
  onDismiss: (flag: FactCheckFlag) => void;
  onApplyFix?: (flag: FactCheckFlag) => void;
  aiFix?: FactCheckAiFixConfig | null;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [review, setReview] = useState<FlashMaxReviewState>({ status: "idle" });
  const [reviewOpen, setReviewOpen] = useState(false);
  const [handled, setHandled] = useState<Record<string, "accepted" | "rejected">>({});
  const [stale, setStale] = useState<Set<string>>(() => new Set());
  const aiFixRef = useRef(aiFix);
  aiFixRef.current = aiFix;
  const runFlagsRef = useRef<FactCheckFlag[]>([]);

  const runAiFix = useCallback(async (picked: FactCheckFlag[]) => {
    const cfg = aiFixRef.current;
    if (!cfg?.allowed || picked.length === 0) return;
    const plain = adminRichHtmlToPlainText(cfg.text).trim();
    if (!plain) return;
    const ordered = [...picked.filter((f) => f.level === "E"), ...picked.filter((f) => f.level !== "E")].slice(
      0,
      FACT_CHECK_AI_FIX_MAX_FLAGS,
    );
    runFlagsRef.current = ordered;
    setHandled({});
    setStale(new Set());
    setReview({ status: "running" });
    setReviewOpen(true);
    const res = await postFactCheckAiFix({
      ...cfg.buildPayload(),
      text: plain,
      fieldLabel: cfg.fieldLabel,
      flags: ordered.map((f) => ({ id: f.id, level: f.level, message: f.message, sentence: f.sentence })),
    });
    setReview(
      res.ok
        ? { status: "done", findings: res.findings, fieldLabels: { field: cfg.fieldLabel || "Komentārs" } }
        : { status: "error", error: res.error },
    );
  }, []);

  const acceptFinding = useCallback(
    (finding: FlashMaxReviewFinding) => {
      const cfg = aiFixRef.current;
      const current = cfg ? adminRichHtmlToPlainText(cfg.text).trim() : "";
      const next = cfg ? applyFlashMaxReviewFinding(current, finding) : null;
      if (!cfg || next == null) {
        setStale((prev) => new Set(prev).add(finding.id));
        return;
      }
      cfg.onApplyText(next);
      setHandled((prev) => ({ ...prev, [finding.id]: "accepted" }));
      for (const f of factCheckFlagsResolvedByText(runFlagsRef.current, next)) onDismiss(f);
    },
    [onDismiss],
  );

  const rejectFinding = useCallback((finding: FlashMaxReviewFinding) => {
    setHandled((prev) => ({ ...prev, [finding.id]: "rejected" }));
  }, []);

  const visible = visibleFactCheckFlags(flags, dismissed);
  const aiOn = Boolean(aiFix?.allowed && adminRichHtmlToPlainText(aiFix.text).trim());
  const aiBusy = review.status === "running";
  const modal = (
    <AdminResponsiveModal
      open={reviewOpen && review.status !== "idle"}
      title="Faktu pārbaude - labojumi"
      onClose={() => setReviewOpen(false)}
      maxWidthClass="sm:max-w-2xl"
      zClass="z-[75]"
      footer={
        <button
          type="button"
          className="min-h-11 flex-1 rounded-full bg-slate-100 px-4 text-[15px] font-semibold text-slate-700 md:min-h-0 md:flex-none md:rounded-lg md:py-1.5 md:text-[12px]"
          onClick={() => setReviewOpen(false)}
        >
          Aizvērt
        </button>
      }
    >
      {review.status === "running" ? (
        <p className="text-[14px] text-slate-600 md:text-[12px]">Labojumi tiek sagatavoti…</p>
      ) : review.status === "error" ? (
        <p className="text-[14px] text-[#b42318] md:text-[12px]" role="alert">
          Labojumus sagatavot neizdevās. Teksts nav mainīts.
        </p>
      ) : review.status === "done" && review.findings.length === 0 ? (
        <p className="text-[14px] font-medium text-emerald-800 md:text-[12px]">Labojumu nav - teksts atbilst faktiem.</p>
      ) : (
        <AdminFlashMaxReviewPanel
          state={review}
          handled={handled}
          unappliable={stale}
          onAccept={acceptFinding}
          onReject={rejectFinding}
        />
      )}
    </AdminResponsiveModal>
  );
  if (visible.length === 0) return reviewOpen ? modal : null;
  const interval = visible.filter(isIntervalWarningFlag);
  const rest = visible.filter((f) => !isIntervalWarningFlag(f));
  return (
    <div
      className="mt-2 space-y-1.5 rounded-xl border border-amber-200/90 bg-amber-50 px-3 py-2 text-[12px] text-amber-950"
      role="status"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold">Faktu pārbaude</p>
        <span className="inline-flex shrink-0 items-center gap-1">
        {aiOn ? (
          <button
            type="button"
            data-fact-fix-all=""
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 hover:bg-white/70 disabled:opacity-40"
            disabled={aiBusy}
            aria-busy={aiBusy}
            onClick={() => void runAiFix(visible)}
          >
            {aiBusy ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden /> : null}
            Labot visas
          </button>
        ) : null}
        <button
          type="button"
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-amber-300/80 text-[11px] font-semibold leading-none text-amber-900 hover:bg-white/70"
          aria-expanded={helpOpen}
          aria-label="Kas ir faktu pārbaude"
          title={FACT_CHECK_HELP_LV}
          onClick={() => setHelpOpen((v) => !v)}
        >
          ?
        </button>
        </span>
      </div>
      {helpOpen ? <p className="text-[10px] leading-snug text-amber-900/90">{FACT_CHECK_HELP_LV}</p> : null}
      {rest.map((f) => (
        <FlagCard
          key={factCheckDismissKey(f)}
          flag={f}
          onDismiss={onDismiss}
          onApplyFix={onApplyFix}
          onAiFix={aiOn ? (flag) => void runAiFix([flag]) : undefined}
          aiBusy={aiBusy}
        />
      ))}
      {interval.length > 0 ? (
        <details className="rounded-lg border border-amber-200/70 bg-amber-50/50 px-2 py-1.5">
          <summary className="cursor-pointer text-[11px] font-medium">
            Intervāla brīdinājumi ({interval.length})
          </summary>
          <div className="mt-1.5 space-y-1.5">
            {interval.map((f) => (
              <FlagCard
          key={factCheckDismissKey(f)}
          flag={f}
          onDismiss={onDismiss}
          onApplyFix={onApplyFix}
          onAiFix={aiOn ? (flag) => void runAiFix([flag]) : undefined}
          aiBusy={aiBusy}
        />
            ))}
          </div>
        </details>
      ) : null}
      {modal}
    </div>
  );
}

export function AdminFactCheckPublishConfirm({
  items,
  onContinue,
  onBack,
}: {
  items: { label: string; sentence: string; message: string }[];
  onContinue: () => void;
  onBack: () => void;
}) {
  const backdropClose = useModalBackdropClose(onBack);
  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-3 sm:items-center"
      role="presentation"
      {...backdropClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fact-check-publish-title"
        className="w-full max-w-lg rounded-xl border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="fact-check-publish-title" className="text-sm font-semibold text-[var(--color-apple-text)]">
          Faktu pārbaudes kļūdas
        </h3>
        <p className="mt-1 text-[12px] leading-snug text-[var(--color-provin-muted)]">
          Ir atvērtas kļūdas. Teksts netiek dzēsts un netiek mainīts, kamēr nespiež Labot. Vari turpināt PDF tāpat.
        </p>
        <ul className="mt-3 max-h-[40vh] space-y-2 overflow-y-auto">
          {items.map((item, i) => (
            <li
              key={`${item.label}-${i}`}
              className="rounded-lg border border-red-200/90 bg-red-50 px-2.5 py-2 text-[11px] text-red-950"
            >
              <p className="font-semibold">{item.label}</p>
              <p className="mt-0.5 leading-snug">{item.sentence}</p>
              <p className="mt-1 leading-snug opacity-90">{item.message}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className={adminProBtn("neutral")} onClick={onBack}>
            Atpakaļ
          </button>
          <button type="button" className={adminProBtn("primary")} onClick={onContinue}>
            Turpināt tik un tā
          </button>
        </div>
      </div>
    </div>
  );
}
