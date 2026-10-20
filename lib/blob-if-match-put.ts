import { put } from "@vercel/blob";
import { blobIfMatchPutFields, normalizeBlobEtag } from "@/lib/blob-etag";
import { readPrivateBlobText } from "@/lib/blob-read";
import { ConditionalWriteConflict, isConditionalWriteConflict } from "@/lib/conditional-write";

export type BlobJsonRead = {
  text: string;
  etag: string | null;
  rawEtag: string | null;
};

/** `null` tikai ja objekta nav. Tīkla/5xx kļūda tiek izmesta, nevis uzskatīta par tukšu. */
export async function readBlobTextWithEtag(opts: {
  pathname: string;
  token: string;
}): Promise<BlobJsonRead | null> {
  const snap = await readPrivateBlobText(opts);
  if (snap.state === "missing") return null;
  return { text: snap.text, etag: snap.etag, rawEtag: snap.rawEtag };
}

export type BlobPutEtagResult = {
  /** Stiprais ETag no `put()` atbildes (`W/` noņemts). `null`, ja SDK to neatgrieza. */
  etag: string | null;
};

/**
 * Raksta JSON (vai citu tekstu) ar `ifMatch`. ETag no `get()` tiek normalizēts
 * (noņem `W/`), lai vājais ETag noraidītu katru saglabājumu.
 * Veiksmīga `put()` atbilde atgriež jauno ETag, lai nākamais raksts šajā nomas
 * ciklā nelietotu veco `get()` vērtību.
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
}): Promise<BlobPutEtagResult> {
  const fields = opts.seen ? blobIfMatchPutFields(opts.etag) : { allowOverwrite: true };
  try {
    const written = await put(opts.pathname, opts.body, {
      access: "private",
      token: opts.token,
      addRandomSuffix: false,
      allowOverwrite: fields.allowOverwrite,
      contentType: opts.contentType ?? "application/json",
      ...(fields.ifMatch ? { ifMatch: fields.ifMatch } : {}),
    });
    return { etag: normalizeBlobEtag(written?.etag) };
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
