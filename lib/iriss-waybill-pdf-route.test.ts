/**
 * "Saglabāt PDF" route: sadaļa Pavadzīmes obligāta, kolēģis (tikai Pavadzīmes) saņem tikai paša pieprasītās
 * izdotās pavadzīmes PDF; neizdotai - nekas.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { parseWaybillRequest, type WaybillRequest } from "@/lib/iriss-waybill-requests";
import type { IrissSection } from "@/lib/staff-roles";

const state = vi.hoisted(() => ({
  actor: null as null | { kind: "admin"; name: string } | { kind: "staff"; user: { id: string; sections: IrissSection[] } },
  requests: [] as WaybillRequest[],
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
  waybillPdfViewer: (a: NonNullable<typeof state.actor>) => ({
    actorId: a.kind === "admin" ? "env-admin" : a.user.id,
    waybillOnly: a.kind === "staff" && a.user.sections.length === 1 && a.user.sections[0] === "pavadzimes",
  }),
}));
vi.mock("@/lib/iriss-waybill-requests-store", () => ({
  readWaybillRequestsDoc: async () => ({ version: 1, updatedAt: "", requests: state.requests, events: [] }),
}));
vi.mock("@/lib/iriss-waybill-dropbox", () => ({
  readWaybillRequestPdfBytes: async () => Buffer.from("%PDF-1.4 test"),
}));
vi.mock("@/lib/dropbox-client", () => ({ getDropboxClient: () => null }));

function req(over: Record<string, unknown>): WaybillRequest {
  const r = parseWaybillRequest({
    id: "wbr_own1",
    createdBy: "usr_kolegis",
    createdAt: "2026-10-23T10:00:00.000Z",
    vehicle: { brandModel: "MB E250", plate: "B7627" },
    status: "issued",
    waybillNo: "P02813",
    pdfUrl: "/api/admin/iriss-pavadzimes/p02813/pdf",
    ...over,
  });
  if (!r) throw new Error("fixture");
  return r;
}

async function get(id: string, query = "") {
  const { GET } = await import("@/app/api/admin/iriss/waybill-requests/[id]/pdf/route");
  return GET(new Request(`https://www.provin.lv/api/admin/iriss/waybill-requests/${id}/pdf${query}`), {
    params: Promise.resolve({ id }),
  });
}

describe("GET /api/admin/iriss/waybill-requests/[id]/pdf", () => {
  beforeEach(() => {
    state.requests = [req({}), req({ id: "wbr_foreign2", createdBy: "usr_cits" }), req({ id: "wbr_wait3", status: "queued", waybillNo: "", pdfUrl: "" })];
  });

  it("colleague downloads own issued waybill with the Dropbox file name", async () => {
    state.actor = { kind: "staff", user: { id: "usr_kolegis", sections: ["pavadzimes"] } };
    const res = await get("wbr_own1");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Content-Disposition")).toContain("P02813_MB_E250_B762-7.pdf");
    expect((await get("wbr_own1", "?inline=1")).headers.get("Content-Disposition")).toMatch(/^inline;/);
  });

  it("colleague cannot get someone else's waybill", async () => {
    state.actor = { kind: "staff", user: { id: "usr_kolegis", sections: ["pavadzimes"] } };
    expect((await get("wbr_foreign2")).status).toBe(404);
  });

  it("admin gets any issued one, nobody gets a not-issued one", async () => {
    state.actor = { kind: "admin", name: "Nils" };
    expect((await get("wbr_foreign2")).status).toBe(200);
    expect((await get("wbr_wait3")).status).toBe(404);
  });

  it("deny by default: no session 401, staff without Pavadzīmes 403", async () => {
    state.actor = null;
    expect((await get("wbr_own1")).status).toBe(401);
    state.actor = { kind: "staff", user: { id: "usr_x", sections: ["pasutijumi"] } };
    expect((await get("wbr_own1")).status).toBe(403);
  });
});
