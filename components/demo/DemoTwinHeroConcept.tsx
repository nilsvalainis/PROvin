import { getTranslations } from "next-intl/server";
import { HeroVisual } from "@/components/HeroVisual";
import { demoHeroFeatureTitles } from "@/lib/demo-feature-titles";
import { renderProvinText } from "@/lib/provin-wordmark";
import styles from "@/app/[locale]/demo/page.module.css";

const selectFeatureRows = [
  { label: "Tirgus analīze", icon: "check" as const },
  { label: "Sludinājumu filtrs", icon: "check" as const },
  { label: "Tehnisko risku izvērtējums", icon: "check" as const },
  { label: "Sarunu stratēģija", icon: "check" as const },
  { label: "Rakstisks izvērtējums", icon: "check" as const },
  { label: "48h izpilde", icon: "check" as const },
  { label: "Papildjautājumi", icon: "check" as const },
  { label: "Atlasītie kandidāti", icon: "check" as const },
  { label: "Aizsardzība pret liekiem VIN tēriņiem", icon: "check" as const },
  { label: "PROVIN partnerība", icon: "shield" as const },
] as const;

function FeatureList({ items }: { items: readonly { label: string; icon: "check" | "shield" }[] }) {
  return (
    <ul className={styles.features}>
      {items.map((item) => (
        <li key={item.label}>
          {item.icon === "check" ? (
            <span className={`${styles.featureIcon} ${styles.featureIconCheck}`} aria-hidden>
              ✓
            </span>
          ) : (
            <span className={`${styles.featureIcon} ${styles.featureIconShield}`} aria-hidden>
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M12 2.5 4.5 5.7v6.1c0 5.2 3.2 9.4 7.5 10.9 4.3-1.5 7.5-5.7 7.5-10.9V5.7L12 2.5Zm0 2.2 5.3 2.2v4.9c0 4.2-2.4 7.5-5.3 8.8-2.9-1.3-5.3-4.6-5.3-8.8V6.9L12 4.7Zm-1.2 10.2 5.2-5.2 1.4 1.4-6.6 6.6-3.2-3.2 1.4-1.4 1.8 1.8Z" />
              </svg>
            </span>
          )}
          <span>
            {renderProvinText(item.label, {
              proAndSuffixClassName: "provin-wordmark-pro",
              vinAmberOnlyBeforeSelect: true,
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * DEMO: divas blakus kartītes (PROVIN AUDITS vs PROVIN SELECT) — tas pats hero stils, vieglas rāmja kartes.
 * Netiek lietots produkcijas sākumlapā.
 */
export async function DemoTwinHeroConcept() {
  const tHero = await getTranslations("Hero");
  const tOrder = await getTranslations("Order");
  const tSelect = await getTranslations("ProvinSelect");

  return (
    <>
      <p className={styles.demoTwinHeroKicker}>
        {renderProvinText(
          "DEMO koncepts — netiek publicēts. Salīdzinājums: PROVIN AUDITS pret PROVIN SELECT (vienāds izkārtojums).",
          { proAndSuffixClassName: "provin-wordmark-pro", vinAmberOnlyBeforeSelect: true },
        )}
      </p>
      <div className={`home-hero-intro-surface ${styles.heroIntroSurface}`}>
        <div className={styles.heroDarkBackdrop} aria-hidden>
          <div className={styles.heroVisualWrap}>
            <HeroVisual />
          </div>
          <div className={`home-hero-intro-scrim-gradient ${styles.demoScrimTune}`} aria-hidden />
          <div className={styles.heroDarkVeil} aria-hidden />
        </div>

        <div className="relative z-10 min-w-0">
          <section className={`${styles.heroSection} ${styles.demoTwinHeroSection}`} aria-label="Demo divas hero kartītes">
            <div className={`${styles.shell} ${styles.demoTwinShell}`}>
              <div className={styles.demoTwinHeroGrid}>
                <div className={styles.demoTwinCard}>
                  <h1 className={styles.title}>
                    <span className={`${styles.titleRow} ${styles.titleSubLine}`}>
                      <span className={styles.titleAccent}>VIN</span>
                      <span className={styles.titleInk}> UN</span>
                    </span>
                    <span className={`${styles.titleRow} ${styles.titleSubLine}`}>
                      <span className={styles.titleAccent}>SLUDINĀJUMA</span>
                    </span>
                    <span className={`${styles.titleRow} ${styles.titleAuditsLine}`}>AUDITS</span>
                  </h1>

                  <form className={styles.form}>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>VIN numurs</span>
                      <input type="text" placeholder="Ievadi VIN" readOnly tabIndex={-1} aria-readonly />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Sludinājuma saite</span>
                      <input type="text" placeholder="Iekopē sludinājuma URL" readOnly tabIndex={-1} aria-readonly />
                    </label>
                  </form>

                  <button type="button" className={styles.ctaButton} tabIndex={-1}>
                    {tOrder("heroOrderCta")}
                  </button>
                  <div className={styles.ctaButtonHeroConsult} tabIndex={-1}>
                    {tHero("heroConsultCta")}
                  </div>

                  <FeatureList items={demoHeroFeatureTitles} />
                </div>

                <div className={styles.demoTwinCard}>
                  <h1 className={styles.title}>
                    <span className={`${styles.titleRow} ${styles.titleSubLine}`}>
                      <span className={styles.titleInk}>PRO</span>
                      <span className={styles.titleAccent}>VIN</span>
                    </span>
                    <span className={`${styles.titleRow} ${styles.titleSubLine}`}>
                      <span className={styles.titleAccent}>SELECT</span>
                    </span>
                    <span className={`${styles.titleRow} ${styles.titleAuditsLine}`}>STRATĒĢISKĀ KONSULTĀCIJA</span>
                  </h1>

                  <form className={styles.form}>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Budžets / vēlmes</span>
                      <input type="text" placeholder="Piem., līdz 15 000 €, universālis…" readOnly tabIndex={-1} aria-readonly />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Sludinājuma saite</span>
                      <input type="text" placeholder="Nav obligāta — iekopē, ja jau ir variants" readOnly tabIndex={-1} aria-readonly />
                    </label>
                  </form>

                  <button type="button" className={styles.ctaButton} tabIndex={-1}>
                    {tSelect("ctaPrimary")}
                  </button>
                  <div className={styles.ctaButtonHeroConsult} tabIndex={-1}>
                    {tHero("heroConsultCta")}
                  </div>

                  <FeatureList items={selectFeatureRows} />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
