"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import type { IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

const fieldClass =
  "min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[16px] text-[var(--color-apple-text)] shadow-sm outline-none transition focus:border-[var(--color-provin-accent)] focus:ring-2 focus:ring-[var(--color-provin-accent)]/25 sm:text-[15px]";

const textareaClass = `${fieldClass} min-h-[100px] resize-y py-2.5 leading-snug`;

function BlockTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 border-l-4 border-[var(--color-provin-accent)] bg-[var(--color-provin-accent-soft)]/50 py-2 pl-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-provin-accent)]">
      {children}
    </h2>
  );
}

function LabeledInput({
  label,
  ...rest
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">{label}</span>
      <input className={fieldClass} {...rest} />
    </label>
  );
}

function LabeledTextarea({
  label,
  ...rest
}: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">{label}</span>
      <textarea className={textareaClass} {...rest} />
    </label>
  );
}

export function IrissPasutijumsEditor({ initialRecord }: { initialRecord: IrissPasutijumsRecord }) {
  const [rec, setRec] = useState<IrissPasutijumsRecord>(initialRecord);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const patch = useCallback(<K extends keyof IrissPasutijumsRecord>(key: K, value: IrissPasutijumsRecord[K]) => {
    setRec((r) => ({ ...r, [key]: value }));
  }, []);

  const save = useCallback(async () => {
    setBusy(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`/api/admin/iriss-pasutijumi/${encodeURIComponent(rec.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rec),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveMsg("Neizdevās saglabāt.");
        return;
      }
      const record =
        typeof data === "object" &&
        data !== null &&
        "record" in data &&
        typeof (data as { record: unknown }).record === "object"
          ? ((data as { record: IrissPasutijumsRecord }).record as IrissPasutijumsRecord)
          : null;
      if (record) setRec(record);
      setSaveMsg("Saglabāts.");
    } catch {
      setSaveMsg("Tīkla kļūda.");
    } finally {
      setBusy(false);
    }
  }, [rec]);

  const openPdf = useCallback(async () => {
    await save();
    try {
      const res = await fetch(`/api/admin/iriss-pasutijumi/${encodeURIComponent(rec.id)}/print`, {
        credentials: "include",
      });
      if (!res.ok) {
        alert("PDF sagataves ģenerēšana neizdevās.");
        return;
      }
      const html = await res.text();
      const w = window.open("", "_blank");
      if (!w) {
        alert("Atļauj uznirstošo logu drukai.");
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
      const schedulePrint = () => {
        try {
          w.document.title = "PASŪTĪJUMS.pdf";
          w.focus();
          w.print();
        } catch {
          /* ignore */
        }
      };
      w.addEventListener("load", () => window.setTimeout(schedulePrint, 400), { once: true });
      window.setTimeout(schedulePrint, 800);
    } catch {
      alert("Tīkla kļūda.");
    }
  }, [rec.id, save]);

  const shellCard = useMemo(
    () => "rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5",
    [],
  );

  return (
    <div className="w-full max-w-none pb-28 sm:pb-8">
      <AdminDashboardHeaderWithMenu>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
              IRISS · PASŪTĪJUMI
            </p>
            <h1 className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
              Pasūtījums
            </h1>
            <p className="mt-1 font-mono text-[10px] text-[var(--color-provin-muted)]">{rec.id}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/iriss/pasutijumi"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-200/90 bg-white px-4 text-[13px] font-medium text-[var(--color-provin-accent)] shadow-sm transition hover:bg-slate-50"
            >
              ← Saraksts
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[var(--color-provin-accent)] px-4 text-[13px] font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
            >
              {busy ? "Saglabā…" : "Saglabāt"}
            </button>
            <button
              type="button"
              onClick={() => void openPdf()}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--color-provin-accent)]/35 bg-[var(--color-provin-accent-soft)]/60 px-4 text-[13px] font-semibold text-[var(--color-provin-accent)] transition hover:bg-[var(--color-provin-accent-soft)]"
            >
              Ģenerēt PDF
            </button>
          </div>
        </div>
        {saveMsg ? (
          <p className="mt-2 text-[12px] font-medium text-[var(--color-provin-muted)]" role="status">
            {saveMsg}
          </p>
        ) : null}
      </AdminDashboardHeaderWithMenu>

      <div className="mt-6 space-y-5">
        <section className={shellCard}>
          <BlockTitle>Klienta dati</BlockTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <LabeledInput
              label="Vārds"
              value={rec.clientFirstName}
              onChange={(e) => patch("clientFirstName", e.target.value)}
              autoComplete="given-name"
            />
            <LabeledInput
              label="Uzvārds"
              value={rec.clientLastName}
              onChange={(e) => patch("clientLastName", e.target.value)}
              autoComplete="family-name"
            />
            <LabeledInput
              label="Tālrunis"
              value={rec.phone}
              onChange={(e) => patch("phone", e.target.value)}
              inputMode="tel"
              autoComplete="tel"
            />
            <LabeledInput
              label="E-pasts"
              value={rec.email}
              onChange={(e) => patch("email", e.target.value)}
              inputMode="email"
              autoComplete="email"
            />
            <LabeledInput
              label="Pasūtījuma datums"
              type="date"
              value={rec.orderDate}
              onChange={(e) => patch("orderDate", e.target.value)}
            />
          </div>
        </section>

        <section className={shellCard}>
          <BlockTitle>Transportlīdzekļa specifikācija</BlockTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <LabeledInput
              label="Marka / modelis"
              value={rec.brandModel}
              onChange={(e) => patch("brandModel", e.target.value)}
            />
            <LabeledInput
              label="Ražošanas gadi"
              value={rec.productionYears}
              onChange={(e) => patch("productionYears", e.target.value)}
              placeholder="piem., 2018–2021"
            />
            <LabeledInput
              label="Kopējais budžets"
              value={rec.totalBudget}
              onChange={(e) => patch("totalBudget", e.target.value)}
            />
            <LabeledInput
              label="Dzinēja tips"
              value={rec.engineType}
              onChange={(e) => patch("engineType", e.target.value)}
            />
            <LabeledInput
              label="Ātrumkārba"
              value={rec.transmission}
              onChange={(e) => patch("transmission", e.target.value)}
            />
            <LabeledInput
              label="Maks. nobraukums"
              value={rec.maxMileage}
              onChange={(e) => patch("maxMileage", e.target.value)}
            />
            <LabeledInput
              label="Vēlamās krāsas"
              value={rec.preferredColors}
              onChange={(e) => patch("preferredColors", e.target.value)}
            />
            <LabeledInput
              label="Nevēlamās krāsas"
              value={rec.nonPreferredColors}
              onChange={(e) => patch("nonPreferredColors", e.target.value)}
            />
            <div className="sm:col-span-2">
              <LabeledInput
                label="Salona apdare"
                value={rec.interiorFinish}
                onChange={(e) => patch("interiorFinish", e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className={shellCard}>
          <BlockTitle>Aprīkojums</BlockTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <LabeledTextarea
              label="Obligātās prasības"
              value={rec.equipmentRequired}
              onChange={(e) => patch("equipmentRequired", e.target.value)}
            />
            <LabeledTextarea
              label="Vēlamās prasības"
              value={rec.equipmentDesired}
              onChange={(e) => patch("equipmentDesired", e.target.value)}
            />
          </div>
        </section>

        <section className={shellCard}>
          <BlockTitle>Piezīmes</BlockTitle>
          <LabeledTextarea label="Piezīmes" value={rec.notes} onChange={(e) => patch("notes", e.target.value)} />
        </section>
      </div>
    </div>
  );
}
