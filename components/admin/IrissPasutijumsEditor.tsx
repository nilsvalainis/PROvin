"use client";

import { FileDown, Home, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

type DeleteDialog = "closed" | "step1" | "step2";

export function IrissPasutijumsEditor({ initialRecord }: { initialRecord: IrissPasutijumsRecord }) {
  const router = useRouter();
  const [rec, setRec] = useState<IrissPasutijumsRecord>(initialRecord);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialog>("closed");
  const [deleteBusy, setDeleteBusy] = useState(false);

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
    /** Jāatver tūlīt pēc klikšķa (pirms `await`), citādi mobilie pārlūki bloķē `window.open` un prasa uznirstošo logu. */
    const w = window.open("", "_blank");
    if (!w) {
      alert("Neizdevās atvērt drukas logu. Pārlūka iestatījumos atļauj uznirstošos logus šai vietnei.");
      return;
    }
    try {
      await save();
      const res = await fetch(`/api/admin/iriss-pasutijumi/${encodeURIComponent(rec.id)}/print`, {
        credentials: "include",
      });
      if (!res.ok) {
        w.close();
        alert("PDF sagataves ģenerēšana neizdevās.");
        return;
      }
      const html = await res.text();
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
      w.close();
      alert("Tīkla kļūda.");
    }
  }, [rec.id, save]);

  const runDelete = useCallback(async () => {
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/admin/iriss-pasutijumi/${encodeURIComponent(rec.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        setSaveMsg("Neizdevās dzēst.");
        setDeleteDialog("closed");
        return;
      }
      setDeleteDialog("closed");
      router.push("/admin/iriss/pasutijumi");
      router.refresh();
    } catch {
      setSaveMsg("Tīkla kļūda.");
      setDeleteDialog("closed");
    } finally {
      setDeleteBusy(false);
    }
  }, [rec.id, router]);

  const shellCard = useMemo(
    () => "rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5",
    [],
  );

  return (
    <div className="w-full max-w-none pb-28 sm:pb-8">
      <AdminDashboardHeaderWithMenu>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-2">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
              IRISS · PASŪTĪJUMI
            </p>
            <h1 className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
              Pasūtījums
            </h1>
          </div>
          <div className="flex shrink-0 flex-nowrap items-center justify-end gap-1 sm:flex-wrap sm:gap-2">
            <Link
              href="/admin/iriss/pasutijumi"
              title="Sākums"
              aria-label="Sākums"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200/90 bg-white text-[var(--color-provin-accent)] shadow-sm transition hover:bg-slate-50 sm:h-11 sm:min-h-[44px] sm:w-auto sm:gap-1.5 sm:px-4"
            >
              <Home className="h-[15px] w-[15px] shrink-0 sm:h-4 sm:w-4" strokeWidth={2.25} aria-hidden />
              <span className="hidden text-[13px] font-medium sm:inline">Sākums</span>
            </Link>
            <button
              type="button"
              disabled={busy}
              title="Saglabāt"
              aria-label={busy ? "Saglabā" : "Saglabāt"}
              onClick={() => void save()}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-provin-accent)] text-white shadow-sm transition hover:opacity-95 disabled:opacity-50 sm:h-11 sm:min-h-[44px] sm:w-auto sm:gap-1.5 sm:px-4"
            >
              <Save className="h-[15px] w-[15px] shrink-0 sm:h-4 sm:w-4" strokeWidth={2.25} aria-hidden />
              <span className="hidden text-[13px] font-semibold sm:inline">{busy ? "Saglabā…" : "Saglabāt"}</span>
            </button>
            <button
              type="button"
              title="Ģenerēt PDF"
              aria-label="Ģenerēt PDF"
              onClick={() => void openPdf()}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-provin-accent)]/35 bg-[var(--color-provin-accent-soft)]/60 text-[var(--color-provin-accent)] shadow-sm transition hover:bg-[var(--color-provin-accent-soft)] sm:h-11 sm:min-h-[44px] sm:w-auto sm:gap-1.5 sm:px-4"
            >
              <FileDown className="h-[15px] w-[15px] shrink-0 sm:h-4 sm:w-4" strokeWidth={2.25} aria-hidden />
              <span className="hidden text-[13px] font-semibold sm:inline">Ģenerēt PDF</span>
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

        <section className={`${shellCard} border-red-200/50 bg-red-50/20`}>
          <p className="mb-3 text-[12px] leading-relaxed text-red-950/85">
            Neatgriezeniski dzēš pasūtījumu no melnraksta. Pirms dzēšanas tiks prasīts atkārtots apstiprinājums.
          </p>
          <button
            type="button"
            onClick={() => setDeleteDialog("step1")}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-red-300/90 bg-white px-4 text-[13px] font-semibold text-red-800 shadow-sm transition hover:bg-red-50"
          >
            Dzēst pasūtījumu
          </button>
        </section>
      </div>

      {deleteDialog !== "closed" ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
          role="presentation"
          onClick={() => !deleteBusy && setDeleteDialog("closed")}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="iriss-delete-dialog-title"
            className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xl sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {deleteDialog === "step1" ? (
              <>
                <h2 id="iriss-delete-dialog-title" className="text-base font-semibold text-[var(--color-apple-text)]">
                  Dzēst pasūtījumu?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-provin-muted)]">
                  Vai tiešām vēlaties dzēst šo pasūtījumu? Nākamajā solī būs jāapstiprina vēlreiz — dzēšanu nevar atsaukt.
                </p>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    disabled={deleteBusy}
                    onClick={() => setDeleteDialog("closed")}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-medium text-[var(--color-apple-text)] shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Atcelt
                  </button>
                  <button
                    type="button"
                    disabled={deleteBusy}
                    onClick={() => setDeleteDialog("step2")}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-slate-800 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
                  >
                    Jā, turpināt
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="iriss-delete-dialog-title" className="text-base font-semibold text-red-950">
                  Pēdējais apstiprinājums
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-red-900/90">
                  Vai tiešām dzēst? Ieraksts pazudīs no saraksta un glabātavas neatgriezeniski.
                </p>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    disabled={deleteBusy}
                    onClick={() => setDeleteDialog("closed")}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-medium text-[var(--color-apple-text)] shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Atcelt
                  </button>
                  <button
                    type="button"
                    disabled={deleteBusy}
                    onClick={() => void runDelete()}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:opacity-50"
                  >
                    {deleteBusy ? "Dzēš…" : "Dzēst neatgriezeniski"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
