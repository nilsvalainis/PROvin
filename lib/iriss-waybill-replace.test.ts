/**
 * 19.11 «Pārrakstīt»: automātika atteica (numurs CSDD aizņemts) -> pieprasījumā aktīvā pavadzīme, UI poga
 * «Pārrakstīt (pārtraukt P0xxxx un izrakstīt jaunu)» ar apstiprinājumu: «Pārtraukt» darbs, tad tas pats pieprasījums.
 * Partneris (tikai Pavadzīmes) pārrakstīt nevar. Nekad «Anulēt».
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { NextResponse } from "next/server";
import { WaybillLiveRow } from "@/components/admin/IrissWaybillMobileForm";
import { csddPlateSyncState, type CsddPlatesDoc } from "@/lib/iriss-waybill-csdd-plates";
import { waybillMobileRequestRows } from "@/lib/iriss-waybill-mobile-form";
import {
  parseWaybillRequest,
  plateBusyActiveWaybillNo,
  waybillReplaceOffer,
  waybillReplaceRequestBody,
  type WaybillRequest,
} from "@/lib/iriss-waybill-requests";
import { renderText } from "@/lib/test-render";
import type { IrissSection } from "@/lib/staff-roles";

const NOW = Date.parse("2026-11-19T10:00:00.000Z");

function req(over: Record<string, unknown>): WaybillRequest {
  const r = parseWaybillRequest({
    id: "wbr_busy",
    createdBy: "usr_toms",
    createdByName: "Toms",
    createdAt: "2026-11-19T09:58:00.000Z",
    updatedAt: "2026-11-19T09:59:00.000Z",
    vehicle: { brandModel: "MB E250", plate: "B1937" },
    status: "error",
    validHours: 12,
    errorReason: "Numurs B193-7 CSDD aizņemts (P02812 MB ML 350, līdz 20.11.2026 07:35). Jaunā pavadzīme nav izveidota.",
    activeWaybillNo: "P02812",
    ...over,
  });
  if (!r) throw new Error("fixture");
  return r;
}

describe("aktīvā numura nolasīšana no worker rezultāta", () => {
  it("jaunais worker: lauks activeWaybillNo; vecais: no teksta; citas kļūdas - nekas", () => {
    expect(plateBusyActiveWaybillNo({ activeWaybillNo: "p02812", errorReason: "Numurs B193-7 CSDD aizņemts (P02812 ...)" })).toBe("P02812");
    expect(plateBusyActiveWaybillNo({ errorReason: "Numurs B193-7 CSDD aizņemts (P02812 MB ML 350, līdz ...)" })).toBe("P02812");
    expect(plateBusyActiveWaybillNo({ errorReason: "Numuru B193-7 CSDD aizņem P02813, nevis apstiprinātā P02812." })).toBe("P02813");
    expect(plateBusyActiveWaybillNo({ activeWaybillNo: "P02812", errorReason: "Automātika: timeout. Pārbaudi CSDD." })).toBe("");
    expect(plateBusyActiveWaybillNo({ activeWaybillNo: "<script>", errorReason: "CSDD aizņemts" })).toBe("");
  });

  it("piedāvājums tikai kļūdai ar aktīvo numuru; partnerim nekad; «Pārtraukt» darbam nekad", () => {
    expect(waybillReplaceOffer(req({}), { waybillOnly: false })).toEqual({ waybillNo: "P02812" });
    expect(waybillReplaceOffer(req({}), { waybillOnly: true })).toBeNull();
    expect(waybillReplaceOffer(req({ status: "queued" }), { waybillOnly: false })).toBeNull();
    expect(waybillReplaceOffer(req({ activeWaybillNo: "" }), { waybillOnly: false })).toBeNull();
    expect(waybillReplaceOffer(req({ kind: "stop", stopWaybillNo: "P02812" }), { waybillOnly: false })).toBeNull();
    // Ārpus «Kļūda» saglabātais numurs netiek nolasīts vispār.
    expect(req({ status: "issued" }).activeWaybillNo).toBe("");
  });

  it("atkārtotā iesniegšana nes TIKAI apstiprināto numuru", () => {
    expect(waybillReplaceRequestBody(" p02812 ")).toEqual({ action: "replace", replaceWaybillNo: "P02812" });
  });
});

describe("numura nolasījuma svaigums (brīdinājums «Numura statuss var būt novecojis»)", () => {
  const doc = (checkedAt: string, ok = true): CsddPlatesDoc => ({
    version: 1,
    updatedAt: checkedAt,
    plates: [{ plate: "B193-7", ok, checkedAt, active: [], error: "" }],
  });
  it("svaigs <= 15 min; vecs -> stale, ja VPN izslēgts -> vpn_down", () => {
    expect(csddPlateSyncState(doc("2026-11-19T09:50:00.000Z"), "B1937", "down", NOW)).toBe("fresh");
    expect(csddPlateSyncState(doc("2026-11-19T09:00:00.000Z"), "B193-7", "up", NOW)).toBe("stale");
    expect(csddPlateSyncState(doc("2026-11-19T09:00:00.000Z"), "B193-7", "down", NOW)).toBe("vpn_down");
    expect(csddPlateSyncState(doc("2026-11-19T09:55:00.000Z", false), "B193-7", "unknown", NOW)).toBe("stale");
    expect(csddPlateSyncState(null, "B762-7", "unknown", NOW)).toBe("stale");
  });
});

describe("telefona saraksts: poga «Pārrakstīt»", () => {
  it("Nils/Toms/Ingus redz pogu ar numuru; partneris - nē; brīdinājums, ja statuss vecs", () => {
    const [row] = waybillMobileRequestRows([req({})], [], 3, {
      nowMs: NOW,
      canReplace: true,
      plateSync: [{ plate: "B193-7", state: "vpn_down" }],
    });
    expect(row).toMatchObject({ replaceWaybillNo: "P02812", plateStatusStale: true });
    const text = renderText(createElement(WaybillLiveRow, { row: row!, onRetry: () => undefined, onReplace: () => undefined }));
    expect(text).toContain("Pārrakstīt (pārtraukt P02812 un izrakstīt jaunu)");
    expect(text).toContain("Numura statuss var būt novecojis");
    expect(text).not.toMatch(/[–—]/);

    const [partnerRow] = waybillMobileRequestRows([req({})], [], 3, { nowMs: NOW, canReplace: false });
    expect(partnerRow?.replaceWaybillNo).toBe("");
    expect(renderText(createElement(WaybillLiveRow, { row: partnerRow!, onReplace: () => undefined }))).not.toContain("Pārrakstīt");
    // Bez onReplace (partnera UI) poga nav, arī ja rindā numurs ir.
    expect(renderText(createElement(WaybillLiveRow, { row: row! }))).not.toContain("Pārrakstīt");
  });

  it("svaigs statuss - bez brīdinājuma", () => {
    const [row] = waybillMobileRequestRows([req({})], [], 3, { nowMs: NOW, canReplace: true, plateSync: [{ plate: "B193-7", state: "fresh" }] });
    expect(row?.plateStatusStale).toBe(false);
  });
});

const state = vi.hoisted(() => ({
  actor: null as
    | null
    | { kind: "admin"; name: string }
    | { kind: "staff"; user: { id: string; name: string; sections: IrissSection[]; partner?: boolean } },
  replaceCalls: [] as Array<{ id: string; waybillNo: string; actorId: string }>,
  completeCalls: [] as Array<Record<string, unknown>>,
  woken: [] as string[],
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
  isWaybillOnlyActor: (a: NonNullable<typeof state.actor>) => a.kind === "staff" && a.user.partner === true,
  waybillOnlyForbidden: () => NextResponse.json({ error: "forbidden" }, { status: 403 }),
  waybillPdfViewer: (a: NonNullable<typeof state.actor>) => ({
    actorId: a.kind === "admin" ? "env-admin" : a.user.id,
    waybillOnly: a.kind === "staff" && a.user.partner === true,
  }),
}));
vi.mock("@/lib/iriss-waybill-requests-store", () => ({
  readWaybillRequestsDoc: async () => ({ version: 1, updatedAt: "", requests: [req({})], events: [] }),
  cancelWaybillRequest: async () => ({ ok: false, reason: "not_found" }),
  retryWaybillRequest: async () => null,
  replaceBusyWaybillRequest: async (input: { id: string; waybillNo: string; actorId: string }) => {
    state.replaceCalls.push({ id: input.id, waybillNo: input.waybillNo, actorId: input.actorId });
    return input.waybillNo === "P02812"
      ? {
          ok: true,
          request: req({ activeWaybillNo: "", waitStopId: "wbr_stop1", waitStopWaybillNo: "P02812" }),
          stop: req({ id: "wbr_stop1", status: "queued", kind: "stop", stopWaybillNo: "P02812", activeWaybillNo: "" }),
        }
      : { ok: false, reason: "not_offered" };
  },
  completeWaybillRequest: async (input: Record<string, unknown>) => {
    state.completeCalls.push(input);
    return req({ status: "error", activeWaybillNo: input.activeWaybillNo });
  },
  handAutoFailureToAivars: async () => null,
}));
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: (fn: () => unknown) => {
    void fn();
  },
}));
vi.mock("@/lib/iriss-waybill-dismissed-store", () => ({ dismissWaybillRequestForActor: async () => [] }));
vi.mock("@/lib/iriss-aivars-wake", () => ({
  wakeAivars: async (id: string) => {
    state.woken.push(id);
  },
}));
vi.mock("@/lib/iriss-waybill-auto-server", () => ({
  waybillAutoContext: async () => ({ mode: "test", isStandard: () => false, reasonFor: () => "numurs aizņemts" }),
}));
vi.mock("@/lib/iriss-waybill-dropbox", () => ({ ensureWaybillRequestInDropbox: async () => null }));
vi.mock("@/lib/iriss-aivars-api-token", () => ({
  irissAivarsApiTokenConfigured: () => true,
  verifyIrissAivarsApiToken: (h: string | null) => h === "Bearer test",
}));
vi.mock("@/lib/iriss-pavadzimes-store", () => ({ uploadIrissPavadzime: async () => ({ id: "x" }) }));

async function postReplace(body: Record<string, unknown>) {
  const { POST } = await import("@/app/api/admin/iriss/waybill-requests/[id]/route");
  return POST(
    new Request("https://www.provin.lv/api/admin/iriss/waybill-requests/wbr_busy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "wbr_busy" }) },
  );
}

describe("POST action=replace («Pārtraukt» + atkārtota iesniegšana)", () => {
  beforeEach(() => {
    state.replaceCalls = [];
    state.woken = [];
  });

  it("Toms pārraksta Nila pieprasījumu: nosūta aktīvo numuru, Aivars saņem «Pārtraukt» darbu (nevis anulēšanu)", async () => {
    state.actor = { kind: "staff", user: { id: "usr_toms", name: "Toms", sections: ["pavadzimes", "pasutijumi"] } };
    const res = await postReplace(waybillReplaceRequestBody("P02812"));
    expect(res.status).toBe(200);
    expect(state.replaceCalls).toEqual([{ id: "wbr_busy", waybillNo: "P02812", actorId: "usr_toms" }]);
    const json = (await res.json()) as { request: WaybillRequest };
    expect(json.request).toMatchObject({ waitStopId: "wbr_stop1", replaceWaybillNo: "", plateBusyAtCreate: false });
    expect(state.woken).toEqual(["wbr_stop1"]);
  });

  it("administrators arī drīkst; cits numurs nekā saglabātais -> 409", async () => {
    state.actor = { kind: "admin", name: "Nils" };
    expect((await postReplace(waybillReplaceRequestBody("P02812"))).status).toBe(200);
    expect((await postReplace(waybillReplaceRequestBody("P09999"))).status).toBe(409);
  });

  it("partneris (tikai Pavadzīmes) pārrakstīt nevar - 403, nekas netiek mainīts", async () => {
    state.actor = { kind: "staff", user: { id: "usr_partner", name: "Partneris", sections: ["pavadzimes"], partner: true } };
    const res = await postReplace(waybillReplaceRequestBody("P02812"));
    expect(res.status).toBe(403);
    expect(state.replaceCalls).toEqual([]);
  });
});

describe("worker rezultāts -> aktīvais numurs pieprasījumā", () => {
  beforeEach(() => {
    state.completeCalls = [];
  });

  async function postResult(body: Record<string, unknown>) {
    const { POST } = await import("@/app/api/iriss/aivars/waybill-requests/[id]/result/route");
    return POST(
      new Request("https://www.provin.lv/api/iriss/aivars/waybill-requests/wbr_busy/result", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: "Bearer test" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: "wbr_busy" }) },
    );
  }

  it("plate_busy: activeWaybillNo tiek saglabāts (arī no vecā worker teksta)", async () => {
    const errorReason = "Numurs B193-7 CSDD aizņemts (P02812 MB ML 350). Jaunā pavadzīme nav izveidota.";
    expect((await postResult({ ok: false, by: "auto", errorReason, activeWaybillNo: "P02812" })).status).toBe(200);
    expect((await postResult({ ok: false, by: "auto", errorReason })).status).toBe(200);
    expect(state.completeCalls.map((c) => c.activeWaybillNo)).toEqual(["P02812", "P02812"]);
  });
});
