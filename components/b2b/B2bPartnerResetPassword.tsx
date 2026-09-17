"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";

export function B2bPartnerResetPassword({ token }: { token: string }) {
  const t = useTranslations("Partner");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState(token ? "" : t("resetPasswordInvalid"));
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!token) {
      setError(t("resetPasswordInvalid"));
      return;
    }
    if (password.trim().length < 8) {
      setError(t("passwordWeak"));
      return;
    }
    if (password.trim() !== passwordConfirm.trim()) {
      setError(t("passwordMismatch"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/partner/password/reset", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error === "weak_password" ? t("passwordWeak") : t("resetPasswordInvalid"));
        return;
      }
      const data = (await res.json()) as { signedIn?: boolean };
      router.replace(data.signedIn ? "/partneriem/konts" : "/partneriem");
    } catch {
      setError(t("resetPasswordError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex w-full flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <p className="text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-[#93c5fd]">
        {t("resetPasswordTitle")}
      </p>
      <p className="text-[0.75rem] leading-snug text-zinc-400">{t("passwordChangeLead")}</p>
      <label className="block min-w-0">
        <span className="mb-1.5 block text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          {t("passwordNew")}
        </span>
        <input
          type="password"
          className={styles.inlineInput}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError("");
          }}
          autoComplete="new-password"
          aria-label={t("passwordNew")}
        />
      </label>
      <label className="block min-w-0">
        <span className="mb-1.5 block text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          {t("passwordConfirm")}
        </span>
        <input
          type="password"
          className={styles.inlineInput}
          value={passwordConfirm}
          onChange={(event) => {
            setPasswordConfirm(event.target.value);
            setError("");
          }}
          autoComplete="new-password"
          aria-label={t("passwordConfirm")}
        />
      </label>
      {error ? <p className={styles.inlineFieldError}>{error}</p> : null}
      <button type="submit" className={styles.liquidCta} disabled={busy || !token}>
        <span className={styles.liquidCtaShimmer} aria-hidden />
        <span className={styles.liquidCtaLabel}>
          {busy ? t("resetPasswordLoading") : t("resetPasswordSubmit")}
        </span>
      </button>
      <Link
        href="/partneriem"
        className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#93c5fd] underline-offset-2 hover:underline"
      >
        {t("forgotPasswordBack")}
      </Link>
    </form>
  );
}
