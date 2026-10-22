import { formatAuditDeadlineRemaining } from "@/lib/admin-audit-deadline";
import { isDealerHighlightAdminOrder } from "@/lib/admin-customer-identity";

/** PRO sākuma flīze: aktīvo skaits, kavētie un tuvākā VĒL NEKAVĒTĀ termiņa sākuma laiks (unix s). */
export type ProHomeTile = { count: number; overdue: number; nextDeadlineFromUnix: number | null };

export type ProHomeSummary = {
  /** MINI + auditi (bez dīleriem). */
  orders: ProHomeTile;
  /** Oficiālo dīleru (Dīlera dati) pasūtījumi. */
  dealers: ProHomeTile;
  /** Šodien (Rīgas laikā) ienākušie maksājumi: summa centos un skaits (arī B2B pakas). */
  today: { revenueCents: number; count: number };
};

const RIGA_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Riga", year: "numeric", month: "2-digit", day: "2-digit" });

export function rigaDayKey(ms: number): string {
  return RIGA_DAY.format(new Date(ms));
}

type Row = {
  created: number;
  deadlineFromUnix?: number | null;
  auditComplete?: boolean;
  isB2bPack?: boolean;
  checkoutLine?: string | null;
  amountTotalCents?: number | null;
};

function emptyTile(): ProHomeTile {
  return { count: 0, overdue: 0, nextDeadlineFromUnix: null };
}

/**
 * PRO sākuma izvēlnes paziņojumi telefonā. Tā pati aktīvā definīcija kā sānjoslas žetonam:
 * nav "Izpildīts" un nav B2B paka. Dīleri atsevišķi, pārējie (MINI + auditi) kopā.
 */
export function summarizeProHome(rows: readonly Row[], nowMs: number): ProHomeSummary {
  const out: ProHomeSummary = { orders: emptyTile(), dealers: emptyTile(), today: { revenueCents: 0, count: 0 } };
  const todayKey = rigaDayKey(nowMs);
  for (const r of rows) {
    // Ieņēmumi neatkarīgi no tā, vai audits jau gatavs.
    if (r.amountTotalCents != null && r.amountTotalCents > 0 && rigaDayKey(r.created * 1000) === todayKey) {
      out.today.revenueCents += r.amountTotalCents;
      out.today.count += 1;
    }
    if (r.auditComplete || r.isB2bPack) continue;
    const tile = isDealerHighlightAdminOrder({ checkoutLine: r.checkoutLine, amountTotalCents: r.amountTotalCents }) ? out.dealers : out.orders;
    const from = r.deadlineFromUnix ?? r.created;
    tile.count += 1;
    if (formatAuditDeadlineRemaining(from, nowMs).status === "overdue") {
      tile.overdue += 1;
      continue;
    }
    if (tile.nextDeadlineFromUnix == null || from < tile.nextDeadlineFromUnix) tile.nextDeadlineFromUnix = from;
  }
  return out;
}
