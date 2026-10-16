import { get, put } from "@vercel/blob";
import { blobIfMatchPutFields, normalizeBlobEtag } from "@/lib/blob-etag";
import { ConditionalWriteConflict, isConditionalWriteConflict } from "@/lib/conditional-write";

export type BlobJsonRead = {
  text: string;
  etag: string | null;
  rawEtag: string | null;
};

export async function readBlobTextWithEtag(opts: {
  pathname: string;
  token: string;
}): Promise<BlobJsonRead | null> {
  try {
    const res = await get(opts.pathname, {
      access: "private",
      token: opts.token,
      useCache: false,
    });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    const text = await new Response(res.stream).text();
    const rawEtag = res.blob?.etag?.trim() || null;
    return { text, rawEtag, etag: normalizeBlobEtag(rawEtag) };
  } catch {
    return null;
  }
}

/**
 * Raksta JSON (vai citu tekstu) ar `ifMatch`. ETag no `get()` tiek normalizēts
 * (noņem `W/`), lai vājais ETag noraidītu katru saglabājumu.
 */
export async function putBlobBodyIfMatch(opts: {
  pathname: string;
  body: string;
  token: string;
  /** ETag no pēdējā `get()` - drīkst būt vājš. `null` = pirmā rakstīšana. */
  etag: string | null;
  /** `true`, ja objekts jau tika nolasīts šajā mēģinājumā. */
  seen: boolean;
  contentType?: string;
}): Promise<void> {
  const fields = opts.seen ? blobIfMatchPutFields(opts.etag) : { allowOverwrite: true };
  try {
    await put(opts.pathname, opts.body, {
      access: "private",
      token: opts.token,
      addRandomSuffix: false,
      allowOverwrite: fields.allowOverwrite,
      contentType: opts.contentType ?? "application/json",
      ...(fields.ifMatch ? { ifMatch: fields.ifMatch } : {}),
    });
  } catch (err) {
    if (isConditionalWriteConflict(err)) throw new ConditionalWriteConflict();
    throw err;
  }
}

export const BLOB_CAS_ATTEMPTS = 6;

/** Atkārto lasīšanu+rakstīšanu, līdz `ifMatch` izdodas vai mēģinājumi beidzas. */
export async function writeBlobBodyWithConflictRetry(opts: {
  pathname: string;
  body: string;
  token: string;
  contentType?: string;
  maxAttempts?: number;
}): Promise<void> {
  const max = opts.maxAttempts ?? BLOB_CAS_ATTEMPTS;
  let last: unknown = null;
  for (let attempt = 0; attempt < max; attempt++) {
    const snap = await readBlobTextWithEtag({ pathname: opts.pathname, token: opts.token });
    try {
      await putBlobBodyIfMatch({
        pathname: opts.pathname,
        body: opts.body,
        token: opts.token,
        etag: snap?.etag ?? null,
        seen: snap != null,
        contentType: opts.contentType,
      });
      return;
    } catch (err) {
      last = err;
      if (!isConditionalWriteConflict(err) || attempt === max - 1) throw err;
    }
  }
  throw last instanceof Error ? last : new ConditionalWriteConflict();
}
