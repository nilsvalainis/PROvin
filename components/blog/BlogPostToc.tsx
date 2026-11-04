"use client";

import { useEffect, useRef, useState } from "react";
import type { BlogTocItem } from "@/lib/blog/toc";
import styles from "./blog-post.module.css";

function Nav({ items, active }: { items: BlogTocItem[]; active: string }) {
  return (
    <nav className={styles.tocNav}>
      {items.map((item) => (
        <a key={item.id} href={`#${item.id}`} className={`${styles.tocLink} ${item.id === active ? styles.tocOn : ""}`}>
          <em>{item.num}</em>
          <span>{item.title}</span>
        </a>
      ))}
    </nav>
  );
}

/** Lasīšanas progresa josla + satura rādītājs ar aktīvo sadaļu. */
export function BlogPostToc({ items, label }: { items: BlogTocItem[]; label: string }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const barRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      if (barRef.current) barRef.current.style.transform = `scaleX(${h > 0 ? Math.min(1, window.scrollY / h) : 0})`;
      let current = items[0]?.id ?? "";
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.3) current = item.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [items]);

  return (
    <>
      <div className={styles.progress} aria-hidden>
        <i ref={barRef} />
      </div>
      {items.length > 1 ? (
        <aside className={styles.toc} aria-label={label}>
          <div className={styles.desktopOnly}>
            <p className={styles.tocLabel}>{label}</p>
            <Nav items={items} active={active} />
          </div>
          <details open className={`${styles.tocMobile} ${styles.mobileOnly}`}>
            <summary>
              <span className={styles.tocLabel}>{label}</span>
            </summary>
            <Nav items={items} active={active} />
          </details>
        </aside>
      ) : null}
    </>
  );
}
