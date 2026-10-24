/**
 * Paplašināma lauku karte izsoles platformu (Auto1/Openlane/Autobid) neapstrādātajiem
 * (raw) datiem -> Piedāvājuma Apraksti/Novērtējums klientam cilnes lauki.
 *
 * Precīzos lauku nosaukumus katrai platformai atsūtīs IRISS aģents - šis fails ir
 * karkass, kurā tos iespraust (`IRISS_AUCTION_LISTING_FIELD_MAPS[platform]`), nevis
 * gatavs pilns risinājums. Structured lauki (valsts, atslēgu skaits, aprīkojums) ir
 * droši lietojami uzreiz; brīvā teksta lauki (bojājumi/stāvoklis) vienmēr jātulko ar
 * `translateLv` (sk. lib/iriss-listings-damage-translate.ts::translateListingDamageLv,
 * kas jau izmanto Gemini - modelTier "gemini-flash", nevis Opus/Sonnet) PIRMS lietošanas
 * Apraksti laukos - pati karte to nedara, lai šo failu var testēt bez tīkla piekļuves.
 */

import type { OfferAprakstiSeedFields } from "@/lib/iriss-offer-apraksti-seed";

export const IRISS_AUCTION_LISTING_PLATFORMS = ["auto1", "openlane", "autobid"] as const;
export type IrissAuctionListingPlatform = (typeof IRISS_AUCTION_LISTING_PLATFORMS)[number];

/** Vienas platformas neapstrādātais izsoles ieraksts - precīzo formu atsūtīs IRISS aģents. */
export type IrissAuctionListingRaw = Record<string, unknown>;

/** Droši lietojami bez tulkošanas (skaitļi, kodi, īsi lauki). */
export type IrissAuctionListingStructuredFields = {
  originCountry: string;
  keyCount: string;
  equipmentHighlights: string;
};

/** Brīvā teksta lauki, kas JĀTULKO latviski (ar `translateLv`) pirms lietošanas Apraksti cilnē. */
export type IrissAuctionListingFreeTextFields = {
  damageText: string;
  conditionText: string;
};

export type IrissAuctionListingFieldMap = {
  platform: IrissAuctionListingPlatform;
  structured: (raw: IrissAuctionListingRaw) => Partial<IrissAuctionListingStructuredFields>;
  freeText: (raw: IrissAuctionListingRaw) => Partial<IrissAuctionListingFreeTextFields>;
};

function noStructuredFields(): Partial<IrissAuctionListingStructuredFields> {
  return {};
}

function noFreeTextFields(): Partial<IrissAuctionListingFreeTextFields> {
  return {};
}

/**
 * Reģistrs pa platformām. Katra sākotnēji tukša (gaida IRISS aģenta lauku kartes) -
 * aizpildīt `structured`/`freeText` funkcijas, kad zināma precīzā raw forma. Pievienojot
 * vienas platformas kartēšanu, citu platformu uzvedība nemainās.
 */
export const IRISS_AUCTION_LISTING_FIELD_MAPS: Record<IrissAuctionListingPlatform, IrissAuctionListingFieldMap> = {
  auto1: { platform: "auto1", structured: noStructuredFields, freeText: noFreeTextFields },
  openlane: { platform: "openlane", structured: noStructuredFields, freeText: noFreeTextFields },
  autobid: { platform: "autobid", structured: noStructuredFields, freeText: noFreeTextFields },
};

export function isIrissAuctionListingPlatform(v: string): v is IrissAuctionListingPlatform {
  return (IRISS_AUCTION_LISTING_PLATFORMS as readonly string[]).includes(v);
}

export function irissAuctionListingFieldMap(platform: string): IrissAuctionListingFieldMap | null {
  return isIrissAuctionListingPlatform(platform) ? IRISS_AUCTION_LISTING_FIELD_MAPS[platform] : null;
}

export type IrissAuctionListingTranslator = (raw: string) => Promise<string>;

/**
 * Pielieto vienas platformas karti neapstrādātajiem datiem un atgriež Apraksti cilnes
 * sākuma laukus - structured lauki tieši, brīvā teksta lauki caur `translateLv`.
 * Manuāli rakstītu tekstu šī funkcija nekad neredz un nepārraksta - to dara izsaucējs
 * (tāpat kā pārējie offer-seed ceļi, sk. lib/iriss-offer-seed.ts).
 */
export async function offerAprakstiSeedFromAuctionListing(
  map: IrissAuctionListingFieldMap,
  raw: IrissAuctionListingRaw,
  translateLv: IrissAuctionListingTranslator,
): Promise<Partial<OfferAprakstiSeedFields> & { originCountry?: string; equipmentHighlights?: string }> {
  const structured = map.structured(raw);
  const freeText = map.freeText(raw);
  const out: Partial<OfferAprakstiSeedFields> & { originCountry?: string; equipmentHighlights?: string } = {};
  if (structured.originCountry?.trim()) out.originCountry = structured.originCountry.trim();
  if (structured.keyCount?.trim()) out.keyCount = structured.keyCount.trim();
  if (structured.equipmentHighlights?.trim()) out.equipmentHighlights = structured.equipmentHighlights.trim();
  const [damageLv, conditionLv] = await Promise.all([
    freeText.damageText?.trim() ? translateLv(freeText.damageText) : Promise.resolve(""),
    freeText.conditionText?.trim() ? translateLv(freeText.conditionText) : Promise.resolve(""),
  ]);
  if (damageLv.trim()) out.technicalAssessment = damageLv.trim();
  if (conditionLv.trim()) out.visualAssessment = conditionLv.trim();
  return out;
}
