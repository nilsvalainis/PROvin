/**
 * Dīlera datu platforma: servera PDF -> Autoparks + STOCK (tikai esošs auto) un e-pasts (mock).
 * Nekādu OneAuto/maksas API, nekādu īstu e-pastu, Dropbox vai Chromium.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  cars: [] as Record<string, unknown>[],
  upserts: [] as { carId: string; section: string; type: string; typeLabel?: string; fileName?: string }[],
  uploads: [] as { folder: string; fileName: string; bytes: number }[],
  uploadResult: "/STOCK/BMW 320d 896936/doc/Dīlera dati.pdf" as string | null,
  metaSize: -1,
  dropboxPathSet: [] as string[],
  mails: [] as { to: string; subject?: string; attachments: number }[],
  plain: [] as { to: string; subject: string; text: string; html: string; fromName: string; attachments: number }[],
  smtp: true,
  renders: 0,
}));

vi.mock("@/lib/report-pdf-server", () => ({
  renderReportHtmlToPdf: async () => {
    state.renders += 1;
    return { pdf: new TextEncoder().encode("%PDF-1.4 mock"), ms: 1, fontsReady: true };
  },
}));
vi.mock("@/lib/iriss-autoparks-store", () => ({ readAutoparksState: async () => ({ cars: state.cars, files: [] }) }));
vi.mock("@/lib/iriss-autoparks-v2-store", () => ({ readAutoparksV2State: async () => ({}) }));
vi.mock("@/lib/iriss-autoparks-v2", () => ({
  carV2Of: () => ({}),
  autoparksV2Basics: (car: { make?: string; model?: string }) => ({ title: `${car.make ?? ""} ${car.model ?? ""}`.trim() }),
}));
vi.mock("@/lib/iriss-logistics-cabinet-store", () => ({
  upsertCabinetDocument: async (input: { carId: string; section: string; type: string; typeLabel?: string; fileName?: string }) => {
    state.upserts.push(input);
    return { document: { id: "cd-1", title: input.typeLabel ?? "Dokuments" }, duplicate: false };
  },
  setCabinetDocumentDropboxPath: async (_id: string, p: string) => {
    state.dropboxPathSet.push(p);
    return null;
  },
}));
vi.mock("@/lib/iriss-autoparks-v2-iegade-dropbox", () => ({
  iegadeStockDocFolder: (car: { dropboxFolderPath?: string }) => (car.dropboxFolderPath ? `${car.dropboxFolderPath}/doc` : null),
  iegadeDocDropboxFileName: (title: string) => `${title}.pdf`,
  uploadIegadeDocumentToStock: async (folder: string, fileName: string, bytes: Buffer) => {
    state.uploads.push({ folder, fileName, bytes: bytes.length });
    return state.uploadResult;
  },
}));
vi.mock("@/lib/iriss-autoparks-files", () => ({
  autoparksDropboxEnabled: () => false,
  resolveAutoparksCarFolder: async () => null,
}));
vi.mock("@/lib/dropbox-client", () => ({
  getDropboxClient: () => ({
    getMetadata: async () => ({ tag: "file", size: state.metaSize }),
  }),
}));
vi.mock("@/lib/email/send-transactional", () => ({
  isSmtpConfigured: () => state.smtp,
  sendPlainBrandlessEmail: async (opts: { to: string; subject: string; text: string; html: string; fromName: string; attachments: unknown[] }) => {
    state.plain.push({ ...opts, attachments: opts.attachments.length });
  },
  sendReportReadyEmail: async (opts: { to: string; custom?: { subject: string }; attachments: unknown[] }) => {
    state.mails.push({ to: opts.to, subject: opts.custom?.subject, attachments: opts.attachments.length });
  },
}));

import type { DealerCheckRecord } from "@/lib/dealer-check";
import {
  deliverDealerCheckToAutoparks,
  findDealerCheckAutoparksCar,
  sendDealerCheckEmail,
  validateDealerCheckEmail,
} from "@/lib/dealer-check-platform";
import { dealerCheckEmailDefaults } from "@/lib/dealer-check-report";

const VIN = "WBA8A71070K896936";
const PDF_LEN = new TextEncoder().encode("%PDF-1.4 mock").length;

function record(patch: Partial<DealerCheckRecord> = {}): DealerCheckRecord {
  return {
    id: "dc-platform-1",
    vin: VIN,
    plate: "",
    template: "dzintarzeme",
    selectedProducts: ["oe_service_history"],
    results: {},
    display: { equipment: [], powertrain: [], serviceTimeline: [{ date: "18.10.2024", odometer: "203900", place: "LV", works: "Eļļas serviss" }] },
    displayOriginal: { equipment: [], powertrain: [], serviceTimeline: [] },
    vehicle: { make: "BMW", model: "320d", body: "", engine: "", firstReg: "", color: "", gearbox: "", manufacturer: "", vin: VIN },
    mileageRows: [],
    serviceRows: [],
    comments: { serviceHistory: "", oilIntervals: "" },
    csdd: null,
    chargedCents: 300,
    quotedCents: 300,
    fetchedAt: "2026-11-19T10:00:00.000Z",
    monthKey: "2026-11",
    autoparks: null,
    saved: true,
    createdAt: "2026-11-19T10:00:00.000Z",
    updatedAt: "2026-11-19T10:00:00.000Z",
    ...patch,
  };
}

beforeEach(() => {
  state.cars = [{ id: "car-1", orderId: "ord-1", vin: VIN, make: "BMW", model: "320d", dropboxFolderPath: "/STOCK/BMW 320d 896936" }];
  state.upserts = [];
  state.uploads = [];
  state.uploadResult = "/STOCK/BMW 320d 896936/doc/Dīlera dati.pdf";
  state.metaSize = PDF_LEN;
  state.dropboxPathSet = [];
  state.mails = [];
  state.plain = [];
  state.smtp = true;
  state.renders = 0;
});

describe("Uz Autoparku + STOCK", () => {
  it("auto nav Autoparkā - neko neveido un PDF negatavo", async () => {
    state.cars = [];
    expect(await findDealerCheckAutoparksCar(VIN)).toBeNull();
    const r = await deliverDealerCheckToAutoparks(record(), "env-admin");
    expect(r).toEqual({ ok: false, error: "not_in_autoparks" });
    expect(state.upserts).toHaveLength(0);
    expect(state.renders).toBe(0);
  });

  it("esošam auto - dokuments + Dropbox STOCK doc/ + pārbaude pēc augšupielādes", async () => {
    const r = await deliverDealerCheckToAutoparks(record(), "env-admin");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.car).toEqual({ carId: "car-1", title: "BMW 320d" });
    expect(r.dropboxVerified).toBe(true);
    expect(state.upserts[0]).toMatchObject({ carId: "ord-1", section: "A", type: "other", typeLabel: "Dīlera dati" });
    expect(state.upserts[0]?.fileName).toBe(`OFICIALA_DILERA_DATI_${VIN}_DZA.pdf`);
    expect(state.uploads[0]).toMatchObject({ folder: "/STOCK/BMW 320d 896936/doc", bytes: PDF_LEN });
    expect(state.dropboxPathSet).toEqual(["/STOCK/BMW 320d 896936/doc/Dīlera dati.pdf"]);
  });

  it("Dropbox izmērs nesakrīt - nav pārbaudīts", async () => {
    state.metaSize = 1;
    const r = await deliverDealerCheckToAutoparks(record(), "env-admin");
    expect(r.ok && r.dropboxVerified).toBe(false);
    expect(r.ok && r.dropboxError).toBe("verify_failed");
    expect(state.dropboxPathSet).toHaveLength(0);
  });

  it("auto bez STOCK mapes - dokuments saglabāts, Dropbox nav sasaistīts", async () => {
    state.cars = [{ id: "car-2", orderId: "", vin: VIN, make: "BMW", model: "320d" }];
    const r = await deliverDealerCheckToAutoparks(record(), "env-admin");
    expect(r.ok && r.dropboxError).toBe("not_linked");
    expect(state.upserts[0]?.carId).toBe("car-2");
    expect(state.uploads).toHaveLength(0);
  });
});

describe("E-pasts", () => {
  it("adreses pārbaude un bloķētais saraksts", () => {
    expect(validateDealerCheckEmail({ to: "nav-adrese", subject: "a", text: "b" }, "")).toEqual({ ok: false, error: "invalid_email" });
    expect(validateDealerCheckEmail({ to: "a@blocked.lv", subject: "a", text: "b" }, "blocked.lv")).toEqual({
      ok: false,
      error: "recipient_blocked",
    });
    expect(validateDealerCheckEmail({ to: "a@b.lv", subject: " ", text: "b" }, "")).toEqual({ ok: false, error: "missing_text" });
    expect(validateDealerCheckEmail({ to: " a@b.lv ", subject: "T", text: "X" }, "")).toMatchObject({ ok: true, to: "a@b.lv" });
  });

  it("Cits: sūta ar servera PDF pielikumā caur esošo veidni (mock)", async () => {
    const r = await sendDealerCheckEmail(record({ template: "cits" }), { to: "klients@example.com", subject: "Dīlera dati", text: "Labdien!" });
    expect(r).toEqual({ ok: true, to: "klients@example.com" });
    expect(state.mails).toEqual([{ to: "klients@example.com", subject: "Dīlera dati", attachments: 1 }]);
    expect(state.plain).toHaveLength(0);
  });

  it("Dzintarzeme Auto: tematā, tekstā, HTML un sūtītāja vārdā nav PROVIN, paraksts Nils Valainis", async () => {
    const rec = record();
    const mail = dealerCheckEmailDefaults(rec);
    expect(mail.text.endsWith("Ar cieņu,\nNils Valainis")).toBe(true);
    const r = await sendDealerCheckEmail(rec, { to: "klients@example.com", ...mail });
    expect(r).toEqual({ ok: true, to: "klients@example.com" });
    expect(state.mails).toHaveLength(0);
    expect(state.plain).toHaveLength(1);
    const sent = state.plain[0]!;
    for (const part of [sent.subject, sent.text, sent.html, sent.fromName]) expect(part).not.toMatch(/provin/i);
    expect(sent.fromName).toBe("Nils Valainis");
    expect(sent.html).toContain("Nils Valainis");
    expect(sent.attachments).toBe(1);
  });

  it("Dzintarzeme Auto: ja admins ierakstījis PROVIN - nesūta", async () => {
    const r = await sendDealerCheckEmail(record(), { to: "klients@example.com", subject: "PROVIN dati", text: "Labdien!" });
    expect(r).toEqual({ ok: false, error: "provin_in_dza" });
    expect(state.plain).toHaveLength(0);
    expect(state.renders).toBe(0);
  });

  it("bez SMTP nesūta un PDF negatavo", async () => {
    state.smtp = false;
    const r = await sendDealerCheckEmail(record(), { to: "klients@example.com", subject: "a", text: "b" });
    expect(r).toEqual({ ok: false, error: "smtp_not_configured" });
    expect(state.renders).toBe(0);
    expect(state.mails).toHaveLength(0);
  });
});
