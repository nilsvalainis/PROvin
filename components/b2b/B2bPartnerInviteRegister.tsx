"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { useRouter } from "@/i18n/navigation";

const empty = {
  companyName: "",
  companyReg: "",
  companyAddress: "",
  contactName: "",
  email: "",
  phone: "",
  password: "",
};

export function B2bPartnerInviteRegister({ token }: { token: string }) {
  const t = useTranslations("Partner");
  const router = useRouter();
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/partner/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, token }),
      });
      if (!res.ok) {
        setError(t("inviteRegisterError"));
        return;
      }
      router.push("/partneriem/konts");
    } catch {
      setError(t("inviteRegisterError"));
    } finally {
      setBusy(false);
    }
  };

  const field = (
    key: keyof typeof empty,
    labelKey: "fieldCompany" | "fieldReg" | "fieldAddress" | "fieldContact" | "fieldEmail" | "fieldPhone" | "loginPassword",
    extra?: { type?: string; autoComplete?: string; className?: string },
  ) => (
    <label key={key} className={`block min-w-0 ${extra?.className ?? ""}`}>
      <span className="mb-1 block text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {t(labelKey)}
      </span>
      <input
        className={styles.inlineInput}
        value={form[key]}
        type={extra?.type ?? (key === "email" ? "email" : key === "phone" ? "tel" : key === "password" ? "password" : "text")}
        autoComplete={extra?.autoComplete ?? "off"}
        onChange={(event) => {
          setForm((prev) => ({ ...prev, [key]: event.target.value }));
          setError("");
        }}
      />
    </label>
  );

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
