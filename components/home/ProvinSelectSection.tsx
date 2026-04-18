"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import demoPageStyles from "@/app/[locale]/demo/page.module.css";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { PROVIN_SELECT_FORM_HASH, PROVIN_SELECT_SECTION_ID } from "@/lib/provin-select-section";

const subsectionHeadingClass =
  "iriss-editorial-heading font-semibold uppercase tracking-[0.08em] text-white/90";

type IncludedRow = { title: string; body: string };

export function ProvinSelectSection() {
  const t = useTranslations("ProvinSelect");
  const rawIncluded = t.raw("included");
  const includedRows: IncludedRow[] = Array.isArray(rawIncluded)
    ? (rawIncluded as IncludedRow[]).filter((r) => r && typeof r.title === "string" && typeof r.body === "string")
    : [];

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<"idle" | "loading" | "ok" | "err">("idle");
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg(null);
    setPhase("loading");
    try {
      const res = await fetch("/api/provin-select-consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, message }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (res.status === 503 && typeof data === "object" && data && "error" in data) {
        const err = (data as { error?: string }).error;
        setErrMsg(err === "smtp_not_configured" || err === "no_admin_email" ? t("errorSmtp") : t("errorGeneric"));
        setPhase("err");
        return;
      }
      if (!res.ok) {
        if (
          typeof data === "object" &&
          data &&
          "error" in data &&
          (data as { error: unknown }).error === "validation" &&
          "field" in data &&
          typeof (data as { field: unknown }).field === "string"
        ) {
          const f = (data as { field: string }).field;
          if (f === "name" || f === "email" || f === "phone" || f === "message") {
            setErrMsg(t(`validation.${f}`));
          } else {
            setErrMsg(t("errorGeneric"));
          }
        } else {
          setErrMsg(t("errorGeneric"));
        }
        setPhase("err");
        return;
      }
      setPhase("ok");
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch {
      setErrMsg(t("errorGeneric"));
      setPhase("err");
    }
  };

  return (
    <section
      id={PROVIN_SELECT_SECTION_ID}
      aria-labelledby="provin-select-heading"
      className={`home-hero-intro-surface ${demoPageStyles.heroIntroSurface} home-body-ink relative scroll-mt-16 overflow-x-clip py-16 sm:py-20`}
    >
      <div className="demo-design-dir__shell relative">
        <div className="text-center">
          <h2
            id="provin-select-heading"
            className="demo-design-dir__title mx-auto max-w-[min(100%,48rem)] text-balance"
          >
            {t("eyebrow")}
          </h2>
          <div className="mx-auto mt-3 w-full max-w-[min(100%,42rem)] px-1 sm:px-2">
            <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
          </div>
          <p className="demo-design-dir__body mx-auto mt-3 max-w-[min(100%,40rem)] text-balance font-medium sm:mt-4">
            {t("lead")}
          </p>
          <p className="demo-design-dir__body mx-auto mt-3 max-w-[min(100%,40rem)] text-balance sm:mt-4">{t("body1")}</p>
          <p className="demo-design-dir__body mx-auto mt-3 max-w-[min(100%,40rem)] text-balance font-semibold sm:mt-4">
            {t("priceLine")}
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-[min(100%,40rem)] space-y-10 text-left text-pretty">
          <div>
            <h3 className={subsectionHeadingClass}>{t("includedTitle")}</h3>
            <div className="mt-3 w-full">
              <DiagnosticScanLine variant="rail" motion="none" className="w-full" />
            </div>
            <ul className="mb-0 mt-3 space-y-4">
              {includedRows.map((row) => (
                <li key={row.title} className="demo-design-dir__body flex gap-2.5 text-[0.92rem] leading-snug">
                  <span className="provin-select-included-check mt-0.5 shrink-0 font-black" aria-hidden>
                    ✓
                  </span>
                  <span>
                    <strong className="font-semibold">{row.title}</strong>
                    {": "}
                    {row.body}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className={subsectionHeadingClass}>{t("whyTitle")}</h3>
            <div className="mt-3 w-full">
              <DiagnosticScanLine variant="rail" motion="none" className="w-full" />
            </div>
            <p className="demo-design-dir__body mt-3">{t("whyBody")}</p>
          </div>

          <div>
            <h3 className={subsectionHeadingClass}>{t("deliveryTitle")}</h3>
            <div className="mt-3 w-full">
              <DiagnosticScanLine variant="rail" motion="none" className="w-full" />
            </div>
            <p className="demo-design-dir__body mt-3">{t("delivery1")}</p>
            <p className="demo-design-dir__body mt-1">{t("delivery2")}</p>
          </div>

          <div id={PROVIN_SELECT_FORM_HASH} className="scroll-mt-[calc(3.5rem+8px)]">
            <h3 className={subsectionHeadingClass}>{t("formTitle")}</h3>
            <div className="mt-3 w-full">
              <DiagnosticScanLine variant="rail" motion="none" className="w-full" />
            </div>
            {phase === "ok" ? (
              <p className="provin-select-success-msg mt-4 text-center text-[0.95rem]" role="status">
                {t("success")}
              </p>
            ) : (
              <form onSubmit={(e) => void onSubmit(e)} className="mx-auto mt-4 max-w-[520px] space-y-3">
                <label className={demoPageStyles.field}>
                  <span className={demoPageStyles.fieldLabel}>{t("nameLabel")}</span>
                  <input
                    type="text"
                    name="name"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full"
                    required
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
                  />
                </label>
                <label className={demoPageStyles.field}>
                  <span className={demoPageStyles.fieldLabel}>{t("messageLabel")}</span>
                  <textarea
                    name="message"
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t("messagePlaceholder")}
                    className="w-full min-h-[7.5rem]"
                    required
                  />
                </label>
                <p className="demo-design-dir__body text-[11px] leading-relaxed opacity-80">{t("followupNote")}</p>
                {errMsg ? (
                  <p className="provin-select-form-error text-[12px]" role="alert">
                    {errMsg}
                  </p>
                ) : null}
                <div className="flex justify-center pt-1">
                  <button
                    type="submit"
                    disabled={phase === "loading"}
                    className={`${demoPageStyles.ctaButton} !mt-0 disabled:cursor-wait disabled:opacity-60`}
                  >
                    {phase === "loading" ? t("submitting") : t("submit")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
