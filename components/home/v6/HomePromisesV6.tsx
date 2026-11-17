import { getLocale } from "next-intl/server";
import { getHomeV6HeroCopy } from "@/lib/home-hero-v6-copy";
import styles from "./sections-v6.module.css";

const ICONS = [
  <svg key="r" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>,
  <svg key="p" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  </svg>,
  <svg key="u" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="10" cy="8" r="4" />
    <path d="M3 20a7 7 0 0 1 11-5.7M16 19l2 2 4-4" />
  </svg>,
];

/** «Ne tikai dati - palīdzība izlemt» - 3 solījumi. */
export async function HomePromisesV6() {
  const locale = await getLocale();
  const c = getHomeV6HeroCopy(locale).promises;
  return (
    <section id="ko-sanem" className={styles.section} aria-labelledby="ko-sanem-h">
      <div className={styles.wrap}>
        <p className={styles.kicker}>{c.kicker}</p>
        <h2 id="ko-sanem-h" className={styles.h2}>
          {c.title}
        </h2>
        <div className={styles.promises}>
          {c.items.map((item, j) => (
            <div key={item.title} className={styles.promise} style={{ ["--j" as string]: j }}>
              <i className={styles.promiseIcon}>{ICONS[j]}</i>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
