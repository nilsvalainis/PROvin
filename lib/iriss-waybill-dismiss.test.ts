/**
 * j22 "Dzēst" pavadzīmju sarakstā: tikai paslēpj vecu ierakstu (izrakstīta, kļūda, atcelts, novecojis),
 * saraksts rāda ne vairāk par 3, aktīvie vienmēr redzami; pavadzīmju dati netiek mainīti.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { WAYBILL_MOBILE_CURRENT_LIMIT, waybillMobileRequestRows } from "@/lib/iriss-waybill-mobile-form";
import {
  WAYBILL_DISMISSED_MAX,
  addDismissedWaybillId,
  parseDismissedWaybillDoc,
  parseWaybillRequest,
  waybillRequestDismissable,
  type WaybillRequest,
} from "@/lib/iriss-waybill-requests";
import type { IrissSection } from "@/lib/staff-roles";

const NOW = Date.parse("2026-10-23T20:00:00.000Z");

function req(over: Record<string, unknown>): WaybillRequest {
  const r = parseWaybillRequest({
    id: "wbr_a",
    createdBy: "env-admin",
    createdAt: "2026-10-23T18:00:00.000Z",
    vehicle: { brandModel: "BMW 216D GRAN TOURER", plate: "B1937" },
    status: "issued",
    validUntil: "2026-10-23T19:00:00.000Z",
    ...over,
  });
  if (!r) throw new Error("fixture");
  return r;
}

const ended = req({ id: "wbr_ended", waybillNo: "P02790" });
const error = req({ id: "wbr_err", status: "error", updatedAt: "2026-10-23T19:30:00.000Z", errorReason: "Numuru aizņem P02812" });
const valid = req({ id: "wbr_valid", createdAt: "2026-10-23T12:00:00.000Z", waybillNo: "P02815", validUntil: "2026-10-25T12:00:00.000Z", vehicle: { brandModel: "BMW X5", plate: "B7627" } });
const queued = req({ id: "wbr_q", status: "queued", createdAt: "2026-10-23T19:59:00.000Z", updatedAt: "2026-10-23T19:59:00.000Z", validUntil: "2026-10-24T08:00:00.000Z" });
const working = req({ id: "wbr_w", status: "in_progress", createdAt: "2026-10-23T19:58:00.000Z", updatedAt: "2026-10-23T19:58:30.000Z", pickedAt: "2026-10-23T19:58:30.000Z" });
const all = [ended, error, valid, queued, working];

describe("kurš ieraksts ir dzēšams (tikai paslēpšana)", () => {
  it("vecie - jā; derīga izdota un darbā esošie - nē", () => {
    expect(waybillRequestDismissable(ended, all, NOW)).toBe(true);
    expect(waybillRequestDismissable(error, all, NOW)).toBe(true);
    expect(waybillRequestDismissable(req({ id: "wbr_c", status: "cancelled" }), all, NOW)).toBe(true);
    expect(waybillRequestDismissable(valid, all, NOW)).toBe(false);
    expect(waybillRequestDismissable(queued, all, NOW)).toBe(false);
    expect(waybillRequestDismissable(working, all, NOW)).toBe(false);
    // Novecojis (24 h bez virzības) gaidošais - jā.
    const stale = req({ id: "wbr_s", status: "queued", createdAt: "2026-10-22T10:00:00.000Z", updatedAt: "2026-10-22T10:00:00.000Z" });
    expect(waybillRequestDismissable(stale, [stale], NOW)).toBe(true);
    // Derīga, bet aizstāta ar jaunāku tam pašam numuram (izrakstīta) - jā.
    const replaced = req({ id: "wbr_old", createdAt: "2026-10-23T10:00:00.000Z", validUntil: "2026-10-25T10:00:00.000Z", vehicle: { brandModel: "X", plate: "B7627" } });
    expect(waybillRequestDismissable(replaced, [replaced, valid], NOW)).toBe(true);
  });

  it("rindā 'Dzēst' ir tikai vecajiem", () => {
    const rows = waybillMobileRequestRows(all, [], 10, { nowMs: NOW });
    const by = Object.fromEntries(rows.map((r) => [r.id, r.canDismiss]));
    expect(by).toEqual({ wbr_ended: true, wbr_err: true, wbr_valid: false, wbr_q: false, wbr_w: false });
  });
});

describe("saraksts: ne vairāk par 3, aktīvie pirmie, paslēptie pazūd", () => {
  it("limits 3 un aktīvie (darbā, derīgi) netiek izspiesti ar jaunākiem vecajiem", () => {
    expect(WAYBILL_MOBILE_CURRENT_LIMIT).toBe(3);
    const newerOld = [
      req({ id: "wbr_e1", status: "error", createdAt: "2026-10-23T19:50:00.000Z", updatedAt: "2026-10-23T19:50:00.000Z" }),
      req({ id: "wbr_e2", status: "error", createdAt: "2026-10-23T19:51:00.000Z", updatedAt: "2026-10-23T19:51:00.000Z" }),
      req({ id: "wbr_e3", status: "error", createdAt: "2026-10-23T19:52:00.000Z", updatedAt: "2026-10-23T19:52:00.000Z" }),
    ];
    const rows = waybillMobileRequestRows([valid, ...newerOld], [], WAYBILL_MOBILE_CURRENT_LIMIT, { nowMs: NOW });
    expect(rows.map((r) => r.id)).toEqual(["wbr_valid", "wbr_e3", "wbr_e2"]);
  });

  it("paslēptie pazūd no pirmās lapas, bet Arhīvā paliek; dati nemainās", () => {
    const frozen = JSON.stringify(all);
    const rows = waybillMobileRequestRows(all, [], 10, { nowMs: NOW, dismissed: ["wbr_ended", "wbr_err"] });
    expect(rows.map((r) => r.id)).not.toContain("wbr_ended");
    expect(rows.map((r) => r.id)).not.toContain("wbr_err");
    const archive = waybillMobileRequestRows([ended], [], 30, { nowMs: NOW + 25 * 3_600_000, which: "archive", dismissed: ["wbr_ended"] });
    expect(archive.map((r) => r.id)).toEqual(["wbr_ended"]);
    expect(JSON.stringify(all)).toBe(frozen);
  });

  it("aktīvu ierakstu paslēpšanas saraksts nepaslēpj (piem. kļūda pēc tam atkārtota)", () => {
    const rows = waybillMobileRequestRows([valid, queued], [], 10, { nowMs: NOW, dismissed: ["wbr_valid", "wbr_q"] });
    expect(rows.map((r) => r.id).sort()).toEqual(["wbr_q", "wbr_valid"]);
  });

  it("paslēpto saraksts: bez dublikātiem, ierobežots, tikai pieprasījumu ID", () => {
    expect(addDismissedWaybillId(["wbr_a", "wbr_b"], "wbr_a")).toEqual(["wbr_b", "wbr_a"]);
    const many = Array.from({ length: WAYBILL_DISMISSED_MAX + 5 }, (_, i) => `wbr_${i}`);
    expect(addDismissedWaybillId(many, "wbr_new")).toHaveLength(WAYBILL_DISMISSED_MAX);
    expect(parseDismissedWaybillDoc({ ids: ["wbr_ok", "../x", 5, "wbr_ok2"] }).ids).toEqual(["wbr_ok", "wbr_ok2"]);
    expect(parseDismissedWaybillDoc(null).ids).toEqual([]);
  });
});

const state = vi.hoisted(() => ({
  actor: null as null | { kind: "admin"; name: string } | { kind: "staff"; user: { id: string; name: string; sections: IrissSection[] } },
  requests: [] as WaybillRequest[],
  dismissed: {} as Record<string, string[]>,
  writes: 0,
}));

vi.mock("@/lib/staff-auth", () => ({
  requireIrissSectionApi: async (section: IrissSection) => {
    const a = state.actor;
    if (!a) return { ok: false, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
    if (a.kind === "staff" && !a.user.sections.includes(section)) {
      return { ok: false, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
    }
    return { ok: true, actor: a };
  },
  isWaybillOnlyActor: () => false,
  waybillOnlyForbidden: () => NextResponse.json({ error: "forbidden" }, { status: 403 }),
  waybillPdfViewer: () => ({ actorId: "x", waybillOnly: false }),
}));
vi.mock("@/lib/iriss-waybill-requests-store", () => ({
  readWaybillRequestsDoc: async () => ({ version: 1, updatedAt: "", requests: state.requests, events: [] }),
  cancelWaybillRequest: async () => {
    state.writes += 1;
    return { ok: false, reason: "not_found" };
  },
  retryWaybillRequest: async () => {
    state.writes += 1;
    return null;
  },
}));
vi.mock("@/lib/iriss-waybill-dismissed-store", () => ({
  dismissWaybillRequestForActor: async (actorId: string, id: string) => {
    state.dismissed[actorId] = addDismissedWaybillId(state.dismissed[actorId] ?? [], id);
    return state.dismissed[actorId];
  },
}));
vi.mock("@/lib/iriss-aivars-wake", () => ({ wakeAivars: async () => undefined }));
vi.mock("@/lib/iriss-waybill-auto-server", () => ({ waybillAutoContext: async () => ({ mode: "test" }) }));
vi.mock("@/lib/iriss-waybill-dropbox", () => ({ ensureWaybillRequestInDropbox: async () => null }));

async function post(id: string, action: string) {
  const { POST } = await import("@/app/api/admin/iriss/waybill-requests/[id]/route");
  return POST(
    new Request(`https://www.provin.lv/api/admin/iriss/waybill-requests/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }),
    { params: Promise.resolve({ id }) },
  );
}

describe("POST action=dismiss", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    state.actor = { kind: "admin", name: "Nils" };
    state.requests = all.map((r) => ({ ...r }));
    state.dismissed = {};
    state.writes = 0;
  });

  it("vecu ierakstu paslēpj tikai šim lietotājam; rinda netiek aiztikta", async () => {
    const before = JSON.stringify(state.requests);
    const res = await post("wbr_ended", "dismiss");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, dismissedIds: ["wbr_ended"] });
    expect(state.dismissed).toEqual({ "env-admin": ["wbr_ended"] });
    expect(JSON.stringify(state.requests)).toBe(before);
    expect(state.writes).toBe(0);
  });

  it("kolēģis (tikai Pavadzīmes) arī var paslēpt - savā sarakstā", async () => {
    state.actor = { kind: "staff", user: { id: "usr_kolegis", name: "Taivo", sections: ["pavadzimes"] } };
    const res = await post("wbr_err", "dismiss");
    expect(res.status).toBe(200);
    expect(state.dismissed).toEqual({ usr_kolegis: ["wbr_err"] });
  });

  it("derīgu izdotu vai darbā esošu nepaslēpj (409), nezināmu - 404, bez tiesībām - 403", async () => {
    for (const id of ["wbr_valid", "wbr_q", "wbr_w"]) {
      const res = await post(id, "dismiss");
      expect(res.status).toBe(409);
    }
    expect((await post("wbr_nav", "dismiss")).status).toBe(404);
    expect(state.dismissed).toEqual({});
    state.actor = { kind: "staff", user: { id: "usr_x", name: "X", sections: ["pasutijumi" as IrissSection] } };
    expect((await post("wbr_ended", "dismiss")).status).toBe(403);
    expect(state.dismissed).toEqual({});
  });
});
