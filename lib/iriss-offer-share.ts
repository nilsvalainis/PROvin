/** Piedāvājuma koplietošanas teksts. Zīmols ir Dzintarzeme Auto, ne PROVIN.LV. */

export const IRISS_OFFER_SHARE_BRAND = "Dzintarzeme Auto";

type OfferShareDraft = {
  brandModel: string;
  firstRegistration: string;
  year: string;
};

export function buildIrissOfferShareSubject(draft: OfferShareDraft): string {
  const vehicle = [draft.brandModel.trim(), draft.firstRegistration.trim() || draft.year.trim()].filter(Boolean).join(", ");
  return `${IRISS_OFFER_SHARE_BRAND}: piedāvājums${vehicle ? `: ${vehicle}` : ""}`;
}

export function buildIrissOfferClientShareBody(
  draft: OfferShareDraft,
  clientFirstName: string,
  clientLastName: string,
  pdfFileName: string,
): string {
  const name = [clientFirstName, clientLastName].map((s) => s.trim()).filter(Boolean).join(" ");
  const greeting = name ? `Sveiki, ${name}!` : "Sveiki!";
  const vehicle = [draft.brandModel.trim(), draft.firstRegistration.trim() || draft.year.trim()].filter(Boolean).join(", ");
  return [
    greeting,
    "",
    `PDF ar piedāvājumu tikko saglabāts tālrunī kā „${pdfFileName}”. Pievieno to šai sarunā: + → Dokuments → atrodi failu (piem. Lejupielādes).`,
    ...(vehicle ? [`Objekts: ${vehicle}.`] : []),
    "",
    "Labu dienu,",
    IRISS_OFFER_SHARE_BRAND,
  ].join("\n");
}

export function irissOfferImagesOmittedNotice(count: number): string {
  if (count <= 0) return "";
  if (count === 1) return "Brīdinājums: viens attēls netika ievietots PDF.";
  return `Brīdinājums: ${count} attēli netika ievietoti PDF.`;
}
