import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, prefetch: () => undefined }),
}));

import { AdminAuctionArchiveView } from "@/components/admin/AdminAuctionArchiveView";
import { AdminDealerCheckPage } from "@/components/admin/AdminDealerCheckPage";
import { AdminListingPeekMobileFilters } from "@/components/admin/AdminListingPeekMobileFilters";
import { AdminMorningSummaryView } from "@/components/admin/AdminMorningSummaryView";
import type { MorningQueueItem, MorningSummary } from "@/lib/admin-morning-summary";
import { emptyArchiveCounts } from "@/lib/vin-memory-auction";
import { renderHtml } from "@/lib/test-render";

/** 3. posms (22.11 makets v2, sadaļa 5): telefonā stikla stils un vienkāršojumi, funkcijas tās pašas. */
describe("PRO pārējās lapas telefonā - 1. grupa", () => {
  it("Dīlera datu pārbaude: PRO - stikla lapa, šablons kā segmenti, cena avota rindā; IRISS nemainās", () => {
    const pro = renderHtml(<AdminDealerCheckPage initialVin="" />);
    expect(pro).toContain("amx amx-pg amx-pg--dilera");
    expect(pro).toMatch(/data-amx-seg="true" role="tablist"/);
    expect(pro).toMatch(/role="tab" aria-selected="true"/);
    expect(pro).toContain("data-amx-price");
    expect(pro).toContain("data-amx-load");
    // Visi esošie avoti un poga paliek.
    expect(pro).toContain("Ielādēt ·");
    const iriss = renderHtml(<AdminDealerCheckPage initialVin="" basePath="/admin/iriss/dilera-dati" />);
    expect(iriss).not.toContain("amx-pg");
    expect(iriss).not.toContain('role="tablist"');
  });

  it("Izsoļu arhīvs: 4 skaitļi vienā rindā, ieraksti kā saraksts, ievads - paskaidrojums (telefonā paslēpts)", () => {
    const base = emptyArchiveCounts();
    base.vins = 51;
    base.observations = 55;
    base.bySource.autobid = { vins: 1, observations: 0 };
    base.bySource.openline = { vins: 40, observations: 53 };
    const html = renderHtml(
      <AdminAuctionArchiveView
        counts={{ ...base, countedAt: "2026-11-22T10:00:00.000Z", shards: 3, recent: [] }}
        recent={[
          {
            vin: "WAUZZZ4G0KN000001",
            updatedAt: "2026-11-22T10:00:00.000Z",
            model: "Audi A6 Avant",
            km: 184300,
            date: "2026-11-22",
            firstRegistration: "2019",
            sources: ["openline"],
            observations: 1,
          },
        ]}
        progress={null}
        passDay=""
        completedDay={null}
        vin=""
        observations={[]}
        rollback={null}
        vinNote=""
        message=""
        busy={false}
      />,
    );
    expect(html).toMatch(/data-amx-stats[^>]*>[\s\S]*<b>51<\/b><span>VIN<\/span>[\s\S]*<b>53<\/b><span>Openlane<\/span>/);
    expect(html).toContain("data-amx-recent");
    expect(html).toContain("Audi A6 Avant");
    expect(html).toMatch(/data-amx-hint[^>]*>\s*Izsoļu portālu arhīvs ir mūsu VIN atmiņa/);
    expect(html).toContain('id="izsolu-meklesana"');
  });

  it("Ātrie vērtējumi: meklēšana aiz ikonas, filtri paliek", () => {
    const closed = renderHtml(<AdminListingPeekMobileFilters tab="pending" q="" counts={{ pending: 2, completed: 194, rejected: 4, all: 200 }} />);
    expect(closed).toContain('aria-label="Meklēt"');
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).toContain("Gaida 2");
    const open = renderHtml(<AdminListingPeekMobileFilters tab="pending" q="WAUZZZ" counts={{ pending: 2, completed: 194, rejected: 4, all: 200 }} />);
    expect(open).toContain('aria-expanded="true"');
  });

  it("Rīta kopsavilkums: telefonā bez e-pasta, termiņš ar punktu, kavētie sarkani", () => {
    const item: MorningQueueItem = {
      kind: "audit",
      id: "cs_1",
      href: "/admin/orders/cs_1",
      title: "BMW 740",
      subtitle: "AUDITS · WBA000 · klients@example.lv",
      product: "AUDITS",
      deadlineStatus: "overdue",
      deadlineLabel: "Kavējas 6 h",
      dueToday: false,
      isNew: false,
      unanswered: false,
    } as MorningQueueItem;
    const summary = {
      counts: { open: 15, urgent: 0, overdue: 6, openAudits: 10, urgentAudits: 0, overdueAudits: 6, dueTodayAudits: 0, openPeeks: 5, unansweredPeeks: 0, urgentPeeks: 0, overduePeeks: 0, newPeeksLast24h: 0 },
      overdueAudits: [item],
      dueTodayAudits: [],
      urgentAudits: [],
      unansweredPeeks: [],
      newPeeksLast24h: [],
      failingSources: [],
      costAlerts: [],
    } as unknown as MorningSummary;
    const html = renderHtml(<AdminMorningSummaryView summary={summary} stripeError={null} />);
    expect(html).toContain('data-amx-count="overdue"');
    expect(html).toContain('data-amx-pill="overdue"');
    expect(html).toMatch(/max-md:block">AUDITS<\/p>/);
    // Datorā pilnais apakšraksts (ar e-pastu) paliek.
    expect(html).toContain("klients@example.lv");
  });
});
