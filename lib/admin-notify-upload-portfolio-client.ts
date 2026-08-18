"use client";

import { upload } from "@vercel/blob/client";
import { notifyPortfolioPathPrefix } from "@/lib/admin-notify-blob-constants";

export type NotifyPortfolioUploadInput = {
  sessionId: string;
  files: { blob: Blob; filename: string; mime: string }[];
};

export class NotifyBlobUploadError extends Error {}

async function describeClientTokenFailure(): Promise<string> {
  try {
    const res = await fetch("/api/admin/notify-blob-upload", { credentials: "include" });
    if (res.status === 401) {
      return "Admin sesija beigusies — ielogojies vēlreiz un mēģini sūtīt e-pastu no jauna.";
    }
    const j = (await res.json().catch(() => ({}))) as { enabled?: unknown };
    if (j.enabled !== true) {
      return "Serverī nav BLOB_READ_WRITE_TOKEN. Vercel → Project → Environment Variables (Production) → pievieno tokenu no Storage → Blob, tad Redeploy.";
    }
  } catch {
    /* ignore */
  }
  return "Vercel Blob noraidīja augšupielādes atļauju (client token). Tokenam Production vidē jābūt no šī paša Vercel projekta Blob store (Storage → Blob → Connect). Pēc env izmaiņas vajag Redeploy.";
}

/**
 * Augšupielādē portfeļa failus tieši uz Vercel Blob (apiņot mazu Vercel API route multipart limitu).
 * Atgriež atsauces JSON ķermenim `POST /api/admin/notify-report-ready` (`blobAttachments`).
 */
export async function uploadNotifyPortfolioBlobs(input: NotifyPortfolioUploadInput): Promise<{ url: string; filename: string }[]> {
  const sid = input.sessionId.trim();
  const clientPayload = JSON.stringify({ sessionId: sid });
  const prefix = notifyPortfolioPathPrefix(sid);
  const out: { url: string; filename: string }[] = [];

  for (const f of input.files) {
    const safe = f.filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 100) || "pielikums";
    const pathname = `${prefix}/${Date.now()}-${safe}`;
    try {
      const r = await upload(pathname, f.blob, {
        access: "private",
        handleUploadUrl: "/api/admin/notify-blob-upload",
        clientPayload,
        multipart: f.blob.size > 8 * 1024 * 1024,
        contentType: f.mime,
      });
      out.push({ url: r.url, filename: f.filename });
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      if (/Failed to retrieve the client token/i.test(raw)) {
        throw new NotifyBlobUploadError(await describeClientTokenFailure());
      }
      throw new NotifyBlobUploadError(`Neizdevās augšupielādēt pielikumu „${f.filename}”: ${raw}`);
    }
  }
  return out;
}
