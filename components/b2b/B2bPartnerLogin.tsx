"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { useRouter } from "@/i18n/navigation";

function isLoginEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function B2bPartnerLogin() {
  const t = useTranslations("Partner");
  const router = useRouter();
  const [loginEmail, setLoginEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!isLoginEmail(loginEmail) || password.trim().length < 8) {
      setError(t("loginError"));
      return;
    }
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/partner/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail.trim(), password }),
      });
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

  return (
    <form
      className="flex w-full max-w-[22rem] flex-col gap-4"
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
          }}
          autoComplete="email"
          inputMode="email"
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
          }}
          autoComplete="current-password"
          aria-label={t("passwordAria")}
        />
      </label>
      {error ? <p className={styles.inlineFieldError}>{error}</p> : null}
      <button type="submit" className={styles.liquidCta} disabled={busy}>
        <span className={styles.liquidCtaShimmer} aria-hidden />
        <span className={styles.liquidCtaLabel}>{busy ? t("loginLoading") : t("loginSubmit")}</span>
      </button>
    </form>
  );
}
