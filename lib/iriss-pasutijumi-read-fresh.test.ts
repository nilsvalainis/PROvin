import { afterEach, describe, expect, it, vi } from "vitest";

const blobs = new Map<string, string>();

vi.mock("server-only", () => ({}));
vi.mock("@vercel/blob", () => ({
  get: vi.fn(async (pathname: string) => {
    const body = blobs.get(pathname);
    if (body === undefined) return null;
    return { statusCode: 200, stream: new Response(body).body };
  }),
  put: vi.fn(async () => {
    throw new Error("put not expected");
  }),
  del: vi.fn(async () => undefined),
  list: vi.fn(async () => ({ blobs: [] })),
}));

const ID = "70a6fe94-c1a8-4be5-9e84-86872ded1963";

function stored(brandModel: string, workspaceRevision: number) {
  return JSON.stringify({
    id: ID,
    createdAt: "2026-10-26T06:00:00.000Z",
    updatedAt: "2026-10-26T06:00:00.000Z",
    workspaceRevision,
    clientFirstName: "FABLE",
    brandModel,
  });
}

describe("readIrissPasutijums - cita instance jau saglabāja", () => {
  afterEach(() => {
    blobs.clear();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function load() {
    vi.stubEnv("ADMIN_IRISS_PASUTIJUMI_DIR", "");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token-placeholder");
    vi.stubEnv("IRISS_PASUTIJUMI_LOCAL_MIRROR_DIR", "disabled");
    vi.resetModules();
    return import("@/lib/iriss-pasutijumi-store");
  }

  const PATH = `iriss-pasutijumi/${ID}.json`;

  it("lapa/API redz jaunāko versiju, ne šīs instances atmiņas kešu", async () => {
    const store = await load();
    // Pirmā lasīšana (lapa atvērta pirms labojuma) piepilda kešu.
    blobs.set(PATH, stored("To", 2));
    expect((await store.readIrissPasutijums(ID))?.brandModel).toBe("To");
    // Cita instance (PATCH API) saglabā.
    blobs.set(PATH, stored("Toyota RAV4", 3));
    const fresh = await store.readIrissPasutijums(ID);
    expect(fresh?.brandModel).toBe("Toyota RAV4");
    expect(fresh?.workspaceRevision).toBe(3);
  });

  it("masveida lasītāji ar allowCache drīkst lietot kešu", async () => {
    const store = await load();
    blobs.set(PATH, stored("To", 2));
    expect((await store.readIrissPasutijums(ID, { allowCache: true }))?.brandModel).toBe("To");
    blobs.set(PATH, stored("Toyota RAV4", 3));
    expect((await store.readIrissPasutijums(ID, { allowCache: true }))?.brandModel).toBe("To");
    expect((await store.readIrissPasutijums(ID))?.brandModel).toBe("Toyota RAV4");
  });
});
