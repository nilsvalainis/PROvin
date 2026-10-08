"use client";

import { useEffect, useState } from "react";
import type { IrissListingPlatform } from "@/lib/iriss-listings-types";

const PLATFORM_LABEL: Record<IrissListingPlatform, string> = {
  autobid: "Autobid",
  openline: "Openlane",
  auto1: "Auto1",
};

type LoginResponse = {
  ok?: boolean;
  error?: string;
  vncUrl?: string;
  vncReady?: boolean;
  vncError?: string;
  minutes?: number;
  note?: string;
  session?: string;
  testRead?: { status?: string; vehicleCount?: number; note?: string } | null;
};

async function postLogin(platform: IrissListingPlatform, action: "start" | "close" | "verify"): Promise<LoginResponse> {
  const res = await fetch("/api/admin/iriss-listings/login", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ platform, action }),
  });
  const body = (await res.json().catch(() => ({}))) as LoginResponse;
  if (!res.ok && !body.error) body.error = `HTTP ${res.status}`;
  return body;
}

export function IrissListingsLoginButton({
  platform,
  onDone,
}: {
  platform: IrissListingPlatform;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 shrink-0 items-center rounded-full border border-slate-200 bg-white px-3 text-[12px] font-semibold text-[var(--color-provin-accent)] shadow-sm hover:bg-[var(--color-provin-accent)]/8 sm:h-6 sm:px-2 sm:py-0.5 sm:text-[10px]"
      >
        Ielogoties
      </button>
      {open ? <IrissListingsLoginDialog platform={platform} onClose={() => setOpen(false)} onDone={onDone} /> : null}
    </>
  );
}

function IrissListingsLoginDialog({
  platform,
  onClose,
  onDone,
}: {
  platform: IrissListingPlatform;
  onClose: () => void;
  onDone?: () => void;
}) {
  const label = PLATFORM_LABEL[platform];
  const [busy, setBusy] = useState<"start" | "close" | null>("start");
  const [vncUrl, setVncUrl] = useState("");
  const [minutes, setMinutes] = useState(15);
  const [msg, setMsg] = useState("Atveru servera pārlūku...");
  const [ok, setOk] = useState(false);
  const [vncReady, setVncReady] = useState(false);

  async function start() {
    setBusy("start");
    setOk(false);
    setMsg("Atveru servera pārlūku...");
    try {
      const body = await postLogin(platform, "start");
      if (!body.ok) {
        setMsg(body.error || "Ielogošanos neizdevās sākt.");
        setVncReady(false);
        return;
      }
      setVncUrl(body.vncUrl ?? "");
      setVncReady(Boolean(body.vncReady && body.vncUrl));
      setMinutes(body.minutes && body.minutes > 0 ? body.minutes : 15);
      setMsg(
        body.vncReady
          ? body.note || `Ieraksti ${label} paroli un, ja prasa, 2FA kodu. Paroli nesaglabājam.`
          : body.vncError || body.note || "Attālinātais pārlūks nenostrādāja.",
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message.slice(0, 220) : "Tīkla kļūda.");
    } finally {
      setBusy(null);
    }
  }

  async function finish() {
    if (busy) return;
    setBusy("close");
    setMsg("Aizveru pārlūku un pārbaudu sesiju...");
    try {
      const body = await postLogin(platform, "close");
      if (body.ok && body.session === "ok") {
        setOk(true);
        setMsg(body.note || `${label} sesija ir kārtībā.`);
        onDone?.();
        return;
      }
      setOk(false);
      setMsg(body.note || body.error || `${label} sesija vēl nav aktīva. Ielogojies un spied Gatavs vēlreiz.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message.slice(0, 220) : "Tīkla kļūda.");
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    if (busy === "close") return;
    setBusy("close");
    try {
      await postLogin(platform, "close");
    } catch {
      /* aizvēršana nav kritiska */
    } finally {
      setBusy(null);
      onClose();
    }
  }

  useEffect(() => {
    void start();
    // tikai atverot dialogu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);

  return (
    <div
      className="fixed inset-0 z-[140] flex items-end justify-center bg-black/45 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
      onClick={() => {
        if (!busy) void cancel();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="iriss-login-title"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#E5E7EB] px-4 py-3">
          <div>
            <h2 id="iriss-login-title" className="text-[15px] font-semibold text-[var(--color-apple-text)]">
              Ielogoties {label}
            </h2>
            <p className="mt-1 max-w-3xl text-[12px] leading-5 text-[var(--color-provin-muted)]">
              Zemāk ir servera pārlūks (ne tavs). Ieraksti paroli un, ja prasa, e-pasta vai 2FA kodu pats. Paroli
              nesaglabājam - paliek tikai ielogotā sesija. Kad esi iekšā, spied Gatavs. Logs aizveras pēc {minutes} min.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void cancel()}
            disabled={busy === "close"}
            className="inline-flex h-11 items-center rounded-full px-3 text-[12px] font-medium text-slate-500 hover:bg-slate-50 sm:h-8"
          >
            Aizvērt
          </button>
        </div>

        <div className="min-h-0 flex-1 bg-slate-950">
          {vncReady && vncUrl ? (
            <iframe
              src={vncUrl}
              title={`${label} attālinātais pārlūks`}
              className="h-[min(62vh,640px)] w-full border-0 bg-black"
              allow="clipboard-read; clipboard-write"
            />
          ) : (
            <div className="flex h-[min(36vh,320px)] flex-col items-center justify-center gap-2 px-6 text-center text-[13px] text-slate-300">
              <p>{busy === "start" ? "Atveru pārlūku..." : msg}</p>
              {!busy && !vncReady ? (
                <p className="max-w-lg text-[12px] text-slate-400">
                  Ja logs neatveras, uz Hetzner jāatjaunina relejs (rsync + restart). Vecais SSH tunelis uz noVNC paliek kā rezerve.
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-[#E5E7EB] px-4 py-3">
          <p className={`text-[12px] ${ok ? "text-emerald-800" : "text-[var(--color-provin-muted)]"}`}>{msg}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void finish()}
              disabled={Boolean(busy)}
              className="inline-flex min-h-11 items-center rounded-full border border-[var(--color-provin-accent)] bg-[var(--color-provin-accent)] px-4 text-[12px] font-semibold text-white shadow-sm disabled:opacity-55 sm:min-h-10"
            >
              {busy === "close" ? "Pārbauda..." : "Gatavs"}
            </button>
            <button
              type="button"
              onClick={() => void cancel()}
              disabled={busy === "close"}
              className="inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-700 shadow-sm disabled:opacity-55 sm:min-h-10"
            >
              Atcelt
            </button>
            {vncUrl ? (
              <a
                href={vncUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] font-medium text-[var(--color-provin-accent)] hover:underline"
              >
                Atvērt jaunā cilnē
              </a>
            ) : null}
            {ok ? (
              <button type="button" onClick={onClose} className="ml-auto text-[12px] font-medium text-emerald-800 hover:underline">
                Aizvērt
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
