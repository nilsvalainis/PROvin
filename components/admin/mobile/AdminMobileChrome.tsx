"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { AdminBodyPortal } from "@/components/admin/AdminBodyPortal";
import { useAdminMobileColorScheme } from "@/components/admin/useAdminMobileViewport";
import { useAdminScrollLock } from "@/lib/admin-scroll-lock";
import { AdminMobileIcon } from "@/components/admin/mobile/AdminMobileIcon";
import type { AdminMobileIconName } from "@/lib/admin-mobile-ds";
import { ADMIN_MAIN_SCROLL_ID } from "@/lib/admin-mobile-shell";

export function AdminMobileTopBar({
  title,
  subtitle,
  backHref,
  onBack,
  trailing,
  children,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  onBack?: () => void;
  trailing?: ReactNode;
  children?: ReactNode;
}) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const scroller = document.getElementById(ADMIN_MAIN_SCROLL_ID);
    const readY = () => (scroller ? scroller.scrollTop : window.scrollY);
    const onScroll = () => setCompact(readY() > 18);
    onScroll();
    scroller?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller?.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  const hasBack = Boolean(backHref || onBack);
  return (
    <header className="am-glass am-topbar sticky top-0 z-[20] px-4 pb-3 pt-[max(10px,env(safe-area-inset-top))] md:hidden">
      <div className="flex items-center gap-2">
        {hasBack ? (
          backHref ? (
            <Link href={backHref} aria-label="Atpakaļ" className="am-press grid h-9 w-9 place-items-center rounded-full bg-[var(--am-fill)] text-[var(--am-ink)]">
              <AdminMobileIcon name="atpakal" className="h-[18px] w-[18px]" />
            </Link>
          ) : (
            <button type="button" aria-label="Atpakaļ" onClick={onBack} className="am-press grid h-9 w-9 place-items-center rounded-full bg-[var(--am-fill)] text-[var(--am-ink)]">
              <AdminMobileIcon name="atpakal" className="h-[18px] w-[18px]" />
            </button>
          )
        ) : null}
        <div className="min-w-0 flex-1">
          <h1
            className={`origin-left truncate font-bold tracking-tight text-[var(--am-ink)] ${hasBack ? "text-[19px]" : "text-[26px]"}`}
            style={{
              transform: !hasBack && compact ? "scale(0.65)" : "scale(1)",
              transition: "transform var(--d-std) var(--ease-out)",
            }}
          >
            {title}
          </h1>
          {subtitle ? <p className="truncate text-[13px] text-[var(--am-ink2)]">{subtitle}</p> : null}
        </div>
        {trailing ? <div className="flex shrink-0 items-center gap-1.5">{trailing}</div> : null}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </header>
  );
}

export function AdminMobileRoundBtn({
  name,
  label,
  onClick,
  href,
  primary = false,
}: {
  name: AdminMobileIconName;
  label: string;
  onClick?: () => void;
  href?: string;
  primary?: boolean;
}) {
  const cls = `am-press grid h-9 w-9 place-items-center rounded-full ${
    primary ? "bg-[var(--am-ink)] text-[var(--am-s1)]" : "bg-[var(--am-fill)] text-[var(--am-ink)]"
  }`;
  if (href) {
    return (
      <Link href={href} aria-label={label} className={cls}>
        <AdminMobileIcon name={name} className="h-[18px] w-[18px]" />
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} onClick={onClick} className={cls}>
      <AdminMobileIcon name={name} className="h-[18px] w-[18px]" />
    </button>
  );
}

export function AdminMobileSaveStatus({
  saved,
  busy,
  onSave,
}: {
  saved: boolean;
  busy?: boolean;
  onSave?: () => void;
}) {
  const label = busy ? "Saglabā…" : saved ? "Saglabāts" : "Nav saglabāts";
  return (
    <button
      type="button"
      onClick={saved ? undefined : onSave}
      disabled={busy || saved}
      className="inline-flex h-[26px] items-center gap-1 rounded-full bg-[var(--am-fill)] px-2 text-[12px] font-medium text-[var(--am-ink2)]"
    >
      <AdminMobileIcon name={saved ? "saglabats" : "navSaglabats"} className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
      {label}
    </button>
  );
}

export function AdminMobileChips({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string; count?: number }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="am-chip-fade -mx-1 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((it) => {
        const on = it.id === value;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            className={`am-press inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] ${
              on ? "bg-[var(--am-ink)] font-semibold text-[var(--am-s1)]" : "bg-[var(--am-fill)] font-medium text-[var(--am-ink)]"
            }`}
          >
            {it.label}
            {it.count != null ? (
              <span className={on ? "text-[var(--am-s1)]/70" : "text-[var(--am-ink3)]"}>{it.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function AdminMobileSegments({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const i = Math.max(0, items.findIndex((it) => it.id === value));
  const n = Math.max(1, items.length);
  return (
    <div className="relative flex h-8 overflow-hidden rounded-full bg-[var(--am-fill)] p-0.5" role="tablist">
      <span
        aria-hidden
        className="pointer-events-none absolute top-0.5 bottom-0.5 rounded-full bg-[var(--am-s1)] shadow-sm"
        style={{
          width: `calc((100% - 4px) / ${n})`,
          transform: `translateX(${i * 100}%)`,
          transition: "transform var(--d-std) var(--ease-out)",
        }}
      />
      {items.map((it) => {
        const on = it.id === value;
        return (
          <button
            key={it.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(it.id)}
            className={`relative z-[1] h-full min-w-0 flex-1 truncate px-0.5 text-[11px] font-semibold ${on ? "text-[var(--am-ink)]" : "text-[var(--am-ink2)]"}`}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

export function AdminMobileCard({ children, href, onClick, className = "" }: { children: ReactNode; href?: string; onClick?: () => void; className?: string }) {
  const cls = `am-row am-press relative block rounded-[22px] bg-[var(--am-s1)] p-3.5 shadow-[var(--am-card-shadow)] ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls} onClick={onClick}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" className={`${cls} w-full text-left`} onClick={onClick}>
        {children}
      </button>
    );
  }
  return <div className={cls}>{children}</div>;
}

export function AdminMobileStatusTag({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  const cls =
    "inline-flex h-[22px] items-center gap-0.5 rounded-[7px] bg-[var(--am-fill)] px-1.5 text-[11px] font-medium text-[var(--am-ink2)]";
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick}>
        {children}
      </button>
    );
  }
  return <span className={cls}>{children}</span>;
}

export function AdminMobileCountBadge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--am-badge)] px-0.5 text-[9px] font-semibold tabular-nums text-[var(--am-badge-ink)] ring-2 ring-[var(--am-bg,#eef0f3)]">
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function AdminMobileSheet({
  open,
  title,
  subtitle,
  onClose,
  children,
  action,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  action?: ReactNode;
}) {
  const [shown, setShown] = useState(open);
  const theme = useAdminMobileColorScheme();
  useAdminScrollLock(open);
  useEffect(() => {
    if (open) setShown(true);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!shown) return null;
  const panel = (
    <div className="admin-m admin-sheet-root md:hidden" role="dialog" aria-modal="true" aria-label={title} data-open={open ? "true" : "false"} data-admin-theme={theme}>
      <button
        type="button"
        aria-label="Aizvērt"
        className="admin-sheet-scrim"
        onClick={onClose}
        onTransitionEnd={() => {
          if (!open) setShown(false);
        }}
      />
      <div
        className={`am-glass admin-sheet-panel rounded-t-[36px] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 ${
          open ? "" : "admin-sheet-out"
        }`}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--am-fill2)]" aria-hidden />
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[19px] font-bold text-[var(--am-ink)]">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[13px] text-[var(--am-ink2)]">{subtitle}</p> : null}
          </div>
          <button type="button" aria-label="Aizvērt" onClick={onClose} className="am-press grid h-9 w-9 place-items-center rounded-full bg-[var(--am-fill)]">
            <AdminMobileIcon name="aizvert" className="h-4 w-4" />
          </button>
        </div>
        {children}
        {action}
      </div>
    </div>
  );
  return <AdminBodyPortal>{panel}</AdminBodyPortal>;
}

export function AdminMobileSectionNav({
  items,
  activeId,
  onPick,
}: {
  items: { id: string; label: string }[];
  activeId: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="am-chip-fade -mx-1 mt-3 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((it) => {
        const on = it.id === activeId;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onPick(it.id)}
            className={`am-press inline-flex h-[30px] shrink-0 items-center rounded-full px-3 text-[13px] ${
              on ? "bg-[var(--am-ink)] font-semibold text-[var(--am-s1)]" : "bg-[var(--am-fill)] text-[var(--am-ink)]"
            }`}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

export function AdminMobileActionDock({
  actions,
  more,
}: {
  actions: { id: string; label: string; icon: AdminMobileIconName; onClick?: () => void; href?: string; disabled?: boolean }[];
  more?: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[30] flex items-end justify-center gap-2 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 md:hidden">
      <nav className="am-glass pointer-events-auto flex h-[62px] min-w-0 flex-1 items-stretch rounded-full px-1.5">
        {actions.map((a) => {
          const inner = (
            <>
              <AdminMobileIcon name={a.icon} className="h-5 w-5" />
              <span className="max-w-full truncate px-0.5 text-center text-[10px] font-medium leading-none">{a.label}</span>
            </>
          );
          const cls = `am-press flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[var(--am-ink)] disabled:opacity-35`;
          if (a.href && !a.disabled) {
            return (
              <a key={a.id} href={a.href} target="_blank" rel="noopener noreferrer" className={cls}>
                {inner}
              </a>
            );
          }
          return (
            <button key={a.id} type="button" disabled={a.disabled} onClick={a.onClick} className={cls}>
              {inner}
            </button>
          );
        })}
      </nav>
      {more ? (
        <button
          type="button"
          aria-label="Vairāk"
          onClick={more}
          className="am-press pointer-events-auto grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--am-ink)] text-[var(--am-s1)] shadow-[var(--am-glass-shadow)]"
        >
          <AdminMobileIcon name="vairak" className="h-5 w-5" />
        </button>
      ) : null}
    </div>
  );
}

export function AdminMobileSearchField({
  value,
  onChange,
  placeholder,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onSubmit?: () => void;
}) {
  return (
    <label className="flex h-9 items-center gap-2 px-1 text-[var(--am-ink2)]">
      <AdminMobileIcon name="meklet" className="h-4 w-4" />
      <input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit?.();
        }}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--am-ink)] outline-none placeholder:text-[var(--am-ink3)]"
      />
    </label>
  );
}

export function AdminMobilePrimaryButton({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="am-press h-11 w-full rounded-full bg-[var(--am-ink)] text-[16px] font-semibold text-[var(--am-s1)] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function AdminMobileSecondaryButton({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="am-press flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--am-fill)] text-[15px] font-semibold text-[var(--am-ink)] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function AdminMobileTabPill({ index, count }: { index: number; count: number }) {
  if (index < 0 || count <= 0) return null;
  const style: CSSProperties = {
    width: `calc((100% - 12px) / ${count})`,
    transform: `translateX(${index * 100}%)`,
    transition: "transform var(--d-std) var(--ease-out)",
  };
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute top-1 bottom-1 left-1.5 rounded-full bg-[var(--am-fill2)]"
      style={style}
    />
  );
}
