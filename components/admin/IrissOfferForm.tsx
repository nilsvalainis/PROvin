"use client";

/**
 * Piedāvājuma forma (dialogs). Viena forma visām ieejām: Pasūtījumi, Loģistika, Autoparks, klienta kabinets.
 * Stāvokli (melnrakstu, saglabāšanu, PDF) tur izsaucējs; forma tikai rāda un ziņo izmaiņas.
 */

import { Loader2, Paperclip, X } from "lucide-react";
import type React from "react";
import { useMemo } from "react";
import { AdminAiPolishRichCommentShell } from "@/components/admin/AdminAiPolishRichCommentShell";
import { AdminSaveButton } from "@/components/admin/AdminSaveButton";
import { IrissOfferBlocksEditor } from "@/components/admin/IrissOfferBlocksEditor";
import { IrissOfferFieldTag } from "@/components/admin/IrissOfferFieldTag";
import { IrissLabeledInput as LabeledInput, irissOfferFieldClass as fieldClass } from "@/components/admin/IrissOfferFormFields";
import { IrissOfferImageSorter } from "@/components/admin/IrissOfferImageSorter";
import { IrissSectionHeading } from "@/components/admin/IrissSectionHeading";
import { offerDraftTotalPrice, type OfferDraft } from "@/lib/iriss-offer-draft";
import { isIrissOfferExpired, normalizeOfferValidUntil } from "@/lib/iriss-offer-valid-until";
import { IRISS_MAX_OFFER_ATTACHMENTS } from "@/lib/iriss-pasutijumi-types";
import { irissPriceFormatWarning } from "@/lib/iriss-price-format";
import { irissVinWarning } from "@/lib/iriss-vin-check";

const offerDialogMainBtnClass =
  "inline-flex min-h-[44px] min-w-[116px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-[var(--color-apple-text)] shadow-sm transition hover:bg-slate-50 disabled:opacity-50";

function WhatsAppGlyphIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12.04 2C6.55 2 2.1 6.45 2.1 11.94c0 1.93.55 3.81 1.59 5.43L2 22l4.8-1.61a9.9 9.9 0 0 0 5.24 1.5h.01c5.49 0 9.95-4.45 9.95-9.95A9.96 9.96 0 0 0 12.04 2Zm0 18.1h-.01a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-2.85.95.95-2.78-.19-.29a8.1 8.1 0 0 1-1.25-4.33c0-4.49 3.65-8.14 8.14-8.14a8.1 8.1 0 0 1 5.76 2.38 8.08 8.08 0 0 1 2.38 5.76c0 4.48-3.65 8.13-8.14 8.13Zm4.46-6.06c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.95-1.22a7.34 7.34 0 0 1-1.35-1.67c-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.37.51.58.18 1.11.15 1.53.09.47-.07 1.43-.58 1.63-1.13.2-.56.2-1.04.14-1.13-.06-.1-.22-.16-.46-.28Z"
      />
    </svg>
  );
}

function LabeledOfferRichCommentField({
  label,
  value,
  onHtmlChange,
}: {
  label: string;
  value: string;
  onHtmlChange: (html: string) => void;
}) {
  return (
    <div className="block min-w-0">
      <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">{label}</span>
      <AdminAiPolishRichCommentShell
        compact
        toolbar="simple"
        value={value}
        onChange={onHtmlChange}
        aria-label={label}
      />
    </div>
  );
}

export type IrissOfferFormProps = {
  draft: OfferDraft;
  setDraft: React.Dispatch<React.SetStateAction<OfferDraft>>;
  autoFields: ReadonlySet<string>;
  busy: boolean;
  filePrepare: { pct: number; label: string } | null;
  deleteBusy: boolean;
  pdfBusy: boolean;
  whatsappBusy: boolean;
  readyForPdfActions: boolean;
  shareWhatsAppEnabled: boolean;
  saveState: React.ComponentProps<typeof AdminSaveButton>["state"];
  pdfNotice: string | null;
  pdfAllowWithoutImages: boolean;
  onClose: () => void;
  onDelete: () => void;
  onSave: () => void;
  onPdf: (allowWithoutImages?: boolean) => void;
  onWhatsApp: () => void;
  onFilesPick: (files: FileList | null) => void;
};

export function IrissOfferForm({
  draft,
  setDraft,
  autoFields,
  busy,
  filePrepare,
  deleteBusy,
  pdfBusy,
  whatsappBusy,
  readyForPdfActions,
  shareWhatsAppEnabled,
  saveState,
  pdfNotice,
  pdfAllowWithoutImages,
  onClose,
  onDelete,
  onSave,
  onPdf,
  onWhatsApp,
  onFilesPick,
}: IrissOfferFormProps) {
  const vinWarning = useMemo(() => irissVinWarning(draft.vin), [draft.vin]);
  const carPriceWarning = useMemo(() => irissPriceFormatWarning(draft.carPrice), [draft.carPrice]);
  const deliveryPriceWarning = useMemo(() => irissPriceFormatWarning(draft.deliveryPrice), [draft.deliveryPrice]);
  const commissionWarning = useMemo(() => irissPriceFormatWarning(draft.commissionFee), [draft.commissionFee]);
  const totalPrice = useMemo(() => offerDraftTotalPrice(draft), [draft]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center overscroll-y-contain bg-black/45 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
      onClick={() => !busy && !filePrepare && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="iriss-offer-dialog-title"
        data-iriss-order-room="1"
        className="flex max-h-[min(92dvh,920px)] w-full max-w-6xl flex-col overflow-hidden rounded-[22px] border border-[#e5e7eb] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1 pr-2">
            <h2
              id="iriss-offer-dialog-title"
              className="truncate text-base font-semibold text-[var(--color-apple-text)]"
            >
              {draft.title}
            </h2>
            {autoFields.size > 0 ? (
              <p className="mt-0.5 text-[11px] text-[var(--color-provin-muted)]">Sagatavots no izsoles ieraksta</p>
            ) : null}
            {isIrissOfferExpired(draft) ? (
              <p className="mt-0.5 text-[12px] font-semibold text-red-700">Piedāvājums beidzies</p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={busy || !!filePrepare}
            aria-label="Aizvērt"
            title="Aizvērt"
            onClick={() => onClose()}
            className="inline-flex h-10 min-h-10 w-10 min-w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[var(--color-apple-text)] shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <X className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 [-webkit-overflow-scrolling:touch] pb-4 pt-3 sm:px-5 sm:pb-5 sm:pt-4">
          <div className="grid min-w-0 grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,1fr)]">
          <div className="min-w-0 space-y-3">
          <div className="rounded-xl border border-slate-200/90 bg-white p-3">
            <IrissSectionHeading>Transportlīdzeklis</IrissSectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ["brandModel", "Marka, modelis", (v: string) => ({ brandModel: v })],
                  ["vin", "VIN", (v: string) => ({ vin: v.toUpperCase() })],
                  ["firstRegistration", "Pirmā reģistrācija", (v: string) => ({ firstRegistration: v, year: v })],
                  ["odometerReading", "Nobraukums", (v: string) => ({ odometerReading: v, mileage: v })],
                  ["fuel", "Degviela", (v: string) => ({ fuel: v })],
                  ["transmission", "Ātrumkārba", (v: string) => ({ transmission: v })],
                  ["driveType", "Piedziņa", (v: string) => ({ driveType: v })],
                  ["powerKw", "Jauda", (v: string) => ({ powerKw: v })],
                  ["engineDisplacement", "Dzinēja tilpums", (v: string) => ({ engineDisplacement: v })],
                  ["bodyTypeOffer", "Virsbūve", (v: string) => ({ bodyTypeOffer: v })],
                  ["color", "Krāsa", (v: string) => ({ color: v })],
                  ["doorCount", "Durvis / vietas", (v: string) => ({ doorCount: v })],
                  ["emissionClass", "Emisijas klase", (v: string) => ({ emissionClass: v })],
                  ["originCountry", "Izcelsmes valsts", (v: string) => ({ originCountry: v })],
                  ["location", "Atrašanās vieta", (v: string) => ({ location: v })],
                ] as const
              ).map(([key, label, patch]) => (
                <label key={key} className="block min-w-0">
                  <span className="mb-1 flex items-center text-[11px] font-medium text-[var(--color-provin-muted)]">
                    {label}
                    <IrissOfferFieldTag source={autoFields.has(key) ? "auto" : "manual"} />
                  </span>
                  <input
                    className={fieldClass}
                    value={draft[key]}
                    onChange={(e) => setDraft((d) => ({ ...d, ...patch(e.target.value) }))}
                    autoComplete="off"
                  />
                  {key === "vin" && vinWarning ? (
                    <p className="mt-1 text-[11px] text-amber-800">{vinWarning}</p>
                  ) : null}
                </label>
              ))}
            </div>
            <IrissSectionHeading className="mt-4">Izsole</IrissSectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(
                [
                  ["auctionPlatform", "Platforma", (v: string) => ({ auctionPlatform: v })],
                  ["auctionStockNumber", "Lot / stock nr.", (v: string) => ({ auctionStockNumber: v })],
                  ["auctionEndAt", "Izsoles beigas", (v: string) => ({ auctionEndAt: v })],
                  ["vatStatus", "PVN statuss", (v: string) => ({ vatStatus: v })],
                  ["carPrice", "Izsoles cena", (v: string) => ({ carPrice: v, priceGermany: v })],
                  ["estimatedTotalPrice", "Aplēstā kopsumma", (v: string) => ({ estimatedTotalPrice: v })],
                ] as const
              ).map(([key, label, patch]) => (
                <label key={key} className="block min-w-0">
                  <span className="mb-1 flex items-center text-[11px] font-medium text-[var(--color-provin-muted)]">
                    {label}
                    <IrissOfferFieldTag source={autoFields.has(key) ? "auto" : "manual"} />
                  </span>
                  <input
                    className={fieldClass}
                    value={draft[key]}
                    onChange={(e) => setDraft((d) => ({ ...d, ...patch(e.target.value) }))}
                    autoComplete="off"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-slate-200/90 bg-white p-3">
            <IrissSectionHeading>Novērtējums klientam</IrissSectionHeading>
            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <LabeledInput
                label="Bojājumu pakāpe"
                value={draft.damageGrade}
                onChange={(e) => setDraft((d) => ({ ...d, damageGrade: e.target.value }))}
              />
              <LabeledInput
                label="Atslēgu skaits"
                value={draft.keyCount}
                onChange={(e) => setDraft((d) => ({ ...d, keyCount: e.target.value }))}
              />
              <div className="sm:col-span-2">
                <LabeledInput
                  label="Aprīkojuma izcēlumi"
                  value={draft.equipmentHighlights}
                  onChange={(e) => setDraft((d) => ({ ...d, equipmentHighlights: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <label className="inline-flex items-center gap-2 text-[12px] text-[var(--color-apple-text)]">
                <input
                  type="checkbox"
                  checked={draft.hasFullServiceHistory}
                  onChange={(e) => setDraft((d) => ({ ...d, hasFullServiceHistory: e.target.checked }))}
                />
                Pilna servisa vēsture
              </label>
              <label className="inline-flex items-center gap-2 text-[12px] text-[var(--color-apple-text)]">
                <input
                  type="checkbox"
                  checked={draft.hasFactoryPaint}
                  onChange={(e) => setDraft((d) => ({ ...d, hasFactoryPaint: e.target.checked }))}
                />
                Rūpnīcas krāsojums
              </label>
              <label className="inline-flex items-center gap-2 text-[12px] text-[var(--color-apple-text)]">
                <input
                  type="checkbox"
                  checked={draft.hasNoRustBody}
                  onChange={(e) => setDraft((d) => ({ ...d, hasNoRustBody: e.target.checked }))}
                />
                Virsbūve bez rūsas
              </label>
              <label className="inline-flex items-center gap-2 text-[12px] text-[var(--color-apple-text)]">
                <input
                  type="checkbox"
                  checked={draft.hasSecondWheelSet}
                  onChange={(e) => setDraft((d) => ({ ...d, hasSecondWheelSet: e.target.checked }))}
                />
                Otrs riteņu komplekts
              </label>
            </div>
            <div className="mt-3">
              <LabeledOfferRichCommentField
                label="Īpašas atzīmes"
                value={draft.specialNotes}
                onHtmlChange={(next) => setDraft((d) => ({ ...d, specialNotes: next }))}
              />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <LabeledOfferRichCommentField
                label="Vizuālais novērtējums"
                value={draft.visualAssessment}
                onHtmlChange={(next) => setDraft((d) => ({ ...d, visualAssessment: next }))}
              />
              <LabeledOfferRichCommentField
                label="Tehniskais novērtējums"
                value={draft.technicalAssessment}
                onHtmlChange={(next) => setDraft((d) => ({ ...d, technicalAssessment: next }))}
              />
            </div>
            <div className="mt-3">
              <LabeledOfferRichCommentField
                label="Kopsavilkums"
                value={draft.summary}
                onHtmlChange={(next) => setDraft((d) => ({ ...d, summary: next, comment: next }))}
              />
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-slate-200/90 bg-white p-3">
            <IrissSectionHeading>Cenas</IrissSectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block min-w-0">
                <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Automašīnas cena</span>
                <input
                  className={fieldClass}
                  value={draft.carPrice}
                  inputMode="decimal"
                  onChange={(e) => setDraft((d) => ({ ...d, carPrice: e.target.value, priceGermany: e.target.value }))}
                />
                {carPriceWarning ? <p className="mt-1 text-[11px] text-amber-800">{carPriceWarning}</p> : null}
              </label>
              <label className="block min-w-0">
                <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Piegādes cena</span>
                <input
                  className={fieldClass}
                  value={draft.deliveryPrice}
                  inputMode="decimal"
                  onChange={(e) => setDraft((d) => ({ ...d, deliveryPrice: e.target.value }))}
                />
                {deliveryPriceWarning ? <p className="mt-1 text-[11px] text-amber-800">{deliveryPriceWarning}</p> : null}
              </label>
              <label className="block min-w-0">
                <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Komisijas maksa</span>
                <input
                  className={fieldClass}
                  value={draft.commissionFee}
                  inputMode="decimal"
                  onChange={(e) => setDraft((d) => ({ ...d, commissionFee: e.target.value }))}
                />
                {commissionWarning ? <p className="mt-1 text-[11px] text-amber-800">{commissionWarning}</p> : null}
              </label>
              <LabeledInput label="Kopā" value={totalPrice} readOnly />
              <div className="sm:col-span-2">
                <LabeledInput
                  label="Piedāvājums spēkā līdz"
                  type="date"
                  value={draft.validUntil}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      validUntil: normalizeOfferValidUntil(e.target.value),
                      offerValidDays: d.offerValidDays,
                    }))
                  }
                />
                {isIrissOfferExpired(draft) ? (
                  <p className="text-[12px] font-semibold text-red-700">Piedāvājums beidzies</p>
                ) : null}
              </div>
            </div>
          </div>
          <div className="mt-3">
            <IrissOfferBlocksEditor
              offer={{
                id: draft.id,
                title: draft.title,
                brandModel: draft.brandModel,
                vin: draft.vin,
                year: draft.year,
                mileage: draft.mileage,
                priceGermany: draft.priceGermany,
                comment: draft.comment,
                firstRegistration: draft.firstRegistration,
                odometerReading: draft.odometerReading,
                transmission: draft.transmission,
                location: draft.location,
                fuel: draft.fuel,
                driveType: draft.driveType,
                powerKw: draft.powerKw,
                engineDisplacement: draft.engineDisplacement,
                color: draft.color,
                bodyTypeOffer: draft.bodyTypeOffer,
                doorCount: draft.doorCount,
                emissionClass: draft.emissionClass,
                originCountry: draft.originCountry,
                auctionPlatform: draft.auctionPlatform,
                auctionStockNumber: draft.auctionStockNumber,
                auctionEndAt: draft.auctionEndAt,
                vatStatus: draft.vatStatus,
                damageGrade: draft.damageGrade,
                equipmentHighlights: draft.equipmentHighlights,
                estimatedTotalPrice: draft.estimatedTotalPrice,
                keyCount: draft.keyCount,
                hasFullServiceHistory: draft.hasFullServiceHistory,
                hasFactoryPaint: draft.hasFactoryPaint,
                hasNoRustBody: draft.hasNoRustBody,
                hasSecondWheelSet: draft.hasSecondWheelSet,
                specialNotes: draft.specialNotes,
                visualAssessment: draft.visualAssessment,
                technicalAssessment: draft.technicalAssessment,
                summary: draft.summary,
                carPrice: draft.carPrice,
                deliveryPrice: draft.deliveryPrice,
                commissionFee: draft.commissionFee,
                offerValidDays: draft.offerValidDays,
                validUntil: draft.validUntil,
                attachments: draft.attachments,
                ...(draft.coverAttachmentId ? { coverAttachmentId: draft.coverAttachmentId } : {}),
                ...(draft.blocks?.length ? { blocks: draft.blocks } : {}),
                createdAt: draft.createdAt,
                updatedAt: draft.createdAt,
              }}
              onChange={(next) =>
                setDraft((d) => ({
                  ...d,
                  brandModel: next.brandModel,
                  firstRegistration: next.firstRegistration,
                  year: next.year,
                  odometerReading: next.odometerReading,
                  mileage: next.mileage,
                  fuel: next.fuel,
                  transmission: next.transmission,
                  powerKw: next.powerKw,
                  color: next.color,
                  specialNotes: next.specialNotes,
                  carPrice: next.carPrice,
                  priceGermany: next.priceGermany,
                  ...(next.blocks?.length ? { blocks: next.blocks } : {}),
                }))
              }
            />
          </div>
          </div>
          <div className="min-w-0 rounded-xl border border-[#e5e7eb] bg-white p-3">
            <IrissSectionHeading>
              Bildes · {draft.attachments.length}/{IRISS_MAX_OFFER_ATTACHMENTS}
            </IrissSectionHeading>
          <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-slate-50/50 p-3 select-none">
            <label
              className={`inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:bg-slate-50 ${filePrepare || draft.attachments.length >= IRISS_MAX_OFFER_ATTACHMENTS ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
            >
              <Paperclip className="h-4 w-4" aria-hidden />
              Pievienot failus
              <input
                type="file"
                multiple
                disabled={!!filePrepare || draft.attachments.length >= IRISS_MAX_OFFER_ATTACHMENTS}
                className="hidden"
                onChange={(e) => {
                  onFilesPick(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            {filePrepare ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3" role="status" aria-live="polite">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[var(--color-provin-accent)]" aria-hidden />
                  <span className="text-[12px] font-medium text-[var(--color-apple-text)]">{filePrepare.label}</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-[var(--color-provin-accent)] transition-[width] duration-150"
                    style={{ width: `${filePrepare.pct}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] tabular-nums text-slate-500">{filePrepare.pct}%</p>
              </div>
            ) : null}
            <p className="mt-2 text-[10px] font-medium text-slate-500">
              Līdz {IRISS_MAX_OFFER_ATTACHMENTS} attēliem ({draft.attachments.length}/{IRISS_MAX_OFFER_ATTACHMENTS}).
            </p>
            <IrissOfferImageSorter
              attachments={draft.attachments}
              coverId={draft.coverAttachmentId}
              disabled={!!filePrepare}
              onChange={(next) =>
                setDraft((d) => ({
                  ...d,
                  attachments: next.attachments,
                  coverAttachmentId: next.coverId,
                }))
              }
            />
          </div>
          </div>
          </div>
        </div>
        <div className="shrink-0 border-t border-slate-200/80 bg-white px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              disabled={busy || !!filePrepare || deleteBusy}
              onClick={() => onDelete()}
              className={`${offerDialogMainBtnClass} sm:self-start`}
            >
              Dzēst
            </button>
            <div className="flex flex-wrap items-center justify-end gap-2 sm:min-w-0 sm:flex-1">
              <button
                type="button"
                disabled={busy || !!filePrepare}
                onClick={() => onClose()}
                className={offerDialogMainBtnClass}
              >
                Atcelt
              </button>
              {readyForPdfActions ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy || !!filePrepare || pdfBusy || whatsappBusy}
                    onClick={() => onPdf()}
                    className={offerDialogMainBtnClass}
                  >
                    {pdfBusy ? "PDF..." : "PDF"}
                  </button>
                  {shareWhatsAppEnabled ? (
                    <button
                      type="button"
                      disabled={busy || !!filePrepare || pdfBusy || whatsappBusy}
                      onClick={onWhatsApp}
                      title="Sūtīt WhatsApp klientam"
                      aria-label="Sūtīt WhatsApp klientam"
                      className="inline-flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 items-center justify-center rounded-full border border-emerald-500/35 bg-[#25D366] text-white shadow-sm transition hover:brightness-105 active:scale-[0.98] disabled:opacity-40"
                    >
                      <WhatsAppGlyphIcon className="h-5 w-5" />
                    </button>
                  ) : null}
                </div>
              ) : null}
              <AdminSaveButton
                onSave={onSave}
                state={saveState}
                disabled={!!filePrepare || pdfBusy || whatsappBusy}
              />
            </div>
          </div>
          {pdfNotice ? (
            <div
              className="mt-3 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-[12px] leading-snug text-amber-950"
              role="status"
            >
              <p>{pdfNotice}</p>
              {pdfAllowWithoutImages ? (
                <button
                  type="button"
                  disabled={busy || !!filePrepare || pdfBusy || whatsappBusy}
                  onClick={() => onPdf(true)}
                  className="mt-1.5 inline-flex min-h-9 items-center rounded-full border border-amber-300/90 bg-white px-3 text-[12px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:bg-amber-50 disabled:opacity-40"
                >
                  PDF bez attēliem
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
