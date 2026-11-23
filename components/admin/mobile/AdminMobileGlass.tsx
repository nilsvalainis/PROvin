/**
 * PRO admin telefonā - stikla stila komponentes (22.11 makets v3). Stils: `app/admin/mobile/glass.css` (`.amx-*`),
 * kas darbojas tikai <768 px. Komponentes ir bez stāvokļa - der jebkurā telefona skatā.
 */

import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { AdminIngestState } from "@/lib/admin-mobile-ingest";

export type AmxIconName = "ok" | "x" | "re" | "more" | "doc" | "send" | "undo" | "pen" | "chev" | "wa";

const PATHS: Record<AmxIconName, ReactNode> = {
  ok: <path d="M5 12.5l4.5 4.5L19 7" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  re: (
    <>
      <path d="M20 11a8 8 0 10-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </>
  ),
  more: (
    <>
      <circle cx="6" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="18" cy="12" r="1" />
    </>
  ),
  doc: (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
    </>
  ),
  send: <path d="M4 12l16-8-6 16-2-7z" />,
  undo: (
    <>
      <path d="M9 14l-5-5 5-5" />
      <path d="M4 9h10a6 6 0 010 12h-3" />
    </>
  ),
  pen: <path d="M4 20l4-1L19 8l-3-3L5 16z" />,
  chev: <path d="M9 6l6 6-6 6" />,
  wa: <path d="M4 20l1.3-4A8 8 0 118 18.7z" />,
};

export function AmxIcon({ name, className = "", strokeWidth = 1.6 }: { name: AmxIconName; className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}

const STATE_ICON: Record<AdminIngestState, AmxIconName> = {
  done: "ok",
  no_data: "x",
  error: "x",
  running: "re",
  idle: "more",
};

const STATE_ARIA: Record<AdminIngestState, string> = {
  done: "Ielasīts",
  no_data: "Datu nav",
  error: "Kļūda",
  running: "Ielasa",
  idle: "Nav palaists",
};

/** Ielases statuss pildītā aplī (23.11): zaļš ar baltu ķeksi, sarkans ar baltu krustu, pelēks griežas, pelēki punkti. */
export function AmxStatusIcon({ state, label }: { state: AdminIngestState; label?: string }) {
  return (
    <span className={`amx-sti amx-sti--${state}`} role="img" aria-label={label || STATE_ARIA[state]} data-amx-state={state}>
      <AmxIcon name={STATE_ICON[state]} strokeWidth={2.2} />
    </span>
  );
}

export type AmxDotTone = "ok" | "warn" | "err" | "muted" | "outline" | "neutral";

/** Statuss ar punktu: «Ielasīts · 14 ieraksti», «Nav nosūtīts». */
export function AmxStatusDot({ tone = "neutral", children }: { tone?: AmxDotTone; children: ReactNode }) {
  return <span className={`amx-st${tone === "neutral" ? "" : ` amx-st--${tone}`}`}>{children}</span>;
}

export type AmxChipTone = "ok" | "warn" | "err" | "neutral";

/** Krāsains statusa čips (23.11): «Kavē 42 h» sarkans, «8 h» oranžs, «Nosūtīts» zaļš. Stils - `order-colors.css`. */
export function AmxChip({ tone = "neutral", children }: { tone?: AmxChipTone; children: ReactNode }) {
  return <span className={`amx-chip amx-chip--${tone}`}>{children}</span>;
}

/** Produkta veida birka (23.11): katram produktam sava atturīga krāsa. */
export function AmxProductChip({ kind, children }: { kind: string; children: ReactNode }) {
  return (
    <span className={`amx-prod amx-prod--${kind}`} data-amx-product={kind}>
      {children}
    </span>
  );
}

export type AmxButtonVariant = "primary" | "secondary" | "danger";

type AmxButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  variant?: AmxButtonVariant;
  icon?: AmxIconName;
  small?: boolean;
};

/** Poga: galvenā (zila), sekundārā (neitrāls stikls), destruktīvā (sarkans teksts + ikona uz stikla). */
export function AmxButton({ variant = "secondary", icon, small = false, className = "", children, ...rest }: AmxButtonProps) {
  const cls = [
    "amx-btn",
    variant === "primary" ? "amx-btn--primary" : "",
    variant === "danger" ? "amx-btn--danger" : "",
    small ? "amx-btn--sm" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={cls} data-amx-variant={variant} {...rest}>
      {icon ? <AmxIcon name={icon} /> : null}
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}

/** Stikla kartīte. */
export function AmxCard({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`amx-card ${className}`.trim()}>{children}</div>;
}

/** Sadaļas virsraksts (mazie lielie burti). */
export function AmxLabel({ children }: { children: ReactNode }) {
  return <div className="amx-lbl">{children}</div>;
}

/** Galvenes saglabāšanas statuss (pelēks teksts; sarkans - neizdevās). Nesaglabātu var saglabāt pieskaroties. */
export function AdminMobileGlassSaveStatus({
  saved,
  busy = false,
  failed = false,
  onSave,
}: {
  saved: boolean;
  busy?: boolean;
  failed?: boolean;
  onSave?: () => void;
}) {
  const label = busy ? "Saglabā…" : failed ? "Nav saglabāts" : saved ? "Saglabāts" : "Saglabāt";
  return (
    <button
      type="button"
      className={`amx-save${failed && !busy ? " amx-save--err" : ""}`}
      onClick={saved || busy ? undefined : onSave}
      disabled={busy || saved}
      data-amx-save={busy ? "busy" : failed ? "error" : saved ? "saved" : "dirty"}
    >
      {saved && !busy ? <AmxIcon name="ok" className="h-3.5 w-3.5" strokeWidth={2} /> : null}
      {busy ? <AmxIcon name="re" className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : null}
      {label}
    </button>
  );
}
