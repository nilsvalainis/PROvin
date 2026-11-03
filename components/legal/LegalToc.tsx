"use client";

import { useEffect, useState } from "react";
import styles from "./legal.module.css";

export type LegalTocItem = { id: string; title: string };

function TocNav({ items, active }: { items: LegalTocItem[]; active: string }) {
  return (
    <nav className={styles.tocNav}>
      {items.map((item) => (
        <a key={item.id} href={`#${item.id}`} className={item.id === active ? styles.tocLinkOn : styles.tocLink}>
          {item.title}
        </a>
      ))}
    </nav>
  );
}

/** Juridisko lapu satura rādītājs: datorā sānā ar aktīvās sadaļas izcēlumu, telefonā atverams saraksts. */
export function LegalToc({ items, label }: { items: LegalTocItem[]; label: string }) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const update = () => {
      let current = items[0]?.id ?? "";
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.3) current = item.id;
      }
      setActive(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [items]);

  return (
    <aside className={styles.toc} aria-label={label}>
      <div className={styles.desktopOnly}>
        <p className={styles.tocLabel}>{label}</p>
        <TocNav items={items} active={active} />
      </div>
      <details className={`${styles.tocMobile} ${styles.mobileOnly}`}>
        <summary>
          <span className={styles.tocLabel}>{label}</span>
        </summary>
        <TocNav items={items} active={active} />
      </details>
    </aside>
  );
}
