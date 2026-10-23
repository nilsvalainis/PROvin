/**
 * Vispārīgs Dropbox API klients (tikai serverī). Tokens no env:
 * DROPBOX_REFRESH_TOKEN + DROPBOX_APP_KEY + DROPBOX_APP_SECRET (ieteicams) vai DROPBOX_ACCESS_TOKEN.
 * Publiskas koplietošanas saites netiek veidotas - failus atver caur servera proxy vai `get_temporary_link`.
 * `fetch` un tokena avots ir injicējami testiem.
 */

const DROPBOX_API = "https://api.dropboxapi.com/2";
const DROPBOX_CONTENT = "https://content.dropboxapi.com/2";
const DROPBOX_OAUTH = "https://api.dropboxapi.com/oauth2/token";

export type DropboxFetch = (url: string, init: RequestInit) => Promise<Response>;

export class DropboxApiError extends Error {
  readonly status: number;
  /** Dropbox `error_summary`, piem. `path/not_found/..`. */
  readonly summary: string;
  constructor(status: number, summary: string) {
    super(`dropbox_${status}${summary ? `: ${summary.slice(0, 200)}` : ""}`);
    this.name = "DropboxApiError";
    this.status = status;
    this.summary = summary;
  }
  get notFound(): boolean {
    return this.status === 409 && /not_found/.test(this.summary);
  }
  get conflict(): boolean {
    return this.status === 409 && /conflict/.test(this.summary);
  }
}

export type DropboxEntry = {
  tag: "file" | "folder" | "deleted";
  id: string;
  name: string;
  pathLower: string;
  pathDisplay: string;
  rev: string;
  size: number;
  contentHash: string;
  serverModified: string;
};

export type DropboxThumbnailSize = "w64h64" | "w256h256" | "w480h320" | "w1024h768" | "w2048h1536";

export type DropboxListPage = { entries: DropboxEntry[]; cursor: string; hasMore: boolean };

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Dropbox metadatu objekts -> vienots ieraksts (`.tag` var nebūt files/upload atbildē). */
export function parseDropboxEntry(raw: unknown, fallbackTag: DropboxEntry["tag"] = "file"): DropboxEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const tagRaw = str(o[".tag"]);
  const tag = tagRaw === "file" || tagRaw === "folder" || tagRaw === "deleted" ? tagRaw : fallbackTag;
  const name = str(o.name);
  if (!name) return null;
  return {
    tag,
    id: str(o.id),
    name,
    pathLower: str(o.path_lower),
    pathDisplay: str(o.path_display) || str(o.path_lower),
    rev: str(o.rev),
    size: typeof o.size === "number" && Number.isFinite(o.size) ? o.size : 0,
    contentHash: str(o.content_hash),
    serverModified: str(o.server_modified),
  };
}

/** Dropbox-API-Arg galvenē drīkst būt tikai ASCII - pārējās zīmes kā \uXXXX. */
export function dropboxApiArg(value: unknown): string {
  return JSON.stringify(value).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

export function isDropboxEnvConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.DROPBOX_ACCESS_TOKEN?.trim()) return true;
  return Boolean(env.DROPBOX_REFRESH_TOKEN?.trim() && env.DROPBOX_APP_KEY?.trim() && env.DROPBOX_APP_SECRET?.trim());
}

type TokenCache = { token: string; expiresAt: number };

/** Refresh token plūsma ar kešu procesā; īslaicīgs DROPBOX_ACCESS_TOKEN ir rezerves variants. */
export function createDropboxTokenSource(opts: { env?: NodeJS.ProcessEnv; fetchImpl?: DropboxFetch; now?: () => number } = {}) {
  const env = opts.env ?? process.env;
  const doFetch: DropboxFetch = opts.fetchImpl ?? ((u, i) => fetch(u, i));
  const now = opts.now ?? Date.now;
  let cache: TokenCache | null = null;
  let inflight: Promise<string | null> | null = null;

  async function refresh(): Promise<string | null> {
    const refreshToken = env.DROPBOX_REFRESH_TOKEN?.trim() ?? "";
    const key = env.DROPBOX_APP_KEY?.trim() ?? "";
    const secret = env.DROPBOX_APP_SECRET?.trim() ?? "";
    if (!refreshToken || !key || !secret) return null;
    const res = await doFetch(DROPBOX_OAUTH, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: key, client_secret: secret }).toString(),
    });
    if (!res.ok) {
      // Atbildes tekstu nelogojam pilnībā - tajā var būt jutīga informācija.
      throw new DropboxApiError(res.status, "oauth_refresh_failed");
    }
    const json = (await res.json()) as { access_token?: unknown; expires_in?: unknown };
    const token = str(json.access_token);
    if (!token) throw new DropboxApiError(500, "oauth_empty_token");
    const ttl = typeof json.expires_in === "number" && Number.isFinite(json.expires_in) ? json.expires_in : 3600;
    cache = { token, expiresAt: now() + Math.max(60, ttl - 120) * 1000 };
    return token;
  }

  return {
    async get(): Promise<string | null> {
      if (env.DROPBOX_REFRESH_TOKEN?.trim()) {
        if (cache && cache.expiresAt > now()) return cache.token;
        inflight ??= refresh().finally(() => {
          inflight = null;
        });
        return inflight;
      }
      return env.DROPBOX_ACCESS_TOKEN?.trim() || null;
    },
    /** Pēc 401: aizmirst kešu, nākamais `get` atjauno. */
    invalidate() {
      cache = null;
    },
  };
}

export type DropboxClient = ReturnType<typeof createDropboxClient>;

export function createDropboxClient(opts: { token: { get: () => Promise<string | null>; invalidate: () => void }; fetchImpl?: DropboxFetch }) {
  const doFetch: DropboxFetch = opts.fetchImpl ?? ((u, i) => fetch(u, i));

  async function call(url: string, init: (token: string) => RequestInit): Promise<Response> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const token = await opts.token.get();
      if (!token) throw new DropboxApiError(503, "not_configured");
      const res = await doFetch(url, init(token));
      if (res.status === 401 && attempt === 0) {
        opts.token.invalidate();
        continue;
      }
      if (res.status === 429 || res.status >= 500) {
        if (attempt < 2) {
          const wait = Math.min(5, Number(res.headers.get("Retry-After")) || 1);
          await new Promise((r) => setTimeout(r, wait * 1000));
          continue;
        }
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let summary = text.slice(0, 300);
        try {
          summary = str((JSON.parse(text) as { error_summary?: unknown }).error_summary) || summary;
        } catch {
          /* ne-JSON kļūda */
        }
        throw new DropboxApiError(res.status, summary);
      }
      return res;
    }
    throw new DropboxApiError(503, "retries_exhausted");
  }

  async function rpc<T = Record<string, unknown>>(route: string, args: unknown): Promise<T> {
    const res = await call(`${DROPBOX_API}/${route}`, (token) => ({
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    }));
    return (await res.json()) as T;
  }

  function page(json: { entries?: unknown; cursor?: unknown; has_more?: unknown }): DropboxListPage {
    const entries = (Array.isArray(json.entries) ? json.entries : [])
      .map((e) => parseDropboxEntry(e))
      .filter((e): e is DropboxEntry => e !== null);
    return { entries, cursor: str(json.cursor), hasMore: json.has_more === true };
  }

  return {
    rpc,

    async getMetadata(pathOrId: string): Promise<DropboxEntry | null> {
      try {
        return parseDropboxEntry(await rpc("files/get_metadata", { path: pathOrId }));
      } catch (err) {
        if (err instanceof DropboxApiError && err.notFound) return null;
        throw err;
      }
    },

    /** Izveido mapi; ja tāda jau ir, atgriež esošās metadatus (bez autorename). */
    async ensureFolder(path: string): Promise<DropboxEntry> {
      try {
        const json = await rpc<{ metadata?: unknown }>("files/create_folder_v2", { path, autorename: false });
        const entry = parseDropboxEntry(json.metadata, "folder");
        if (entry) return entry;
      } catch (err) {
        if (!(err instanceof DropboxApiError && err.conflict)) throw err;
      }
      const existing = parseDropboxEntry(await rpc("files/get_metadata", { path }));
      if (!existing || existing.tag !== "folder") throw new DropboxApiError(409, "path/conflict/file");
      return existing;
    },

    /**
     * Augšupielāde līdz 150 MB. Noklusējums: nekad nepārraksta (`add` + autorename).
     * `autorename: false` + `add`: ja fails jau ir, Dropbox atgriež 409 conflict (nekas netiek mainīts).
     */
    async upload(
      path: string,
      bytes: Uint8Array,
      mode: "add" | "overwrite" = "add",
      opts2: { autorename?: boolean } = {},
    ): Promise<DropboxEntry> {
      const autorename = mode === "add" && opts2.autorename !== false;
      const res = await call(`${DROPBOX_CONTENT}/files/upload`, (token) => ({
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
          "Dropbox-API-Arg": dropboxApiArg({ path, mode, autorename, mute: true, strict_conflict: false }),
        },
        body: bytes as BodyInit,
      }));
      const entry = parseDropboxEntry(await res.json(), "file");
      if (!entry) throw new DropboxApiError(500, "upload_bad_response");
      return entry;
    },

    async download(pathOrId: string): Promise<{ bytes: Buffer; entry: DropboxEntry | null }> {
      const res = await call(`${DROPBOX_CONTENT}/files/download`, (token) => ({
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Dropbox-API-Arg": dropboxApiArg({ path: pathOrId }) },
      }));
      let entry: DropboxEntry | null = null;
      try {
        entry = parseDropboxEntry(JSON.parse(res.headers.get("Dropbox-API-Result") ?? "null"), "file");
      } catch {
        entry = null;
      }
      return { bytes: Buffer.from(await res.arrayBuffer()), entry };
    },

    /** Īslaicīga (4 h) tiešā saite. Nav publiska koplietošanas saite. */
    async temporaryLink(pathOrId: string): Promise<string> {
      const json = await rpc<{ link?: unknown }>("files/get_temporary_link", { path: pathOrId });
      const link = str(json.link);
      if (!link) throw new DropboxApiError(500, "temporary_link_empty");
      return link;
    },

    async listFolder(path: string, opts2: { recursive?: boolean } = {}): Promise<DropboxListPage> {
      return page(await rpc("files/list_folder", { path, recursive: opts2.recursive === true, limit: 2000, include_deleted: false }));
    },

    async listFolderContinue(cursor: string): Promise<DropboxListPage> {
      return page(await rpc("files/list_folder/continue", { cursor }));
    },

    async latestCursor(path: string, recursive: boolean): Promise<string> {
      const json = await rpc<{ cursor?: unknown }>("files/list_folder/get_latest_cursor", { path, recursive, include_deleted: true });
      return str(json.cursor);
    },

    /**
     * JPEG sīktēls / samazināts attēls (arī HEIC -> JPEG). Dropbox izmēri: w256h256 režģim, w2048h1536 pilnam skatam.
     * Fails Dropbox netiek mainīts.
     */
    async getThumbnail(pathOrId: string, size: DropboxThumbnailSize = "w256h256"): Promise<Buffer> {
      const res = await call(`${DROPBOX_CONTENT}/files/get_thumbnail_v2`, (token) => ({
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Dropbox-API-Arg": dropboxApiArg({ resource: { ".tag": "path", path: pathOrId }, format: "jpeg", size, mode: "bestfit" }),
        },
      }));
      return Buffer.from(await res.arrayBuffer());
    },

    /** Līdz 25 sīktēliem vienā pieprasījumā. Neizdevušies netiek atgriezti. */
    async getThumbnailBatch(pathsOrIds: readonly string[], size: DropboxThumbnailSize = "w256h256"): Promise<Map<string, Buffer>> {
      const out = new Map<string, Buffer>();
      const list = [...new Set(pathsOrIds)].slice(0, 25);
      if (list.length === 0) return out;
      const res = await call(`${DROPBOX_CONTENT}/files/get_thumbnail_batch`, (token) => ({
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ entries: list.map((path) => ({ path, format: "jpeg", size, mode: "bestfit" })) }),
      }));
      const json = (await res.json()) as { entries?: unknown };
      const entries = Array.isArray(json.entries) ? json.entries : [];
      entries.forEach((raw, i) => {
        const e = raw as { ".tag"?: unknown; thumbnail?: unknown };
        const key = list[i];
        if (!key || e[".tag"] !== "success" || typeof e.thumbnail !== "string") return;
        out.set(key, Buffer.from(e.thumbnail, "base64"));
      });
      return out;
    },

    /** Visas lapas vienā sarakstā (ar drošības robežu). */
    async listAll(path: string, opts2: { recursive?: boolean; maxPages?: number } = {}): Promise<{ entries: DropboxEntry[]; cursor: string }> {
      let p = await this.listFolder(path, opts2);
      const entries = [...p.entries];
      for (let i = 0; p.hasMore && i < (opts2.maxPages ?? 50); i++) {
        p = await this.listFolderContinue(p.cursor);
        entries.push(...p.entries);
      }
      return { entries, cursor: p.cursor };
    },
  };
}

let shared: DropboxClient | null = null;

/** Procesa kopīgais klients ar env tokeniem; `null`, ja Dropbox nav konfigurēts. */
export function getDropboxClient(): DropboxClient | null {
  if (!isDropboxEnvConfigured()) return null;
  shared ??= createDropboxClient({ token: createDropboxTokenSource() });
  return shared;
}
