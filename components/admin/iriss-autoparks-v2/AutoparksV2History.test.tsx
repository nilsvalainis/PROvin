import { describe, expect, it } from "vitest";
import { renderText } from "@/lib/test-render";
import type { V2HistoryRow } from "@/lib/iriss-autoparks-v2";
import { groupV2HistoryByDay } from "@/lib/iriss-autoparks-v2-history-text";
import { AutoparksV2HistoryList } from "@/components/admin/iriss-autoparks-v2/AutoparksV2History";

const row = (id: string, at: string, field: string, from: string, to: string, actorName = "Nils"): V2HistoryRow => ({
  id,
  carId: "c",
  at,
  actorId: "a",
  actorName,
  field,
  from,
  to,
});

const now = new Date("2026-10-27T18:00:00Z");
const rows = [
  row("1", "2026-10-24T08:15:00Z", "status", "in_transit", "in_stock", "Loģistika"),
  row("2", "2026-10-27T11:32:00Z", "status", "in_service", "for_sale"),
  row("3", "2026-10-26T13:02:00Z", "plate", "", "AB-1234", "Andris"),
];

describe("Vēsture pa dienām (makets 27.10)", () => {
  it("grupē pēc Rīgas dienas, jaunākās augšā", () => {
    expect(groupV2HistoryByDay(rows, now).map((g) => [g.label, g.rows.map((r) => r.id)])).toEqual([
      ["Šodien", ["2"]],
      ["Vakar", ["3"]],
      ["24.10.2026", ["1"]],
    ]);
  });

  it("rāda kurš, laiku, lauku un statusus latviski", () => {
    const text = renderText(<AutoparksV2HistoryList rows={rows} now={now} />);
    expect(text).toContain("Šodien");
    expect(text).toContain("13:32");
    expect(text).toContain("Loģistika");
    expect(text).toContain("Pārdošanā");
    expect(text).toContain("AB-1234");
    expect(text).not.toContain("for_sale");
  });

  it("cenas nerāda; vērtības formatētas; bildes id nerāda", () => {
    const text = renderText(
      <AutoparksV2HistoryList
        now={now}
        rows={[
          row("p", "2026-10-27T10:00:00Z", "purchase.purchasePriceEur", "", "7664"),
          row("m", "2026-10-27T10:01:00Z", "tech.mileageKm", "", "171048"),
          row("d", "2026-10-27T10:02:00Z", "tech.firstRegDate", "", "2010-05-19"),
          row("f", "2026-10-27T10:03:00Z", "mainPhoto", "id:A-secret", ""),
        ]}
      />,
    );
    expect(text).not.toContain("7664");
    expect(text).not.toContain("Iepirkuma cena");
    expect(text).toContain("171 048 km");
    expect(text).toContain("19.05.2010");
    expect(text).toContain("Galvenā bilde");
    expect(text).not.toContain("id:A-secret");
  });

  it("tukša vēsture", () => {
    expect(renderText(<AutoparksV2HistoryList rows={[]} />)).toContain("Nav izmaiņu");
  });
});
