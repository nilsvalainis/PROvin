/**
 * J52: Iegādes PDF augšupielāde reģistrēja "Neizdevās saglabāt", ja pārlūks neziņoja
 * `file.type === "application/pdf"` (bieži tukšs/neprecīzs atkarībā no OS MIME reģistra).
 * Maršruts tagad pārbauda faila baitus ("%PDF"), nevis pārlūka ziņoto tipu.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  gate: { ok: true as const, actor: { kind: "admin" as const, name: "Nils" }, perms: {}, actorId: "admin1", actorName: "Nils" },
  car: { id: "car1", orderId: "order1", dropboxFolderPath: "" } as Record<string, unknown>,
  upsertCalls: [] as { contentType: string; fileName: string }[],
  upsertError: null as Error | null,
}));

vi.mock("@/lib/iriss-autoparks-v2-access", async (orig) => ({
  ...(await orig<typeof import("@/lib/iriss-autoparks-v2-access")>()),
  requireAutoparksV2Api: async () => state.gate,
}));
vi.mock("@/lib/iriss-autoparks-v2-store", () => ({
  readAutoparksV2Car: async (id: string) => (id === state.car.id ? { car: state.car, v2: {} } : null),
}));
vi.mock("@/lib/iriss-logistics-cabinet-store", () => ({
  upsertCabinetDocument: async (input: { contentType: string; fileName: string }) => {
    if (state.upsertError) throw state.upsertError;
    state.upsertCalls.push({ contentType: input.contentType, fileName: input.fileName });
    return { document: { id: "doc1", title: "Dokuments" }, duplicate: false };
  },
  setCabinetDocumentDropboxPath: async () => null,
}));
vi.mock("@/lib/iriss-autoparks-v2-iegade-dropbox", () => ({
  iegadeStockDocFolder: () => null,
  iegadeDocDropboxFileName: (title: string) => `${title}.pdf`,
  uploadIegadeDocumentToStock: async () => null,
}));
vi.mock("@/lib/iriss-autoparks-v2-iegade", () => ({
  autoparksV2IegadeView: async () => ({ files: [] }),
}));

import { POST } from "@/app/api/admin/iriss-autoparks-v2/iegade/[id]/faili/route";

const PDF_BYTES = new TextEncoder().encode("%PDF-1.4\n%mock pdf content\n");

function postFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  const req = new Request("http://x/api/admin/iriss-autoparks-v2/iegade/car1/faili", { method: "POST", body: form });
  return POST(req, { params: Promise.resolve({ id: "car1" }) });
}

beforeEach(() => {
  state.upsertCalls = [];
  state.upsertError = null;
});

describe("Iegādes PDF augšupielāde: faila tips pēc baitiem, ne pārlūka MIME", () => {
  it("pārlūks neziņo type (tukšs string) - PDF ar pareizu parakstu tomēr tiek pieņemts", async () => {
    const file = new File([PDF_BYTES], "Auto1_Order_Confirmation.pdf", { type: "" });
    const res = await postFile(file);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { ok?: boolean };
    expect(body.ok).toBe(true);
    expect(state.upsertCalls).toEqual([{ contentType: "application/pdf", fileName: "Auto1_Order_Confirmation.pdf" }]);
  });

  it("pārlūks ziņo nepareizu/neparastu type - paraksts no baitiem joprojām nosaka PDF", async () => {
    const file = new File([PDF_BYTES], "skenets.pdf", { type: "application/octet-stream" });
    const res = await postFile(file);
    expect(res.status).toBe(201);
  });

  it("fails nav PDF (nav %PDF paraksta), pat ja nosaukumā .pdf - noraida", async () => {
    const file = new File([new TextEncoder().encode("not a pdf")], "fake.pdf", { type: "application/pdf" });
    const res = await postFile(file);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("invalid_file");
    expect(state.upsertCalls).toEqual([]);
  });
});
