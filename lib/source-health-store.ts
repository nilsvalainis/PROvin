import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import { getOrderDraftBlobConfig, getOrderDraftStorageDir } from "@/lib/admin-order-draft-store";
import { applySourceOutcomes, emptySourceHealthDoc, type SourceHealthDoc, type SourceOutcome } from "@/lib/source-health";

/**
 * Viegls avotu ielādes rezultātu žurnāls: viens JSON {dir|blobPrefix}/source_health/v1.json.
 * Ieraksts ir „best effort” (nekad nemet kļūdu, nebloķē atbildi); paralēli ieraksti var pārrakstīt viens otru — pieņemami.
 */

const REL = "source_health/v1.json";

export async function readSourceHealth(): Promise<SourceHealthDoc> {
  const blob = getOrderDraftBlobConfig();
  const dir = getOrderDraftStorageDir();
  try {
    if (blob) {
      const res = await get(`${blob.prefix}${REL}`, { access: "private", token: blob.token, useCache: false });
      if (res?.statusCode === 200 && res.stream) {
        const raw = JSON.parse(await new Response(res.stream).text()) as SourceHealthDoc;
        if (raw && typeof raw.sources === "object") return raw;
      }
    } else if (dir && process.env.VERCEL !== "1") {
      const raw = JSON.parse(await fs.readFile(path.join(dir, REL), "utf8")) as SourceHealthDoc;
      if (raw && typeof raw.sources === "object") return raw;
    }
  } catch {
    /* nav datu */
  }
  return emptySourceHealthDoc();
}

export async function recordSourceOutcomes(outcomes: SourceOutcome[]): Promise<void> {
  if (outcomes.length === 0) return;
  try {
    const blob = getOrderDraftBlobConfig();
    const dir = getOrderDraftStorageDir();
    if (!blob && (!dir || process.env.VERCEL === "1")) return;
    const next = applySourceOutcomes(await readSourceHealth(), outcomes);
    const body = JSON.stringify(next);
    if (blob) {
      await put(`${blob.prefix}${REL}`, body, {
        access: "private",
        token: blob.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
    } else if (dir) {
      const fp = path.join(dir, REL);
      await fs.mkdir(path.dirname(fp), { recursive: true });
      await fs.writeFile(fp, body, "utf8");
    }
  } catch (e) {
    console.warn("[source-health] record failed", e instanceof Error ? e.message : e);
  }
}
