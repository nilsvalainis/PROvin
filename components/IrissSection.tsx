import { getTranslations } from "next-intl/server";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { IrissZigzagRow } from "@/components/IrissZigzagRow";
import { IRISS_SOCIAL_DEFAULTS } from "@/lib/iriss-social-defaults";
import { renderProvinText } from "@/lib/provin-wordmark";

/** Lielāks ķermenis, lai teksta laukums vizuāli tuvinātos YouTube logam (max-w-xl). */
const bodyMuted =
  "about-provin-body about-provin-body--muted text-base leading-relaxed sm:text-lg sm:leading-relaxed";

export async function IrissSection({ editorialColumn = false }: { editorialColumn?: boolean } = {}) {
  const t = await getTranslations("Iriss");

  const socialTiktok = process.env.NEXT_PUBLIC_IRISS_TIKTOK_URL?.trim() || IRISS_SOCIAL_DEFAULTS.tiktok;
  const socialYoutube = process.env.NEXT_PUBLIC_IRISS_YOUTUBE_URL?.trim() || IRISS_SOCIAL_DEFAULTS.youtube;
  const socialInstagram = process.env.NEXT_PUBLIC_IRISS_INSTAGRAM_URL?.trim() || IRISS_SOCIAL_DEFAULTS.instagram;

  const core = (
    <div className="about-provin-section mx-auto w-full max-w-[min(100%,80rem)] px-1 sm:px-2">
      <header className="text-center">
        <h2 className="demo-design-dir__title mx-auto max-w-[min(100%,48rem)] text-balance font-semibold">
          {t("title")}
        </h2>
        <div className="mx-auto mt-3 w-full max-w-[min(100%,42rem)] px-1 sm:px-2">
          <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
        </div>
        <p className="demo-design-dir__kicker mx-auto mt-3 max-w-[min(100%,40rem)] text-balance sm:mt-4">
          {t("pageLead")}
        </p>
      </header>

      <div className="mt-6 flex justify-center sm:mt-7">
        <IrissSocialIcons
          tiktok={socialTiktok}
          youtube={socialYoutube}
          instagram={socialInstagram}
          socialLabel={t("socialLabel")}
          socialSoon={t("socialSoon")}
        />
      </div>

      <div className="mx-auto mt-10 w-full max-w-[min(100%,90rem)] px-1 sm:mt-12 sm:px-2">
        <div className="flex flex-col gap-12 sm:gap-14 lg:gap-16 xl:gap-20">
          <IrissZigzagRow videoId="vlUsjQyEqME" startSeconds={90} playLabel={t("youtubePlayAria")}>
            <div className="w-full text-left">
              <p className="about-provin-signature text-sm uppercase tracking-[0.24em] sm:text-[0.9375rem]">
                {t("authorityTitle")}
              </p>
              <p className={`${bodyMuted} mt-3 sm:mt-4`}>{t("authorityBody")}</p>
            </div>
          </IrissZigzagRow>

          <IrissZigzagRow videoId="I5Xc0uFmbdo" reverse playLabel={t("youtubePlayAria")}>
            <div className="about-provin-methodology flex items-stretch justify-center gap-4 sm:gap-5">
              <span className="about-provin-axis-line block w-px shrink-0" aria-hidden />
              <p className={`${bodyMuted} pt-0.5 text-left`}>{t("methodologyBody")}</p>
            </div>
          </IrissZigzagRow>

          <IrissZigzagRow videoId="klwAEEdNXko" playLabel={t("youtubePlayAria")}>
            <p className="about-provin-hook mx-auto max-w-xl text-balance text-center text-[1.2rem] font-light leading-snug tracking-[0.012em] sm:text-[1.5rem]">
              {t("hookPart1")}
              <span className="inline font-bold">{renderProvinText(t("hookProvin"))}</span>
              {t("hookPart2")}
            </p>
          </IrissZigzagRow>

          <IrissZigzagRow videoId="7pBr-91QUjw" reverse playLabel={t("youtubePlayAria")}>
            <p className="about-provin-punchline mx-auto max-w-xl text-balance text-center text-[1.463rem] font-semibold leading-[1.06] tracking-tight sm:text-[1.95rem] lg:text-[2.438rem]">
              <span className="about-provin-punchline-lead block">{t("punchlineLead")}</span>
              <span className="about-provin-punchline-accent mt-1.5 block sm:mt-2">{t("punchlineAccent")}</span>
            </p>
          </IrissZigzagRow>
        </div>
      </div>
    </div>
  );

  if (editorialColumn) {
    return (
      <div id="kas-ir-iriss" className="home-body-ink scroll-mt-16 pb-0 pt-6 sm:pt-8">
        <span id="kas-stav-aiz-provin" className="sr-only" aria-hidden tabIndex={-1} />
        {core}
      </div>
    );
  }

  return (
    <section id="kas-ir-iriss" className="home-body-ink relative scroll-mt-16 bg-transparent pb-0 pt-6 sm:pt-8">
      <span id="kas-stav-aiz-provin" className="sr-only" aria-hidden tabIndex={-1} />
      <div className="demo-design-dir__shell relative">{core}</div>
    </section>
  );
}

function IrissSocialIcons({
  tiktok,
  youtube,
  instagram,
  socialLabel,
  socialSoon,
}: {
  tiktok?: string;
  youtube?: string;
  instagram?: string;
  socialLabel: string;
  socialSoon: string;
}) {
  const btnClass =
    "iriss-social-btn flex h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-[#b8bcc4] shadow-sm transition will-change-[box-shadow,border-color] hover:border-provin-accent/45 hover:bg-white/[0.08] hover:text-white hover:shadow-[0_0_20px_rgba(59,130,246,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent";

  const disabledClass = `${btnClass} cursor-default opacity-55 hover:border-white/15 hover:bg-white/[0.06] hover:text-[#b8bcc4] hover:shadow-none`;

  return (
    <ul className="flex list-none flex-wrap items-center justify-center gap-3" aria-label={socialLabel}>
      <li>
        {tiktok ? (
          <a href={tiktok} target="_blank" rel="noopener noreferrer" className={btnClass} aria-label="TikTok">
            <IconTikTok className="h-5 w-5" />
          </a>
        ) : (
          <span className={disabledClass} aria-label={`TikTok (${socialSoon})`} title={socialSoon}>
            <IconTikTok className="h-5 w-5" />
          </span>
        )}
      </li>
      <li>
        {youtube ? (
          <a href={youtube} target="_blank" rel="noopener noreferrer" className={btnClass} aria-label="YouTube">
            <IconYouTube className="h-5 w-5" />
          </a>
        ) : (
          <span className={disabledClass} aria-label={`YouTube (${socialSoon})`} title={socialSoon}>
            <IconYouTube className="h-5 w-5" />
          </span>
        )}
      </li>
      <li>
        {instagram ? (
          <a href={instagram} target="_blank" rel="noopener noreferrer" className={btnClass} aria-label="Instagram">
            <IconInstagram className="h-5 w-5" />
          </a>
        ) : (
          <span className={disabledClass} aria-label={`Instagram (${socialSoon})`} title={socialSoon}>
            <IconInstagram className="h-5 w-5" />
          </span>
        )}
      </li>
    </ul>
  );
}

function IconTikTok({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

function IconYouTube({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function IconInstagram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}
