import { describe, expect, it, vi } from "vitest";
import { createDropboxClient, createDropboxTokenSource, dropboxApiArg, DropboxApiError } from "@/lib/dropbox-client";

type Call = { url: string; init: RequestInit };

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

function fakeFetch(handler: (url: string, init: RequestInit, n: number) => Response) {
  const calls: Call[] = [];
  const impl = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init, calls.length);
  });
  return { impl, calls };
}

const env = { DROPBOX_REFRESH_TOKEN: "r", DROPBOX_APP_KEY: "k", DROPBOX_APP_SECRET: "s" } as unknown as NodeJS.ProcessEnv;

describe("dropbox token source", () => {
  it("atjauno tokenu ar refresh token un kešo līdz derīguma beigām", async () => {
    let now = 0;
    const f = fakeFetch(() => json({ access_token: "tok1", expires_in: 3600 }));
    const src = createDropboxTokenSource({ env, fetchImpl: f.impl, now: () => now });
    expect(await src.get()).toBe("tok1");
    expect(await src.get()).toBe("tok1");
    expect(f.calls).toHaveLength(1);
    now = 3600 * 1000;
    await src.get();
    expect(f.calls).toHaveLength(2);
  });

  it("bez env atgriež null", async () => {
    const src = createDropboxTokenSource({ env: {} as NodeJS.ProcessEnv });
    expect(await src.get()).toBeNull();
  });
});

describe("dropbox client", () => {
  const token = () => {
    let n = 0;
    return { get: async () => `t${n}`, invalidate: () => void (n += 1) };
  };

  it("pēc 401 atjauno tokenu un atkārto", async () => {
    const f = fakeFetch((_u, init, n) => {
      if (n === 1) return new Response("expired", { status: 401 });
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer t1");
      return json({ ".tag": "folder", id: "id:F", name: "STOCK", path_display: "/STOCK" });
    });
    const c = createDropboxClient({ token: token(), fetchImpl: f.impl });
    const meta = await c.getMetadata("/STOCK");
    expect(meta).toMatchObject({ tag: "folder", id: "id:F", pathDisplay: "/STOCK" });
  });

  it("getMetadata: not_found -> null, citas kļūdas izmet", async () => {
    const nf = fakeFetch(() => json({ error_summary: "path/not_found/.." }, 409));
    expect(await createDropboxClient({ token: token(), fetchImpl: nf.impl }).getMetadata("/x")).toBeNull();
    const bad = fakeFetch(() => json({ error_summary: "path/malformed_path/" }, 400));
    await expect(createDropboxClient({ token: token(), fetchImpl: bad.impl }).getMetadata("/x")).rejects.toBeInstanceOf(DropboxApiError);
  });

  it("ensureFolder: esoša mape -> atgriež tās metadatus, nevis kļūdu", async () => {
    const f = fakeFetch((url) => {
      if (url.endsWith("create_folder_v2")) return json({ error_summary: "path/conflict/folder/.." }, 409);
      return json({ ".tag": "folder", id: "id:X", name: "A", path_display: "/STOCK/A" });
    });
    const c = createDropboxClient({ token: token(), fetchImpl: f.impl });
    expect(await c.ensureFolder("/STOCK/A")).toMatchObject({ id: "id:X" });
  });

  it("upload nekad nepārraksta: mode add + autorename, galvene ASCII", async () => {
    const f = fakeFetch(() => json({ id: "id:U", name: "Serviss - Rēķins.pdf", path_display: "/STOCK/A/Serviss - Rēķins.pdf", size: 3 }));
    const c = createDropboxClient({ token: token(), fetchImpl: f.impl });
    const up = await c.upload("/STOCK/A/Serviss - Rēķins.pdf", new Uint8Array([1, 2, 3]));
    expect(up).toMatchObject({ tag: "file", id: "id:U", size: 3 });
    const arg = (f.calls[0]!.init.headers as Record<string, string>)["Dropbox-API-Arg"]!;
    expect(/^[\x20-\x7e]*$/.test(arg)).toBe(true);
    expect(JSON.parse(arg)).toMatchObject({ path: "/STOCK/A/Serviss - Rēķins.pdf", mode: "add", autorename: true });
  });

  it("listAll iet cauri visām lapām", async () => {
    const f = fakeFetch((url) =>
      url.endsWith("/continue")
        ? json({ entries: [{ ".tag": "file", id: "id:2", name: "b" }], cursor: "c2", has_more: false })
        : json({ entries: [{ ".tag": "folder", id: "id:1", name: "a" }], cursor: "c1", has_more: true }),
    );
    const c = createDropboxClient({ token: token(), fetchImpl: f.impl });
    const all = await c.listAll("/STOCK");
    expect(all.entries.map((e) => e.id)).toEqual(["id:1", "id:2"]);
    expect(all.cursor).toBe("c2");
  });

  it("temporaryLink neveido koplietošanas saiti", async () => {
    const f = fakeFetch(() => json({ link: "https://dl.dropboxusercontent.com/x" }));
    const c = createDropboxClient({ token: token(), fetchImpl: f.impl });
    expect(await c.temporaryLink("id:A")).toContain("dropboxusercontent");
    expect(f.calls.every((x) => !x.url.includes("sharing"))).toBe(true);
  });
});

describe("dropboxApiArg", () => {
  it("escapē ne-ASCII zīmes", () => {
    expect(dropboxApiArg({ path: "/Ā – b" })).toBe('{"path":"/\\u0100 \\u2013 b"}');
  });
});
