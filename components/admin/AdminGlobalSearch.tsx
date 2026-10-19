"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useAdminMobileViewport } from "@/components/admin/useAdminMobileViewport";
import { useAdminScrollLock } from "@/lib/admin-scroll-lock";
import {
  ADMIN_GLOBAL_SEARCH_OPEN,
  ADMIN_SEARCH_QUERY_MIN,
  ADMIN_SEARCH_RECENT_KEY,
  groupAdminSearchHits,
  parseAdminSearchRecent,
  pushAdminSearchRecent,
  requestAdminGlobalSearch,
  type AdminSearchGroup,
  type AdminSearchHit,
} from "@/lib/admin-global-search";

function HitButton({
  hit,
  index,
  active,
  onPick,
  onHover,
}: {
  hit: AdminSearchHit;
  index: number;
  active: boolean;
  onPick: (hit: AdminSearchHit) => void;
  onHover: (index: number) => void;
}) {
  return (
    <button
      id={`admin-search-hit-${index}`}
      type="button"
      role="option"
      aria-selected={active}
      onMouseEnter={() => onHover(index)}
      onClick={() => onPick(hit)}
      className={`flex w-full min-w-0 flex-col items-start gap-0.5 px-3 py-2 text-left ${
        active ? "bg-[#e8efff]" : "hover:bg-[#f5f5f7]"
      }`}
    >
      <span className="w-full truncate text-[14px] font-medium text-[#1d1d1f]">{hit.title}</span>
      {hit.subtitle ? <span className="w-full truncate text-[12px] text-[#8e8e93]">{hit.subtitle}</span> : null}
    </button>
  );
}

/** Mobilā meklēšanas poga. Ieliek galvenē vai tab joslā, nevis virs satura. */
export function AdminMobileSearchButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => requestAdminGlobalSearch()}
      aria-label="Meklēt"
      className={
        className ||
        "am-glass pointer-events-auto inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-0 text-[var(--am-ink)]"
      }
    >
      <Search className="h-4 w-4" strokeWidth={2} aria-hidden />
    </button>
  );
}

export function AdminGlobalSearch() {
  const mobile = useAdminMobileViewport();
  const [mobileReady, setMobileReady] = useState(false);
  useEffect(() => {
    if (!mobile) return;
    const onOpen = () => setMobileReady(true);
    window.addEventListener(ADMIN_GLOBAL_SEARCH_OPEN, onOpen);
    return () => window.removeEventListener(ADMIN_GLOBAL_SEARCH_OPEN, onOpen);
  }, [mobile]);
  if (mobile && !mobileReady) return null;
  return <AdminGlobalSearchPanel />;
}

function AdminGlobalSearchPanel() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<AdminSearchGroup[]>([]);
  const [recent, setRecent] = useState<AdminSearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setGroups([]);
  }, []);

  const showingRecent = query.trim().length < ADMIN_SEARCH_QUERY_MIN;
  const flat = useMemo(() => (showingRecent ? recent : groups.flatMap((g) => g.hits)), [showingRecent, recent, groups]);

  const openHit = useCallback(
    (hit: AdminSearchHit) => {
      const next = pushAdminSearchRecent(recent, hit);
      setRecent(next);
      try {
        window.localStorage.setItem(ADMIN_SEARCH_RECENT_KEY, JSON.stringify(next));
      } catch {
        /* nav kritiski */
      }
      close();
      router.push(hit.href);
    },
    [close, recent, router],
  );

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener(ADMIN_GLOBAL_SEARCH_OPEN, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener(ADMIN_GLOBAL_SEARCH_OPEN, onOpen);
    };
  }, []);

  useAdminScrollLock(open);

  useEffect(() => {
    if (!open) return;
    setRecent(parseAdminSearchRecent(window.localStorage.getItem(ADMIN_SEARCH_RECENT_KEY)));
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(t);
    };
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query, groups, recent, open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < ADMIN_SEARCH_QUERY_MIN) {
      setGroups([]);
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    let alive = true;
    setLoading(true);
    const t = window.setTimeout(() => {
      void fetch(`/api/admin/search?q=${encodeURIComponent(q)}`, {
        credentials: "include",
        cache: "no-store",
        signal: ac.signal,
      })
        .then(async (res) => {
          if (!res.ok) return { groups: [] as AdminSearchGroup[] };
          return (await res.json()) as { groups?: AdminSearchGroup[] };
        })
        .then((data) => {
          if (!alive) return;
          const next = Array.isArray(data.groups) ? data.groups.filter((g) => g && Array.isArray(g.hits)) : [];
          setGroups(next);
        })
        .catch((err: unknown) => {
          if (!alive) return;
          if (err instanceof DOMException && err.name === "AbortError") return;
          setGroups([]);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 300);
    return () => {
      alive = false;
      window.clearTimeout(t);
      ac.abort();
    };
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(`admin-search-hit-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(flat.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const hit = flat[active];
      if (hit) openHit(hit);
    }
  };

  let cursor = 0;

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-[130] flex flex-col bg-[var(--am-bg,#e9ecf1)] md:block md:bg-black/20 md:p-8"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Meklēt"
            onKeyDown={onKeyDown}
            className="am-glass flex min-h-0 flex-1 flex-col md:mx-auto md:mt-16 md:h-auto md:max-h-[min(32rem,70dvh)] md:w-full md:max-w-xl md:flex-none md:overflow-hidden md:rounded-2xl md:border md:border-[#e5e5ea] md:bg-white md:shadow-[0_12px_40px_rgba(15,23,42,0.12)]"
          >
            <div className="flex items-center gap-2 border-b border-[#e5e5ea] px-3 pt-[max(10px,env(safe-area-inset-top))] md:pt-3">
              <Search className="h-4 w-4 shrink-0 text-[#8e8e93]" strokeWidth={2} aria-hidden />
              <input
                ref={inputRef}
                type="search"
                inputMode="search"
                enterKeyHint="go"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label="Meklēt"
                aria-controls="admin-search-results"
                aria-activedescendant={flat[active] ? `admin-search-hit-${active}` : undefined}
                placeholder="Meklēt"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-11 min-w-0 flex-1 bg-transparent text-[16px] text-[#1d1d1f] outline-none placeholder:text-[#8e8e93] md:h-10 md:text-[14px]"
              />
              <button type="button" onClick={close} className="shrink-0 px-1 text-[15px] font-medium text-[var(--color-provin-accent)] md:text-[13px]">
                Aizvērt
              </button>
            </div>
            <div
              id="admin-search-results"
              role="listbox"
              aria-label="Meklēt"
              className={`min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(12px,env(safe-area-inset-bottom))] md:max-h-[24rem] ${loading ? "opacity-60" : ""}`}
            >
              {showingRecent && recent.length > 0 ? (
                <div>
                  <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93]">Nesenie</p>
                  {recent.map((hit) => {
                    const index = cursor++;
                    return <HitButton key={`${hit.kind}:${hit.id}`} hit={hit} index={index} active={index === active} onPick={openHit} onHover={setActive} />;
                  })}
                </div>
              ) : null}
              {showingRecent
                ? null
                : groupAdminSearchHits(groups.flatMap((g) => g.hits)).map((group) => (
                    <div key={group.kind}>
                      <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93]">{group.label}</p>
                      {group.hits.map((hit) => {
                        const index = cursor++;
                        return (
                          <HitButton
                            key={`${hit.kind}:${hit.id}`}
                            hit={hit}
                            index={index}
                            active={index === active}
                            onPick={openHit}
                            onHover={setActive}
                          />
                        );
                      })}
                    </div>
                  ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
