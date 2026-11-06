import { describe, expect, it } from "vitest";
import { buildWaybillCalendar, waybillExpiredByDay, waybillPlateCards, waybillHistoryForVin } from "@/lib/iriss-waybill-calendar";

const H = 3_600_000;
const now = new Date(2026, 9, 22, 12, 0, 0).getTime(); // vietējais 12:00
const iso = (ms: number) => new Date(ms).toISOString();
const row = (id: string, plate: string, issued: number, until: number, vin = "") => ({
  id,
  number: `N${id}`,
  brandModel: "BMW",
  plate,
  vin,
  issuedAt: iso(issued),
  validUntil: iso(until),
});

describe("pavadzīmju kalendārs", () => {
  it("katram numuram sava josla, pareizi toņi", () => {
    const cal = buildWaybillCalendar(
      [
        row("a", "BA 1234", now - 10 * H, now + 30 * H),
        row("b", "BA 1234", now - 40 * H, now - 2 * H),
        row("c", "BC 9", now - H, now + 5 * H),
        row("d", "BD 7", now + 10 * 24 * H, now + 11 * 24 * H), // ārpus loga
      ],
      now,
    );
    expect(cal.lanes.map((l) => l.plate)).toEqual(["BA1234", "BC9"]);
    const ba = cal.lanes[0]!.segments;
    expect(ba.map((s) => [s.id, s.tone])).toEqual([
      ["b", "expired"],
      ["a", "active"],
    ]);
    expect(cal.lanes[1]!.segments[0]!.tone).toBe("soon");
    expect(cal.days.length).toBe(7);
    expect(cal.nowPct).toBeGreaterThan(5);
    expect(cal.nowPct).toBeLessThan(10);
  });

  it("07.11: vēlāk tam pašam numuram izdota pavadzīme pārtrauc iepriekšējo - pelēka, beidzas tajā brīdī", () => {
    // B762 06.11: P02868 (48 h) aizstāta ar P02872, tā ar P02873, tā ar P02876 vienā pēcpusdienā.
    const cal = buildWaybillCalendar(
      [
        row("p68", "B762-7", now - 26 * H, now + 22 * H),
        row("p72", "B762-7", now + 2 * H, now + 14 * H),
        row("p73", "B762-7", now + 2.4 * H, now + 14.4 * H),
        row("p76", "B762-7", now + 3 * H, now + 15 * H),
      ],
      now + 4 * H,
    );
    const segs = cal.lanes[0]!.segments;
    const byId = Object.fromEntries(segs.map((x) => [x.id, x]));
    expect(byId.p68).toMatchObject({ tone: "expired", interrupted: true });
    expect(byId.p72).toMatchObject({ tone: "expired", interrupted: true });
    expect(byId.p76).toMatchObject({ tone: "soon", interrupted: false });
    // P02868 josla beidzas, kad izdota P02872 (ne sākotnējās beigās nākamajā dienā).
    expect(byId.p68!.leftPct + byId.p68!.widthPct).toBeCloseTo(byId.p72!.leftPct, 5);
  });

  it("07.11: īsas pavadzīmes vienā dienā neuzklājas - katra savā apakšrindā", () => {
    const cal = buildWaybillCalendar(
      [row("x1", "B193-7", now, now + H), row("x2", "B193-7", now + 1.2 * H, now + 2 * H), row("x3", "B193-7", now + 60 * H, now + 61 * H)],
      now - H,
    );
    const lane = cal.lanes[0]!;
    expect(lane.rows).toBe(2);
    expect(lane.segments.map((x) => [x.id, x.row])).toEqual([
      ["x1", 0],
      ["x2", 1],
      ["x3", 0],
    ]);
  });

  it("vēsture pēc VIN: tikai šis auto, jaunākā augšā", () => {
    const rows = [
      row("1", "BA1", now - 100 * H, now - 50 * H, "WBA3A5C50CF256551"),
      row("2", "BA1", now - 10 * H, now + 10 * H, "wba3a5c50cf256551"),
      row("3", "BA1", now - 5 * H, now + 10 * H, "OTHERVIN12345"),
    ];
    expect(waybillHistoryForVin(rows, "WBA3A5C50CF256551").map((r) => r.id)).toEqual(["2", "1"]);
    expect(waybillHistoryForVin(rows, "")).toEqual([]);
  });
});

describe("calendar v2 (phone cards)", () => {
  // 23.10.2026 22:10 Rīgā (UTC+3).
  const now = Date.parse("2026-10-23T19:10:00.000Z");
  const row = (id: string, plate: string, until: string, extra: Record<string, unknown> = {}) => ({
    id,
    number: id,
    brandModel: `Auto ${id}`,
    vin: `VIN${id}`,
    plate,
    issuedAt: "2026-10-22T19:00:00.000Z",
    validUntil: until,
    ...extra,
  });
  it("one card per plate: active with ends/left, or free with the last one", () => {
    const rows = [
      row("a", "B762-7", "2026-10-24T03:42:00.000Z"),
      row("b", "B1937", "2026-10-25T02:54:00.000Z"),
      row("old", "B192-7", "2026-10-21T15:00:00.000Z"),
      row("cut", "B192-7", "2026-10-24T15:00:00.000Z", { lifecycle: "interrupted" }),
    ];
    const cards = waybillPlateCards(rows, ["B193-7", "B762-7", "B192-7"], now);
    expect(cards[0]?.active).toMatchObject({ id: "b", endsLabel: "25.10., 04:54", tone: "ok", hoursLeft: 31 });
    expect(cards[1]?.active).toMatchObject({ id: "a", endsLabel: "rīt, 06:42", tone: "soon", hoursLeft: 8 });
    expect(cards[2]).toMatchObject({ active: null, last: { brandModel: "Auto old", endedLabel: "21.10., 18:00" } });
  });

  it("expired in the last 7 days grouped by day, newest first", () => {
    const rows = [
      row("x", "B192-7", "2026-10-21T15:00:00.000Z"),
      row("y", "B193-7", "2026-10-19T06:15:00.000Z"),
      row("z", "B762-7", "2026-10-19T04:30:00.000Z"),
      row("ancient", "B762-7", "2026-10-01T04:30:00.000Z"),
      row("live", "B762-7", "2026-10-24T04:30:00.000Z"),
    ];
    expect(waybillExpiredByDay(rows, now)).toEqual([
      { day: "21.10.2026", items: [{ id: "x", plate: "B192-7", brandModel: "Auto x", time: "18:00" }] },
      {
        day: "19.10.2026",
        items: [
          { id: "y", plate: "B193-7", brandModel: "Auto y", time: "09:15" },
          { id: "z", plate: "B762-7", brandModel: "Auto z", time: "07:30" },
        ],
      },
    ]);
  });
});

describe("kalendārs: pārtrauktā pavadzīme", () => {
  it("josla beidzas, kad izdota nākamā, un ir pelēka", () => {
    const now = Date.parse("2026-10-26T20:00:00.000Z");
    const cal = buildWaybillCalendar(
      [
        { id: "1", number: "P02830", brandModel: "SKODA OCTAVIA", plate: "B193-7", issuedAt: "2026-10-26T11:48:00.000Z", validUntil: "2026-10-26T23:48:00.000Z", lifecycle: "interrupted", supersededBy: "P02831" },
        { id: "2", number: "P02831", brandModel: "BMW 325", plate: "B193-7", issuedAt: "2026-10-26T13:18:00.000Z", validUntil: "2026-10-26T14:18:00.000Z" },
      ],
      now,
      7,
    );
    const seg = cal.lanes.flatMap((l) => l.segments).find((s) => s.number === "P02830");
    expect(seg?.tone).toBe("expired");
    // Sākotnēji 12 h (7,1% no 7 dienām); pārtraukta pēc 1,5 h - tikai minimālais platums.
    expect(seg?.widthPct ?? 100).toBeLessThan((12 / 168) * 100);
  });
});
