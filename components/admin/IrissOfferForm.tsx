"use client";

/**
 * Piedāvājuma forma (dialogs). Viena forma visām ieejām: Pasūtījumi, Loģistika, Autoparks, klienta kabinets.
 * Stāvokli (melnrakstu, saglabāšanu, PDF) tur izsaucējs; forma tikai rāda un ziņo izmaiņas.
 */

import { Check, FileText, Link2, Loader2, MessageCircle, Plus, Trash2, X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminAiPolishRichCommentShell } from "@/components/admin/AdminAiPolishRichCommentShell";
import { AdminOfferAprakstiTranslateButton } from "@/components/admin/AdminOfferAprakstiTranslateButton";
import { IrissOfferDeadlineField } from "@/components/admin/IrissOfferDeadlineField";
import { AdminSaveButton } from "@/components/admin/AdminSaveButton";
import { IrissOfferBlocksSheet } from "@/components/admin/IrissOfferBlocksSheet";
import { IrissLabeledInput as LabeledInput, irissOfferFieldClass as fieldClass } from "@/components/admin/IrissOfferFormFields";
import { IrissOfferImageSorter, type OfferImageSorterMode } from "@/components/admin/IrissOfferImageSorter";
import { IrissOfferSectionCard } from "@/components/admin/IrissOfferSection";
import { useFormDraftAutosave, clearFormDraftNow, readFormDraftOnce } from "@/hooks/useFormDraftAutosave";
import { useModalBackdropClose } from "@/hooks/useModalBackdropClose";
import {
  irissOfferSectionVisible,
  resolveIrissOfferBlocks,
  setIrissOfferSectionVisible,
  type IrissOfferBlock,
  type IrissOfferSectionKind,
} from "@/lib/iriss-offer-blocks";
import { offerDraftTotalPrice, offerRecordFromDraft, type OfferDraft } from "@/lib/iriss-offer-draft";
import { offerDraftAutosavePayload, offerDraftAutosaveWorthRestoring, type OfferDraftAutosavePayload } from "@/lib/iriss-offer-draft-autosave";
import { isIrissOfferExpired, normalizeOfferValidUntil, offerValidUntilYmdFromAt } from "@/lib/iriss-offer-valid-until";
import { IRISS_MAX_OFFER_ATTACHMENTS } from "@/lib/iriss-pasutijumi-types";
import { irissPriceFormatWarning } from "@/lib/iriss-price-format";
import { irissVinWarning } from "@/lib/iriss-vin-check";
import { adminSaveLabel } from "@/lib/admin-save-state";

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

function OfferRichCommentField({
  label,
  value,
  onHtmlChange,
}: {
  label: string;
  value: string;
  onHtmlChange: (html: string) => void;
}) {
  const empty = !value.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  return (
    <div className="block min-w-0">
      {empty ? (
        <p className="mb-1.5 text-[12px]" style={{ color: "#9ca3af" }}>
          Nav teksta - sadaļa PDF netiek rādīta
        </p>
      ) : null}
      <AdminAiPolishRichCommentShell
        compact
        toolbar="simple"
        value={value}
        onChange={onHtmlChange}
        aria-label={label}
        resizable
        actions={<AdminOfferAprakstiTranslateButton value={value} onChange={onHtmlChange} />}
      />
    </div>
  );
}

export type IrissOfferFormTab = "bildes" | "pamatinfo" | "apraksti" | "cenas";

const TAB_LABELS: Record<IrissOfferFormTab, string> = {
  bildes: "Bildes",
  pamatinfo: "Pamatinfo",
  apraksti: "Apraksti",
  cenas: "Cenas",
};

function tabClass(active: boolean): string {
  return `inline-flex h-10 min-w-0 items-center justify-center truncate rounded-xl px-2 text-[14px] font-semibold transition ${
    active ? "bg-[#3a3f4b] text-white" : "border border-slate-200 bg-white text-[var(--color-apple-text)] hover:bg-slate-50"
  }`;
}

/** j61: telefona cilnes - pill kā maketā (aktīvā tumša), 44 px augstas. */
function mobileTabClass(active: boolean): string {
  return `inline-flex min-h-11 min-w-0 flex-col items-center justify-center rounded-full px-1 text-[15px] font-medium leading-tight transition ${
    active ? "bg-[#1d1d1f] text-white" : "text-[#444] hover:bg-slate-100"
  }`;
}

const NO_TIME = "1970-01-01T00:00:00.000Z";

/** Auto lauks - zaļgans; tukšs - svītrota apmale (CSS: iriss-admin.css, data-offer-field). */
function vehicleFieldState(value: string, auto: boolean): "auto" | "empty" | undefined {
  if (auto) return "auto";
  if (!value.trim()) return "empty";
  return undefined;
}

function AutoFieldBadge() {
  return (
    <span
      className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-[#e7f7ec] py-0.5 pl-1.5 pr-2 text-[11px] font-semibold text-[#1f8a43]"
      title="Importēts automātiski"
    >
      <span className="h-2 w-2 rounded-full bg-[#34c759]" aria-hidden />
      auto
    </span>
  );
}

type FieldKey = keyof OfferDraft & string;
type FieldDef = readonly [key: FieldKey, label: string, patch: (v: string) => Partial<OfferDraft>, wide?: boolean];

/** Pamatinfo: Marka un VIN pilnā platumā, īsie lauki pa 2 (telefonā), datorā 3 kolonnas kā līdz šim. */
const VEHICLE_FIELDS: readonly FieldDef[] = [
  ["brandModel", "Marka, modelis", (v) => ({ brandModel: v }), true],
  ["vin", "VIN", (v) => ({ vin: v.toUpperCase() }), true],
  ["firstRegistration", "Pirmā reģistrācija", (v) => ({ firstRegistration: v, year: v })],
  ["odometerReading", "Nobraukums", (v) => ({ odometerReading: v, mileage: v })],
  ["fuel", "Degviela", (v) => ({ fuel: v })],
  ["transmission", "Ātrumkārba", (v) => ({ transmission: v })],
  ["powerKw", "Jauda", (v) => ({ powerKw: v })],
  ["engineDisplacement", "Dzinēja tilpums", (v) => ({ engineDisplacement: v })],
  ["color", "Krāsa", (v) => ({ color: v })],
  ["bodyTypeOffer", "Virsbūve", (v) => ({ bodyTypeOffer: v })],
  ["doorCount", "Durvis / vietas", (v) => ({ doorCount: v })],
  ["emissionClass", "Emisijas klase", (v) => ({ emissionClass: v })],
  ["originCountry", "Izcelsmes valsts", (v) => ({ originCountry: v })],
  ["location", "Atrašanās vieta", (v) => ({ location: v })],
  ["driveType", "Piedziņa", (v) => ({ driveType: v })],
];

const AUCTION_FIELDS: readonly FieldDef[] = [
  ["auctionPlatform", "Platforma", (v) => ({ auctionPlatform: v })],
  ["auctionStockNumber", "Lot / stock nr.", (v) => ({ auctionStockNumber: v })],
  ["auctionEndAt", "Izsoles beigas", (v) => ({ auctionEndAt: v })],
  ["vatStatus", "PVN statuss", (v) => ({ vatStatus: v })],
  ["carPrice", "Izsoles cena", (v) => ({ carPrice: v, priceGermany: v })],
  ["estimatedTotalPrice", "Aplēstā kopsumma", (v) => ({ estimatedTotalPrice: v })],
];

function FloatDockButton({
  label,
  icon,
  primary = false,
  disabled = false,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  primary?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-11 w-16 flex-col items-center justify-center gap-0.5 rounded-[18px] text-[10px] font-medium tracking-[0.1px] transition active:bg-black/5 disabled:opacity-40 ${
        primary ? "text-[#0a84ff]" : "text-[#3a3a3c]"
      }`}
    >
      {icon}
      <span className="leading-none">{label}</span>
    </button>
  );
}

export type IrissOfferFormProps = {
  /** Saglabāta pasūtījuma id (pilnā izmēra bildēm skatā); tukšs, ja vēl nav saglabāts. */
  orderId?: string;
  /** Saglabātajā piedāvājumā: /STOCK bildes, kuras Dropbox vēl neizdevās ielādēt (nākamā saglabāšana mēģina vēlreiz). */
  savedPendingPhotos?: number;
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
  /** Importēts lauks labots ar roku - zaļais punkts pazūd. */
  onAutoFieldEdited?: (key: string) => void;
  /** Sākuma dati no Autoparka / Loģistikas: ielāde un piezīme (piem. "bilžu nav"). */
  seedStatus?: { loading: boolean; note: string; sourceLabel: string } | null;
  /** Galvenē pa labi (piem. "Klients ▾"). */
  headerSlot?: React.ReactNode;
  /** j61 kājene "Links": saglabā un nokopē klienta saiti (esošo vai jaunu). */
  onLink?: () => void;
  linkBusy?: boolean;
  /** Paziņojums pēc "Links" (piem. "Saite nokopēta") + pati saite, ja kopēšana neizdevās. */
  linkNotice?: { text: string; url: string } | null;
  onLinkNoticeClose?: () => void;
};

export function IrissOfferForm({
  orderId = "",
  savedPendingPhotos = 0,
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
  onAutoFieldEdited,
  seedStatus = null,
  headerSlot = null,
  onLink,
  linkBusy = false,
  linkNotice = null,
  onLinkNoticeClose,
}: IrissOfferFormProps) {
  const vinWarning = useMemo(() => irissVinWarning(draft.vin), [draft.vin]);
  const carPriceWarning = useMemo(() => irissPriceFormatWarning(draft.carPrice), [draft.carPrice]);
  const deliveryPriceWarning = useMemo(() => irissPriceFormatWarning(draft.deliveryPrice), [draft.deliveryPrice]);
  const commissionWarning = useMemo(() => irissPriceFormatWarning(draft.commissionFee), [draft.commissionFee]);
  const totalPrice = useMemo(() => offerDraftTotalPrice(draft), [draft]);
  // Telefonā cilnes (Bildes pirmā); datorā bildes vienmēr labajā kolonnā, pa kreisi 3 cilnes.
  const [tab, setTab] = useState<IrissOfferFormTab>("bildes");
  const leftTab: IrissOfferFormTab = tab === "bildes" ? "pamatinfo" : tab;
  const photoCount = draft.attachments.length;
  const pendingPhotos = savedPendingPhotos;
  const backdropClose = useModalBackdropClose(onClose, !busy && !filePrepare);
  const [photoMode, setPhotoMode] = useState<OfferImageSorterMode>("view");
  const [linkCopied, setLinkCopied] = useState(false);

  // Sviras lasa tieši tāpat kā PDF/saite: vecs piedāvājums bez blocks = ieslēgts. Dati mainās tikai pēc pārslēgšanas.
  const offerForBlocks = useMemo(() => offerRecordFromDraft(draft, { title: draft.title, nowIso: NO_TIME }), [draft]);
  const resolvedBlocks = useMemo(() => resolveIrissOfferBlocks(offerForBlocks), [offerForBlocks]);
  const sectionOn = (kind: IrissOfferSectionKind) => irissOfferSectionVisible(draft.blocks, kind);
  const setSection = useCallback(
    (kind: IrissOfferSectionKind, visible: boolean) =>
      setDraft((d) => ({
        ...d,
        blocks: setIrissOfferSectionVisible(offerRecordFromDraft(d, { title: d.title, nowIso: NO_TIME }), kind, visible),
      })),
    [setDraft],
  );
  const setBlocks = useCallback((next: IrissOfferBlock[]) => setDraft((d) => ({ ...d, blocks: next })), [setDraft]);
  const exportBusy = busy || !!filePrepare || pdfBusy || whatsappBusy || linkBusy;

  const renderField = ([key, label, patch, wide]: FieldDef, opts: { wideOnDesktop?: boolean } = {}) => {
    const value = String(draft[key] ?? "");
    const auto = autoFields.has(key);
    return (
      <label key={key} className={`block min-w-0 ${wide ? `col-span-2 ${opts.wideOnDesktop ? "" : "lg:col-span-1"}` : ""}`.trim()}>
        <span className="mb-1 flex min-h-[20px] items-center text-[12px] font-medium text-[#6e6e73]">
          {label}
          {auto ? <AutoFieldBadge /> : null}
        </span>
        <input
          className={`${fieldClass} !rounded-[11px]`}
          data-offer-field={vehicleFieldState(value, auto)}
          value={value}
          placeholder="-"
          onChange={(e) => {
            setDraft((d) => ({ ...d, ...patch(e.target.value) }));
            if (auto) onAutoFieldEdited?.(key);
          }}
          autoComplete="off"
        />
        {key === "vin" && vinWarning ? <p className="mt-1 text-[11px] text-amber-800">{vinWarning}</p> : null}
      </label>
    );
  };

  // Melnraksta autosave (localStorage): drošības tīkls, ja logs aizveras pirms "Saglabāt".
  const draftStorageKey = `iriss-offer-draft:${orderId || "new"}`;
  const [restoreCandidate, setRestoreCandidate] = useState<OfferDraftAutosavePayload | null>(null);
  const restoreCheckedRef = useRef(false);
  useFormDraftAutosave(draftStorageKey, offerDraftAutosavePayload(draft), true);
  useEffect(() => {
    if (restoreCheckedRef.current || seedStatus?.loading) return;
    restoreCheckedRef.current = true;
    const saved = readFormDraftOnce<OfferDraftAutosavePayload>(draftStorageKey);
    if (saved && offerDraftAutosaveWorthRestoring(saved.data, offerDraftAutosavePayload(draft))) {
      setRestoreCandidate(saved.data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftStorageKey, seedStatus?.loading]);
  useEffect(() => {
    if (saveState === "saved") clearFormDraftNow(draftStorageKey);
  }, [saveState, draftStorageKey]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center overscroll-y-contain bg-black/45 p-0 sm:items-center sm:p-6"
      {...backdropClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="iriss-offer-dialog-title"
        data-iriss-order-room="1"
        // Pasūtījuma istabas telefona atkāpes (16 px malas + vieta apakšējai joslai) nav paredzētas šim pilnekrāna dialogam.
        style={{ padding: 0 }}
        className="relative flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden bg-white shadow-xl sm:h-auto sm:max-h-[min(92dvh,920px)] sm:rounded-[22px] sm:border sm:border-[#e5e7eb]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:border-b sm:border-slate-200/80 sm:px-5 sm:py-3">
          <div className="min-w-0 flex-1 pr-2">
            <h2
              id="iriss-offer-dialog-title"
              className="truncate text-[18px] font-semibold text-[var(--color-apple-text)] sm:text-base"
            >
              {draft.title}
            </h2>
            {seedStatus ? (
              <p className="mt-0.5 text-[11px] text-[var(--color-provin-muted)]" role="status">
                {seedStatus.loading ? `Ielādē datus no: ${seedStatus.sourceLabel}...` : `Dati no: ${seedStatus.sourceLabel}`}
                {seedStatus.note ? ` · ${seedStatus.note}` : ""}
              </p>
            ) : autoFields.size > 0 ? (
              <p className="mt-0.5 text-[11px] text-[var(--color-provin-muted)]">Sagatavots no izsoles ieraksta</p>
            ) : null}
            {isIrissOfferExpired(draft) ? (
              <p className="mt-0.5 text-[12px] font-semibold text-red-700">Piedāvājums beidzies</p>
            ) : null}
          </div>
          {headerSlot}
          <button
            type="button"
            disabled={busy || !!filePrepare}
            aria-label="Aizvērt"
            title="Aizvērt"
            onClick={() => onClose()}
            className="order-first inline-flex h-10 min-h-10 w-10 min-w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[var(--color-apple-text)] shadow-sm transition hover:bg-slate-50 disabled:opacity-50 sm:order-none sm:rounded-full"
          >
            <X className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
          </button>
          {/* j61: telefonā Dzēst ir galvenē (sarkans aplis 32 px, pieskāriens 44 px); kājenē tikai eksports. */}
          <button
            type="button"
            disabled={busy || !!filePrepare || deleteBusy}
            aria-label="Dzēst piedāvājumu"
            title="Dzēst piedāvājumu"
            onClick={() => onDelete()}
            className="-mr-1.5 inline-flex h-11 w-11 shrink-0 items-center justify-center disabled:opacity-40 sm:hidden"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(255,59,48,0.10)] text-[#ff3b30]">
              <Trash2 className="h-[17px] w-[17px]" strokeWidth={1.9} aria-hidden />
            </span>
          </button>
        </div>
        {restoreCandidate ? (
          <div
            className="mx-4 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-[12px] leading-snug text-amber-950 sm:mx-5"
            role="status"
          >
            <span>Atrasts nesaglabāts melnraksts no iepriekšējās reizes.</span>
            <span className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft((d) => ({ ...d, ...restoreCandidate }));
                  setRestoreCandidate(null);
                }}
                className="inline-flex h-8 items-center rounded-full border border-amber-300/90 bg-white px-3 text-[12px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:bg-amber-50"
              >
                Atjaunot
              </button>
              <button
                type="button"
                onClick={() => {
                  setRestoreCandidate(null);
                  clearFormDraftNow(draftStorageKey);
                }}
                className="inline-flex h-8 items-center rounded-full px-3 text-[12px] font-medium text-amber-900 underline"
              >
                Nerādīt
              </button>
            </span>
          </div>
        ) : null}
        <div className="grid shrink-0 grid-cols-4 gap-1 border-b border-[#f0f0f0] px-3 pb-2.5 pt-1 sm:hidden" aria-label="Piedāvājuma daļas">
          {(["bildes", "pamatinfo", "apraksti", "cenas"] as const).map((t) => (
            <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)} className={mobileTabClass(tab === t)}>
              <span>{TAB_LABELS[t]}</span>
              {t === "bildes" && photoCount > 0 ? (
                <span className={`text-[11px] tabular-nums ${tab === t ? "text-white/70" : "text-[#8a8a8e]"}`}>{photoCount}</span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="hidden shrink-0 grid-cols-4 gap-2 px-4 pb-1 pt-1 sm:grid sm:px-5 lg:hidden" aria-label="Piedāvājuma daļas">
          {(["bildes", "pamatinfo", "apraksti", "cenas"] as const).map((t) => (
            <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)} className={tabClass(tab === t)}>
              {TAB_LABELS[t]}
              {t === "bildes" && photoCount > 0 && tab === t ? ` ${photoCount}` : ""}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 [-webkit-overflow-scrolling:touch] pb-24 pt-3 max-sm:bg-[#f6f6f7] sm:px-5 sm:pb-5 sm:pt-4">
          <div className="grid min-w-0 grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,1fr)]">
          <div className={`min-w-0 space-y-3 ${tab === "bildes" ? "hidden lg:block" : ""}`}>
          <div className="hidden grid-cols-3 gap-2 lg:grid" aria-label="Piedāvājuma daļas">
            {(["pamatinfo", "apraksti", "cenas"] as const).map((t) => (
              <button key={t} type="button" aria-pressed={leftTab === t} onClick={() => setTab(t)} className={tabClass(leftTab === t)}>
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>
          <div className={`space-y-3 ${leftTab === "pamatinfo" ? "" : "hidden"}`}>
            <IrissOfferSectionCard title="Transportlīdzeklis" visible={sectionOn("vehicle")} onVisibleChange={(v) => setSection("vehicle", v)}>
              <div className="grid grid-cols-2 gap-x-2.5 gap-y-3 lg:grid-cols-3">{VEHICLE_FIELDS.map((f) => renderField(f))}</div>
            </IrissOfferSectionCard>
            <IrissOfferSectionCard title="Izsole" visible={sectionOn("auction")} onVisibleChange={(v) => setSection("auction", v)}>
              <div className="grid grid-cols-2 gap-x-2.5 gap-y-3">{AUCTION_FIELDS.map((f) => renderField(f))}</div>
            </IrissOfferSectionCard>
          </div>
          <div className={`space-y-3 ${leftTab === "apraksti" ? "" : "hidden"}`}>
            <IrissOfferSectionCard
              title="Īpašas atzīmes"
              visible={sectionOn("specialNotes")}
              onVisibleChange={(v) => setSection("specialNotes", v)}
            >
              <OfferRichCommentField
                label="Īpašas atzīmes"
                value={draft.specialNotes}
                onHtmlChange={(next) => setDraft((d) => ({ ...d, specialNotes: next }))}
              />
            </IrissOfferSectionCard>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <IrissOfferSectionCard
                title="Vizuālais novērtējums"
                visible={sectionOn("visualAssessment")}
                onVisibleChange={(v) => setSection("visualAssessment", v)}
              >
                <OfferRichCommentField
                  label="Vizuālais novērtējums"
                  value={draft.visualAssessment}
                  onHtmlChange={(next) => setDraft((d) => ({ ...d, visualAssessment: next }))}
                />
              </IrissOfferSectionCard>
              <IrissOfferSectionCard
                title="Tehniskais novērtējums"
                visible={sectionOn("technicalAssessment")}
                onVisibleChange={(v) => setSection("technicalAssessment", v)}
              >
                <OfferRichCommentField
                  label="Tehniskais novērtējums"
                  value={draft.technicalAssessment}
                  onHtmlChange={(next) => setDraft((d) => ({ ...d, technicalAssessment: next }))}
                />
              </IrissOfferSectionCard>
            </div>
            {/* Kopsavilkums un Novērtējums klientam PDF/saitē ir viens bloks (assessment) - abām kartītēm tā pati svira. */}
            <IrissOfferSectionCard
              title="Kopsavilkums"
              sub={sectionOn("assessment") ? "Rāda klientam · svira kopā ar Novērtējums klientam" : "Paslēpts klientam · kopā ar Novērtējums klientam"}
              visible={sectionOn("assessment")}
              onVisibleChange={(v) => setSection("assessment", v)}
            >
              <OfferRichCommentField
                label="Kopsavilkums"
                value={draft.summary}
                onHtmlChange={(next) => setDraft((d) => ({ ...d, summary: next, comment: next }))}
              />
            </IrissOfferSectionCard>
            <IrissOfferSectionCard
              title="Novērtējums klientam"
              sub={sectionOn("assessment") ? "Rāda klientam · svira kopā ar Kopsavilkumu" : "Paslēpts klientam · kopā ar Kopsavilkumu"}
              visible={sectionOn("assessment")}
              onVisibleChange={(v) => setSection("assessment", v)}
            >
              <div className="grid grid-cols-2 gap-x-2.5 gap-y-3">
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
                <div className="col-span-2">
                  <LabeledInput
                    label="Aprīkojuma izcēlumi"
                    value={draft.equipmentHighlights}
                    onChange={(e) => setDraft((d) => ({ ...d, equipmentHighlights: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2">
                {(
                  [
                    ["hasFullServiceHistory", "Pilna servisa vēsture"],
                    ["hasFactoryPaint", "Rūpnīcas krāsojums"],
                    ["hasNoRustBody", "Virsbūve bez rūsas"],
                    ["hasSecondWheelSet", "Otrs riteņu komplekts"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-[14px] text-[var(--color-apple-text)]">
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0"
                      checked={draft[key]}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </IrissOfferSectionCard>
          </div>

          <div className={`space-y-3 ${leftTab === "cenas" ? "" : "hidden"}`}>
            <IrissOfferSectionCard title="Cenas" visible={sectionOn("pricing")} onVisibleChange={(v) => setSection("pricing", v)}>
              <div className="grid grid-cols-2 gap-x-2.5 gap-y-3">
                <label className="col-span-2 block min-w-0">
                  <span className="mb-1 block text-[12px] font-medium text-[#6e6e73]">Automašīnas cena</span>
                  <input
                    className={`${fieldClass} !rounded-[11px] font-semibold max-sm:!text-[20px]`}
                    value={draft.carPrice}
                    inputMode="decimal"
                    onChange={(e) => setDraft((d) => ({ ...d, carPrice: e.target.value, priceGermany: e.target.value }))}
                  />
                  {carPriceWarning ? <p className="mt-1 text-[11px] text-amber-800">{carPriceWarning}</p> : null}
                </label>
                <label className="block min-w-0">
                  <span className="mb-1 block text-[12px] font-medium text-[#6e6e73]">Piegādes cena</span>
                  <input
                    className={`${fieldClass} !rounded-[11px]`}
                    value={draft.deliveryPrice}
                    inputMode="decimal"
                    onChange={(e) => setDraft((d) => ({ ...d, deliveryPrice: e.target.value }))}
                  />
                  {deliveryPriceWarning ? <p className="mt-1 text-[11px] text-amber-800">{deliveryPriceWarning}</p> : null}
                </label>
                <label className="block min-w-0">
                  <span className="mb-1 block text-[12px] font-medium text-[#6e6e73]">Komisijas maksa</span>
                  <input
                    className={`${fieldClass} !rounded-[11px]`}
                    value={draft.commissionFee}
                    inputMode="decimal"
                    onChange={(e) => setDraft((d) => ({ ...d, commissionFee: e.target.value }))}
                  />
                  {commissionWarning ? <p className="mt-1 text-[11px] text-amber-800">{commissionWarning}</p> : null}
                </label>
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-slate-200/80 pt-3">
                <span className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[#6e6e73]">Kopā</span>
                <output className="text-[26px] font-bold tabular-nums text-[var(--color-apple-text)]" aria-label="Kopā">
                  {totalPrice || "-"}
                </output>
              </div>
            </IrissOfferSectionCard>
            <IrissOfferSectionCard title="Termiņš">
              <IrissOfferDeadlineField
                key={draft.id}
                idPrefix={`iriss-offer-deadline-${draft.id}`}
                label="Piedāvājuma termiņš"
                initial={{ validUntilAt: draft.validUntilAt, validUntil: draft.validUntil }}
                onChange={({ iso, ymd }) =>
                  setDraft((d) =>
                    iso
                      ? { ...d, validUntilAt: iso, validUntil: offerValidUntilYmdFromAt(iso) }
                      : // Nepilnīgs termiņš: datums kā līdz šim (vecā uzvedība), precīzais termiņš nemainās.
                        { ...d, validUntil: normalizeOfferValidUntil(ymd) },
                  )
                }
              />
              {isIrissOfferExpired(draft) ? <p className="text-[12px] font-semibold text-red-700">Piedāvājums beidzies</p> : null}
            </IrissOfferSectionCard>
            <IrissOfferBlocksSheet blocks={resolvedBlocks} photoCount={photoCount} onChange={setBlocks} />
          </div>
          </div>
          <div className={`min-w-0 lg:rounded-xl lg:border lg:border-[#e5e7eb] lg:bg-white lg:p-3 ${tab === "bildes" ? "" : "hidden lg:block"}`}>
          <div className="select-none">
            <IrissOfferSectionCard
              title="Bildes"
              sub={`${photoCount} / ${IRISS_MAX_OFFER_ATTACHMENTS} · ${sectionOn("photos") ? "rāda klientam" : "paslēptas klientam"}`}
              visible={sectionOn("photos")}
              onVisibleChange={(v) => setSection("photos", v)}
              className="lg:border-0 lg:p-0"
            >
              {pendingPhotos > 0 ? (
                <p className="text-[12px] font-medium text-amber-800">
                  {pendingPhotos} {pendingPhotos === 1 ? "bilde vēl nav ielādēta" : "bildes vēl nav ielādētas"}
                </p>
              ) : null}
            </IrissOfferSectionCard>
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
            {photoCount === 0 && !filePrepare ? (
              <p className="mt-3 rounded-xl border border-dashed border-[#cbd5e1] px-3 py-6 text-center text-[12px] text-slate-500">
                Bilžu vēl nav. Pievieno ar &quot;+ Pievienot&quot;.
              </p>
            ) : null}
            <IrissOfferImageSorter
              attachments={draft.attachments}
              coverId={draft.coverAttachmentId}
              disabled={!!filePrepare}
              onModeChange={setPhotoMode}
              addButton={
                <label
                  className={`inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 text-[15px] font-semibold text-[var(--color-apple-text)] shadow-sm transition hover:bg-slate-50 sm:text-[14px] ${filePrepare || photoCount >= IRISS_MAX_OFFER_ATTACHMENTS ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Pievienot
                  <input
                    type="file"
                    multiple
                    disabled={!!filePrepare || photoCount >= IRISS_MAX_OFFER_ATTACHMENTS}
                    className="hidden"
                    onChange={(e) => {
                      onFilesPick(e.target.files);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              }
              fullSrc={(att) =>
                orderId && att.blobPath
                  ? `/api/admin/iriss-pasutijumi/${encodeURIComponent(orderId)}/offer/${encodeURIComponent(draft.id)}/photo/${encodeURIComponent(att.id)}`
                  : ""
              }
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
        {photoMode !== "select" || tab !== "bildes" ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-20 flex flex-col items-center gap-2 px-4 sm:hidden">
            {pdfNotice || linkNotice ? (
              <div
                className="pointer-events-auto w-full max-w-[420px] rounded-2xl border border-amber-200 bg-amber-50/95 px-3 py-2 text-[12px] leading-snug text-amber-950 shadow-lg"
                role="status"
              >
                {pdfNotice ? <p>{pdfNotice}</p> : null}
                {pdfNotice && pdfAllowWithoutImages ? (
                  <button
                    type="button"
                    disabled={exportBusy}
                    onClick={() => onPdf(true)}
                    className="mt-1.5 inline-flex min-h-11 items-center rounded-full border border-amber-300/90 bg-white px-3 text-[13px] font-semibold text-[var(--color-provin-accent)] shadow-sm disabled:opacity-40"
                  >
                    PDF bez attēliem
                  </button>
                ) : null}
                {linkNotice ? (
                  <div className={`flex items-center gap-2 ${pdfNotice ? "mt-2 border-t border-amber-200 pt-2" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{linkNotice.text}</p>
                      {linkNotice.url ? <p className="truncate text-[11px] text-amber-900/80">{linkNotice.url}</p> : null}
                    </div>
                    {linkNotice.url ? (
                      <button
                        type="button"
                        className="inline-flex h-11 shrink-0 items-center rounded-full border border-amber-300/90 bg-white px-3 text-[13px] font-semibold text-[var(--color-provin-accent)]"
                        onClick={() => {
                          void navigator.clipboard?.writeText(linkNotice.url).then(
                            () => {
                              setLinkCopied(true);
                              window.setTimeout(() => setLinkCopied(false), 1600);
                            },
                            () => setLinkCopied(false),
                          );
                        }}
                      >
                        {linkCopied ? "Nokopēts" : "Kopēt"}
                      </button>
                    ) : null}
                    {onLinkNoticeClose ? (
                      <button
                        type="button"
                        aria-label="Aizvērt paziņojumu"
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-amber-900"
                        onClick={onLinkNoticeClose}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            {/* j61 v3: peldoša kapsula 46 px - PDF / WhatsApp / Links. Kamēr nav saglabāts, tā pati vieta = Saglabāt. */}
            <div className="iriss-offer-float-dock pointer-events-auto flex h-[46px] items-center gap-1 rounded-[23px] px-2" role="toolbar" aria-label="Piedāvājuma darbības">
              {readyForPdfActions ? (
                <>
                  <FloatDockButton
                    label={pdfBusy ? "PDF..." : "PDF"}
                    icon={pdfBusy ? <Loader2 className="h-[19px] w-[19px] animate-spin" aria-hidden /> : <FileText className="h-[19px] w-[19px]" strokeWidth={1.8} aria-hidden />}
                    disabled={exportBusy}
                    onClick={() => onPdf()}
                  />
                  {shareWhatsAppEnabled ? (
                    <FloatDockButton
                      label="WhatsApp"
                      icon={whatsappBusy ? <Loader2 className="h-[19px] w-[19px] animate-spin" aria-hidden /> : <MessageCircle className="h-[19px] w-[19px]" strokeWidth={1.8} aria-hidden />}
                      disabled={exportBusy}
                      onClick={onWhatsApp}
                    />
                  ) : null}
                  {onLink ? (
                    <FloatDockButton
                      label="Links"
                      primary
                      icon={linkBusy ? <Loader2 className="h-[19px] w-[19px] animate-spin" aria-hidden /> : <Link2 className="h-[19px] w-[19px]" strokeWidth={1.8} aria-hidden />}
                      disabled={exportBusy}
                      onClick={onLink}
                    />
                  ) : null}
                </>
              ) : (
                <button
                  type="button"
                  disabled={!!filePrepare || pdfBusy || whatsappBusy || saveState === "saving"}
                  onClick={onSave}
                  className="inline-flex h-11 min-w-[176px] items-center justify-center gap-1.5 rounded-[18px] px-4 text-[15px] font-semibold text-[#0a84ff] transition active:bg-black/5 disabled:opacity-50"
                >
                  {saveState === "saving" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : saveState === "saved" ? (
                    <Check className="h-4 w-4" aria-hidden />
                  ) : null}
                  {adminSaveLabel(saveState, true)}
                </button>
              )}
            </div>
          </div>
        ) : null}
        <div className="hidden shrink-0 border-t border-slate-200/80 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:block sm:px-5 sm:py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy || !!filePrepare || deleteBusy}
              onClick={() => onDelete()}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full px-2 text-[13px] font-semibold text-slate-500 transition hover:text-[var(--color-apple-text)] disabled:opacity-50 sm:border sm:border-slate-200 sm:bg-white sm:px-4 sm:text-[var(--color-apple-text)] sm:shadow-sm"
            >
              Dzēst
            </button>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
              <button
                type="button"
                disabled={busy || !!filePrepare}
                onClick={() => onClose()}
                className={`${offerDialogMainBtnClass.replace("inline-flex ", "")} hidden sm:inline-flex`}
              >
                Atcelt
              </button>
              {readyForPdfActions ? (
                <>
                  <button
                    type="button"
                    disabled={busy || !!filePrepare || pdfBusy || whatsappBusy}
                    onClick={() => onPdf()}
                    className={`${offerDialogMainBtnClass} min-w-0 flex-1 sm:flex-none sm:min-w-[116px]`}
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
                </>
              ) : null}
              <AdminSaveButton
                onSave={onSave}
                state={saveState}
                label="Saglabāt melnrakstu"
                disabled={!!filePrepare || pdfBusy || whatsappBusy}
                className="h-11 min-w-0 flex-1 sm:flex-none"
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
