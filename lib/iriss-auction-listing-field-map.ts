/**
 * Lauku karte izsoles platformu (Auto1/Openlane/Autobid) datiem -> Piedāvājuma
 * Apraksti/Novērtējums klientam cilnes lauki. Pamatā IRISS lauku kartei (j41,
 * "AUTO1 lauku karte" / "OPENLANE karte") - precīzas detaļu lapas (Overview/Condition/
 * Documents cilnes) kartes vēl nav sasaistītas ar kādu scrape avotu (IRISS aģents tās
 * atsūtīs vēlāk), TĀPĒC šī karte šobrīd lieto tikai to, kas JAU ir sistēmā: vispārīgo
 * sludinājumu sarakstu nolasi (`IrissListingVehicle`/`IrissOrderRoomHit`: doorCount,
 * damageRaw, sourceCountry) - sk. lib/iriss-order-room.ts. Kad IRISS aģents atsūtīs
 * precīzās detaļu lapas lauku kartes (atslēgu skaits, TA derīga, īpašnieku skaits u.c.,
 * kas vēl NEKUR netiek nolasīti), `structured`/`freeText` šeit paplašina, nevis maina.
 *
 * Structured lauki (valsts, atslēgu skaits, aprīkojums) ir droši lietojami uzreiz;
 * brīvā teksta lauki vienmēr jātulko ar `translateLv` (sk.
 * lib/iriss-listings-damage-translate.ts::translateListingDamageLv, kas jau izmanto
 * Gemini - modelTier "gemini-flash", nevis Opus/Sonnet) PIRMS lietošanas Apraksti
 * laukos - pati karte to nedara, lai šo failu var testēt bez tīkla piekļuves.
 */

import type { OfferAprakstiSeedFields } from "@/lib/iriss-offer-apraksti-seed";

/** Jāsakrīt ar `IrissAuctionListingPlatform` lib/iriss-listings-types.ts (platformas kods "openline", etiķete "Openlane"). */
export const IRISS_AUCTION_LISTING_PLATFORMS = ["auto1", "openline", "autobid"] as const;
export type IrissAuctionListingPlatform = (typeof IRISS_AUCTION_LISTING_PLATFORMS)[number];

/** Vienas platformas neapstrādātais izsoles ieraksts - precīzo formu atsūtīs IRISS aģents. */
export type IrissAuctionListingRaw = Record<string, unknown>;

/** Droši lietojami bez tulkošanas (skaitļi, kodi, īsi lauki). */
export type IrissAuctionListingStructuredFields = {
  originCountry: string;
  keyCount: string;
  equipmentHighlights: string;
};

/**
 * Brīvā teksta lauki, kas JĀTULKO latviski (ar `translateLv`) pirms lietošanas Apraksti
 * cilnē. `visualDamageText` = AUTO1 "Damage summary" / OPENLANE "Stāvoklis" bojājumu
 * teksts -> Bojājumu pakāpe + Vizuālais novērtējums (pēc kartes). `technicalIssueText` =
 * brīdinājumu lampu / testa brauciena teksts -> Tehniskais novērtējums (pēc kartes) -
 * šo avotu detaļu lapa šobrīd nav nolasīta, tāpēc parasti tukšs.
 */
export type IrissAuctionListingFreeTextFields = {
  visualDamageText: string;
  technicalIssueText: string;
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

function rawStr(raw: IrissAuctionListingRaw, key: string): string {
  const v = raw[key];
  return typeof v === "string" ? v.trim() : "";
}

/**
 * AUTO1/OPENLANE: tas, kas jau ir sistēmā par katru sludinājumu (`IrissOrderRoomHit`
 * nolasīts no saraksta, nevis detaļu lapas) - sk. faila galvas komentāru. `sourceCountry`
 * nokrīt uz `countryCode`, jo Autobid/Openlane relejs ne vienmēr dod abus.
 */
function structuredFromListedFields(raw: IrissAuctionListingRaw): Partial<IrissAuctionListingStructuredFields> {
  const originCountry = rawStr(raw, "sourceCountry") || rawStr(raw, "countryCode");
  return originCountry ? { originCountry } : {};
}

/** `damageRaw` = sarakstā redzamais bojājumu teksts -> pēc kartes vienmēr Vizuālais, ne Tehniskais. */
function freeTextFromListedFields(raw: IrissAuctionListingRaw): Partial<IrissAuctionListingFreeTextFields> {
  const visualDamageText = rawStr(raw, "damageRaw");
  return visualDamageText ? { visualDamageText } : {};
}

/**
 * Reģistrs pa platformām. AUTO1/OPENLINE lieto to, kas jau ir sistēmā (sk. augstāk) -
 * detaļu lapas laukus (atslēgu skaits, TA derīga u.c.) IRISS aģents atsūtīs vēlāk,
 * tad `structured`/`freeText` šeit paplašina. AUTOBID karte vēl nav saņemta (tukša).
 * Pievienojot vienas platformas kartēšanu, citu platformu uzvedība nemainās.
 */
export const IRISS_AUCTION_LISTING_FIELD_MAPS: Record<IrissAuctionListingPlatform, IrissAuctionListingFieldMap> = {
  auto1: { platform: "auto1", structured: structuredFromListedFields, freeText: freeTextFromListedFields },
  openline: { platform: "openline", structured: structuredFromListedFields, freeText: freeTextFromListedFields },
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
  const [visualLv, technicalLv] = await Promise.all([
    freeText.visualDamageText?.trim() ? translateLv(freeText.visualDamageText) : Promise.resolve(""),
    freeText.technicalIssueText?.trim() ? translateLv(freeText.technicalIssueText) : Promise.resolve(""),
  ]);
  if (visualLv.trim()) {
    // Pēc kartes: bojājumu kopsavilkums iet uz abiem laukiem (Bojājumu pakāpe + Vizuālais novērtējums).
    out.damageGrade = visualLv.trim();
    out.visualAssessment = visualLv.trim();
  }
  if (technicalLv.trim()) out.technicalAssessment = technicalLv.trim();
  return out;
}
