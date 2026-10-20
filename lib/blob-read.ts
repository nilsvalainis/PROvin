import { get } from "@vercel/blob";
import { normalizeBlobEtag } from "@/lib/blob-etag";

/**
 * Blob lasīšana neizdevās (tīkls, 5xx, bojāts objekts).
 * Nav tas pats, kas „objekta nav” - tukšu krātuvi nedrīkst uzskatīt.
 */
export class BlobReadFailedError extends Error {
  constructor(message = "blob_read_failed") {
    super(message);
    this.name = "BlobReadFailedError";
  }
}

export function isNodeNotFoundError(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && "code" in err && (err as { code: unknown }).code === "ENOENT");
}

export function isBlobMissingError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = "name" in err && typeof err.name === "string" ? err.name : "";
  if (name === "BlobNotFoundError") return true;
  const status =
    "status" in err && typeof err.status === "number"
      ? err.status
      : "statusCode" in err && typeof err.statusCode === "number"
        ? err.statusCode
        : null;
  if (status === 404) return true;
  const msg = err instanceof Error ? err.message : "";
  return /not found|404/i.test(msg) && !/precondition failed|etag mismatch/i.test(msg);
}

export type PrivateBlobTextSnapshot =
  | { state: "missing" }
  | { state: "ok"; text: string; etag: string; rawEtag: string | null };

function blobStatusCode(res: { statusCode?: number; status?: number } | null | undefined): number | null {
  if (!res) return null;
  if (typeof res.statusCode === "number") return res.statusCode;
  if (typeof res.status === "number") return res.status;
  return null;
}

/**
 * Privāta Blob objekta lasīšana: 404 / BlobNotFound = nav;
 * jebkura cita kļūda = throw (nedrīkst kļūt par tukšu dokumentu).
 */
export async function readPrivateBlobText(opts: {
  pathname: string;
  token: string;
}): Promise<PrivateBlobTextSnapshot> {
  let res: Awaited<ReturnType<typeof get>>;
  try {
    res = await get(opts.pathname, {
      access: "private",
      token: opts.token,
      useCache: false,
    });
  } catch (err) {
    if (isBlobMissingError(err)) return { state: "missing" };
    throw err instanceof BlobReadFailedError
      ? err
      : new BlobReadFailedError(err instanceof Error ? err.message : "blob_get_failed");
  }

  const status = blobStatusCode(res);
  if (status === 404 || !res) return { state: "missing" };
  if (status != null && status !== 200) {
    throw new BlobReadFailedError(`blob_get_status_${status}`);
  }
  if (!res.stream) {
    if (status === 200) throw new BlobReadFailedError("blob_get_empty_stream");
    return { state: "missing" };
  }

  let text: string;
  try {
    text = await new Response(res.stream).text();
  } catch (err) {
    throw new BlobReadFailedError(err instanceof Error ? err.message : "blob_stream_failed");
  }

  const rawEtag = res.blob?.etag?.trim() || null;
  const etag = normalizeBlobEtag(rawEtag);
  if (!etag) throw new BlobReadFailedError("blob_get_missing_etag");
  return { state: "ok", text, etag, rawEtag };
}
