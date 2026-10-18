import Link from "next/link";

/** Skaidra atgriešanās uz partneru sarakstu. Parastā bulta, bez garajām svītrām. */
export function AdminB2bPartnerBackLink() {
  return (
    <Link
      href="/admin/partneri"
      className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-provin-accent)] hover:underline"
    >
      <span aria-hidden>←</span>
      Atpakaļ uz partneriem
    </Link>
  );
}
