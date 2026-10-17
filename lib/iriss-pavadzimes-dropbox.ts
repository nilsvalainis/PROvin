import "server-only";

import { classifyDropboxWaybillPath } from "@/lib/iriss-pavadzimes-dropbox-path";

export type DropboxWaybillFile = {
  id: string;
  name: string;
  path: string;
  rev: string;
  contentHash: string;
  serverModified: string;
  size: number;
  /** true = fails ir `Arhīvs/` apakšmapē. */
  archived: boolean;
};

export type DropboxListResult =
  | { ok: true; files: DropboxWaybillFile[] }
  | { ok: false; error: string };

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

const DROPBOX_API = "https://api.dropboxapi.com/2";
const DROPBOX_CONTENT = "https://content.dropboxapi.com/2";

export function dropboxPavadzimesPath(): string {
  const raw = process.env.DROPBOX_PAVADZIMES_PATH?.trim();
  if (raw === "" || raw === "/") return "";
  return raw || "/Pavadzīmes_IRISS";
}

export function isDropboxConfigured(): boolean {
  if (process.env.DROPBOX_ACCESS_TOKEN?.trim()) return true;
  return Boolean(
    process.env.DROPBOX_REFRESH_TOKEN?.trim() &&
      process.env.DROPBOX_APP_KEY?.trim() &&
      process.env.DROPBOX_APP_SECRET?.trim(),
  );
}

async function refreshDropboxAccessToken(): Promise<string | null> {
  const refresh = process.env.DROPBOX_REFRESH_TOKEN?.trim() ?? "";
  const key = process.env.DROPBOX_APP_KEY?.trim() ?? "";
  const secret = process.env.DROPBOX_APP_SECRET?.trim() ?? "";
  if (!refresh || !key || !secret) return null;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refresh,
    client_id: key,
    client_secret: secret,
  });
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`dropbox_oauth_${res.status}${t ? `: ${t.slice(0, 180)}` : ""}`);
  }
  const json = (await res.json()) as { access_token?: unknown; expires_in?: unknown };
  const token = typeof json.access_token === "string" ? json.access_token : "";
  if (!token) throw new Error("dropbox_oauth_empty_token");
  const ttl = typeof json.expires_in === "number" && Number.isFinite(json.expires_in) ? json.expires_in : 3600;
  tokenCache = { token, expiresAt: Date.now() + Math.max(60, ttl - 60) * 1000 };
  return token;
}

export async function getDropboxAccessToken(): Promise<string | null> {
  const direct = process.env.DROPBOX_ACCESS_TOKEN?.trim() ?? "";
  if (direct) return direct;
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;
  if (!isDropboxConfigured()) return null;
  return refreshDropboxAccessToken();
}

function dropboxErrorMessage(status: number, body: string): string {
  const slice = body.replace(/\s+/g, " ").slice(0, 220);
  if (status === 401) return "Dropbox token nav derīgs (DROPBOX_ACCESS_TOKEN vai refresh).";
  if (status === 409 && /not_found/i.test(body)) {
    return `Dropbox mape nav atrasta: ${dropboxPavadzimesPath() || "/"}.`;
  }
  return `Dropbox ${status}${slice ? `: ${slice}` : ""}`;
}

type ListFolderEntry = {
  ".tag"?: string;
  id?: string;
  name?: string;
  path_display?: string;
  path_lower?: string;
  rev?: string;
  content_hash?: string;
  server_modified?: string;
  size?: number;
};

function asWaybillFile(e: ListFolderEntry): DropboxWaybillFile | null {
  if (e[".tag"] && e[".tag"] !== "file") return null;
  const name = typeof e.name === "string" ? e.name : "";
  if (!name.toLowerCase().endsWith(".pdf")) return null;
  const path = (e.path_display || e.path_lower || "").trim();
  if (!path && !e.id) return null;
  return {
    id: typeof e.id === "string" ? e.id : "",
    name,
    path: path || name,
    rev: typeof e.rev === "string" ? e.rev : "",
    contentHash: typeof e.content_hash === "string" ? e.content_hash : "",
    serverModified: typeof e.server_modified === "string" ? e.server_modified : "",
    size: typeof e.size === "number" ? e.size : 0,
    archived: false,
  };
}

export async function listDropboxPavadzimes(): Promise<DropboxListResult> {
  const token = await getDropboxAccessToken();
  if (!token) return { ok: false, error: "dropbox_not_configured" };

  const folderPath = dropboxPavadzimesPath();
  const files: DropboxWaybillFile[] = [];
  let cursor: string | null = null;
  let isContinue = false;

  for (let i = 0; i < 20; i++) {
    const url = isContinue ? `${DROPBOX_API}/files/list_folder/continue` : `${DROPBOX_API}/files/list_folder`;
    const payload = isContinue
      ? { cursor }
      : {
          path: folderPath,
          recursive: true,
          limit: 2000,
          include_non_downloadable_files: false,
        };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const raw = await res.text();
    if (!res.ok) return { ok: false, error: dropboxErrorMessage(res.status, raw) };
    let json: { entries?: unknown; cursor?: unknown; has_more?: unknown };
    try {
      json = JSON.parse(raw) as { entries?: unknown; cursor?: unknown; has_more?: unknown };
    } catch {
      return { ok: false, error: "dropbox_list_invalid_json" };
    }
    const entries = Array.isArray(json.entries) ? json.entries : [];
    for (const e of entries) {
      if (!e || typeof e !== "object") continue;
      const file = asWaybillFile(e as ListFolderEntry);
      if (!file) continue;
      const placement = classifyDropboxWaybillPath(file.path, folderPath);
      if (placement) files.push({ ...file, archived: placement === "archive" });
    }
    if (!json.has_more || typeof json.cursor !== "string" || !json.cursor) break;
    cursor = json.cursor;
    isContinue = true;
  }

  return { ok: true, files };
}

export async function downloadDropboxFile(pathOrId: string): Promise<Buffer> {
  const token = await getDropboxAccessToken();
  if (!token) throw new Error("dropbox_not_configured");
  const path = pathOrId.trim();
  if (!path) throw new Error("dropbox_path_empty");
  const res = await fetch(`${DROPBOX_CONTENT}/files/download`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({ path }),
    },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(dropboxErrorMessage(res.status, t));
  }
  return Buffer.from(await res.arrayBuffer());
}
