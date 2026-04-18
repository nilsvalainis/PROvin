"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import styles from "@/app/[locale]/demo/page.module.css";
import { homeSectionEyebrowClass } from "@/lib/home-layout";
import { PROVIN_SELECT_FORM_HASH, PROVIN_SELECT_SECTION_ID } from "@/lib/provin-select-section";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2.5 text-[14px] leading-snug text-white/[0.95] shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] outline-none transition placeholder:text-white/38 focus:border-[rgb(0,102,255/0.55)] focus:ring-0";

const labelClass = "block text-left text-[11px] font-medium uppercase tracking-[0.06em] text-white/55";

type IncludedRow = { title: string; body: string };

export function ProvinSelectSection() {
  const t = useTranslations("ProvinSelect");
  const rawIncluded = t.raw("included");
  const includedRows: IncludedRow[] = Array.isArray(rawIncluded)
    ? (rawIncluded as IncludedRow[]).filter((r) => r && typeof r.title === "string" && typeof r.body === "string")
    : [];

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const syncHash = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === `#${PROVIN_SELECT_FORM_HASH}`) {
      setFormOpen(true);
      setPhase("idle");
    }
  }, []);

  useEffect(() => {
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [syncHash]);

  useEffect(() => {
    if (!formOpen) return;
    window.requestAnimationFrame(() => {
      document.getElementById(PROVIN_SELECT_FORM_HASH)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [formOpen]);

  const openForm = useCallback(() => {
    setFormOpen(true);
    setPhase("idle");
    setErrMsg(null);
    if (typeof window !== "undefined") {
      const next = `#${PROVIN_SELECT_FORM_HASH}`;
      if (window.location.hash !== next) {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${next}`);
      }
    }
  }, []);

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
      className="demo-design-dir__section demo-design-dir__section--band-c border-t border-white/[0.06] py-16 sm:py-20"
    >
      <div className="demo-design-dir__shell">
        <div className="mx-auto max-w-[min(100%,40rem)] text-pretty text-white/88">
          <p className={`${homeSectionEyebrowClass} mb-2 text-center`}>{t("eyebrow")}</p>
          <p className="mb-4 text-center text-[clamp(1.05rem,2.5vw,1.35rem)] font-semibold leading-snug tracking-tight text-white">
            {t("lead")}
          </p>
          <p className="mb-4 text-center text-[0.95rem] leading-relaxed text-white/78">{t("body1")}</p>
          <p className="mb-8 text-center text-[0.95rem] font-medium text-white/90">{t("priceLine")}</p>

          <h3 className="mb-3 text-left text-[0.72rem] font-bold uppercase tracking-[0.14em] text-white/55">
            {t("includedTitle")}
          </h3>
          <ul className="mb-10 space-y-4">
            {includedRows.map((row) => (
              <li key={row.title} className="flex gap-2.5 text-[0.92rem] leading-snug text-white/82">
                <span className="mt-0.5 shrink-0 font-black text-emerald-400" aria-hidden>
                  ✓
                </span>
                <span>
                  <strong className="font-semibold text-white/92">{row.title}</strong>
                  {": "}
                  {row.body}
                </span>
              </li>
            ))}
          </ul>

          <h3 className="mb-2 text-left text-[0.72rem] font-bold uppercase tracking-[0.14em] text-white/55">
            {t("whyTitle")}
          </h3>
          <p className="mb-8 text-[0.92rem] leading-relaxed text-white/80">{t("whyBody")}</p>

          <h3 className="mb-2 text-left text-[0.72rem] font-bold uppercase tracking-[0.14em] text-white/55">
            {t("deliveryTitle")}
          </h3>
          <p className="text-[0.92rem] text-white/82">{t("delivery1")}</p>
          <p className="mb-8 text-[0.92rem] text-white/82">{t("delivery2")}</p>

          <div className="flex justify-center">
            <button type="button" className={styles.ctaButton} onClick={openForm}>
              {t("ctaPrimary")}
            </button>
          </div>

          {formOpen ? (
            <div
              id={PROVIN_SELECT_FORM_HASH}
              className="scroll-mt-[calc(3.5rem+8px)] mt-10 rounded-2xl border border-white/10 bg-black/25 p-5 sm:p-6"
            >
              <h3 className="mb-4 text-center text-[0.85rem] font-semibold uppercase tracking-[0.1em] text-white/70">
                {t("formTitle")}
              </h3>
              {phase === "ok" ? (
                <p className="text-center text-[0.95rem] text-emerald-300/95" role="status">
                  {t("success")}
                </p>
              ) : (
                <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
                  <label className={labelClass}>
                    {t("nameLabel")}
                    <input
                      type="text"
                      name="name"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputClass}
                      required
                    />
                  </label>
                  <label className={labelClass}>
                    {t("phoneLabel")}
                    <input
                      type="tel"
                      name="phone"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={inputClass}
                      required
                    />
                  </label>
                  <label className={labelClass}>
                    {t("emailLabel")}
                    <input
                      type="email"
                      name="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                      required
                    />
                  </label>
                  <label className={labelClass}>
                    {t("messageLabel")}
                    <textarea
                      name="message"
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={t("messagePlaceholder")}
                      className={`${inputClass} min-h-[7.5rem] resize-y`}
                      required
                    />
                  </label>
                  <p className="text-[11px] leading-relaxed text-white/50">{t("followupNote")}</p>
                  {errMsg ? (
                    <p className="text-[12px] text-amber-200/95" role="alert">
                      {errMsg}
                    </p>
                  ) : null}
                  <div className="flex justify-center pt-1">
                    <button
                      type="submit"
                      disabled={phase === "loading"}
                      className={`${styles.ctaButton} !mt-0 disabled:cursor-wait disabled:opacity-60`}
                    >
                      {phase === "loading" ? t("submitting") : t("submit")}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
