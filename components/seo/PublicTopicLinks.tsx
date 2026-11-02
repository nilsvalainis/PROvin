import { Link } from "@/i18n/navigation";

export type PublicTopicLink = {
  href: string;
  label: string;
  primary?: boolean;
};

const primaryClass = "text-provin-accent no-underline transition hover:text-white";
const secondaryClass = "text-white/55 no-underline transition hover:text-provin-accent";

/** Mazā saistīto lapu rinda (VIN / BUJ / dekoders). Prefiksu pievieno next-intl `Link`. */
export function PublicTopicLinks({ links }: { links: readonly PublicTopicLink[] }) {
  if (links.length === 0) return null;
  return (
    <p className="mt-10 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.16em]">
      {links.map((link) => (
        <Link key={`${link.href}:${link.label}`} href={link.href} className={link.primary ? primaryClass : secondaryClass}>
          {link.label}
        </Link>
      ))}
    </p>
  );
}
