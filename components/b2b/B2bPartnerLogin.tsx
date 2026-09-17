"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { useRouter } from "@/i18n/navigation";

function isLoginEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function B2bPartnerLogin() {
  const t = useTranslations("Partner");
  const locale = useLocale();
  const router = useRouter();
  const [loginEmail, setLoginEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [unverified, setUnverified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendOk, setResendOk] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const onSubmit = async () => {
    if (!isLoginEmail(loginEmail) || password.trim().length < 8) {
      setError(t("loginError"));
      setUnverified(false);
      return;
    }
    setError("");
    setUnverified(false);
    setResendOk(false);
    setBusy(true);
    try {
      const res = await fetch("/api/partner/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail.trim(), password }),
      });
      if (res.status === 403) {
        setUnverified(true);
        setError(t("loginUnverified"));
        return;
      }
      if (!res.ok) {
        setError(t("loginError"));
        return;
      }
      router.push("/partneriem/konts");
    } catch {
      setError(t("loginError"));
    } finally {
      setBusy(false);
    }
  };

  const onResend = async () => {
    setResendBusy(true);
    setResendOk(false);
    try {
      await fetch("/api/partner/verify/resend", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail.trim(), locale }),
      });
      setResendOk(true);
    } catch {
      setResendOk(true);
    } finally {
      setResendBusy(false);
    }
  };

  const onForgot = async () => {
    if (!isLoginEmail(loginEmail)) {
      setError(t("loginError"));
      return;
    }
    setError("");
    setForgotBusy(true);
    try {
      await fetch("/api/partner/password/forgot", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail.trim(), locale }),
      });
      setForgotSent(true);
    } catch {
      setForgotSent(true);
    } finally {
      setForgotBusy(false);
    }
  };

  if (forgot) {
    return (
      <form
        className="flex w-full flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void onForgot();
        }}
      >
        <p className="text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-[#93c5fd]">
          {t("forgotPasswordTitle")}
        </p>
        <p className="text-[0.75rem] leading-snug text-zinc-400">{t("forgotPasswordLead")}</p>
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            {t("loginEmail")}
          </span>
          <input
            type="email"
            className={styles.inlineInput}
            value={loginEmail}
            onChange={(event) => {
              setLoginEmail(event.target.value);
              setError("");
              setForgotSent(false);
            }}
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            enterKeyHint="send"
            aria-label={t("emailAria")}
          />
        </label>
        {error ? <p className={styles.inlineFieldError}>{error}</p> : null}
        {forgotSent ? <p className="text-[0.75rem] text-zinc-300">{t("forgotPasswordSent")}</p> : null}
        <button type="submit" className={styles.liquidCta} disabled={forgotBusy}>
          <span className={styles.liquidCtaShimmer} aria-hidden />
          <span className={styles.liquidCtaLabel}>
            {forgotBusy ? t("forgotPasswordLoading") : t("forgotPasswordSubmit")}
          </span>
        </button>
        <button
          type="button"
          className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#93c5fd] underline-offset-2 hover:underline"
          onClick={() => {
            setForgot(false);
            setForgotSent(false);
            setError("");
          }}
        >
          {t("forgotPasswordBack")}
        </button>
      </form>
    );
  }

  return (
    <form
      className="flex w-full flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <label className="block min-w-0">
        <span className="mb-1.5 block text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          {t("loginEmail")}
        </span>
        <input
          type="email"
          className={styles.inlineInput}
          value={loginEmail}
          onChange={(event) => {
            setLoginEmail(event.target.value);
            setError("");
            setUnverified(false);
            setResendOk(false);
          }}
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          enterKeyHint="next"
          aria-label={t("emailAria")}
        />
      </label>
      <label className="block min-w-0">
        <span className="mb-1.5 block text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          {t("loginPassword")}
        </span>
        <input
          type="password"
          className={styles.inlineInput}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError("");
            setUnverified(false);
          }}
          autoComplete="current-password"
          enterKeyHint="go"
          aria-label={t("passwordAria")}
        />
      </label>
      {error ? <p className={styles.inlineFieldError}>{error}</p> : null}
      {resendOk ? <p className="text-[0.75rem] text-zinc-300">{t("verifyResendOk")}</p> : null}
      <button type="submit" className={styles.liquidCta} disabled={busy}>
        <span className={styles.liquidCtaShimmer} aria-hidden />
        <span className={styles.liquidCtaLabel}>{busy ? t("loginLoading") : t("loginSubmit")}</span>
      </button>
      <button
        type="button"
        className="text-left text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#93c5fd] underline-offset-2 hover:underline"
        onClick={() => {
          setForgot(true);
          setError("");
          setUnverified(false);
          setResendOk(false);
        }}
      >
        {t("forgotPassword")}
      </button>
      {unverified ? (
        <button
          type="button"
          className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#93c5fd] underline-offset-2 hover:underline disabled:opacity-50"
          disabled={resendBusy}
          onClick={() => void onResend()}
        >
          {resendBusy ? t("verifyResendBusy") : t("verifyResend")}
        </button>
      ) : null}
    </form>
  );
}
