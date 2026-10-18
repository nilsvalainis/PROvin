"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { B2bPartnerDialog } from "@/components/b2b/B2bPartnerDialog";
import { Link } from "@/i18n/navigation";
import {
  b2bPartnerLeadFieldError,
  normalizeB2bPartnerLeadInput,
  type B2bPartnerLeadField,
} from "@/lib/b2b-partner-lead";

const LABEL_CLASS = "mb-1.5 block text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-zinc-500";

const FIELD_ERROR_KEY = {
  contactName: "quoteErrContact",
  companyName: "quoteErrCompany",
  phone: "quoteErrPhone",
  email: "quoteErrEmail",
  consent: "quoteErrConsent",
} as const satisfies Record<B2bPartnerLeadField, string>;

export function B2bPartnerQuoteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("Partner");
  const locale = useLocale();
  const [form, setForm] = useState({
    contactName: "",
    companyName: "",
    companyReg: "",
    companyAddress: "",
    vatNumber: "",
    phone: "",
    email: "",
    message: "",
  });
  const [consent, setConsent] = useState(false);
  const [fieldError, setFieldError] = useState<B2bPartnerLeadField | null>(null);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const close = () => {
    onClose();
    if (done) {
      setDone(false);
      setForm({
        contactName: "",
        companyName: "",
        companyReg: "",
        companyAddress: "",
        vatNumber: "",
        phone: "",
        email: "",
        message: "",
      });
      setConsent(false);
    }
    setFieldError(null);
    setFormError("");
  };

  const set = (key: keyof typeof form) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (fieldError === key) setFieldError(null);
    setFormError("");
  };

  const onSubmit = async () => {
    const input = normalizeB2bPartnerLeadInput({ ...form, consent });
    const invalid = b2bPartnerLeadFieldError(input);
    if (invalid) {
      setFieldError(invalid);
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      const res = await fetch("/api/partner/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, locale }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; field?: B2bPartnerLeadField };
      if (res.status === 400 && data.field && data.field in FIELD_ERROR_KEY) {
        setFieldError(data.field);
        return;
      }
      if (!res.ok || !data.ok) {
        setFormError(t("quoteErrNetwork"));
        return;
      }
      setDone(true);
    } catch {
      setFormError(t("quoteErrNetwork"));
    } finally {
      setBusy(false);
    }
  };

  const errorFor = (key: keyof typeof form | "consent") => {
    if (fieldError !== key || !(key in FIELD_ERROR_KEY)) return null;
    return <p className={`${styles.inlineFieldError} mt-1.5`}>{t(FIELD_ERROR_KEY[key as B2bPartnerLeadField])}</p>;
  };

  const input = (
    key: "contactName" | "companyName" | "companyReg" | "companyAddress" | "vatNumber" | "phone" | "email",
    label: string,
    extra: object,
  ) => (
    <label className="block min-w-0">
      <span className={LABEL_CLASS}>{label}</span>
      <input
        className={`${styles.inlineInput}${fieldError === key ? ` ${styles.inlineInputError}` : ""}`}
        value={form[key]}
        onChange={(event) => set(key)(event.target.value)}
        aria-invalid={fieldError === key ? true : undefined}
        disabled={busy}
        {...extra}
      />
      {errorFor(key)}
    </label>
  );

  return (
    <B2bPartnerDialog open={open} onClose={close} title={t("quoteTitle")} closeLabel={t("quoteClose")}>
      {done ? (
        <div className="flex flex-col gap-6">
          <p className="text-[0.95rem] font-medium leading-snug text-emerald-300" role="status">
            {t("quoteSuccess")}
          </p>
          <button type="button" className={styles.liquidCta} onClick={close}>
            <span className={styles.liquidCtaShimmer} aria-hidden />
            <span className={styles.liquidCtaLabel}>{t("quoteClose")}</span>
          </button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy) void onSubmit();
          }}
        >
          <p className="text-[0.82rem] leading-relaxed text-zinc-400">{t("quoteLead")}</p>
          {input("contactName", t("quoteContact"), { autoComplete: "name" })}
          {input("companyName", t("quoteCompany"), { autoComplete: "organization" })}
          {input("companyReg", t("quoteReg"), { autoComplete: "off", inputMode: "numeric" })}
          {input("companyAddress", t("quoteAddress"), { autoComplete: "street-address" })}
          {input("vatNumber", t("quoteVat"), { autoComplete: "off" })}
          {input("phone", t("quotePhone"), { type: "tel", autoComplete: "tel", inputMode: "tel" })}
          {input("email", t("quoteEmail"), {
            type: "email",
            autoComplete: "email",
            inputMode: "email",
            autoCapitalize: "none",
          })}
          <label className="block min-w-0">
            <span className={LABEL_CLASS}>{t("quoteMessage")}</span>
            <textarea
              className={`${styles.inlineInput} min-h-[5.5rem] resize-y py-2.5`}
              value={form.message}
              onChange={(event) => set("message")(event.target.value)}
              placeholder={t("quoteMessagePlaceholder")}
              maxLength={2000}
              disabled={busy}
            />
          </label>
          <div>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => {
                  setConsent(event.target.checked);
                  if (fieldError === "consent") setFieldError(null);
                }}
                className="mt-0.5 h-4 w-4 shrink-0 rounded-[0.2rem] border-zinc-500 bg-transparent text-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/40"
                aria-invalid={fieldError === "consent" ? true : undefined}
                disabled={busy}
              />
              <span className="text-[0.75rem] leading-snug text-zinc-400">
                {t.rich("quoteConsent", {
                  privacy: (chunks) => (
                    <Link
                      href="/privatuma-politika"
                      target="_blank"
                      className="text-[#93c5fd] underline-offset-2 hover:underline"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </span>
            </label>
            {errorFor("consent")}
          </div>
          {formError ? <p className={styles.inlineFieldError}>{formError}</p> : null}
          <button type="submit" className={styles.liquidCta} disabled={busy}>
            <span className={styles.liquidCtaShimmer} aria-hidden />
            <span className={styles.liquidCtaLabel}>{busy ? t("quoteSubmitting") : t("quoteSubmit")}</span>
          </button>
          <p className="text-[0.68rem] leading-snug text-zinc-500">{t("quoteRequiredNote")}</p>
        </form>
      )}
    </B2bPartnerDialog>
  );
}
