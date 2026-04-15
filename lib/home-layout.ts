/**
 * Vienots maks. platums lapas vidus slejai — tā pati „viena ass” kā demo (`min(75rem, …)` = 1200px @16px).
 * Mazos ekrānos respekte `calc(100vw - 2rem)`, lai sakrist ar `px-4` malām.
 */
export const homeContentMaxClass = "mx-auto min-w-0 w-full max-w-[min(75rem,calc(100vw-2rem))]";

/** BUJ / šaura sleja — iepriekšējais ~680px ar to pašu responsīvo formulu. */
export const homeFaqMaxClass = "mx-auto min-w-0 w-full max-w-[min(42.5rem,calc(100vw-2rem))]";

/**
 * Hero — pasūtījuma forma un 4 pīlāri (design-direction orbit); tā pati maks. sleja kā `OrderForm` (`max-w-[560px]`).
 */
export const homeHeroOrderColumnMaxClass =
  "mx-auto min-w-0 w-full max-w-[min(35rem,calc(100vw-2rem))]";

/** Centrēšanas čaula — MarketingHero 2×2 režģis un How it works soļu rinda (1:1 platums). */
export const homeMarketingPillarGridShellClass = "flex w-full justify-center";

/** 2×2 pīlāru režģa maks. platums; jālieto arī 3 soļu blokam zem Hero. */
export const homeMarketingPillarGridWidthClass =
  "w-full min-w-0 max-w-full sm:max-w-[min(100%,40.7rem)] md:max-w-[min(100%,44.55rem)]";

/**
 * „KAS IEKĻAUTS CENĀ” kartes virsraksts / ikona — saskaņots ar Hero pīlāru izmēriem (`data-hero-orbit-home`).
 */
export const heroPillarCardTitleClass =
  "marketing-hero-pillar-title line-clamp-2 max-h-[2.4em] min-h-[2.4em] w-full max-w-[11.5rem] whitespace-pre-line text-center text-[9px] font-semibold uppercase leading-[1.2] tracking-tight sm:max-w-[12.5rem] sm:text-[10px] home-body-ink";

export const heroPillarCardIconClass =
  "marketing-hero-pillar-icon h-7 w-7 shrink-0 text-[#0066ff] [stroke-width:1.5] sm:h-7 sm:w-7 md:h-8 md:w-8";

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

/**
 * Hero — mazais paraksta izmērs + lasāmība pret Deep Focus (neliels „halo” pret joslām).
 */
export const approvedByIrissSignatureHeroClass = `${approvedByIrissSignatureBaseClass} text-[0.5625rem] sm:text-[0.625rem] text-[#bcc6d4] [text-shadow:0_1px_0_rgba(0,0,0,0.55),0_0_22px_rgba(5,5,5,0.65)]`;

/** Hero apakšvirsraksts — tā pati pelēcība kā „IRISS” rindiņai, nedaudz lielāks tonis. */
export const homeHeroSubtitleClass =
  "text-[#c4ccd8] [text-shadow:0_1px_0_rgba(0,0,0,0.5),0_0_18px_rgba(5,5,5,0.55)]";

/** Hero H1 pirmā rinda — atslēgvārdi (VIN, SLUDINĀJUMA); krāsa no `--color-provin-accent` (tēma). */
export const heroH1BlueKeywordClass = "font-semibold whitespace-nowrap text-provin-accent";

/** Kas ir IRISS? — apakšvirsraksts: tā pati estētika, ~2× izmērs, nedaudz platāka līnija. */
export const irissSectionSubtitleClass = `${approvedByIrissSignatureBaseClass} mx-auto max-w-[min(100%,52ch)] text-balance text-[1.125rem] sm:text-[1.25rem]`;

/**
 * IRISS staggered bloku virsraksti — līdzīgi „IRISS | Perekupa Dienasgrāmata”
 * (light, uppercase, plašs tracking); nedaudz šaurāks tracking garām rindiņām.
 */
export const irissStaggerHeadingClass =
  "iriss-stagger-heading font-light uppercase tracking-[0.2em] text-balance text-[#e5e7eb] leading-snug sm:tracking-[0.24em] md:tracking-[0.28em] text-[0.9375rem] sm:text-[1.0625rem] md:text-[1.125rem]";

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
