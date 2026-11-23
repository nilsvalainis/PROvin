"use client";

/**
 * «Klienta saite» (Nils 22.11): droša saite, ar kuru klients atver savu atskaiti tīmeklī.
 * Izveido (vecā tiek atsaukta), parāda saiti ar «Kopēt» un termiņu, «Atsaukt».
 * Saite redzama tikai izveides brīdī - serverī glabājas tikai hešs.
 * E-pastiem saiti pagaidām NEpievieno (Nils vispirms testē).
 */

import { useCallback, useState } from "react";
import { adminProBtn } from "@/lib/admin-pro-tones";
import { formatClientReportDate } from "@/lib/client-report-link";
import { AmxButton, AmxCard } from "@/components/admin/mobile/AdminMobileGlass";

export type ClientReportLinkStatus = {
  pdf: { available: boolean; version: number; sentAt: string | null };
  active: { createdAt: string; expiresAt: string; locale: string } | null;
  ttlDays: number;
};

export type AdminClientReportLinkPanelProps = {
  variant: "desktop" | "glass";
  status: ClientReportLinkStatus | null;
  url: string | null;
  busy: null | "load" | "create" | "revoke";
  copied: boolean;
  error: string | null;
  onCreate: () => void;
  onRevoke: () => void;
  onCopy: () => void;
};

/** Prezentācija (bez stāvokļa) - testējama ar SSR. */
export function AdminClientReportLinkPanelView(p: AdminClientReportLinkPanelProps) {
  const glass = p.variant === "glass";
  const txt = glass ? "amx-mut text-[13px]" : "text-[10.5px] text-[var(--color-provin-muted)]";
  const red = glass ? "amx-tx--red text-[13px]" : "text-[10.5px] text-[#d70015]";
  const s = p.status;
  const active = s?.active ?? null;
  const pdfMissing = s != null && !s.pdf.available;

  const btn = (
    label: string,
    onClick: () => void,
    opts: { tone?: "client" | "neutral" | "danger"; disabled?: boolean } = {},
  ) =>
    glass ? (
      <AmxButton
        small
        variant={opts.tone === "danger" ? "danger" : opts.tone === "client" ? "primary" : "secondary"}
        disabled={opts.disabled || p.busy !== null}
        onClick={onClick}
      >
        {label}
      </AmxButton>
    ) : (
      <button
        type="button"
        className={adminProBtn(opts.tone ?? "neutral")}
        disabled={opts.disabled || p.busy !== null}
        onClick={onClick}
      >
        {label}
      </button>
    );

  const body = (
    <div data-client-report-link className="flex min-w-0 flex-col gap-1.5">
      {p.busy === "load" && !s ? <p className={txt}>Ielādē…</p> : null}
      {pdfMissing ? <p className={red}>PDF vēl nav nosūtīts klientam</p> : null}

      {p.url ? (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <input
            readOnly
            value={p.url}
            aria-label="Klienta saite"
            onFocus={(e) => e.currentTarget.select()}
            className={
              glass
                ? "min-w-0 flex-1 rounded-[10px] border border-[var(--amx-line,#e4e7eb)] bg-transparent px-2.5 py-2 font-mono text-[12px]"
                : "min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[10.5px] text-[#1d1d1f]"
            }
          />
          {btn(p.copied ? "Nokopēts" : "Kopēt", p.onCopy, { tone: "client" })}
        </div>
      ) : null}

      {active ? (
        <p className={txt}>
          Aktīva līdz {formatClientReportDate(active.expiresAt)}
          {p.url ? "" : ` · izveidota ${formatClientReportDate(active.createdAt)} (saiti rāda tikai izveidojot)`}
        </p>
      ) : s && !pdfMissing && !p.url ? (
        <p className={txt}>Saite nav izveidota · derīgums {s.ttlDays} dienas</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        {btn(
          p.busy === "create" ? "Veido…" : active ? "Jauna saite" : "Izveidot klienta saiti",
          p.onCreate,
          { tone: active ? "neutral" : "client", disabled: pdfMissing || s == null },
        )}
        {active ? btn(p.busy === "revoke" ? "Atsauc…" : "Atsaukt saiti", p.onRevoke, { tone: "danger" }) : null}
      </div>
      {p.error ? <p className={red}>{p.error}</p> : null}
    </div>
  );

  return glass ? <AmxCard className="mt-2.5 px-3.5 py-3">{body}</AmxCard> : body;
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toStatus(j: Record<string, unknown>): ClientReportLinkStatus | null {
  const pdf = j.pdf as ClientReportLinkStatus["pdf"] | undefined;
  if (!pdf || typeof pdf.available !== "boolean") return null;
  return {
    pdf,
    active: (j.active as ClientReportLinkStatus["active"]) ?? null,
    ttlDays: typeof j.ttlDays === "number" ? j.ttlDays : 30,
  };
}

/**
 * Poga «Klienta saite» → atver paneli (statusu ielādē tikai pēc klikšķa).
 * `variant="glass"` - telefona B1 panelim.
 */
export function AdminClientReportLinkControl({
  sessionId,
  variant = "desktop",
}: {
  sessionId: string;
  variant?: "desktop" | "glass";
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ClientReportLinkStatus | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<AdminClientReportLinkPanelProps["busy"]>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy("load");
    setError(null);
    try {
      const res = await fetch(`/api/admin/client-report-link?sessionId=${encodeURIComponent(sessionId)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const j = await readJson(res);
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : `HTTP ${res.status}`);
      setStatus(toStatus(j));
    } catch (e) {
      setError(`Neizdevās ielādēt: ${e instanceof Error ? e.message : "kļūda"}`);
    } finally {
      setBusy(null);
    }
  }, [sessionId]);

  const post = async (action: "create" | "revoke") => {
    if (action === "revoke" && !window.confirm("Atsaukt klienta saiti? Klients to vairs nevarēs atvērt.")) return;
    setBusy(action);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch("/api/admin/client-report-link", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, action }),
      });
      const j = await readJson(res);
      if (!res.ok) {
        throw new Error(typeof j.message === "string" ? j.message : typeof j.error === "string" ? j.error : `HTTP ${res.status}`);
      }
      setStatus(toStatus(j));
      setUrl(action === "create" && typeof j.url === "string" ? j.url : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kļūda");
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Neizdevās nokopēt - atzīmējiet saiti un kopējiet manuāli.");
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !status) void load();
  };

  return (
    <div className="min-w-0">
      {variant === "glass" ? (
        <AmxButton small icon="doc" onClick={toggle} aria-expanded={open} className="mt-2.5 w-full">
          Klienta saite
        </AmxButton>
      ) : (
        <button type="button" className={adminProBtn("client")} onClick={toggle} aria-expanded={open}>
          Klienta saite
        </button>
      )}
      {open ? (
        <div className={variant === "glass" ? "" : "mt-1.5"}>
          <AdminClientReportLinkPanelView
            variant={variant}
            status={status}
            url={url}
            busy={busy}
            copied={copied}
            error={error}
            onCreate={() => void post("create")}
            onRevoke={() => void post("revoke")}
            onCopy={() => void copy()}
          />
        </div>
      ) : null}
    </div>
  );
}
