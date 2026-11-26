"use client";

import { useEffect, useState, type ReactNode } from "react";

import { VIN_SCAN_V4_BTN, VIN_SCAN_V4_BTN_DARK, VinScanV4Panel } from "@/components/admin/vin-scan-v4/AdminVinScanV4";

/* ---------------- Apstiprinājums ar summu ---------------- */

export type VinScanV4PaidState = "idle" | "ask" | "load" | "done" | "error";

/**
 * Viena maksas pozīcija: «Ielasīt» -> «Ielasīt X par Y?» -> «Apstiprināt Y». Darbība (`onConfirm`) notiek
 * TIKAI pēc apstiprinājuma klikšķa ar summu.
 */
export function VinScanV4PaidRow({
  id,
  label,
  description,
  price,
  state,
  note,
  onAsk,
  onCancel,
  onConfirm,
  disabled = false,
  actionLabel = "Ielasīt",
}: {
  id: string;
  label: string;
  description: string;
  price: string;
  state: VinScanV4PaidState;
  note?: ReactNode;
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  disabled?: boolean;
  actionLabel?: string;
}) {
  return (
    <div
      className="grid grid-cols-[132px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 border-b border-[#d2d2d7] py-[9px] last:border-b-0 max-sm:grid-cols-[minmax(0,1fr)_auto]"
      data-v4-paid={id}
    >
      <span className="min-w-0 truncate text-[13px] font-[650] text-[#1d1d1f]">{label}</span>
      <p className="min-w-0 text-[12.5px] text-[#86868b] max-sm:col-span-2 max-sm:row-start-2">{description}</p>
      <div className="flex items-center justify-end gap-2.5 whitespace-nowrap">
        {state === "idle" || state === "error" ? (
          <>
            <span className="text-[13px] font-semibold">{price}</span>
            <button type="button" className={VIN_SCAN_V4_BTN} onClick={onAsk} disabled={disabled}>
              {actionLabel}
            </button>
          </>
        ) : state === "ask" ? (
          <span className="text-[13px] font-semibold">{price}</span>
        ) : state === "load" ? (
          <span className="text-[12px] text-[#86868b]">lasa…</span>
        ) : (
          <span className="text-[12px] text-[#86868b]">✓ {price}</span>
        )}
      </div>
      {state === "ask" ? (
        <div className="col-start-2 col-end-[-1] flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-dashed border-[#d2d2d7] pb-0.5 pt-2 max-sm:col-span-2 max-sm:col-start-1">
          <p className="text-[13px]">
            {actionLabel} <b>{label}</b> par <b>{price}</b>?
          </p>
          <div className="flex flex-1 justify-end gap-2">
            <button type="button" className={`${VIN_SCAN_V4_BTN} max-sm:flex-1`} onClick={onCancel}>
              Atcelt
            </button>
            <button type="button" className={`${VIN_SCAN_V4_BTN_DARK} max-sm:flex-1`} onClick={onConfirm} data-v4-paid-confirm={id}>
              Apstiprināt {price}
            </button>
          </div>
        </div>
      ) : null}
      {note ? <div className="col-start-2 col-end-[-1] text-[12.5px] max-sm:col-span-2 max-sm:col-start-1">{note}</div> : null}
    </div>
  );
}

/* ---------------- 6. Maksas pakalpojumi (bez pasūtījuma) ---------------- */

export type VinScanV4PaidService = {
  id: string;
  label: string;
  description: string;
  price: string;
  /** Pirkuma lapa ar VIN; atveras tikai pēc apstiprinājuma. */
  href: string | null;
};

/**
 * «Ātrā pārbaude» (bez pasūtījuma): apstiprinājums atver pakalpojuma pirkuma lapu ar VIN jaunā cilnē -
 * pirkumu pabeidz pakalpojuma lapā. Pasūtījumā (#PR2) to pašu rindu izmanto ar fona pirkumu.
 */
export function VinScanV4PaidServices({ services, title = "Maksas pakalpojumi" }: { services: readonly VinScanV4PaidService[]; title?: string }) {
  const [state, setState] = useState<Record<string, VinScanV4PaidState>>({});
  if (!services.length) return null;
  return (
    <VinScanV4Panel title={title} count={services.length} right="tikai pēc apstiprinājuma" data-v4-block="maksas">
      <div className="grid">
        {services.map((s) => (
          <VinScanV4PaidRow
            key={s.id}
            id={s.id}
            label={s.label}
            description={s.description}
            price={s.price}
            state={state[s.id] ?? "idle"}
            disabled={!s.href}
            onAsk={() => setState((c) => ({ ...c, [s.id]: "ask" }))}
            onCancel={() => setState((c) => ({ ...c, [s.id]: "idle" }))}
            onConfirm={() => {
              if (s.href) window.open(s.href, "_blank", "noopener,noreferrer");
              setState((c) => ({ ...c, [s.id]: "done" }));
            }}
            note={state[s.id] === "done" ? <span className="text-[#86868b]">Atskaites lapa atvērta jaunā cilnē</span> : undefined}
          />
        ))}
      </div>
    </VinScanV4Panel>
  );
}

/* ---------------- 3. solis: CSDD maksas SMS izziņa ---------------- */

export const CSDD_SMS_PRICE = "1,50 €";

type SmsLink = { status: string; href?: string; hrefOther?: string; number?: string; body?: string; plate?: string; verificationCode?: string };

/**
 * CSDD maksas izziņa (1,50 €): «Ielasīt» -> apstiprinājums ar summu -> e.csdd sagatavo SMS (numurs + teksts).
 * SMS sūta un maksā Nils savā telefonā; pēc tam «Ielasīt izziņu» nolasa apmaksāto izziņu.
 */
export function VinScanV4CsddSms({ vin, plate }: { vin: string; plate: string }) {
  const [state, setState] = useState<VinScanV4PaidState>("idle");
  const [sms, setSms] = useState<SmsLink | null>(null);
  const [since, setSince] = useState("");
  const [report, setReport] = useState<{ status: string; rawText?: string } | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    setState("idle");
    setSms(null);
    setReport(null);
    setMsg("");
  }, [vin, plate]);
  const query = plate || vin;

  async function confirm() {
    setState("load");
    setMsg("");
    try {
      const res = await fetch("/api/admin/ecsdd/paid/sms-link", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, login: true }),
      });
      const data = (await res.json().catch(() => null)) as SmsLink | null;
      if (data?.status === "ok") {
        setSms(data);
        setSince(new Date().toISOString());
        setState("done");
        return;
      }
      setState("error");
      setMsg(
        data?.status === "needs_login"
          ? `Gaida e.csdd Smart-ID${data.verificationCode ? ` · kods ${data.verificationCode}` : ""} - pēc apstiprinājuma spied vēlreiz`
          : data?.status === "not_found"
            ? "e.csdd šo auto neatrada"
            : data?.status === "no_button"
              ? "e.csdd nerāda maksas izziņas pogu"
              : "Neizdevās sagatavot SMS",
      );
    } catch {
      setState("error");
      setMsg("Tīkla kļūda");
    }
  }

  async function loadReport() {
    const p = sms?.plate || plate;
    if (!p) return;
    setReport({ status: "__loading" });
    try {
      const res = await fetch("/api/admin/ecsdd/paid/report", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plate: p, since }),
      });
      const data = (await res.json().catch(() => null)) as { status: string; rawText?: string } | null;
      setReport(data ?? { status: "error" });
    } catch {
      setReport({ status: "error" });
    }
  }

  if (!query) return <span className="text-[#b3261e]">Nav numura vai VIN</span>;
  if (state === "idle" || state === "error" || state === "ask") {
    return (
      <span className="grid gap-1.5">
        <span className="flex flex-wrap items-center justify-between gap-2.5">
          <span className="text-[#86868b]">īpašnieku un reģistrācijas vēsture</span>
          {state === "ask" ? (
            <span className="flex items-center gap-2">
              <span className="text-[13px]">
                Ielasīt CSDD izziņu par <b>{CSDD_SMS_PRICE}</b>?
              </span>
              <button type="button" className={VIN_SCAN_V4_BTN} onClick={() => setState("idle")}>
                Atcelt
              </button>
              <button type="button" className={VIN_SCAN_V4_BTN_DARK} onClick={() => void confirm()} data-v4-paid-confirm="csdd_sms">
                Apstiprināt {CSDD_SMS_PRICE}
              </button>
            </span>
          ) : (
            <span className="flex items-center gap-2.5">
              <b className="text-[13px]">{CSDD_SMS_PRICE}</b>
              <button type="button" className={VIN_SCAN_V4_BTN} onClick={() => setState("ask")} data-v4-paid="csdd_sms">
                Ielasīt
              </button>
            </span>
          )}
        </span>
        {msg ? <span className="text-[12.5px] text-[#b3261e]">{msg}</span> : null}
      </span>
    );
  }
  if (state === "load") return <span className="text-[#86868b]">gatavo SMS…</span>;
  return (
    <span className="grid gap-1.5">
      <span className="flex flex-wrap items-center gap-2.5">
        {sms?.href ? (
          <a href={sms.href} className={VIN_SCAN_V4_BTN_DARK}>
            Sūtīt SMS · {CSDD_SMS_PRICE}
          </a>
        ) : null}
        <span className="text-[12px] text-[#86868b]">
          {sms?.number} · «{sms?.body}»
        </span>
        <button type="button" className={VIN_SCAN_V4_BTN} onClick={() => void loadReport()} disabled={report?.status === "__loading"}>
          {report?.status === "__loading" ? "lasa…" : "Ielasīt izziņu"}
        </button>
      </span>
      {report?.status === "found" && report.rawText ? (
        <pre className="max-h-[280px] overflow-auto whitespace-pre-wrap break-words font-[inherit] text-[12.5px] text-[#424245]">{report.rawText}</pre>
      ) : report && report.status !== "__loading" && report.status !== "found" ? (
        <span className="text-[12.5px] text-[#b3261e]">Izziņa vēl nav apmaksāta vai nav atrasta</span>
      ) : null}
    </span>
  );
}
