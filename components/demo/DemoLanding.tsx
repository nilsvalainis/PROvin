import { getTranslations } from "next-intl/server";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { Footer } from "@/components/Footer";
import { HeroVisual } from "@/components/HeroVisual";
import { HomeFaqSection } from "@/components/home/HomeFaqSection";
import { IrissSection } from "@/components/IrissSection";
import { PricingIncluded } from "@/components/PricingIncluded";
import { renderProvinText } from "@/lib/provin-wordmark";
import { DemoViewportChips } from "@/components/demo/DemoViewportChips";
import styles from "@/app/[locale]/demo/page.module.css";

const featureTitles = [
  { label: "Vēstures pārbaude", icon: "check" as const },
  { label: "Sludinājuma analīze", icon: "check" as const },
  { label: "Tehnisko risku analīze", icon: "check" as const },
  { label: "Starptautiskās datubāzes", icon: "check" as const },
  { label: "Latvijas reģistru analīze", icon: "check" as const },
  { label: "Datu interpretācija", icon: "check" as const },
  { label: "Individuāla konsultācija", icon: "check" as const },
  { label: "Approved by IRISS", icon: "shield" as const },
];

export async function DemoLanding() {
  const tMeta = await getTranslations("Meta");

  return (
    <div className={styles.demoRoot}>
      <DemoViewportChips />
      <div className={`home-hero-intro-surface ${styles.heroIntroSurface}`}>
        <div className={styles.heroDarkBackdrop} aria-hidden>
          <div className={styles.heroVisualWrap}>
            <HeroVisual />
          </div>
          <div className={`home-hero-intro-scrim-gradient ${styles.demoScrimTune}`} />
          <div className={styles.heroDarkVeil} aria-hidden />
        </div>

        <div className="relative z-10 min-w-0">
          <section className={styles.heroSection}>
            <div className={styles.shell}>
              <div className={styles.heroColumns}>
                <div className={styles.left}>
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
                      <input type="text" placeholder="Ievadi VIN" />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Sludinājuma saite</span>
                      <input type="text" placeholder="Iekopē sludinājuma URL" />
                    </label>
                  </form>

                  <button type="button" className={styles.ctaButton}>
                    PASŪTĪT AUDITU
                  </button>

                  <ul className={styles.features}>
                    {featureTitles.map((item) => (
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
                        <span>{item.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <aside id="home-intro" className={styles.heroIntroPanel}>
                  <div className={styles.heroGlassCard}>
                    <h2 className={styles.heroGlassTitle}>
                      KAS IR{" "}
                      <span className={styles.heroGlassTitleNowrap}>
                        <span className={styles.heroGlassTitlePro}>PRO</span>
                        <span className="text-provin-accent">VIN</span>
                      </span>
                      ?
                    </h2>
                    <div className={styles.heroGlassScan}>
                      <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
                    </div>
                    <p className={styles.heroGlassBody}>
                      {renderProvinText(tMeta("homeIntroBody"), { proAndSuffixClassName: styles.heroGlassPro })}
                    </p>
                  </div>
                </aside>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="demo-design-dir min-w-0 pb-0 text-white">
        <div id="site-content" className="home-body-ink scroll-mt-14">
          <section className="demo-design-dir__section demo-design-dir__section--band-a py-16 sm:py-20">
            <div className="demo-design-dir__shell">
              <PricingIncluded embedded />
            </div>
          </section>

          <section className="demo-design-dir__section demo-design-dir__section--band-b py-16 sm:py-20">
            <div className="demo-design-dir__shell">
              <IrissSection editorialColumn />
            </div>
          </section>
        </div>

        <HomeFaqSection />

        <section className="demo-design-dir__section border-t border-white/[0.06] pb-0">
          <Footer />
        </section>
      </div>
    </div>
  );
}
