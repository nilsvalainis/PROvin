import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const pill =
  "provin-press inline-flex min-h-[44px] items-center rounded-full border border-white/20 px-[18px] text-[14px] font-bold text-white no-underline transition hover:bg-white hover:text-[#0a0a0a]";

export default function LocaleNotFound() {
  const t = useTranslations("Misc");
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 py-24 text-center">
      <p
        aria-hidden
        className="bg-gradient-to-b from-white to-white/[0.08] bg-clip-text text-[clamp(7.5rem,18vw,13.75rem)] font-black leading-[0.85] tracking-[-0.07em] text-transparent"
      >
        404
      </p>
      <h1 className="mt-5 text-[32px] font-extrabold leading-[1.15] tracking-[-0.03em] text-white">{t("notFoundHeading")}</h1>
      <p className="mt-3 text-[16px] leading-relaxed text-zinc-400">{t("notFoundLead")}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-2.5">
        <Link href="/" className={pill}>
          {t("notFoundLinkHome")}
        </Link>
        <Link href="/pakalpojumi" className={pill}>
          {t("notFoundLinkServices")}
        </Link>
        <Link href="/#bezmaksas-novertejums" className={pill}>
          {t("notFoundLinkFreeCheck")}
        </Link>
      </div>
    </section>
  );
}
