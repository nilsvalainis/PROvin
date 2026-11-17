import type { ReactNode } from "react";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { Link } from "@/i18n/navigation";
import type { PublicTopicLink } from "@/components/seo/PublicTopicLinks";
import styles from "./vin-check.module.css";

export type VinCheckSection = {
  title: string;
  body: string;
  figure?: ReactNode;
};

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** Ilustrācija: kur atrast VIN (vējstikla apakšējais kreisais stūris). */
export function VinWindshieldFigure({ caption }: { caption: string }) {
  return (
    <svg className={styles.figure} viewBox="0 0 320 180" role="img" aria-label={caption}>
      <path d="M40 150 L80 40 Q90 25 110 25 L210 25 Q230 25 240 40 L280 150 Z" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="2" />
      <rect x="70" y="128" width="62" height="14" rx="3" fill="#5c9dff" opacity=".9" />
      <text x="101" y="138.5" textAnchor="middle" fontFamily="ui-monospace,monospace" fontSize="8" fill="#050608">
        WVW…000
      </text>
      <circle cx="101" cy="135" r="20" fill="none" stroke="#5c9dff" strokeWidth="1.5" className={styles.pulse} />
      <text x="160" y="170" textAnchor="middle" fontFamily="Inter,system-ui,sans-serif" fontSize="11" fill="#8b8b94">
        {caption}
      </text>
    </svg>
  );
}

/** /vin-koda-parbaude: kreisajā slejā virsraksts un CTA (datorā lipīgs), labajā sadaļas kartītēs. */
export function VinCheckArticle({
  h1,
  lead,
  sections,
  links,
}: {
  h1: string;
  lead: string;
  sections: readonly VinCheckSection[];
  links: readonly PublicTopicLink[];
}) {
  const primary = links.find((l) => l.primary);
  const rest = links.filter((l) => l !== primary);
  const [secondary, ...textLinks] = rest;

  return (
    <article className={styles.wrap}>
      <div className={styles.grid}>
        <aside className={styles.aside}>
          <h1 className={styles.title}>{h1}</h1>
          <p className={styles.lead}>{lead}</p>
          {links.length > 0 ? (
            <div className={styles.ctas}>
              {primary ? (
                <div className={`${tp5Styles.ctaWrap} w-full`}>
                  <Link href={primary.href} className={tp5Styles.liquidCtaLink}>
                    <span className={tp5Styles.liquidCtaShimmer} aria-hidden />
                    <span className={tp5Styles.liquidCtaLabel}>{primary.label}</span>
                  </Link>
                </div>
              ) : null}
              {secondary ? (
                <Link href={secondary.href} className={`${styles.ghost} provin-press`}>
                  {secondary.label}
                </Link>
              ) : null}
              {textLinks.map((link) => (
                <Link key={`${link.href}:${link.label}`} href={link.href} className={styles.textLink}>
                  {link.label}
                  <Arrow />
                </Link>
              ))}
            </div>
          ) : null}
        </aside>
        <div className={styles.body}>
          {sections.map((section) => (
            <section key={section.title} className={styles.card}>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
              {section.figure ?? null}
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
