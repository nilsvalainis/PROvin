import Link from "next/link";
import styles from "@/components/admin/IrissHomeLogisticsPins.module.css";
import type { IrissHomeLogisticsPin } from "@/lib/iriss-home-logistics-pins";

const PIN_FILL: Record<IrissHomeLogisticsPin["tone"], string> = {
  ok: "#34c759",
  soon: "#ff9f0a",
  wait: "#c7c7cc",
};

function TonePin({ tone, count }: { tone: IrissHomeLogisticsPin["tone"]; count: number }) {
  return (
    <span className={styles.pin} data-tone={tone}>
      <svg viewBox="0 0 24 34" width="28" height="40" aria-hidden>
        <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 22 12 22s12-13 12-22C24 5.4 18.6 0 12 0z" fill={PIN_FILL[tone]} />
        <circle cx="12" cy="12" r="6.2" fill="#fff" />
      </svg>
      <span className={styles.n}>{count}</span>
    </span>
  );
}

/** Loģistikas pin-i sākumā: bez virsraksta un bez «Karte ›» - viss ir saite. */
export function IrissHomeLogisticsPins({ href, pins }: { href: string; pins: readonly IrissHomeLogisticsPin[] }) {
  return (
    <Link href={href} className={`admin-nav-link ${styles.wrap}`} aria-label="Loģistika">
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
