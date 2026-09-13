"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";

const empty = {
  companyName: "",
  companyReg: "",
  companyAddress: "",
  contactName: "",
  email: "",
  phone: "",
  password: "",
  passwordConfirm: "",
};

export function B2bPartnerInviteRegister({ token }: { token: string }) {
  const t = useTranslations("Partner");
  const locale = useLocale();
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [resendBusy, setResendBusy] = useState(false);
  const [resendOk, setResendOk] = useState(false);

  const onSubmit = async () => {
    if (form.password.trim() !== form.passwordConfirm.trim()) {
      setError(t("passwordMismatch"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/partner/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName,
          companyReg: form.companyReg,
          companyAddress: form.companyAddress,
          contactName: form.contactName,
          email: form.email,
          phone: form.phone,
          password: form.password,
          token,
          locale,
        }),
      });
      if (!res.ok) {
        setError(t("inviteRegisterError"));
        return;
      }
      const data = (await res.json()) as { email?: string };
      setPendingEmail(data.email?.trim() || form.email.trim());
    } catch {
      setError(t("inviteRegisterError"));
    } finally {
      setBusy(false);
    }
  };

  const onResend = async () => {
    if (!pendingEmail) return;
    setResendBusy(true);
    setResendOk(false);
    try {
      await fetch("/api/partner/verify/resend", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail, locale }),
      });
      setResendOk(true);
    } catch {
      setResendOk(true);
    } finally {
      setResendBusy(false);
    }
  };

  const field = (
    key: keyof typeof empty,
    labelKey:
      | "fieldCompany"
      | "fieldReg"
      | "fieldAddress"
      | "fieldContact"
      | "fieldEmail"
      | "fieldPhone"
      | "loginPassword"
      | "passwordConfirm",
    extra?: { type?: string; autoComplete?: string; className?: string },
  ) => (
    <label key={key} className={`block min-w-0 ${extra?.className ?? ""}`}>
      <span className="mb-1 block text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {t(labelKey)}
      </span>
      <input
        className={styles.inlineInput}
        value={form[key]}
        type={
          extra?.type ??
          (key === "email" ? "email" : key === "phone" ? "tel" : key === "password" || key === "passwordConfirm" ? "password" : "text")
        }
        autoComplete={extra?.autoComplete ?? "off"}
        onChange={(event) => {
          setForm((prev) => ({ ...prev, [key]: event.target.value }));
          setError("");
        }}
      />
    </label>
  );

  if (pendingEmail) {
    return (
      <div className="flex w-full flex-col gap-3">
        <p className="text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-[#93c5fd]">
          {t("verifyPendingTitle")}
        </p>
        <p className="text-[0.84rem] leading-relaxed text-zinc-300">{t("verifyPendingLead", { email: pendingEmail })}</p>
        <p className="text-[0.75rem] leading-snug text-zinc-500">{t("verifyPendingHint")}</p>
        {resendOk ? <p className="text-[0.75rem] text-zinc-300">{t("verifyResendOk")}</p> : null}
        <button type="button" className={styles.liquidCta} disabled={resendBusy} onClick={() => void onResend()}>
          <span className={styles.liquidCtaShimmer} aria-hidden />
          <span className={styles.liquidCtaLabel}>{resendBusy ? t("verifyResendBusy") : t("verifyResend")}</span>
        </button>
      </div>
    );
  }

  return (
    <form
      className="flex w-full flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <p className="text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-[#93c5fd]">
        {t("inviteRegisterTitle")}
      </p>
      <p className="text-[0.75rem] leading-snug text-zinc-400">{t("inviteRegisterLead")}</p>
      <div className="grid grid-cols-1 gap-2.5 min-[380px]:grid-cols-2">
        {field("companyName", "fieldCompany")}
        {field("companyReg", "fieldReg")}
        {field("companyAddress", "fieldAddress", { className: "min-[380px]:col-span-2" })}
        {field("contactName", "fieldContact")}
        {field("email", "fieldEmail", { type: "email", autoComplete: "email" })}
        {field("phone", "fieldPhone", { type: "tel", autoComplete: "tel" })}
        {field("password", "loginPassword", { type: "password", autoComplete: "new-password" })}
        {field("passwordConfirm", "passwordConfirm", { type: "password", autoComplete: "new-password" })}
      </div>
      {error ? <p className={styles.inlineFieldError}>{error}</p> : null}
      <button type="submit" className={styles.liquidCta} disabled={busy}>
        <span className={styles.liquidCtaShimmer} aria-hidden />
        <span className={styles.liquidCtaLabel}>
          {busy ? t("inviteRegisterLoading") : t("inviteRegisterSubmit")}
        </span>
      </button>
    </form>
  );
}
