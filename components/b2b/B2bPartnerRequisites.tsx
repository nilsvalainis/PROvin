"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import type { B2bPartnerPublicProfile } from "@/lib/b2b-partner-account";

const TITLE_CLASS = "text-balance text-lg font-bold leading-snug tracking-tight text-zinc-100 sm:text-xl";
const TITLE_RULE_CLASS = "mt-2.5 h-px w-full bg-white/10";
const CARD_CLASS =
  "rounded-[0.85rem] border border-white/10 bg-gradient-to-b from-white/[0.045] to-white/[0.015] p-4 sm:p-5";
const LABEL_CLASS = "mb-1 block text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-zinc-500";
const SAVE_BTN =
  "inline-flex h-10 items-center justify-center rounded-full bg-[#2563EB] px-5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50";

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  className?: string;
}) {
  return (
    <label className={`block min-w-0 ${className ?? ""}`}>
      <span className={LABEL_CLASS}>{label}</span>
      <input
        className={styles.inlineInput}
        value={value}
        type={type}
        autoComplete={autoComplete ?? "off"}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function B2bPartnerRequisites({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const t = useTranslations("Partner");
  const locale = useLocale();
  const [profile, setProfile] = useState<B2bPartnerPublicProfile | null>(null);
  const [company, setCompany] = useState({
    companyName: "",
    companyReg: "",
    companyAddress: "",
    contactName: "",
    phone: "",
  });
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileError, setProfileError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [nextPasswordConfirm, setNextPasswordConfirm] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [emailPassword, setEmailPassword] = useState("");
  const [nextEmail, setNextEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/partner/me", { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as { partner?: B2bPartnerPublicProfile };
        if (!cancelled && data.partner) {
          setProfile(data.partner);
          setCompany({
            companyName: data.partner.companyName,
            companyReg: data.partner.companyReg,
            companyAddress: data.partner.companyAddress,
            contactName: data.partner.contactName,
            phone: data.partner.phone,
          });
        }
      } catch {
        /* paliek tukšs, kamēr nav profila */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSaveProfile = async () => {
    setProfileBusy(true);
    setProfileError("");
    setProfileMsg("");
    try {
      const res = await fetch("/api/partner/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(company),
      });
      if (!res.ok) {
        setProfileError(t("profileSaveError"));
        return;
      }
      const data = (await res.json()) as { partner?: B2bPartnerPublicProfile };
      if (data.partner) {
        setProfile(data.partner);
        setCompany({
          companyName: data.partner.companyName,
          companyReg: data.partner.companyReg,
          companyAddress: data.partner.companyAddress,
          contactName: data.partner.contactName,
          phone: data.partner.phone,
        });
      }
      setProfileMsg(t("profileSaved"));
    } catch {
      setProfileError(t("profileSaveError"));
    } finally {
      setProfileBusy(false);
    }
  };

  const onChangePassword = async () => {
    if (nextPassword.trim() !== nextPasswordConfirm.trim()) {
      setPasswordError(t("passwordMismatch"));
      setPasswordMsg("");
      return;
    }
    setPasswordBusy(true);
    setPasswordError("");
    setPasswordMsg("");
    try {
      const res = await fetch("/api/partner/me/password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, nextPassword }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (data.error === "invalid_current") setPasswordError(t("passwordCurrentWrong"));
        else if (data.error === "weak_password") setPasswordError(t("passwordWeak"));
        else if (data.error === "same_password") setPasswordError(t("passwordSame"));
        else setPasswordError(t("passwordError"));
        return;
      }
      setCurrentPassword("");
      setNextPassword("");
      setNextPasswordConfirm("");
      setPasswordMsg(t("passwordChanged"));
    } catch {
      setPasswordError(t("passwordError"));
    } finally {
      setPasswordBusy(false);
    }
  };

  const onChangeEmail = async () => {
    setEmailBusy(true);
    setEmailError("");
    setEmailMsg("");
    try {
      const res = await fetch("/api/partner/me/email", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: emailPassword, nextEmail, locale }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (data.error === "invalid_current") setEmailError(t("passwordCurrentWrong"));
        else setEmailError(t("emailChangeError"));
        return;
      }
      const data = (await res.json()) as { partner?: B2bPartnerPublicProfile };
      if (data.partner) setProfile(data.partner);
      setEmailPassword("");
      setNextEmail("");
      setEmailMsg(t("emailChangeSent"));
    } catch {
      setEmailError(t("emailChangeError"));
    } finally {
      setEmailBusy(false);
    }
  };

  const HeadingTag = embedded ? "h2" : "h1";
  const headingClass = embedded
    ? "text-balance text-[1.05rem] font-semibold tracking-[-0.02em] text-zinc-100"
    : TITLE_CLASS;

  return (
    <section aria-labelledby="b2b-partner-requisites-title">
      <HeadingTag id="b2b-partner-requisites-title" className={headingClass}>
        {t("requisitesTitle")}
      </HeadingTag>
      <div className={TITLE_RULE_CLASS} aria-hidden />
      {!profile ? (
        <p className="mt-8 text-[0.8125rem] text-zinc-400 sm:text-[0.875rem]">{t("requisitesLoading")}</p>
      ) : (
        <div className="mt-7 flex flex-col gap-5">
          <div className={CARD_CLASS}>
            <p className="text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-[#93c5fd]">
              {t("profileCompanyTitle")}
            </p>
            <p className="mt-1.5 text-[0.75rem] leading-snug text-zinc-500">{t("profileCompanyLead")}</p>
            <div className="mt-4 grid grid-cols-1 gap-2.5 min-[380px]:grid-cols-2">
              <Field
                label={t("fieldCompany")}
                value={company.companyName}
                onChange={(value) => setCompany((prev) => ({ ...prev, companyName: value }))}
              />
              <Field
                label={t("fieldReg")}
                value={company.companyReg}
                onChange={(value) => setCompany((prev) => ({ ...prev, companyReg: value }))}
              />
              <Field
                label={t("fieldAddress")}
                value={company.companyAddress}
                onChange={(value) => setCompany((prev) => ({ ...prev, companyAddress: value }))}
                className="min-[380px]:col-span-2"
              />
              <Field
                label={t("fieldContact")}
                value={company.contactName}
                onChange={(value) => setCompany((prev) => ({ ...prev, contactName: value }))}
                autoComplete="name"
              />
              <Field
                label={t("fieldPhone")}
                value={company.phone}
                onChange={(value) => setCompany((prev) => ({ ...prev, phone: value }))}
                type="tel"
                autoComplete="tel"
              />
            </div>
            {profileError ? <p className={`${styles.inlineFieldError} mt-3`}>{profileError}</p> : null}
            {profileMsg ? <p className="mt-3 text-[0.75rem] text-zinc-300">{profileMsg}</p> : null}
            <button type="button" className={`${SAVE_BTN} mt-4`} disabled={profileBusy} onClick={() => void onSaveProfile()}>
              {profileBusy ? t("profileSaving") : t("profileSave")}
            </button>
          </div>

          <div className={CARD_CLASS}>
            <p className="text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-[#93c5fd]">
              {t("securityTitle")}
            </p>
            <div className="mt-4 rounded-[0.45rem] bg-white/[0.03] px-3 py-3">
              <p className={LABEL_CLASS}>{t("fieldEmail")}</p>
              <p className="text-[0.875rem] font-medium text-zinc-100">{profile.email}</p>
              <p className="mt-1 text-[0.72rem] text-zinc-500">
                {profile.emailVerifiedAt ? t("emailVerified") : t("loginUnverified")}
              </p>
              {profile.pendingEmail ? (
                <p className="mt-1 text-[0.72rem] text-[#93c5fd]">{t("emailPending", { email: profile.pendingEmail })}</p>
              ) : null}
            </div>
            <p className="mt-4 text-[0.75rem] leading-snug text-zinc-500">{t("emailChangeLead")}</p>
            <div className="mt-3 grid grid-cols-1 gap-2.5 min-[380px]:grid-cols-2">
              <Field
                label={t("emailNew")}
                value={nextEmail}
                onChange={setNextEmail}
                type="email"
                autoComplete="email"
              />
              <Field
                label={t("passwordCurrent")}
                value={emailPassword}
                onChange={setEmailPassword}
                type="password"
                autoComplete="current-password"
              />
            </div>
            {emailError ? <p className={`${styles.inlineFieldError} mt-3`}>{emailError}</p> : null}
            {emailMsg ? <p className="mt-3 text-[0.75rem] text-zinc-300">{emailMsg}</p> : null}
            <button type="button" className={`${SAVE_BTN} mt-4`} disabled={emailBusy} onClick={() => void onChangeEmail()}>
              {emailBusy ? t("emailChangeBusy") : t("emailChangeSubmit")}
            </button>

            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="text-[0.75rem] leading-snug text-zinc-500">{t("passwordChangeLead")}</p>
              <div className="mt-3 grid grid-cols-1 gap-2.5 min-[380px]:grid-cols-2">
                <Field
                  label={t("passwordCurrent")}
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  type="password"
                  autoComplete="current-password"
                  className="min-[380px]:col-span-2"
                />
                <Field
                  label={t("passwordNew")}
                  value={nextPassword}
                  onChange={setNextPassword}
                  type="password"
                  autoComplete="new-password"
                />
                <Field
                  label={t("passwordConfirm")}
                  value={nextPasswordConfirm}
                  onChange={setNextPasswordConfirm}
                  type="password"
                  autoComplete="new-password"
                />
              </div>
              {passwordError ? <p className={`${styles.inlineFieldError} mt-3`}>{passwordError}</p> : null}
              {passwordMsg ? <p className="mt-3 text-[0.75rem] text-zinc-300">{passwordMsg}</p> : null}
              <button
                type="button"
                className={`${SAVE_BTN} mt-4`}
                disabled={passwordBusy}
                onClick={() => void onChangePassword()}
              >
                {passwordBusy ? t("passwordChanging") : t("passwordChange")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
