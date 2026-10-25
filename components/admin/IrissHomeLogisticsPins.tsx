import Link from "next/link";
import styles from "@/components/admin/IrissHomeLogisticsPins.module.css";
import type { IrissHomeLogisticsPin } from "@/lib/iriss-home-logistics-pins";

const PIN_FILL: Record<IrissHomeLogisticsPin["tone"], string> = {
  ok: "#30a46c",
  soon: "#f08c00",
  wait: "#a1a1aa",
};

function TonePin({ tone, count }: { tone: IrissHomeLogisticsPin["tone"]; count: number }) {
  const fill = PIN_FILL[tone];
  return (
    <span className={styles.pin} data-tone={tone}>
      <svg width="30" height="38" viewBox="0 0 30 38" aria-hidden>
        <path d="M15 37c-1-3-14-14-14-22a14 14 0 0 1 28 0c0 8-13 19-14 22z" fill={fill} />
        <circle cx="15" cy="15" r="9" fill="#fff" />
        <text x="15" y="19.5" fontSize="12.5" fontWeight="700" textAnchor="middle" fill={fill} fontFamily="-apple-system,Inter,sans-serif">
          {count}
        </text>
      </svg>
      <span className={styles.base} style={{ background: fill }} />
    </span>
  );
}

/** Loģistikas pin-i sākumā: stikla kartīte, bez virsraksta - viss ir saite. */
export function IrissHomeLogisticsPins({ href, pins }: { href: string; pins: readonly IrissHomeLogisticsPin[] }) {
  return (
    <Link href={href} className={`admin-nav-link ${styles.wrap}`} aria-label="Loģistika">
      <span className={styles.line} aria-hidden />
      {pins.map((p) => (
        <span key={p.id} className={styles.col}>
          <TonePin tone={p.tone} count={p.count} />
          <span className={styles.label}>{p.label}</span>
          <span className={styles.detail}>{p.detail}</span>
        </span>
      ))}
    </Link>
  );
}
