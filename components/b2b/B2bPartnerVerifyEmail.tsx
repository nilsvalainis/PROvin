"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";

export function B2bPartnerVerifyEmail({ token }: { token: string }) {
  const t = useTranslations("Partner");
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError(t("verifyInvalid"));
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/partner/verify", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) {
          if (!cancelled) setError(t("verifyInvalid"));
          return;
        }
        router.replace("/partneriem/konts");
      } catch {
        if (!cancelled) setError(t("verifyInvalid"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, t, token]);

  if (!error) {
    return <p className="text-[0.84rem] leading-relaxed text-zinc-400">{t("verifyWorking")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className={styles.inlineFieldError}>{error}</p>
      <Link
        href="/partneriem"
        className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[#93c5fd] underline-offset-2 hover:underline"
      >
        {t("verifyBackToLogin")}
      </Link>
    </div>
  );
}
