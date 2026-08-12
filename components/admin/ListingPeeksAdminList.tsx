"use client";

import { ExternalLink, Phone } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { AdminWhatsAppOpenButton } from "@/components/admin/AdminWhatsAppOpenButton";
import type { ListingPeekEntry, ListingPeekStatus } from "@/lib/listing-peek-store";

const STATUSES: ListingPeekStatus[] = ["new", "in_progress", "completed", "rejected"];

const STATUS_LABEL: Record<ListingPeekStatus, string> = {
  new: "Jauns",
  in_progress: "Procesā",
  completed: "Pabeigts",
  rejected: "Noraidīts",
};

const fieldClass =
  "min-h-[44px] w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[16px] text-[var(--color-apple-text)] shadow-sm outline-none transition focus:border-[var(--color-provin-accent)] focus:ring-2 focus:ring-[var(--color-provin-accent)]/25 sm:text-[15px]";

const textareaClass = `${fieldClass} min-h-[120px] resize-y py-3 leading-snug`;

const actionPillClass =
  "inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-2 text-[12px] font-semibold text-[var(--color-apple-text)] shadow-sm transition active:scale-[0.98] hover:bg-slate-50";

type Tab = "pending" | "done";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString("lv-LV", { dateStyle: "short", timeStyle: "short" });
}

function listingHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Sludinājums";
  }
}

type Props = {
  entries: ListingPeekEntry[];
  smtpOk: boolean;
  setStatus: (formData: FormData) => Promise<void>;
  saveEmail: (formData: FormData) => Promise<void>;
  sendComment: (formData: FormData) => Promise<void>;
};

export function ListingPeeksAdminList({ entries, smtpOk, setStatus, saveEmail, sendComment }: Props) {
  const pending = useMemo(
    () => entries.filter((e) => e.status === "new" || e.status === "in_progress"),
    [entries],
  );
  const done = useMemo(
    () => entries.filter((e) => e.status === "completed" || e.status === "rejected"),
    [entries],
  );

  const [tab, setTab] = useState<Tab>(() => (pending.length > 0 ? "pending" : "done"));

  const visible = tab === "pending" ? pending : done;

  if (entries.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-slate-200/90 bg-white px-5 py-12 text-center shadow-sm sm:mt-8 sm:px-6">
        <p className="font-medium text-[var(--color-apple-text)]">Nav pieprasījumu</p>
        <p className="mt-2 text-sm text-[var(--color-provin-muted)]">
          Kad kāds iesniegs īso vērtējumu mājaslapā, ieraksti parādīsies šeit.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 sm:mt-6">
      <div
        className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-20 -mx-1 mb-3 flex gap-2 border-b border-slate-200/80 bg-[#F8F8F9]/95 px-1 pb-2 pt-1 backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none"
        role="tablist"
        aria-label="Filtrēt vērtējumus"
      >
        <TabButton active={tab === "pending"} count={pending.length} onClick={() => setTab("pending")}>
          Gaida
        </TabButton>
        <TabButton active={tab === "done"} count={done.length} onClick={() => setTab("done")}>
          Apstrādāti
        </TabButton>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200/90 bg-white px-5 py-10 text-center shadow-sm">
          <p className="text-sm font-medium text-[var(--color-apple-text)]">
            {tab === "pending" ? "Nav gaidošu pieprasījumu" : "Nav apstrādātu ierakstu"}
          </p>
          {tab === "pending" && done.length > 0 ? (
            <button
              type="button"
              onClick={() => setTab("done")}
              className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-[var(--color-provin-accent)] shadow-sm"
            >
              Skatīt apstrādātos ({done.length})
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-3 pb-2 sm:space-y-4">
          {visible.map((entry) => (
            <PeekCard
              key={entry.id}
              entry={entry}
              smtpOk={smtpOk}
              setStatus={setStatus}
              saveEmail={saveEmail}
              sendComment={sendComment}
              showSend={tab === "pending"}
              compact={tab === "done"}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TabButton({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 text-[13px] font-semibold transition sm:flex-none sm:rounded-full sm:px-4 ${
        active
          ? "border-[var(--color-provin-accent)] bg-[var(--color-provin-accent-soft)]/70 text-[var(--color-provin-accent)] shadow-sm"
          : "border-slate-200/90 bg-white text-[var(--color-apple-text)] hover:bg-slate-50"
      }`}
    >
      <span>{children}</span>
      <span
        className={`tabular-nums text-[11px] ${active ? "text-[var(--color-provin-accent)]/90" : "text-[var(--color-provin-muted)]"}`}
      >
        {count}
      </span>
    </button>
  );
}

function PeekCard({
  entry: e,
  smtpOk,
  setStatus,
  saveEmail,
  sendComment,
  showSend,
  compact,
}: {
  entry: ListingPeekEntry;
  smtpOk: boolean;
  setStatus: (formData: FormData) => Promise<void>;
  saveEmail: (formData: FormData) => Promise<void>;
  sendComment: (formData: FormData) => Promise<void>;
  showSend: boolean;
  compact: boolean;
}) {
  const isDone = e.status === "completed";
  const isRejected = e.status === "rejected";
  const telHref = e.phone ? `tel:${e.phone.replace(/\s/g, "")}` : null;

  return (
    <li
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
        isDone
          ? "border-emerald-200/90 bg-emerald-50/30"
          : isRejected
            ? "border-slate-200/90 bg-slate-50/80 opacity-90"
            : "border-slate-200/90"
      }`}
    >
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[12px] tabular-nums text-[var(--color-provin-muted)]">{formatWhen(e.createdAt)}</p>
          {isDone ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-emerald-800">
              E-pasts nosūtīts
            </span>
          ) : null}
          {isRejected ? (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600">
              Noraidīts
            </span>
          ) : null}
          {!isDone && !isRejected && e.status === "in_progress" ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-amber-900">
              Procesā
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex gap-2">
          <a
            href={e.listingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={actionPillClass}
            title={e.listingUrl}
          >
            <ExternalLink className="h-4 w-4 shrink-0 text-[var(--color-provin-accent)]" aria-hidden />
            <span className="truncate">{listingHost(e.listingUrl)}</span>
          </a>
          {telHref ? (
            <a href={telHref} className={actionPillClass}>
              <Phone className="h-4 w-4 shrink-0 text-[var(--color-provin-accent)]" aria-hidden />
              <span className="truncate">{e.phone}</span>
            </a>
          ) : null}
          {e.phone ? (
            <span className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl border border-emerald-200/90 bg-emerald-50 shadow-sm">
              <AdminWhatsAppOpenButton phone={e.phone} />
            </span>
          ) : null}
        </div>

        {!compact ? (
          <p className="mt-2 hidden break-all text-[11px] text-[var(--color-provin-muted)] sm:block">{e.listingUrl}</p>
        ) : null}

        <form action={saveEmail} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input type="hidden" name="id" value={e.id} />
          <input
            type="email"
            name="email"
            required
            defaultValue={e.email}
            aria-label="Klienta e-pasts"
            autoComplete="off"
            inputMode="email"
            className={fieldClass}
          />
          <button
            type="submit"
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--color-provin-muted)] shadow-sm transition hover:bg-slate-50 sm:min-w-[5.5rem]"
          >
            Saglabāt
          </button>
        </form>

        <form action={setStatus} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input type="hidden" name="id" value={e.id} />
          <select
            name="status"
            defaultValue={e.status}
            aria-label="Statuss"
            className={`${fieldClass} appearance-none bg-[length:12px] bg-[right_12px_center] bg-no-repeat pr-10 sm:flex-1`}
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
            }}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--color-provin-muted)] shadow-sm transition hover:bg-slate-50 sm:min-w-[5.5rem]"
          >
            Statuss
          </button>
        </form>
      </div>

      {showSend ? (
        <form
          action={sendComment}
          className="border-t border-slate-100 bg-slate-50/40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
        >
          <input type="hidden" name="id" value={e.id} />
          <label
            htmlFor={`comment-${e.id}`}
            className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-provin-muted)]"
          >
            Komentārs klientam (e-pastā + AUDITS CTA)
          </label>
          <textarea
            id={`comment-${e.id}`}
            name="comment"
            required
            minLength={8}
            rows={4}
            placeholder="Īss komentārs par to, kas redzams sludinājumā…"
            className={`${textareaClass} mt-2`}
          />
          <div className="mt-3 space-y-2">
            <button
              type="submit"
              disabled={!smtpOk}
              className="flex min-h-[48px] w-full items-center justify-center rounded-full bg-[var(--color-provin-accent)] px-5 text-[13px] font-semibold uppercase tracking-[0.06em] text-white shadow-md transition hover:opacity-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:min-w-[12rem]"
            >
              Nosūtīt e-pastu
            </button>
            {!smtpOk ? <p className="text-center text-[12px] text-amber-700 sm:text-left">SMTP nav konfigurēts.</p> : null}
          </div>
        </form>
      ) : null}
    </li>
  );
}
