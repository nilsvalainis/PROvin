/** Vienots maks. platums lapas vidus slejai (tabula, kartītes, Why, IRISS). */
export const homeContentMaxClass = "mx-auto min-w-0 w-full max-w-[1200px]";

/**
 * Zem-Hero sadaļu virsraksts — maza trekna uppercase, provin zilā.
 * Nelietot Hero sadaļā.
 */
export const homeSectionEyebrowClass =
  "text-[12px] font-semibold uppercase tracking-[0.1em] text-provin-accent sm:text-[13px]";

/** Vienots H2 zem Hero (Cena, IRISS, BUJ): zils eyebrow + centrēts + vienāda atstarpe līdz saturam zemāk. */
export const homeSectionTitleClass = `${homeSectionEyebrowClass} text-balance text-center mb-4 sm:mb-5`;

/** Sudraba lapa — sadaļu virsraksti bez akcenta, tīrs #050505. */
export const homeSectionTitleSilverClass =
  "text-[12px] font-semibold uppercase tracking-[0.1em] text-balance text-center text-[#050505] mb-4 sm:mb-5 sm:text-[13px]";

/**
 * „APPROVED BY IRISS” paraksts Hero augšā — mīksts pelēks, light, plaša burtu distance.
 * IRISS sadaļas apakšvirsraksts lieto to pašu bāzi ar `irissSectionSubtitleClass` (2× lielāks teksts).
 */
export const approvedByIrissSignatureBaseClass =
  "font-light uppercase tracking-[0.32em] text-[#8e8e93] sm:tracking-[0.38em] leading-relaxed";

/** Hero — mazais paraksta izmērs. */
export const approvedByIrissSignatureHeroClass = `${approvedByIrissSignatureBaseClass} text-[0.5625rem] sm:text-[0.625rem]`;

/** Hero H1 pirmā rinda — zilās atslēgvārdu „pogas” (#0066ff), kā galvenajā CTA. */
export const heroH1BluePillClass =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-[#0066ff] px-[0.45em] py-[0.1em] font-semibold text-white shadow-[0_0_20px_rgba(0,102,255,0.28)] ring-1 ring-white/12 sm:px-[0.5em] sm:py-[0.11em]";

/** Kas ir IRISS? — apakšvirsraksts: tā pati estētika, ~2× izmērs, nedaudz platāka līnija. */
export const irissSectionSubtitleClass = `${approvedByIrissSignatureBaseClass} mx-auto max-w-[min(100%,52ch)] text-balance text-[1.125rem] sm:text-[1.25rem]`;

/** Salīdzinājuma tabulas galvenes bāze — trekns, uppercase, plašāka tracking. */
export const comparisonTableHeaderBaseClass =
  "text-[10px] font-bold uppercase tracking-[0.14em] sm:text-[11px] sm:tracking-[0.16em]";

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

/** Tumšā diagnostikas plūsma virs #050505 (pasūtījuma bloks). */
export const homeFlowModuleGradientTerminalClass =
  "bg-[linear-gradient(180deg,rgba(5,5,5,0)_0%,rgba(5,5,5,0)_12%,rgba(12,18,28,0.55)_35%,rgba(18,32,52,0.35)_55%,rgba(8,12,20,0.72)_100%)]";
