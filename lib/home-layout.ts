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
 * Viena plūstoša virsma: Hero → 3 soļi → anketa (vienā `relative` blokā ar `absolute inset-0` gradientu).
 * Garas, maigas krāsu pārējas — bez asas horizontālas joslas pie pogas / soļiem.
 */
/** Augšā caurspīdīgs, lai zem tā paliek HeroVisual + globālais overlay — bez „krāsas kastes” pār visu ekrānu. */
export const homeFlowModuleGradientClass =
  "bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0)_14%,rgba(250,251,252,0.42)_24%,rgba(238,242,248,0.78)_38%,rgba(228,234,242,0.92)_50%,rgba(238,242,248,0.78)_62%,rgba(250,251,252,0.5)_78%,rgba(255,255,255,0.96)_100%)]";
