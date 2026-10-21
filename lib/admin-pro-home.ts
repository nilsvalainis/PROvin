import { formatAuditDeadlineRemaining } from "@/lib/admin-audit-deadline";
import { isDealerHighlightAdminOrder } from "@/lib/admin-customer-identity";

/** PRO sākuma flīze: aktīvo skaits, kavētie un tuvākā VĒL NEKAVĒTĀ termiņa sākuma laiks (unix s). */
export type ProHomeTile = { count: number; overdue: number; nextDeadlineFromUnix: number | null };

export type ProHomeSummary = {
  /** MINI + auditi (bez dīleriem). */
  orders: ProHomeTile;
  /** Oficiālo dīleru (Dīlera dati) pasūtījumi. */
  dealers: ProHomeTile;
};

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
  const out: ProHomeSummary = { orders: emptyTile(), dealers: emptyTile() };
  for (const r of rows) {
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
