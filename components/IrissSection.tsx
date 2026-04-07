import { getTranslations } from "next-intl/server";
import { homeContentMaxClass, sectionH2Class } from "@/lib/home-layout";

export async function IrissSection() {
  const t = await getTranslations("Iriss");

  const socialTiktok = process.env.NEXT_PUBLIC_IRISS_TIKTOK_URL?.trim();
  const socialYoutube = process.env.NEXT_PUBLIC_IRISS_YOUTUBE_URL?.trim();
  const socialInstagram = process.env.NEXT_PUBLIC_IRISS_INSTAGRAM_URL?.trim();

  return (
    <section
      id="kas-ir-iriss"
      className="relative scroll-mt-16 overflow-hidden bg-white px-4 py-10 sm:px-6 sm:py-16"
    >
      <span id="kas-stav-aiz-provin" className="sr-only" aria-hidden tabIndex={-1} />
      <div className="pointer-events-none absolute inset-0 provin-noise opacity-20" aria-hidden />

      <div className={`relative ${homeContentMaxClass}`}>
        <div className="text-center">
          <h2 className={sectionH2Class}>{t("title")}</h2>
        </div>

        <IrissSocialIcons
          tiktok={socialTiktok}
          youtube={socialYoutube}
          instagram={socialInstagram}
          socialLabel={t("socialLabel")}
          socialSoon={t("socialSoon")}
        />

        <div className="mt-8 flex w-full min-w-0 flex-col gap-6 sm:mt-10 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <div className="min-w-0 flex-1 space-y-4 text-left [text-shadow:0_1px_2px_rgba(15,23,42,0.08)]">
            <p className="text-[16px] font-normal leading-relaxed text-[#1d1d1f] sm:text-[17px]">{t("bio1")}</p>
            <p className="text-[16px] font-normal leading-relaxed text-[#1d1d1f] sm:text-[17px]">{t("bio2")}</p>
          </div>
          <div className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-provin-accent px-5 py-4 text-center text-white shadow-[0_4px_16px_rgba(0,0,0,0.15)] sm:min-w-[140px]">
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/90">{t("experienceLabel")}</p>
            <p className="mt-1 text-[32px] font-semibold tabular-nums leading-none tracking-tight sm:text-[36px]">{t("years")}</p>
            <p className="mt-1 text-[12px] font-normal text-white/90">{t("yearsLabel")}</p>
          </div>
        </div>
      </div>
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
    "flex h-11 w-11 items-center justify-center rounded-full border border-black/[0.1] bg-white/90 text-[#1d1d1f] shadow-sm transition hover:border-black/[0.18] hover:text-provin-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent";

  const disabledClass = `${btnClass} cursor-default opacity-60 hover:border-black/[0.1] hover:text-[#1d1d1f]`;

  return (
    <ul className="mt-5 flex list-none flex-wrap items-center justify-center gap-3 sm:mt-6" aria-label={socialLabel}>
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
