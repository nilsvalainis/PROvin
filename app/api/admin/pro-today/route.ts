/**
 * PRO telefona sākums «Šodien»: «Nav nosūtīti» un «Kļūda vai datu nav» skaits.
 * Tie paši dati un tā pati loģika, ko pasūtījumu saraksta ielases filtri (`loadAdminOrderIngests`), tikai aktīvajiem.
 * Atsevišķi no `/api/admin/badges` (to sānjosla prasa ik minūti) - šo ielādē tikai telefona sākums.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { filterAdminOrdersForDashboard } from "@/lib/admin-order-amount-filter";
import { readOrderDraftSummaries } from "@/lib/admin-order-draft-summaries";
import { adminOrderFullyReversed, listAdminOrders } from "@/lib/admin-orders";
import { getOrderFlags } from "@/lib/admin-orders-flags";
import { loadAdminOrderIngests } from "@/lib/admin-orders-ingest-load";
import { countProTodayIngest } from "@/lib/admin-pro-today";
import { isB2bPackAdminOrder, parsePartnerCheckoutLineFromNotes } from "@/lib/b2b-partner-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const { rows } = await listAdminOrders();
    const orders = filterAdminOrdersForDashboard(rows, false);
    const ids = orders.map((o) => o.id);
    const [drafts, { complete }] = await Promise.all([readOrderDraftSummaries(ids), getOrderFlags(ids)]);
    const list = orders.map((o) => {
      const isB2bPack = isB2bPackAdminOrder(o);
      return {
        ...o,
        checkoutLine: parsePartnerCheckoutLineFromNotes(drafts.get(o.id)?.notes ?? "") ?? o.checkoutLine,
        isB2bPack,
        auditComplete: isB2bPack ? true : Boolean(complete.get(o.id)),
      };
    });
    const info = await loadAdminOrderIngests(list, drafts);
    const counts = countProTodayIngest(
      list.map((o) => ({
        ingest: info.get(o.id)?.ingest ?? null,
        auditComplete: o.auditComplete,
        isB2bPack: o.isB2bPack,
        fullyReversed: adminOrderFullyReversed(o),
      })),
    );
    return NextResponse.json({ ok: true, ...counts }, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch (e) {
    console.error("[admin/pro-today]", e);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
