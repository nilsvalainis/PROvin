"use client";

import { ArrowLeft, FileDown, Paperclip, Phone, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { IrissListingPlatformChipsRow, IrissListingPlatformsFields } from "@/components/admin/IrissListingPlatformsSection";
import type { IrissOfferAttachment, IrissOfferRecord, IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

/** Mobilajā — kvadrātveida FAB (`rounded-xl`); no `sm:` — apaļas pogas ar tekstu. */
const toolbarBtnBase =
  "inline-flex shrink-0 items-center justify-center rounded-xl transition active:scale-95 disabled:opacity-50 " +
  "h-12 w-12 shadow-md hover:opacity-95 " +
  "sm:h-11 sm:min-h-[44px] sm:w-auto sm:rounded-full sm:gap-1.5 sm:px-4 sm:shadow-sm sm:hover:opacity-100 sm:active:scale-100";

const fieldClass =
  "min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[16px] text-[var(--color-apple-text)] shadow-sm outline-none transition focus:border-[var(--color-provin-accent)] focus:ring-2 focus:ring-[var(--color-provin-accent)]/25 sm:text-[15px]";

const textareaClass = `${fieldClass} min-h-[100px] resize-y py-2.5 leading-snug`;

function normalizePhoneForLv(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) {
    const cleaned = `+${trimmed.slice(1).replace(/[^\d]/g, "")}`;
    if (cleaned.startsWith("+371")) return cleaned;
    return cleaned;
  }
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("00371")) return `+${digits.slice(2)}`;
  if (digits.startsWith("371")) return `+${digits}`;
  return `+371${digits}`;
}

/** PDF no API — iOS Safari: slēpts `<a download target="_self">`, nevis `window.open`. */
async function downloadPdfBlobFromResponse(res: Response, fallbackName: string): Promise<void> {
  const cd = res.headers.get("Content-Disposition");
  let name = fallbackName;
  if (cd) {
    const star = /filename\*=UTF-8''([^;\s]+)/i.exec(cd);
    const quoted = /filename="([^"]+)"/i.exec(cd);
    try {
      if (star?.[1]) name = decodeURIComponent(star[1]);
      else if (quoted?.[1]) name = quoted[1];
    } catch {
      /* keep fallback */
    }
  }
  const blob = await res.blob();
  if (blob.size < 32) throw new Error("empty_pdf");
  const objectUrl = URL.createObjectURL(blob);
  const safeName = /\.pdf$/i.test(name) ? name : `${name}.pdf`;
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = safeName;
  a.target = "_self";
  a.rel = "noopener";
  a.hidden = true;
  a.style.cssText = "display:none;position:fixed;left:-9999px;top:0;";
  document.body.appendChild(a);
  try {
    a.click();
  } catch {
    window.location.assign(objectUrl);
  }
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(objectUrl);
  }, 5000);
}

type OfferDraft = {
  id: string;
  title: string;
  brandModel: string;
  year: string;
  mileage: string;
  priceGermany: string;
  comment: string;
  attachments: IrissOfferAttachment[];
  createdAt: string;
};

function newOfferDraft(nextNumber: number): OfferDraft {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: `Piedāvājums ${nextNumber}`,
    brandModel: "",
    year: "",
    mileage: "",
    priceGermany: "",
    comment: "",
    attachments: [],
    createdAt: now,
  };
}

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
  const router = useRouter();
  const [rec, setRec] = useState<IrissPasutijumsRecord>(initialRecord);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerBusy, setOfferBusy] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [offerDraft, setOfferDraft] = useState<OfferDraft>(() => newOfferDraft(1));
  const lastSavedSnapshot = useRef(JSON.stringify(initialRecord));
  const autosaveTimer = useRef<number | null>(null);
  const autosaveInFlight = useRef(false);

  const patch = useCallback(<K extends keyof IrissPasutijumsRecord>(key: K, value: IrissPasutijumsRecord[K]) => {
    setRec((r) => ({ ...r, [key]: value }));
  }, []);

  const patchRecord = useCallback((p: Partial<IrissPasutijumsRecord>) => {
    setRec((r) => ({ ...r, ...p }));
  }, []);

  const save = useCallback(async (opts?: { redirectToList?: boolean; silent?: boolean; payload?: IrissPasutijumsRecord }) => {
    const redirectToList = opts?.redirectToList === true;
    const silent = opts?.silent === true;
    const payload = opts?.payload ?? rec;
    if (!silent) setBusy(true);
    if (!silent) setSaveMsg(null);
    if (silent && autosaveInFlight.current) return false;
    if (silent) autosaveInFlight.current = true;
    try {
      const res = await fetch(`/api/admin/iriss-pasutijumi/${encodeURIComponent(payload.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!silent) setSaveMsg("Neizdevās saglabāt.");
        return false;
      }
      const record =
        typeof data === "object" &&
        data !== null &&
        "record" in data &&
        typeof (data as { record: unknown }).record === "object"
          ? ((data as { record: IrissPasutijumsRecord }).record as IrissPasutijumsRecord)
          : null;
      if (!silent && record) setRec(record);
      lastSavedSnapshot.current = JSON.stringify(record ?? payload);
      if (redirectToList) {
        router.push("/admin/iriss/pasutijumi");
        router.refresh();
        return true;
      }
      if (!silent) setSaveMsg("Saglabāts.");
      return true;
    } catch {
      if (!silent) setSaveMsg("Tīkla kļūda.");
      return false;
    } finally {
      if (!silent) setBusy(false);
      if (silent) autosaveInFlight.current = false;
    }
  }, [rec, router]);

  useEffect(() => {
    const snap = JSON.stringify(rec);
    if (snap === lastSavedSnapshot.current) return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      void save({ silent: true });
    }, 900);
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [rec, save]);

  const openPdf = useCallback(async () => {
    try {
      const ok = await save({ silent: true });
      if (!ok) {
        alert("Saglabāšana neizdevās.");
        return;
      }
      const res = await fetch(`/api/admin/iriss-pasutijumi/${encodeURIComponent(rec.id)}/print`, {
        credentials: "include",
      });
      if (!res.ok) {
        alert("PDF ģenerēšana neizdevās.");
        return;
      }
      await downloadPdfBlobFromResponse(res, "pasutijums.pdf");
    } catch {
      alert("Tīkla kļūda.");
    }
  }, [rec.id, save]);

  const openCreateOffer = useCallback(() => {
    setOfferDraft(newOfferDraft(rec.offers.length + 1));
    setOfferOpen(true);
  }, [rec.offers.length]);

  const openEditOffer = useCallback((offer: IrissOfferRecord) => {
    setOfferDraft({
      id: offer.id,
      title: offer.title,
      brandModel: offer.brandModel,
      year: offer.year,
      mileage: offer.mileage,
      priceGermany: offer.priceGermany,
      comment: offer.comment,
      attachments: offer.attachments,
      createdAt: offer.createdAt || new Date().toISOString(),
    });
    setOfferOpen(true);
  }, []);

  const onOfferFilesPick = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files).slice(0, 6);
    const loaded = await Promise.all(
      fileArr.map(
        (file) =>
          new Promise<IrissOfferAttachment | null>((resolve) => {
            const fr = new FileReader();
            fr.onload = () => {
              const dataUrl = typeof fr.result === "string" ? fr.result : "";
              if (!dataUrl) return resolve(null);
              resolve({
                id: crypto.randomUUID(),
                name: file.name,
                mimeType: file.type || "application/octet-stream",
                size: file.size,
                dataUrl,
              });
            };
            fr.onerror = () => resolve(null);
            fr.readAsDataURL(file);
          }),
      ),
    );
    setOfferDraft((d) => ({ ...d, attachments: [...d.attachments, ...loaded.filter((x): x is IrissOfferAttachment => x !== null)].slice(0, 12) }));
  }, []);

  const persistOffer = useCallback(
    async (withPdf: boolean) => {
      setOfferBusy(true);
      try {
        const now = new Date().toISOString();
        const cleanedTitle = offerDraft.title.trim() || `Piedāvājums ${rec.offers.length + 1}`;
        const offerOut: IrissOfferRecord = {
          id: offerDraft.id,
          title: cleanedTitle,
          brandModel: offerDraft.brandModel,
          year: offerDraft.year,
          mileage: offerDraft.mileage,
          priceGermany: offerDraft.priceGermany,
          comment: offerDraft.comment,
          attachments: offerDraft.attachments,
          createdAt: offerDraft.createdAt || now,
          updatedAt: now,
        };
        const exists = rec.offers.some((o) => o.id === offerOut.id);
        const nextOffers = exists ? rec.offers.map((o) => (o.id === offerOut.id ? offerOut : o)) : [...rec.offers, offerOut];
        const renumbered = nextOffers.map((o, idx) => ({ ...o, title: `Piedāvājums ${idx + 1}` }));
        const nextRec: IrissPasutijumsRecord = { ...rec, offers: renumbered };
        const ok = await save({ payload: nextRec });
        if (!ok) return;
        setOfferOpen(false);

        if (withPdf) {
          try {
            const base = `/api/admin/iriss-pasutijumi/${encodeURIComponent(rec.id)}/offer/${encodeURIComponent(offerOut.id)}/print`;
            let res = await fetch(base, { credentials: "include" });
            if (!res.ok) {
              res = await fetch(`${base}?images=0`, { credentials: "include" });
            }
            if (!res.ok) {
              alert("PDF ģenerēšana neizdevās.");
              return;
            }
            await downloadPdfBlobFromResponse(res, "piedavajums.pdf");
          } catch {
            alert("PDF lejupielāde neizdevās (pārlūks).");
          }
        }
      } finally {
        setOfferBusy(false);
      }
    },
    [offerDraft, rec, save],
  );

  const onConfirmDeleteOrder = useCallback(async () => {
    setDeleteBusy(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`/api/admin/iriss-pasutijumi/${encodeURIComponent(rec.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        setSaveMsg("Dzēšana neizdevās.");
        return;
      }
      setDeleteConfirmOpen(false);
      router.push("/admin/iriss/pasutijumi");
      router.refresh();
    } catch {
      setSaveMsg("Tīkla kļūda.");
    } finally {
      setDeleteBusy(false);
    }
  }, [rec.id, router]);

  const shellCard = useMemo(
    () => "rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5",
    [],
  );

  const normalizedPhone = useMemo(() => normalizePhoneForLv(rec.phone), [rec.phone]);

  const triggerCall = useCallback(() => {
    if (!normalizedPhone) return;
    if (normalizedPhone !== rec.phone.trim()) patch("phone", normalizedPhone);
    window.location.href = `tel:${normalizedPhone}`;
  }, [normalizedPhone, patch, rec.phone]);

  const triggerWhatsapp = useCallback(() => {
    if (!normalizedPhone) return;
    if (normalizedPhone !== rec.phone.trim()) patch("phone", normalizedPhone);
    const digits = normalizedPhone.replace(/[^\d]/g, "");
    if (!digits) return;
    window.open(`https://wa.me/${digits}`, "_blank", "noopener,noreferrer");
  }, [normalizedPhone, patch, rec.phone]);

  const offerIconClass =
    "inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:bg-slate-50";

  return (
    <div className="mx-auto w-full max-w-[1200px] bg-white px-3 pb-28 sm:px-6 sm:pb-8 lg:px-10">
      <AdminDashboardHeaderWithMenu>
        <div className="flex flex-col gap-2">
          <Link
            href="/admin/iriss/pasutijumi"
            title="Atpakaļ"
            aria-label="Atpakaļ"
            className="inline-flex min-h-10 items-center gap-1.5 self-start rounded-full border border-slate-200/90 bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2.3} aria-hidden />
            <span>Atpakaļ</span>
          </Link>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-2">
          <div className="hidden min-w-0 md:block">
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
              IRISS · PASŪTĪJUMI
            </p>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
                Pasūtījums
              </h1>
              {rec.offers.map((offer, idx) => (
                <button
                  key={offer.id}
                  type="button"
                  onClick={() => openEditOffer(offer)}
                  className={offerIconClass}
                  title={offer.title}
                >
                  P{idx + 1}
                </button>
              ))}
            </div>
          </div>
          {rec.offers.length > 0 ? (
            <div className="flex items-center gap-1 md:hidden">
              {rec.offers.map((offer, idx) => (
                <button
                  key={offer.id}
                  type="button"
                  onClick={() => openEditOffer(offer)}
                  className={offerIconClass}
                  title={offer.title}
                >
                  P{idx + 1}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex shrink-0 flex-nowrap items-center justify-end gap-1 sm:flex-wrap sm:gap-2">
            <button
              type="button"
              disabled={busy}
              title="Saglabāt"
              aria-label={busy ? "Saglabā" : "Saglabāt"}
              onClick={() => void save({ redirectToList: true })}
              className={`${toolbarBtnBase} bg-[var(--color-provin-accent)] text-white hover:opacity-95 sm:hover:opacity-95`}
            >
              <Save className="h-6 w-6 shrink-0 sm:h-4 sm:w-4" strokeWidth={2.25} aria-hidden />
              <span className="hidden text-[13px] font-semibold sm:inline">{busy ? "Saglabā…" : "Saglabāt"}</span>
            </button>
            <button
              type="button"
              title="Ģenerēt PDF"
              aria-label="Ģenerēt PDF"
              onClick={() => void openPdf()}
              className={`${toolbarBtnBase} border border-[var(--color-provin-accent)]/35 bg-[var(--color-provin-accent-soft)]/60 text-[var(--color-provin-accent)] hover:bg-[var(--color-provin-accent-soft)] sm:hover:bg-[var(--color-provin-accent-soft)]`}
            >
              <FileDown className="h-6 w-6 shrink-0 sm:h-4 sm:w-4" strokeWidth={2.25} aria-hidden />
              <span className="hidden text-[13px] font-semibold sm:inline">Ģenerēt PDF</span>
            </button>
          </div>
        </div>
        </div>
        {saveMsg ? (
          <p className="mt-2 text-[12px] font-medium text-[var(--color-provin-muted)]" role="status">
            {saveMsg}
          </p>
        ) : null}
      </AdminDashboardHeaderWithMenu>

      <div className="mt-3 space-y-4 sm:mt-4 sm:space-y-5">
        <section className={shellCard}>
          <IrissListingPlatformChipsRow rec={rec} />
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
            <label className="block min-w-0">
              <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Tālrunis</span>
              <div className="flex min-w-0 items-center gap-1.5">
                <input
                  className={`${fieldClass} min-w-0 flex-1`}
                  value={rec.phone}
                  onChange={(e) => patch("phone", e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                />
                <button
                  type="button"
                  onClick={triggerCall}
                  disabled={!normalizedPhone}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-[var(--color-provin-accent)] shadow-sm transition hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-35"
                  title="Zvanīt"
                  aria-label="Zvanīt"
                >
                  <Phone className="h-5 w-5" strokeWidth={2.2} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={triggerWhatsapp}
                  disabled={!normalizedPhone}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200/80 bg-emerald-50 text-emerald-700 shadow-sm transition hover:bg-emerald-100/70 aria-disabled:pointer-events-none aria-disabled:opacity-35"
                  title="Atvērt WhatsApp"
                  aria-label="Atvērt WhatsApp"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
                    <path d="M12.04 2C6.55 2 2.1 6.45 2.1 11.94c0 1.93.55 3.81 1.59 5.43L2 22l4.8-1.61a9.9 9.9 0 0 0 5.24 1.5h.01c5.49 0 9.95-4.45 9.95-9.95A9.96 9.96 0 0 0 12.04 2Zm0 18.1h-.01a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-2.85.95.95-2.78-.19-.29a8.1 8.1 0 0 1-1.25-4.33c0-4.49 3.65-8.14 8.14-8.14a8.1 8.1 0 0 1 5.76 2.38 8.08 8.08 0 0 1 2.38 5.76c0 4.48-3.65 8.13-8.14 8.13Zm4.46-6.06c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.95-1.22a7.34 7.34 0 0 1-1.35-1.67c-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.37.51.58.18 1.11.15 1.53.09.47-.07 1.43-.58 1.63-1.13.2-.56.2-1.04.14-1.13-.06-.1-.22-.16-.46-.28Z" />
                  </svg>
                </button>
              </div>
            </label>
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

        <section className={shellCard}>
          <BlockTitle>Sludinājumu platformas (saites)</BlockTitle>
          <IrissListingPlatformsFields rec={rec} onPatch={patchRecord} />
        </section>

        <section className={shellCard}>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={openCreateOffer}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Izveidot piedāvājumu
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save({ redirectToList: true })}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[var(--color-provin-accent)] px-4 text-[13px] font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
            >
              {busy ? "Saglabā…" : "Saglabāt"}
            </button>
          </div>
        </section>

        <section className={`${shellCard} hidden border-red-200/80 bg-red-50/30 md:block`}>
          <p className="text-[12px] leading-snug text-red-950/90">
            Neatgriezeniski dzēst šo pasūtījumu un visus piedāvājumus. Pirms dzēšanas tiek prasīts apstiprinājums.
          </p>
          <button
            type="button"
            disabled={busy || deleteBusy}
            onClick={() => {
              setOfferOpen(false);
              setDeleteConfirmOpen(true);
            }}
            className="mt-3 inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-full border border-red-300/90 bg-white px-4 text-[13px] font-semibold text-red-800 shadow-sm transition hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden />
            Dzēst pasūtījumu
          </button>
        </section>
      </div>

      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] border-t border-red-200/70 bg-white/95 backdrop-blur-md md:hidden"
        style={{
          paddingBottom: "max(0.65rem, env(safe-area-inset-bottom, 0px))",
          paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
          paddingTop: "0.5rem",
        }}
      >
        <div className="pointer-events-auto mx-auto w-full max-w-[1200px]">
          <button
            type="button"
            disabled={busy || deleteBusy}
            onClick={() => {
              setOfferOpen(false);
              setDeleteConfirmOpen(true);
            }}
            className="inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl border border-red-300/90 bg-red-50 px-4 text-[13px] font-semibold text-red-800 shadow-sm transition active:scale-[0.99] disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden />
            Dzēst pasūtījumu
          </button>
        </div>
      </div>

      {offerOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/45 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
          onClick={() => !offerBusy && setOfferOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-2xl rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xl sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-[var(--color-apple-text)]">{offerDraft.title}</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <LabeledInput
                label="Marka/modelis"
                value={offerDraft.brandModel}
                onChange={(e) => setOfferDraft((d) => ({ ...d, brandModel: e.target.value }))}
              />
              <LabeledInput
                label="Gads"
                value={offerDraft.year}
                onChange={(e) => setOfferDraft((d) => ({ ...d, year: e.target.value }))}
              />
              <LabeledInput
                label="Nobraukums"
                value={offerDraft.mileage}
                onChange={(e) => setOfferDraft((d) => ({ ...d, mileage: e.target.value }))}
              />
              <LabeledInput
                label="Cena Vācijā"
                value={offerDraft.priceGermany}
                onChange={(e) => setOfferDraft((d) => ({ ...d, priceGermany: e.target.value }))}
              />
            </div>
            <div className="mt-3">
              <LabeledTextarea
                label="Komentāri"
                value={offerDraft.comment}
                onChange={(e) => setOfferDraft((d) => ({ ...d, comment: e.target.value }))}
              />
            </div>
            <div className="mt-3 rounded-xl border border-slate-200/90 bg-slate-50/50 p-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:bg-slate-50">
                <Paperclip className="h-4 w-4" aria-hidden />
                Pievienot failus
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void onOfferFilesPick(e.target.files);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
              {offerDraft.attachments.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {offerDraft.attachments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 text-[12px] text-[var(--color-provin-muted)]">
                      <span className="truncate">{a.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setOfferDraft((d) => ({ ...d, attachments: d.attachments.filter((x) => x.id !== a.id) }))
                        }
                        className="rounded-md px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50"
                      >
                        Noņemt
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOfferOpen(false)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-medium text-[var(--color-apple-text)] shadow-sm transition hover:bg-slate-50"
              >
                Atcelt
              </button>
              <button
                type="button"
                disabled={offerBusy}
                onClick={() => void persistOffer(false)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[var(--color-provin-accent)] px-4 text-[13px] font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
              >
                Saglabāt
              </button>
              <button
                type="button"
                disabled={offerBusy}
                onClick={() => void persistOffer(true)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--color-provin-accent)]/35 bg-[var(--color-provin-accent-soft)]/60 px-4 text-[13px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:bg-[var(--color-provin-accent-soft)] disabled:opacity-50"
              >
                Saglabāt + Ģenerēt PDF
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirmOpen ? (
        <div
          className="fixed inset-0 z-[130] flex items-end justify-center bg-black/45 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
          onClick={() => !deleteBusy && setDeleteConfirmOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xl sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-[var(--color-apple-text)]">
              Vai tiešām vēlaties neatgriezeniski dzēst šo pasūtījumu?
            </h2>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deleteBusy}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-medium text-[var(--color-apple-text)] shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                Atcelt
              </button>
              <button
                type="button"
                onClick={() => void onConfirmDeleteOrder()}
                disabled={deleteBusy}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:opacity-50"
              >
                {deleteBusy ? "Dzēš…" : "Dzēst"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
