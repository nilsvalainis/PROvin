"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminDealerMajorWorksEditor } from "@/components/admin/AdminDealerMajorWorksEditor";
import type { DealerCheckDelivery, DealerCheckRecord } from "@/lib/dealer-check";
import type { DealerMajorWorkOverride } from "@/lib/dealer-major-works-override-persist";
import {
  dealerCheckDealerFacts,
  DEALER_CHECK_DELIVER_PATH,
  dealerCheckDeliveryErrorLv,
  dealerCheckDeliveryLine,
  dealerCheckServerPdfHref,
} from "@/lib/dealer-check-delivery";

const btnGray =
  "flex-1 rounded-[10px] bg-[#f2f2f7] px-4 py-2.5 text-[13.5px] font-semibold text-[#111] disabled:opacity-45 sm:flex-none";
const btnBlue =
  "flex-1 rounded-[10px] bg-[#2563EB] px-4 py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-45 sm:flex-none";
const field =
  "w-full min-w-0 rounded-[10px] border border-[#d1d1d6] bg-white px-3 py-[10px] text-[14px] text-[#111] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/25";

type Info = {
  autoparks: { carId: string; title: string } | null;
  email: { subject: string; text: string };
  smtp: boolean;
  deliveries: DealerCheckDelivery[];
};

type EmailStep = "closed" | "edit" | "confirm";

export function AdminDealerCheckDelivery({
  record,
  onOverridesChange,
  beforePdf,
  busy,
}: {
  record: DealerCheckRecord;
  onOverridesChange: (next: DealerMajorWorkOverride[]) => Promise<void>;
  /** Pirms servera PDF: saglabā nesaglabātos komentārus. */
  beforePdf: () => Promise<boolean>;
  busy: boolean;
}) {
  const facts = useMemo(() => dealerCheckDealerFacts(record), [record]);
  const [overrides, setOverrides] = useState<DealerMajorWorkOverride[]>(record.dealerMajorWorkOverrides ?? []);
  const [info, setInfo] = useState<Info | null>(null);
  const [working, setWorking] = useState<"" | "autoparks" | "email" | "pdf">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [step, setStep] = useState<EmailStep>("closed");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    setOverrides(record.dealerMajorWorkOverrides ?? []);
  }, [record.id, record.dealerMajorWorkOverrides]);

  useEffect(() => {
    let alive = true;
    setInfo(null);
    setStep("closed");
    setError("");
    setNotice("");
    void (async () => {
      try {
        const res = await fetch(`${DEALER_CHECK_DELIVER_PATH}?id=${encodeURIComponent(record.id)}`, { credentials: "include" });
        const body = (await res.json().catch(() => null)) as (Info & { ok?: boolean }) | null;
        if (!alive || !res.ok || !body?.ok) return;
        setInfo(body);
        setSubject(body.email.subject);
        setText(body.email.text);
      } catch {
        /* piegādes bloks paliek bez Autoparka pārbaudes */
      }
    })();
    return () => {
      alive = false;
    };
  }, [record.id]);

  const locked = busy || working !== "";

  async function changeOverrides(next: DealerMajorWorkOverride[]) {
    setOverrides(next);
    await onOverridesChange(next);
  }

  async function openPdf() {
    setError("");
    const w = window.open("", "_blank");
    setWorking("pdf");
    try {
      if (!(await beforePdf())) {
        w?.close();
        return;
      }
      const href = dealerCheckServerPdfHref(record.id);
      if (w) w.location.href = href;
      else window.location.href = href;
    } finally {
      setWorking("");
    }
  }

  async function post(payload: Record<string, unknown>) {
    const res = await fetch(DEALER_CHECK_DELIVER_PATH, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: record.id, ...payload }),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { res, body };
  }

  async function toAutoparks() {
    if (!info?.autoparks) return;
    setError("");
    setNotice("");
    setWorking("autoparks");
    try {
      if (!(await beforePdf())) return;
      const { res, body } = await post({ action: "autoparks" });
      if (!res.ok) {
        setError(dealerCheckDeliveryErrorLv(String(body.error ?? "")));
        return;
      }
      const result = body.result as { dropboxVerified?: boolean; dropboxError?: string; car?: { title?: string } } | undefined;
      if (Array.isArray(body.deliveries)) setInfo((cur) => (cur ? { ...cur, deliveries: body.deliveries as DealerCheckDelivery[] } : cur));
      if (result?.dropboxVerified) setNotice(`PDF ielikts Autoparkā un STOCK: ${result.car?.title ?? ""}`);
      else setError(`PDF ielikts Autoparka dokumentos. ${dealerCheckDeliveryErrorLv(result?.dropboxError ?? "upload_failed")}`);
    } catch {
      setError(dealerCheckDeliveryErrorLv(""));
    } finally {
      setWorking("");
    }
  }

  async function sendEmail() {
    setError("");
    setNotice("");
    setWorking("email");
    try {
      if (!(await beforePdf())) return;
      const { res, body } = await post({ action: "email", to, subject, text, confirmed: true });
      if (!res.ok) {
        setError(dealerCheckDeliveryErrorLv(String(body.error ?? "")));
        return;
      }
      if (Array.isArray(body.deliveries)) setInfo((cur) => (cur ? { ...cur, deliveries: body.deliveries as DealerCheckDelivery[] } : cur));
      setNotice(`Nosūtīts: ${String(body.to ?? to)}`);
      setStep("closed");
      setTo("");
    } catch {
      setError(dealerCheckDeliveryErrorLv(""));
    } finally {
      setWorking("");
    }
  }

  const deliveries = info?.deliveries ?? record.deliveries ?? [];

  return (
    <section className="mb-3.5 rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-5" data-dealer-check-delivery>
      <h2 className="mb-1 text-[12px] font-semibold uppercase tracking-[0.5px] text-[#3a3a3c]">PDF un piegāde</h2>
      <AdminDealerMajorWorksEditor
        facts={facts}
        overrides={overrides}
        onChange={(next) => void changeOverrides(next)}
        disabled={locked}
      />

      <div className="mt-3.5 flex flex-wrap gap-2">
        <button type="button" onClick={() => void openPdf()} disabled={locked} className={btnBlue} data-dealer-check-server-pdf>
          {working === "pdf" ? "Gatavo…" : "PDF"}
        </button>
        <button
          type="button"
          onClick={() => void toAutoparks()}
          disabled={locked || !info?.autoparks}
          className={btnGray}
          data-dealer-check-to-autoparks
        >
          {working === "autoparks" ? "Liek…" : "Uz Autoparku + STOCK"}
        </button>
        <button
          type="button"
          onClick={() => setStep(step === "closed" ? "edit" : "closed")}
          disabled={locked || info?.smtp === false}
          className={btnGray}
          data-dealer-check-email
        >
          Sūtīt e-pastā
        </button>
      </div>
      {info && !info.autoparks ? (
        <p className="mt-2 text-[12.5px] text-[#d70015]" data-dealer-check-not-in-autoparks>
          Auto ar šo VIN nav Autoparkā - tikai e-pasts.
        </p>
      ) : null}
      {info?.autoparks ? <p className="mt-2 text-[12.5px] text-[#6e6e73]">Autoparks: {info.autoparks.title}</p> : null}
      {info?.smtp === false ? <p className="mt-2 text-[12.5px] text-[#d70015]">Serverī nav SMTP.</p> : null}

      {step === "edit" ? (
        <div className="mt-3.5 space-y-2.5 rounded-xl border border-[#e5e5ea] bg-[#fafafa] p-3">
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-semibold text-[#6e6e73]">Adrese</span>
            <input
              className={field}
              type="email"
              inputMode="email"
              autoComplete="off"
              value={to}
              onChange={(e) => setTo(e.target.value.trim())}
              placeholder="vards@example.com"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-semibold text-[#6e6e73]">Temats</span>
            <input className={field} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-semibold text-[#6e6e73]">Teksts</span>
            <textarea className={`${field} min-h-[120px]`} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnBlue}
              disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !subject.trim() || !text.trim()}
              onClick={() => setStep("confirm")}
            >
              Tālāk
            </button>
            <button type="button" className={btnGray} onClick={() => setStep("closed")}>
              Atcelt
            </button>
          </div>
        </div>
      ) : null}

      {step === "confirm" ? (
        <div className="mt-3.5 space-y-2.5 rounded-xl border border-[#2563EB]/40 bg-[#f3f7ff] p-3" data-dealer-check-email-confirm>
          <p className="text-[13px] text-[#111]">
            Kam: <b className="break-all">{to}</b>
          </p>
          <p className="text-[13px] text-[#111]">
            No: <b>{record.template === "dzintarzeme" ? "Nils Valainis · " : ""}info@provin.lv</b>
          </p>
          <p className="text-[13px] font-semibold text-[#111]">{subject}</p>
          <pre className="whitespace-pre-wrap rounded-lg border border-[#e5e5ea] bg-white p-2.5 font-sans text-[13px] leading-[1.5] text-[#3a3a3c]">
            {text}
          </pre>
          <p className="text-[13px]">
            <a href={dealerCheckServerPdfHref(record.id)} target="_blank" rel="noreferrer" className="font-semibold text-[#2563EB] underline">
              Pielikums: PDF
            </a>
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnBlue} disabled={locked} onClick={() => void sendEmail()} data-dealer-check-email-send>
              {working === "email" ? "Sūta…" : "Sūtīt"}
            </button>
            <button type="button" className={btnGray} disabled={locked} onClick={() => setStep("edit")}>
              Atpakaļ
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl border border-[#f3c2c7] bg-[#fff5f5] px-3.5 py-2.5 text-[13px] text-[#d70015]" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-3 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3.5 py-2.5 text-[13px] text-[#166534]">{notice}</p>
      ) : null}

      {deliveries.length > 0 ? (
        <ul className="mt-3 space-y-1 text-[12.5px] text-[#6e6e73]">
          {deliveries.slice(0, 5).map((d, i) => (
            <li key={`${d.at}-${i}`}>{dealerCheckDeliveryLine(d)}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
