import { getTranslations } from "next-intl/server";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { getIrissSocialUrls, IrissSocialIcons } from "@/components/IrissSocialIcons";
import { IrissZigzagRow } from "@/components/IrissZigzagRow";
import {
  homeDarkProvinWordmarkOptions,
  homeEditorialPunchlineAccentClass,
  homeEditorialPunchlineClass,
  homeEditorialPunchlineLeadClass,
  homeEditorialSectionBodyLeadClass,
  homeEditorialSectionTitleClass,
  homeHeroSubheadBodyClass,
} from "@/lib/home-layout";
import { renderProvinText } from "@/lib/provin-wordmark";

export async function IrissSection({ editorialColumn = false }: { editorialColumn?: boolean } = {}) {
  const t = await getTranslations("Iriss");
  const social = getIrissSocialUrls();

  const core = (
    <div className="about-provin-section mx-auto w-full max-w-[min(100%,80rem)] px-1 sm:px-2">
      <header className="text-center">
        <h2 className={homeEditorialSectionTitleClass}>
          {renderProvinText(t("title"), homeDarkProvinWordmarkOptions)}
        </h2>
        <div className="mx-auto mt-3 w-full max-w-[min(100%,42rem)] px-1 sm:px-2">
          <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
        </div>
        <p className={homeEditorialSectionBodyLeadClass}>{t("pageLead")}</p>
      </header>

      <div className="mt-6 flex justify-center sm:mt-7">
        <IrissSocialIcons
          tiktok={social.tiktok}
          youtube={social.youtube}
          instagram={social.instagram}
          socialLabel={t("socialLabel")}
          socialSoon={t("socialSoon")}
        />
      </div>

      <div className="mx-auto mt-10 w-full max-w-[min(100%,90rem)] px-1 sm:mt-12 sm:px-2">
        <div className="flex flex-col gap-12 sm:gap-14 lg:gap-16 xl:gap-20">
          <IrissZigzagRow videoId="vlUsjQyEqME" startSeconds={90} playLabel={t("youtubePlayAria")}>
            <div className="w-full">
              <p className={homeHeroSubheadBodyClass}>
                {renderProvinText(t("body1"), homeDarkProvinWordmarkOptions)}
              </p>
            </div>
          </IrissZigzagRow>

          <IrissZigzagRow videoId="I5Xc0uFmbdo" reverse playLabel={t("youtubePlayAria")}>
            <p className={homeHeroSubheadBodyClass}>
              {renderProvinText(t("body2"), homeDarkProvinWordmarkOptions)}
            </p>
          </IrissZigzagRow>

          <IrissZigzagRow videoId="klwAEEdNXko" playLabel={t("youtubePlayAria")}>
            <p className={homeHeroSubheadBodyClass}>
              {renderProvinText(t("body3"), homeDarkProvinWordmarkOptions)}
            </p>
          </IrissZigzagRow>

          <IrissZigzagRow videoId="7pBr-91QUjw" reverse playLabel={t("youtubePlayAria")}>
            <p className={homeEditorialPunchlineClass}>
              <span className={homeEditorialPunchlineLeadClass}>{t("punchlineLead")}</span>
              <span className={homeEditorialPunchlineAccentClass}>{t("punchlineAccent")}</span>
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
