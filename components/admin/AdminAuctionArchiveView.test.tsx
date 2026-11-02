import { describe, expect, it } from "vitest";
import { AdminAuctionArchiveView } from "@/components/admin/AdminAuctionArchiveView";
import { emptyArchiveCounts } from "@/lib/vin-memory-auction";
import { renderHtml, renderText } from "@/lib/test-render";

const VIN = "WVWZZZ7NZEV015204";

function counts() {
  const base = emptyArchiveCounts();
  base.vins = 12;
  base.observations = 20;
  base.bySource.autobid = { vins: 8, observations: 10 };
  base.bySource.openline = { vins: 3, observations: 4 };
  base.bySource.order = { vins: 2, observations: 6 };
  return { ...base, countedAt: "2026-11-02T10:00:00.000Z", shards: 3, recent: [] };
}

describe("AdminAuctionArchiveView", () => {
  it("rāda skaitītājus, pārlūku un VIN vēsturi", () => {
    const html = renderHtml(
      <AdminAuctionArchiveView
        counts={counts()}
        recent={[
          {
            vin: VIN,
            updatedAt: "2026-11-02T10:00:00.000Z",
            model: "VW Sharan",
            km: 93500,
            date: "2026-11-02",
            firstRegistration: "03.2014",
            sources: ["autobid"],
            observations: 1,
          },
        ]}
        progress={null}
        passDay="2026-11-02"
        completedDay={null}
        vin={VIN}
        observations={[
          {
            date: "2026-11-02",
            source: "autobid",
            km: 93500,
            model: "VW Sharan",
            firstRegistration: "03.2014",
            country: "DE",
          },
        ]}
        rollback={null}
        vinNote=""
        message=""
        busy={false}
        onRun={() => undefined}
        onDeleteVin={() => undefined}
        onDeleteLedger={() => undefined}
      />,
    );
    const text = renderText(
      <AdminAuctionArchiveView
        counts={counts()}
        recent={[
          {
            vin: VIN,
            updatedAt: "2026-11-02T10:00:00.000Z",
            model: "VW Sharan",
            km: 93500,
            date: "2026-11-02",
            firstRegistration: "03.2014",
            sources: ["autobid"],
            observations: 1,
          },
        ]}
        progress={null}
        passDay="2026-11-02"
        completedDay={null}
        vin={VIN}
        observations={[
          {
            date: "2026-11-02",
            source: "autobid",
            km: 93500,
            model: "VW Sharan",
            firstRegistration: "03.2014",
            country: "DE",
          },
        ]}
        rollback={null}
        vinNote=""
        message=""
        busy={false}
        onRun={() => undefined}
        onDeleteVin={() => undefined}
        onDeleteLedger={() => undefined}
      />,
    );
    expect(text).toContain("Izsoļu portālu arhīvs");
    expect(text).toContain("Jaunākie VIN");
    expect(text).toContain("Pirmā reģistrācija");
    expect(text).toContain(VIN);
    expect(text).toContain("02.11.2026");
    expect(text).toMatch(/93\s*500/);
    expect(text).toContain("Autobid");
    expect(text).toContain("Openlane");
    expect(text).toContain("VW Sharan");
    expect(text).toContain("03.2014");
    expect(text).toContain("Citi avoti");
    expect(text).toContain("Dzēst šo VIN no arhīva");
    expect(text).toContain("Dzēst gājiena kursoru");
    expect(text).toContain("Nolasīt nākamo soli");
    expect(html).toContain(`/admin/izsolu-arhivs?vin=${VIN}`);
    expect(text).not.toMatch(/CC\.?\s?VIN/i);
    expect(text.toLowerCase()).not.toContain("checkcar");
    expect(html.toLowerCase()).not.toContain("checkcar");
  });
});
