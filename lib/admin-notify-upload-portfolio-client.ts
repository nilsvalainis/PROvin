"use client";

import { put } from "@vercel/blob/client";
import { describeNotifyBlobTokenHttpError } from "@/lib/admin-notify-blob-errors";
import {
  NOTIFY_BLOB_CLIENT_TOKEN_ACTION,
  notifyPortfolioPathPrefix,
} from "@/lib/admin-notify-blob-constants";

export type NotifyPortfolioUploadInput = {
  sessionId: string;
  files: { blob: Blob; filename: string; mime: string }[];
};

export class NotifyBlobUploadError extends Error {}

async function fetchNotifyBlobClientToken(input: {
  pathname: string;
  sessionId: string;
}): Promise<string> {
  const res = await fetch("/api/admin/notify-blob-upload", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: NOTIFY_BLOB_CLIENT_TOKEN_ACTION,
      pathname: input.pathname,
      sessionId: input.sessionId,
    }),
  });
  const j = (await res.json().catch(() => ({}))) as {
    clientToken?: unknown;
    error?: unknown;
    message?: unknown;
  };
  if (!res.ok) {
    throw new NotifyBlobUploadError(describeNotifyBlobTokenHttpError(res.status, j));
  }
  if (typeof j.clientToken !== "string" || !j.clientToken.startsWith("vercel_blob_client_")) {
    throw new NotifyBlobUploadError(describeNotifyBlobTokenHttpError(res.status, j));
  }
  return j.clientToken;
}

/**
 * Augšupielādē portfeļa failus tieši uz Vercel Blob (apiņot mazu Vercel API route multipart limitu).
 * Tokenu izsniedz serveris — neizmanto SDK `upload()` / `retrieveClientToken`, kas slēpj kļūdas.
 * Atgriež atsauces JSON ķermenim `POST /api/admin/notify-report-ready` (`blobAttachments`).
 */
export async function uploadNotifyPortfolioBlobs(input: NotifyPortfolioUploadInput): Promise<{ url: string; filename: string }[]> {
  const sid = input.sessionId.trim();
  const prefix = notifyPortfolioPathPrefix(sid);
  const out: { url: string; filename: string }[] = [];

  for (const f of input.files) {
    const safe = f.filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 100) || "pielikums";
    const pathname = `${prefix}/${Date.now()}-${safe}`;
    try {
      const token = await fetchNotifyBlobClientToken({ pathname, sessionId: sid });
      const r = await put(pathname, f.blob, {
        access: "private",
        token,
        multipart: f.blob.size > 8 * 1024 * 1024,
        contentType: f.mime,
      });
      out.push({ url: r.url, filename: f.filename });
    } catch (e) {
      if (e instanceof NotifyBlobUploadError) throw e;
      const raw = e instanceof Error ? e.message : String(e);
      throw new NotifyBlobUploadError(`Neizdevās augšupielādēt pielikumu „${f.filename}”: ${raw}`);
    }
  }
  return out;
}
