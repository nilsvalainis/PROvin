import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function LocaleNotFound() {
  const t = useTranslations("Misc");
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-sm uppercase tracking-[0.2em] opacity-60">404</p>
      <h1 className="mt-3 text-2xl font-semibold">{t("notFoundTitle")}</h1>
      <Link href="/" className="mt-6 underline underline-offset-4">
        {t("notFoundHome")}
      </Link>
    </section>
  );
}
