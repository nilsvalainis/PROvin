/** Vienots maks. platums lapas vidus slejai (tabula, kartītes, Why, IRISS). */
export const homeContentMaxClass = "mx-auto min-w-0 w-full max-w-[1200px]";

/**
 * Zem-Hero sadaļu virsraksts — maza trekna uppercase, provin zilā.
 * Nelietot Hero sadaļā.
 */
export const homeSectionEyebrowClass =
  "text-[12px] font-semibold uppercase tracking-[0.1em] text-provin-accent sm:text-[13px]";

/** Salīdzinājuma tabulas galvenes bāze (izmērs, svars) — krāsu dod `Muted` vai `Accent`. */
export const comparisonTableHeaderBaseClass =
  "text-[10px] font-bold uppercase tracking-wide sm:text-[11px] sm:tracking-wider";

/**
 * Salīdzinājuma tabulas galvenes „IEZĪME” / „STANDARTA ATSKAITE” — pelēks.
 */
export const comparisonTableHeaderMutedClass = `${comparisonTableHeaderBaseClass} text-[#5c5d62]`;

/** PROVIN kolonna tabulas galvenē. */
export const comparisonTableHeaderAccentClass = `${comparisonTableHeaderBaseClass} text-provin-accent`;

/**
 * Salīdzinājuma tabulas pirmās kolonnas (IEZĪME) rindiņu teksts — tas pats izmērs un svars kā šūnām zem „STANDARTA ATSKAITE”.
 */
export const comparisonTableFeatureCellClass =
  "text-[13px] font-medium leading-snug text-[#1d1d1f] sm:text-[14px] sm:leading-snug";

/**
 * Maigs vertikālais „vilnis” — gaišāks augšā, nedaudz tumšāks lejā (IRISS).
 */
export const homeSoftBandGradientClass =
  "bg-gradient-to-b from-[#f9fafc] via-[#f3f5f8] to-[#e8ecf0]";

/**
 * 3 soļu josla: viens plūdens linear-gradient (gaišs → nedaudz tumšāks zili-pelēks → gaišs),
 * bez asām robežām pret Hero / anketu. Sānu sapludinājums — caur `HowItWorks` malu slāņiem.
 */
export const homeHowItWorksBandClass =
  "bg-[linear-gradient(180deg,#ffffff_0%,#f9fafc_8%,#f1f4f9_28%,#dfe7f0_50%,#f1f4f9_72%,#f9fafc_92%,#ffffff_100%)]";
