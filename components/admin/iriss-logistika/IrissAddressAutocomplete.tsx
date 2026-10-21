"use client";

import { useEffect, useId, useRef, useState } from "react";

export type PickedAddress = { formatted: string; name: string; lat: number; lng: number };

type Suggestion = { placeId: string; main: string; secondary: string; lat?: number; lng?: number };

type Props = {
  placeholder?: string;
  defaultValue?: string;
  autoFocus?: boolean;
  onPick: (address: PickedAddress) => void;
};

function newSessionToken(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
}

/**
 * Adrese kā Google Maps: ieteikumi parādās rakstot, bultiņas izvēlas, Enter apstiprina, Esc aizver.
 * Places sesija: ieteikumi + viena izvēle = viena sesija (lētāk un precīzāk).
 */
export function IrissAddressAutocomplete({ placeholder = "Meklēt adresi", defaultValue = "", autoFocus, onPick }: Props) {
  const [q, setQ] = useState(defaultValue);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState("");
  const [error, setError] = useState("");
  const session = useRef(newSessionToken());
  const seq = useRef(0);
  /** Esošā adrese (labojot šablonu) nemeklē uzreiz: Google tiek jautāts tikai, kad lietotājs raksta. */
  const skipNext = useRef(Boolean(defaultValue));
  const cache = useRef(new Map<string, { items: Suggestion[]; hint: string }>());
  const geocodeMode = useRef(false);
  const listId = useId();

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const text = q.trim();
    if (text.length < 3) {
      setItems([]);
      setLoading(false);
      return;
    }
    const cached = cache.current.get(text.toLowerCase());
    if (cached) {
      setItems(cached.items);
      setHint(cached.hint);
      setActive(0);
      return;
    }
    // Ģeokodēšanas rezervē katrs pieprasījums maksā vairāk, tāpēc gaidām garāku pauzi.
    const delay = geocodeMode.current ? 650 : 250;
    const my = ++seq.current;
    setLoading(true);
    const t = window.setTimeout(async () => {
      const res = await fetch("/api/admin/iriss-logistics/address-suggest", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text, sessionToken: session.current }),
      }).catch(() => null);
      if (my !== seq.current) return;
      setLoading(false);
      const body = (res ? await res.json().catch(() => ({})) : {}) as { items?: Suggestion[]; source?: string; hint?: string; notice?: string };
      if (!res?.ok) {
        setError(body.notice || "Adrešu meklēšana neizdevās.");
        setItems([]);
        return;
      }
      geocodeMode.current = body.source === "geocode";
      const next = body.items ?? [];
      cache.current.set(text.toLowerCase(), { items: next, hint: body.hint ?? "" });
      setError("");
      setHint(body.hint ?? "");
      setItems(next);
      setActive(0);
      setOpen(true);
    }, delay);
    return () => window.clearTimeout(t);
  }, [q]);

  async function choose(s: Suggestion) {
    setOpen(false);
    skipNext.current = true;
    setQ([s.main, s.secondary].filter(Boolean).join(", "));
    if (s.lat != null && s.lng != null) {
      onPick({ formatted: [s.main, s.secondary].filter(Boolean).join(", "), name: s.main, lat: s.lat, lng: s.lng });
      return;
    }
    setLoading(true);
    const res = await fetch("/api/admin/iriss-logistics/address-place", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId: s.placeId, sessionToken: session.current }),
    }).catch(() => null);
    setLoading(false);
    session.current = newSessionToken();
    const body = (res ? await res.json().catch(() => ({})) : {}) as Partial<PickedAddress> & { notice?: string };
    if (!res?.ok || typeof body.lat !== "number" || typeof body.lng !== "number") {
      setError(body.notice || "Vietas koordinātes neizdevās iegūt.");
      return;
    }
    setError("");
    onPick({ formatted: body.formatted || s.main, name: body.name || s.main, lat: body.lat, lng: body.lng });
  }

  return (
    <div className="iriss-log-ac">
      <div className="iriss-log-ac-field">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          value={q}
          autoFocus={autoFocus}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(items.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const pick = items[active];
              if (pick) void choose(pick);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {loading ? <span className="iriss-log-ac-spin" aria-hidden /> : null}
      </div>
      {open && items.length > 0 ? (
        <ul id={listId} role="listbox" className="iriss-log-ac-list">
          {items.map((s, i) => (
            <li key={`${s.placeId}-${s.main}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                className={i === active ? "on" : ""}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => void choose(s)}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
                  <circle cx="12" cy="9.5" r="2.5" />
                </svg>
                <span className="min-w-0 flex-1">
                  <span className="m">{s.main}</span>
                  {s.secondary ? <span className="s">{s.secondary}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && !loading && q.trim().length >= 3 && items.length === 0 && !error ? (
        <p className="iriss-log-ac-note">Nekas nav atrasts. Pamēģini ar pilsētu vai pasta indeksu.</p>
      ) : null}
      {error ? <p className="iriss-log-ac-note bad">{error}</p> : null}
      {hint && open ? <p className="iriss-log-ac-note">{hint}</p> : null}
    </div>
  );
}
