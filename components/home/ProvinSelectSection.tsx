"use client";

import { AlertTriangle, Filter, Layers, MessageSquare, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import demoPageStyles from "@/app/[locale]/demo/page.module.css";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { PROVIN_SELECT_FORM_HASH, PROVIN_SELECT_SECTION_ID } from "@/lib/provin-select-section";
import {
  homePillarCardBodyClass,
  homePillarCardShellClass,
  homePillarCardTitleClass,
  homePillarGridWidthClass,
} from "@/lib/home-pricing-pillar-cards";
import {
  heroPillarCardIconClass,
  homeEditorialAuthorityHeadingClass,
  homeEditorialSectionBodyLeadClass,
  homeEditorialSectionTitleClass,
} from "@/lib/home-layout";
import { renderProvinText } from "@/lib/provin-wordmark";

const SELECT_CARD_ICONS: LucideIcon[] = [Layers, Filter, AlertTriangle, MessageSquare];

const NOTES_MAX = 500;
const NAME_MAX = 120;
const SEL_BRAND_MAX = 400;
const SEL_SHORT_MAX = 120;
const SEL_ENGINE_MAX = 200;
const SEL_TEX_MAX = 400;
const SEL_EQ_MAX = 500;

type IncludedRow = { title: string; body: string };

type ProvinSelectSectionProps = {
  /** `standalone` — tikai konsultācijas forma (lapa `/provin-select-pieteikums`). */
  variant?: "full" | "standalone";
};

export function ProvinSelectSection({ variant = "full" }: ProvinSelectSectionProps) {
  const t = useTranslations("ProvinSelect");
  const tOrder = useTranslations("Order");
  const locale = useLocale();
  const rawIncluded = t.raw("included");
  const includedRows: IncludedRow[] = Array.isArray(rawIncluded)
    ? (rawIncluded as IncludedRow[]).filter((r) => r && typeof r.title === "string" && typeof r.body === "string")
    : [];

  const [step, setStep] = useState<1 | 2>(1);
  const [brandModel, setBrandModel] = useState("");
  const [productionYears, setProductionYears] = useState("");
  const [plannedBudget, setPlannedBudget] = useState("");
  const [engineType, setEngineType] = useState("");
  const [transmission, setTransmission] = useState("");
  const [maxMileage, setMaxMileage] = useState("");
  const [exteriorColors, setExteriorColors] = useState("");
  const [interiorMaterial, setInteriorMaterial] = useState("");
  const [requiredEquipment, setRequiredEquipment] = useState("");
  const [desiredEquipment, setDesiredEquipment] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [withdrawalConsent, setWithdrawalConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "loading">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const scrollToFormIfHash = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== `#${PROVIN_SELECT_FORM_HASH}`) return;
    window.requestAnimationFrame(() => {
      document.getElementById(PROVIN_SELECT_FORM_HASH)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  useEffect(() => {
    scrollToFormIfHash();
    window.addEventListener("hashchange", scrollToFormIfHash);
    return () => window.removeEventListener("hashchange", scrollToFormIfHash);
  }, [scrollToFormIfHash]);

  const requiredHint = tOrder("validation.required");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg(null);
    setConsentError(null);
    if (!withdrawalConsent) {
      setConsentError(tOrder("errors.withdrawalRequired"));
      requestAnimationFrame(() => document.getElementById("provin-select-checkout-consent")?.focus());
      return;
    }
    if (!plannedBudget.trim()) {
      setErrMsg(requiredHint);
      return;
    }
    if (!engineType.trim()) {
      setErrMsg(requiredHint);
      return;
    }
    if (!transmission.trim()) {
      setErrMsg(requiredHint);
      return;
    }
    if (!email.trim()) {
      setErrMsg(tOrder("validation.email"));
      return;
    }
    if (!phone.trim()) {
      setErrMsg(tOrder("validation.phone"));
      return;
    }

    setPhase("loading");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutLine: "provin_select",
          name: name.trim().slice(0, NAME_MAX),
          email: email.trim(),
          phone: phone.trim(),
          notes: comment.trim().slice(0, NOTES_MAX),
          selectBrandModel: brandModel.trim().slice(0, SEL_BRAND_MAX),
          selectProductionYearsDpf: productionYears.trim().slice(0, SEL_SHORT_MAX),
          selectPlannedBudget: plannedBudget.trim().slice(0, SEL_SHORT_MAX),
          selectEngineType: engineType.trim().slice(0, SEL_ENGINE_MAX),
          selectTransmission: transmission.trim().slice(0, SEL_SHORT_MAX),
          selectMaxMileage: maxMileage.trim().slice(0, SEL_SHORT_MAX),
          selectExteriorColor: exteriorColors.trim().slice(0, SEL_TEX_MAX),
          selectInteriorMaterial: interiorMaterial.trim().slice(0, SEL_TEX_MAX),
          selectRequiredEquipment: requiredEquipment.trim().slice(0, SEL_EQ_MAX),
          selectDesiredEquipment: desiredEquipment.trim().slice(0, SEL_EQ_MAX),
          locale,
          withdrawalConsent: true,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string; errors?: string[] };
      if (!res.ok) {
        const msg = data.errors?.[0] ?? data.error ?? tOrder("errors.checkoutFailed");
        setErrMsg(msg);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setErrMsg(tOrder("errors.noUrl"));
    } catch {
      setErrMsg(tOrder("errors.network"));
    } finally {
      setPhase("idle");
    }
  };

  const isStandalone = variant === "standalone";
  const headingId = isStandalone ? "provin-select-standalone-heading" : "provin-select-heading";
  const sectionId = isStandalone ? "provin-select-pieteikums" : PROVIN_SELECT_SECTION_ID;
  const fieldDisabled = phase === "loading";

  return (
    <section
      id={sectionId}
      aria-labelledby={headingId}
      className={`provin-select-section home-body-ink relative scroll-mt-16 overflow-x-clip home-hero-intro-surface ${demoPageStyles.heroIntroSurface} py-16 sm:py-20`}
    >
      <div className="demo-design-dir__shell relative">
        {variant === "full" ? (
          <>
            <div className="mx-auto max-w-[min(100%,48rem)] text-center">
              <h2 id={headingId} className={homeEditorialSectionTitleClass}>
                {renderProvinText(t("eyebrow"), {
                  proAndSuffixClassName: "provin-wordmark-pro",
                  vinAmberOnlyBeforeSelect: true,
                })}
              </h2>
              <div className="mx-auto mt-3 w-full max-w-[min(100%,42rem)] px-1 sm:px-2">
                <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
              </div>
              <p className={homeEditorialSectionBodyLeadClass}>{t("lead")}</p>
            </div>

            <ul
              className={`mx-auto mt-12 grid list-none grid-cols-1 items-stretch gap-3 sm:mt-14 sm:grid-cols-2 sm:gap-4 md:gap-5 lg:mt-16 lg:grid-cols-4 ${homePillarGridWidthClass}`}
            >
              {includedRows.map((row, i) => {
                const Icon = SELECT_CARD_ICONS[i] ?? Layers;
                const riskCard = i === 2;
                const iconTone = riskCard ? "marketing-hero-pillar-icon--risk text-[#ff342e]" : "";
                return (
                  <li key={row.title} className="flex min-h-0 min-w-0">
                    <div className={`${homePillarCardShellClass} h-full w-full min-w-0`}>
                      <Icon className={`${heroPillarCardIconClass} ${iconTone}`.trim()} aria-hidden strokeWidth={1.5} />
                      <h3 className={homePillarCardTitleClass}>{row.title}</h3>
                      <p className={homePillarCardBodyClass}>{row.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div
              className={`mx-auto mt-3 flex w-full max-w-[min(100%,40rem)] flex-col items-center gap-2 px-1 text-center sm:mt-4 ${homePillarGridWidthClass}`}
            >
              <p className="pricing-auto-records-footnote text-[10px] font-normal leading-snug text-white/55 sm:text-[11px]">
                {t("cardsTrustLine")}
              </p>
              <p className="pricing-auto-records-footnote text-[10px] font-normal leading-snug text-white/45 sm:text-[11px]">
                {renderProvinText(t("cardsVinNote"), {
                  proAndSuffixClassName: "provin-wordmark-pro",
                  vinAmberOnlyBeforeSelect: true,
                })}
              </p>
            </div>
          </>
        ) : isStandalone ? (
          <div className="mx-auto max-w-[min(100%,48rem)] text-center">
            <h2 id={headingId} className={homeEditorialSectionTitleClass}>
              {t("formTitle")}
            </h2>
            <div className="mx-auto mt-3 w-full max-w-[min(100%,42rem)] px-1 sm:px-2">
              <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
            </div>
            <p className={homeEditorialSectionBodyLeadClass}>{t("lead")}</p>
          </div>
        ) : null}

        <div
          className={`mx-auto max-w-[min(100%,40rem)] space-y-10 text-left text-pretty ${isStandalone ? "mt-10 md:mt-12" : "mt-12 md:mt-14"}`}
        >
          <div id={PROVIN_SELECT_FORM_HASH} className="scroll-mt-[calc(3.5rem+8px)]">
            {isStandalone ? null : (
              <>
                <h3 className={`${homeEditorialAuthorityHeadingClass} text-center`}>{t("formTitle")}</h3>
                <div className="mt-3 w-full">
                  <DiagnosticScanLine variant="rail" motion="none" className="w-full" />
                </div>
              </>
            )}
            <div className={`${demoPageStyles.heroFormCard} mx-auto ${isStandalone ? "mt-2" : "mt-4"} w-full max-w-[520px]`}>
              {step === 1 ? (
                <div className="order-form--hero !mt-0 w-full space-y-4 !px-0 !py-0 sm:!px-0 sm:!py-0">
                  <p className="demo-design-dir__body text-[13px] font-medium leading-snug text-white/90">{t("step1Title")}</p>
                  <p className="demo-design-dir__body text-[12px] leading-relaxed text-white/78">{t("step1Intro")}</p>
                  <p className="demo-design-dir__body text-[11px] leading-relaxed text-white/65">{tOrder("summaryNoteConsultation")}</p>
                  <p className="demo-design-dir__body text-[11px] leading-relaxed text-white/60">{t("financingNote")}</p>
                  <button
                    type="button"
                    className={`${demoPageStyles.ctaButtonHeroConsult} !mt-2 w-full max-w-[min(416px,calc(100vw-2rem))]`}
                    onClick={() => {
                      setErrMsg(null);
                      setStep(2);
                    }}
                  >
                    {tOrder("continueButton")}
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => void onSubmit(e)}
                  className="order-form--hero !mt-0 w-full space-y-3 !px-0 !py-0 sm:!px-0 sm:!py-0"
                >
                  <button
                    type="button"
                    className="demo-design-dir__body mb-1 text-left text-[12px] font-medium text-provin-accent underline decoration-provin-accent/35 underline-offset-2 hover:decoration-provin-accent/70"
                    onClick={() => {
                      setErrMsg(null);
                      setStep(1);
                    }}
                    disabled={fieldDisabled}
                  >
                    {tOrder("backToFirstStep")}
                  </button>
                  <h4 className="demo-design-dir__body text-center text-[13px] font-semibold uppercase tracking-wide text-white/88">
                    {t("strategyFormTitle")}
                  </h4>

                  <label className={demoPageStyles.field}>
                    <span className={demoPageStyles.fieldLabel}>{t("fieldBrandModel")}</span>
                    <input
                      type="text"
                      name="selectBrandModel"
                      value={brandModel}
                      onChange={(e) => setBrandModel(e.target.value)}
                      maxLength={SEL_BRAND_MAX}
                      className="w-full"
                      disabled={fieldDisabled}
                    />
                  </label>
                  <label className={demoPageStyles.field}>
                    <span className={demoPageStyles.fieldLabel}>{t("fieldProductionYears")}</span>
                    <input
                      type="text"
                      name="selectProductionYearsDpf"
                      value={productionYears}
                      onChange={(e) => setProductionYears(e.target.value)}
                      maxLength={SEL_SHORT_MAX}
                      className="w-full"
                      disabled={fieldDisabled}
                    />
                  </label>
                  <label className={demoPageStyles.field}>
                    <span className={demoPageStyles.fieldLabel}>{t("fieldPlannedBudget")}</span>
                    <input
                      type="text"
                      name="selectPlannedBudget"
                      value={plannedBudget}
                      onChange={(e) => setPlannedBudget(e.target.value)}
                      maxLength={SEL_SHORT_MAX}
                      className="w-full"
                      required
                      disabled={fieldDisabled}
                    />
                  </label>
                  <label className={demoPageStyles.field}>
                    <span className={demoPageStyles.fieldLabel}>{t("fieldEngineType")}</span>
                    <input
                      type="text"
                      name="selectEngineType"
                      value={engineType}
                      onChange={(e) => setEngineType(e.target.value)}
                      maxLength={SEL_ENGINE_MAX}
                      className="w-full"
                      required
                      disabled={fieldDisabled}
                    />
                  </label>
                  <label className={demoPageStyles.field}>
                    <span className={demoPageStyles.fieldLabel}>{t("fieldTransmission")}</span>
                    <input
                      type="text"
                      name="selectTransmission"
                      value={transmission}
                      onChange={(e) => setTransmission(e.target.value)}
                      maxLength={SEL_SHORT_MAX}
                      className="w-full"
                      required
                      disabled={fieldDisabled}
                    />
                  </label>
                  <label className={demoPageStyles.field}>
                    <span className={demoPageStyles.fieldLabel}>{t("fieldMaxMileage")}</span>
                    <input
                      type="text"
                      name="selectMaxMileage"
                      value={maxMileage}
                      onChange={(e) => setMaxMileage(e.target.value)}
                      maxLength={SEL_SHORT_MAX}
                      className="w-full"
                      disabled={fieldDisabled}
                    />
                  </label>
                  <label className={demoPageStyles.field}>
                    <span className={demoPageStyles.fieldLabel}>{t("fieldExteriorColors")}</span>
                    <input
                      type="text"
                      name="selectExteriorColor"
                      value={exteriorColors}
                      onChange={(e) => setExteriorColors(e.target.value)}
                      maxLength={SEL_TEX_MAX}
                      className="w-full"
                      disabled={fieldDisabled}
                    />
                  </label>
                  <label className={demoPageStyles.field}>
                    <span className={demoPageStyles.fieldLabel}>{t("fieldInteriorMaterial")}</span>
                    <input
                      type="text"
                      name="selectInteriorMaterial"
                      value={interiorMaterial}
                      onChange={(e) => setInteriorMaterial(e.target.value)}
                      maxLength={SEL_TEX_MAX}
                      className="w-full"
                      disabled={fieldDisabled}
                    />
                  </label>
                  <label className={demoPageStyles.field}>
                    <span className={demoPageStyles.fieldLabel}>{t("fieldRequiredEquipment")}</span>
                    <input
                      type="text"
                      name="selectRequiredEquipment"
                      value={requiredEquipment}
                      onChange={(e) => setRequiredEquipment(e.target.value)}
                      maxLength={SEL_EQ_MAX}
                      className="w-full"
                      disabled={fieldDisabled}
                    />
                  </label>
                  <label className={demoPageStyles.field}>
                    <span className={demoPageStyles.fieldLabel}>{t("fieldDesiredEquipment")}</span>
                    <input
                      type="text"
                      name="selectDesiredEquipment"
                      value={desiredEquipment}
                      onChange={(e) => setDesiredEquipment(e.target.value)}
                      maxLength={SEL_EQ_MAX}
                      className="w-full"
                      disabled={fieldDisabled}
                    />
                  </label>

                  <label className={demoPageStyles.field}>
                    <span className={demoPageStyles.fieldLabel}>{t("nameLabel")}</span>
                    <input
                      type="text"
                      name="name"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={NAME_MAX}
                      className="w-full"
                      disabled={fieldDisabled}
                    />
                  </label>
                  <label className={demoPageStyles.field}>
                    <span className={demoPageStyles.fieldLabel}>{t("phoneLabel")}</span>
                    <input
                      type="tel"
                      name="phone"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full"
                      required
                      disabled={fieldDisabled}
                    />
                  </label>
                  <label className={demoPageStyles.field}>
                    <span className={demoPageStyles.fieldLabel}>{t("emailLabel")}</span>
                    <input
                      type="email"
                      name="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full"
                      required
                      disabled={fieldDisabled}
                    />
                  </label>
                  <label className={demoPageStyles.field}>
                    <span className={demoPageStyles.fieldLabel}>{t("commentLabel")}</span>
                    <textarea
                      name="comment"
                      rows={4}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder={t("commentPlaceholder")}
                      className="w-full min-h-[6rem]"
                      maxLength={NOTES_MAX}
                      disabled={fieldDisabled}
                    />
                  </label>
                  <p className="demo-design-dir__body text-[11px] leading-relaxed opacity-80">{t("followupNote")}</p>

                  <div className="order-form-hero-rule border-b border-[#c0c0c0]/35 pb-4 pt-2">
                    <label
                      htmlFor="provin-select-checkout-consent"
                      className="flex min-h-11 cursor-pointer items-start gap-3 text-left sm:min-h-0"
                    >
                      <input
                        id="provin-select-checkout-consent"
                        type="checkbox"
                        name="withdrawalConsent"
                        checked={withdrawalConsent}
                        onChange={(e) => {
                          setWithdrawalConsent(e.target.checked);
                          setConsentError(null);
                        }}
                        className="order-form-hero-checkbox mt-1 h-4 w-4 shrink-0 rounded border-[#c0c0c0] bg-transparent text-provin-accent focus:ring-1 focus:ring-emerald-400/45 sm:mt-0.5 sm:h-4 sm:w-4"
                        aria-invalid={Boolean(consentError)}
                        aria-describedby={consentError ? "provin-select-consent-error" : undefined}
                        aria-label={tOrder("checkoutConsentAria")}
                        disabled={fieldDisabled}
                      />
                      <span className="order-form-hero-consent-text text-[12px] font-normal leading-snug text-[#e5e7eb] sm:text-[13px]">
                        {tOrder.rich("checkoutConsent", {
                          terms: (chunks) => (
                            <Link
                              href="/lietosanas-noteikumi"
                              className="font-medium text-provin-accent underline decoration-provin-accent/30 underline-offset-2 transition hover:decoration-provin-accent/60"
                            >
                              {chunks}
                            </Link>
                          ),
                          privacy: (chunks) => (
                            <Link
                              href="/privatuma-politika"
                              className="font-medium text-provin-accent underline decoration-provin-accent/30 underline-offset-2 transition hover:decoration-provin-accent/60"
                            >
                              {chunks}
                            </Link>
                          ),
                        })}
                      </span>
                    </label>
                    {consentError ? (
                      <p
                        id="provin-select-consent-error"
                        className="order-form-hero-field-error mt-2 px-0.5 text-left text-[12px] font-normal leading-snug text-red-300 sm:text-[11px]"
                        role="alert"
                        aria-live="polite"
                      >
                        {consentError}
                      </p>
                    ) : null}
                  </div>

                  {errMsg ? (
                    <p className="provin-select-form-error text-[12px]" role="alert">
                      {errMsg}
                    </p>
                  ) : null}
                  <div className="flex flex-col items-center gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={fieldDisabled}
                      className={`${demoPageStyles.ctaButtonHeroConsult} !mt-0 w-full max-w-[min(416px,calc(100vw-2rem))] disabled:cursor-wait disabled:opacity-60`}
                    >
                      {phase === "loading" ? tOrder("payLoading") : t("submit")}
                    </button>
                    <p className="order-form-hero-stripe-note text-center text-[10px] font-normal leading-relaxed text-[#e5e7eb]/48 sm:text-[11px]">
                      {tOrder("stripeNote")}
                    </p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
