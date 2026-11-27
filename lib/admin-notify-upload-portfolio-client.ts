"use client";

import { upload } from "@vercel/blob/client";
import { notifyPortfolioPathPrefix } from "@/lib/admin-notify-blob-constants";

export type NotifyPortfolioUploadInput = {
  sessionId: string;
  files: { blob: Blob; filename: string; mime: string }[];
};

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
    // Neuzminams ceļš (privāts Blob; atsauci serveris pārbauda pēc pasūtījuma prefiksa).
    const rnd =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
        : Math.random().toString(36).slice(2, 12);
    const pathname = `${prefix}/${Date.now()}-${rnd}-${safe}`;
    const r = await upload(pathname, f.blob, {
      access: "private",
      handleUploadUrl: "/api/admin/notify-blob-upload",
      clientPayload,
      multipart: f.blob.size > 8 * 1024 * 1024,
      contentType: f.mime,
    });
    out.push({ url: r.url, filename: f.filename });
  }
  return out;
}
