/**
 * Saglabāšanas PATCH bez AI konteksta un RAW atskaitēm.
 * Vercel serverless ķermeņa limits ir ~4,5 MB: pilns AutoDNA/CSDD raw
 * + komentāri viegli to pārsniedz, un 413 nemaz nesasniedz funkciju.
 */

import type { OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";

/** Lauki, ko PATCH nenes: admin AI / ielīmētais raw, nav klienta PDF komentāri. */
export const WORKSPACE_PERSIST_BULKY_TEXT_KEYS = [
  "aiContextRaw",
  "mileagePasteRaw",
  "pdfImportRaw",
  "listingPasteRaw",
  "rawUnprocessedData",
] as const;

export type WorkspacePersistBulkyTextKey = (typeof WORKSPACE_PERSIST_BULKY_TEXT_KEYS)[number];

const BULKY = new Set<string>(WORKSPACE_PERSIST_BULKY_TEXT_KEYS);

/** Zem Vercel ~4,5 MB, ar rezervi JSON escape un galvenēm. */
export const WORKSPACE_PERSIST_JSON_SOFT_MAX_BYTES = 3_500_000;

/** Chromium `keepalive` ķermeņa limits ir 64 KB. */
export const WORKSPACE_PERSIST_KEEPALIVE_MAX_BYTES = 56_000;

export function isWorkspacePersistBulkyTextKey(key: string): key is WorkspacePersistBulkyTextKey {
  return BULKY.has(key);
}

export function workspaceJsonBytes(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return 0;
  }
}

function substantivePlainTextLen(htmlOrText: string | null | undefined): number {
  if (htmlOrText == null) return 0;
  return htmlOrText
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

/** Tukšs ienākošais (slim PATCH) neiztukšo aizpildītu baseline raw. */
function pickRicherBulkyText(incoming: unknown, baseline: unknown): string {
  const inStr = typeof incoming === "string" ? incoming : "";
  const baseStr = typeof baseline === "string" ? baseline : "";
  const inLen = substantivePlainTextLen(inStr);
  const baseLen = substantivePlainTextLen(baseStr);
  if (baseLen === 0) return inStr;
  if (inLen === 0) return baseStr;
  return inStr;
}

export function slimUnknownForServerPersist(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(slimUnknownForServerPersist);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    out[key] = BULKY.has(key) ? "" : slimUnknownForServerPersist(child);
  }
  return out;
}

/** Komentāri un strukturētās tabulas paliek; AI/RAW lauki uz serveri iet tukši. */
export function slimWorkspaceDraftForServerPersist(draft: OrderDraftWorkspaceBody): OrderDraftWorkspaceBody {
  return {
    ...draft,
    sourceBlocks: slimUnknownForServerPersist(draft.sourceBlocks),
  };
}

/**
 * Pēc bloka izvēles atjauno AI/RAW no baseline, ja ienākošais (slim) ir tukšs.
 * `sourceBlockWipes` gadījumā šo nedrīkst saukt uz notīrīto bloku.
 */
export function overlayBulkyRawTextFields(incoming: unknown, baseline: unknown, picked: unknown): unknown {
  if (Array.isArray(picked)) {
    const inArr = Array.isArray(incoming) ? incoming : [];
    const baseArr = Array.isArray(baseline) ? baseline : [];
    return picked.map((item, i) => overlayBulkyRawTextFields(inArr[i], baseArr[i], item));
  }
  if (!picked || typeof picked !== "object") return picked;
  const inRec = incoming && typeof incoming === "object" && !Array.isArray(incoming) ? (incoming as Record<string, unknown>) : {};
  const baseRec =
    baseline && typeof baseline === "object" && !Array.isArray(baseline) ? (baseline as Record<string, unknown>) : {};
  const out: Record<string, unknown> = { ...(picked as Record<string, unknown>) };
  const keys = new Set([...Object.keys(out), ...Object.keys(inRec), ...Object.keys(baseRec)]);
  for (const key of keys) {
    if (BULKY.has(key)) {
      out[key] = pickRicherBulkyText(inRec[key], baseRec[key]);
      continue;
    }
    if (key in out && out[key] && typeof out[key] === "object") {
      out[key] = overlayBulkyRawTextFields(inRec[key], baseRec[key], out[key]);
    }
  }
  return out;
}
