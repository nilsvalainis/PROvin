/**
 * Piedāvājuma formas autosave (localStorage) - kuri lauki tiek salīdzināti, lai lemtu, vai rādīt
 * "atrasts nesaglabāts melnraksts" joslu. Bildes (attachments) netiek glabātas localStorage -
 * tās jau ir izsekotas serverī/Dropbox, un tās var būt lielas.
 */
import type { OfferDraft } from "@/lib/iriss-offer-draft";

export type OfferDraftAutosavePayload = Omit<OfferDraft, "attachments">;

/** Lauki, ko lietotājs ievada ar roku - ja tie atšķiras, melnraksts ir vērts atjaunot. */
const HAND_TYPED_FIELDS = [
  "title",
  "specialNotes",
  "visualAssessment",
  "technicalAssessment",
  "summary",
  "damageGrade",
  "keyCount",
  "equipmentHighlights",
  "carPrice",
  "deliveryPrice",
  "commissionFee",
  "hasFullServiceHistory",
  "hasFactoryPaint",
  "hasNoRustBody",
  "hasSecondWheelSet",
] as const satisfies readonly (keyof OfferDraftAutosavePayload)[];

export function offerDraftAutosavePayload(draft: OfferDraft): OfferDraftAutosavePayload {
  const { attachments: _attachments, ...rest } = draft;
  return rest;
}

function isHandTypedFieldEmpty(value: OfferDraftAutosavePayload[(typeof HAND_TYPED_FIELDS)[number]]): boolean {
  return typeof value === "boolean" ? value === false : !value.trim();
}

/** Vai saglabātajā melnrakstā ir kāds ar roku ievadīts lauks, kas atšķiras no pašreizējā un nav tukšs? */
export function offerDraftAutosaveWorthRestoring(saved: OfferDraftAutosavePayload, current: OfferDraftAutosavePayload): boolean {
  return HAND_TYPED_FIELDS.some((key) => saved[key] !== current[key] && !isHandTypedFieldEmpty(saved[key]));
}
