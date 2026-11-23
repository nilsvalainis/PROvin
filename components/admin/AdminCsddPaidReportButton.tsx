"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CsddFormFields } from "@/lib/admin-source-blocks";
import type { EcsddRelaySession } from "@/lib/ecsdd-auto-types";
import {
  applyCsddPaidReportToForm,
  ecsddPaidErrorLv,
  isEcsddPlate,
  PAID_POLL_INTERVAL_MS,
  PAID_POLL_TOTAL_MS,
  resolvePaidQuery,
  smsPlatformFromUserAgent,
} from "@/lib/ecsdd-paid-logic";
import { encodeQr, qrSvgPath } from "@/lib/qr-code";

const btn =
  "inline-flex h-7 items-center rounded-md border border-slate-300 bg-white px-2.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

type Pending = { plate: string; since: string; href: string; hrefOther: string; number: string; body: string; price?: string; autoSend?: boolean; autoSent?: boolean };

type Phase =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "login"; code?: string; startedAt: number }
  | { kind: "sms"; pending: Pending }
  | { kind: "done"; at: string }
  | { kind: "error"; message: string };

const LOGIN_WAIT_MS = 3 * 60_000;
const storeKey = (sessionId: string) => `provin:ecsdd-paid:${sessionId}`;

function readPending(sessionId: string): Pending | null {
  try {
    const raw = window.localStorage.getItem(storeKey(sessionId));
    if (!raw) return null;
    const p = JSON.parse(raw) as Pending;
    if (!p?.plate || !p.since || Date.now() - Date.parse(p.since) > PAID_POLL_TOTAL_MS) return null;
    return p;
  } catch {
    return null;
  }
}

function writePending(sessionId: string, p: Pending | null) {
  try {
    if (p) window.localStorage.setItem(storeKey(sessionId), JSON.stringify(p));
    else window.localStorage.removeItem(storeKey(sessionId));
  } catch {
    /* privātais režīms - turpinām bez atmiņas */
  }
}

function QrSvg({ text, size }: { text: string; size: number }) {
  const qr = useMemo(() => {
    try {
      return qrSvgPath(encodeQr(text, { ecc: "M" }).modules);
    } catch {
      return null;
    }
  }, [text]);
  if (!qr) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${qr.viewBox} ${qr.viewBox}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR kods SMS"
      className="rounded-md border border-slate-200 bg-white"
    >
      <rect width={qr.viewBox} height={qr.viewBox} fill="#fff" />
      <path d={qr.d} fill="#0f172a" />
    </svg>
  );
}

function mmss(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type Props = {
  sessionId: string;
  orderVin: string;
  value: CsddFormFields;
  disabled?: boolean;
  onChange: (next: CsddFormFields) => void;
};

/**
 * CSDD maksas izziņa (1,50 € ar SMS): relejs nolasa e.csdd "Sagatavot īsziņu" saiti; datorā liels QR (skenē ar iPhone),
 * telefonā poga atver Ziņas. SMS sūta un maksā Nils. Pēc tam ik 20 s (līdz 10 min) prasa apmaksāto izziņu un ievieto
 * CSDD blokā caur to pašu ceļu kā PDF (ar roku labotie lauki paliek).
 */
export function AdminCsddPaidReportButton({ sessionId, orderVin, value, disabled, onChange }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [now, setNow] = useState(() => Date.now());
  const [platform, setPlatform] = useState<"apple" | "other">("apple");
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const polling = useRef(false);
  const linkInFlight = useRef(false);
  const autoInFlight = useRef(false);
  const [autoState, setAutoState] = useState<"" | "busy" | "sent" | "error">("");

  useEffect(() => {
    setPlatform(smsPlatformFromUserAgent(navigator.userAgent));
    const p = readPending(sessionId);
    if (p) setPhase({ kind: "sms", pending: p });
  }, [sessionId]);

  const query = resolvePaidQuery(value, orderVin);

  const requestLink = useCallback(
    async (login: boolean) => {
      if (!query) {
        setPhase({ kind: "error", message: ecsddPaidErrorLv("invalid_query") });
        return;
      }
      if (linkInFlight.current) return;
      linkInFlight.current = true;
      setPhase((p) => (p.kind === "login" ? p : { kind: "busy" }));
      try {
        const res = await fetch("/api/admin/ecsdd/paid/sms-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, login }),
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (data.status === "ok" && typeof data.href === "string") {
          const plate = typeof data.plate === "string" && isEcsddPlate(data.plate) ? data.plate : isEcsddPlate(query) ? query : "";
          if (!plate) {
            setPhase({ kind: "error", message: ecsddPaidErrorLv("not_found") });
            return;
          }
          const pending: Pending = {
            plate,
            since: new Date().toISOString(),
            href: data.href,
            hrefOther: typeof data.hrefOther === "string" ? data.hrefOther : data.href,
            number: typeof data.number === "string" ? data.number : "",
            body: typeof data.body === "string" ? data.body : "",
            price: typeof data.price === "string" ? data.price : undefined,
            autoSend: data.autoSend === true,
          };
          writePending(sessionId, pending);
          setPhase({ kind: "sms", pending });
          return;
        }
        if (data.status === "needs_login") {
          const code = typeof data.verificationCode === "string" ? data.verificationCode : undefined;
          setPhase((p) => (p.kind === "login" ? { ...p, code: code ?? p.code } : { kind: "login", code, startedAt: Date.now() }));
          return;
        }
        setPhase({ kind: "error", message: ecsddPaidErrorLv(typeof data.code === "string" ? data.code : String(data.status ?? "")) });
      } catch {
        setPhase({ kind: "error", message: ecsddPaidErrorLv("unreachable") });
      } finally {
        linkInFlight.current = false;
      }
    },
    [query, sessionId],
  );

  // Smart-ID: gaida, kamēr releja sesija aktīva, tad vēlreiz prasa saiti (bez jauna Smart-ID).
  useEffect(() => {
    if (phase.kind !== "login") return;
    const t = setInterval(async () => {
      if (Date.now() - phase.startedAt > LOGIN_WAIT_MS) {
        setPhase({ kind: "error", message: "Smart-ID netika apstiprināts" });
        return;
      }
      try {
        const res = await fetch(`/api/admin/ecsdd?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        const data = (await res.json()) as { session?: EcsddRelaySession | null };
        const s = data.session;
        if (s?.state === "awaiting_smartid" && s.verificationCode) setPhase((p) => (p.kind === "login" ? { ...p, code: s.verificationCode } : p));
        if (s?.state === "active") void requestLink(false);
        if (s && s.state !== "active" && s.lastError && Date.parse(s.updatedAt ?? "") > phase.startedAt && s.state !== "logging_in" && s.state !== "awaiting_smartid") {
          setPhase({ kind: "error", message: "Smart-ID netika apstiprināts" });
        }
      } catch {
        /* nākamajā reizē */
      }
    }, 4000);
    return () => clearInterval(t);
  }, [phase, sessionId, requestLink]);

  // Gaida apmaksāto izziņu.
  const pending = phase.kind === "sms" ? phase.pending : null;
  useEffect(() => {
    if (!pending) return;
    let stop = false;
    const tick = async () => {
      if (stop || polling.current) return;
      if (Date.now() - Date.parse(pending.since) > PAID_POLL_TOTAL_MS) {
        writePending(sessionId, null);
        setPhase({ kind: "error", message: "Apmaksātā izziņa 10 min laikā neparādījās" });
        return;
      }
      polling.current = true;
      try {
        const res = await fetch("/api/admin/ecsdd/paid/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plate: pending.plate, since: pending.since }),
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (stop) return;
        if (data.status === "found" && typeof data.rawText === "string" && data.fields) {
          onChangeRef.current(applyCsddPaidReportToForm(valueRef.current, data.fields as CsddFormFields, data.rawText));
          writePending(sessionId, null);
          setPhase({ kind: "done", at: new Date().toISOString() });
        } else if (data.status === "needs_login") {
          writePending(sessionId, null);
          setPhase({ kind: "error", message: "e.csdd sesija beigusies - spied \"Pieslēgt e.csdd\"" });
        }
      } catch {
        /* nākamajā reizē */
      } finally {
        polling.current = false;
      }
    };
    const first = setTimeout(() => void tick(), 15_000);
    const t = setInterval(() => void tick(), PAID_POLL_INTERVAL_MS);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      stop = true;
      clearTimeout(first);
      clearInterval(t);
      clearInterval(clock);
    };
  }, [pending, sessionId]);

  /** "Sūtīt automātiski": e-pasts Nila iPhone Īsceļam (viens pieprasījums = viena SMS; dubultklikšķis bloķēts). */
  const autoSend = async () => {
    if (!pending || pending.autoSent || autoInFlight.current) return;
    autoInFlight.current = true;
    setAutoState("busy");
    try {
      const res = await fetch("/api/admin/ecsdd/paid/auto-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: `${pending.plate}-${pending.since}`, number: pending.number, body: pending.body, plate: pending.plate }),
      });
      if (!res.ok) {
        setAutoState("error");
        return;
      }
      const next = { ...pending, autoSent: true };
      writePending(sessionId, next);
      setPhase({ kind: "sms", pending: next });
      setAutoState("sent");
    } catch {
      setAutoState("error");
    } finally {
      autoInFlight.current = false;
    }
  };

  const autoButton = pending?.autoSend ? (
    <button
      type="button"
      className={btn}
      disabled={disabled || pending.autoSent || autoState === "busy" || !pending.number || !pending.body}
      onClick={() => void autoSend()}
    >
      {pending.autoSent || autoState === "sent" ? "Nosūtīts uz telefonu" : autoState === "busy" ? "Sūta…" : "Sūtīt automātiski"}
    </button>
  ) : null;

  const cancel = () => {
    writePending(sessionId, null);
    setAutoState("");
    setPhase({ kind: "idle" });
  };

  const label = `CSDD maksas izziņa (${pending?.price || "1,50"} €)`;
  const busy = phase.kind === "busy" || phase.kind === "login";

  return (
    <div className="mb-2 text-[11px] text-slate-700" data-testid="csdd-paid-report">
      {phase.kind !== "sms" ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button type="button" className={btn} disabled={disabled || busy || !query} onClick={() => void requestLink(true)}>
            {phase.kind === "busy" ? "Gatavo SMS…" : label}
          </button>
          {phase.kind === "login" ? (
            <span className="font-semibold text-slate-900">{phase.code ? `Smart-ID kods ${phase.code}` : "Apstiprini Smart-ID"}</span>
          ) : null}
          {phase.kind === "done" ? <span className="text-emerald-700">Izziņa ievietota</span> : null}
          {phase.kind === "error" ? <span className="text-red-700">{phase.message}</span> : null}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2">
          {/* Dators: liels QR (skenē ar iPhone kameru); saite sekundāra. */}
          <div className="hidden items-start gap-3 md:flex">
            <QrSvg text={phase.pending.href} size={208} />
            <div className="flex min-w-0 flex-col gap-1.5 pt-1">
              <span className="text-[12px] font-semibold text-slate-900">{label}</span>
              <span>Gaida apmaksu · {mmss(PAID_POLL_TOTAL_MS - (now - Date.parse(phase.pending.since)))}</span>
              <div>{autoButton}</div>
              {autoState === "error" ? <span className="text-red-700">Neizdevās nosūtīt</span> : null}
              <a className="text-slate-500 underline" href={platform === "apple" ? phase.pending.href : phase.pending.hrefOther}>
                Atvērt Ziņās
              </a>
              <button type="button" className="self-start text-slate-500 underline" onClick={cancel}>
                Pārtraukt
              </button>
            </div>
          </div>
          {/* Telefons: tikai poga, kas atver Ziņas. */}
          <div className="flex flex-col gap-1.5 md:hidden">
            <a
              className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-700 px-3 text-[14px] font-semibold text-white"
              href={platform === "apple" ? phase.pending.href : phase.pending.hrefOther}
            >
              Atvērt Ziņas
            </a>
            <div className="flex items-center justify-between">
              <span>Gaida apmaksu · {mmss(PAID_POLL_TOTAL_MS - (now - Date.parse(phase.pending.since)))}</span>
              <button type="button" className="text-slate-500 underline" onClick={cancel}>
                Pārtraukt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
