import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { getAnthropicApiKeyFromEnv } from "@/lib/admin-ai";
import { assertAiAllowedForSession } from "@/lib/admin-ai-demo-guard";
import { applyCopilotActions } from "@/lib/admin-copilot-apply";
import type { CopilotSourceKey } from "@/lib/admin-copilot-types";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { markCarverticalAutoApplied } from "@/lib/carvertical-auto";
import { readCarverticalAutoStatus, readCarverticalPdf } from "@/lib/carvertical-auto-store";
import { runVendorPdfAgent } from "@/lib/copilot-vendor-pdf-agent";
import { getDropboxClient } from "@/lib/dropbox-client";
import { isInsideDropboxFolder } from "@/lib/iriss-autoparks-dropbox-path";
import { provOrdersDropboxRoot } from "@/lib/ltab-dropbox";
import { extractPdfTextDetailed } from "@/lib/pdf-text-extract-server";
import { upsertVendorPdfAiContext } from "@/lib/vendor-ai-context-fill";
import { tryImportVendorArchivePhotosFromPdf } from "@/lib/vendor-archive-photos-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Admin: fonā saņemtā CarVertical atskaite -> CarVertical bloks. Tas pats ceļš kā manuālā PDF augšupielāde
 * (`/api/admin/copilot/vendor-pdf`): esošais CarVertical parseris + Copilot darbības (sapludina, destruktīvās izlaiž -
 * ar roku labotus laukus nepārraksta) + PDF teksts AI konteksta marķētajā blokā. Atgriež tikai izmainītos blokus.
 */
export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!isSafeOrderDraftSessionId(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  const status = await readCarverticalAutoStatus(sessionId);
  if (!status || status.state !== "ready" || !status.pdf) return NextResponse.json({ error: "no_result" }, { status: 409 });

  let bytes = status.pdf.blobPath ? await readCarverticalPdf(sessionId) : null;
  if (!bytes && status.pdf.dropboxPath && isInsideDropboxFolder(status.pdf.dropboxPath, provOrdersDropboxRoot())) {
    const client = getDropboxClient();
    if (client) {
      try {
        bytes = new Uint8Array((await client.download(status.pdf.dropboxPath)).bytes);
      } catch {
        bytes = null;
      }
    }
  }
  if (!bytes) return NextResponse.json({ error: "pdf_missing" }, { status: 404 });

  let sourceBlocks: WorkspaceSourceBlocks;
  try {
    sourceBlocks = mergeSourceBlocksWithDefaults((body.sourceBlocks ?? {}) as Partial<WorkspaceSourceBlocks>);
  } catch {
    return NextResponse.json({ error: "missing_source_blocks" }, { status: 400 });
  }

  let useAi = Boolean(getAnthropicApiKeyFromEnv());
  if (useAi) {
    const guard = await assertAiAllowedForSession(sessionId);
    if (!guard.ok) useAi = false;
  }
  const buffer = bytes.slice().buffer;
  const fileName = status.pdf.name;
  try {
    const agent = await runVendorPdfAgent({ target: "carvertical", fileName, buffer, sourceBlocks, useAi });
    const result = applyCopilotActions(sourceBlocks, agent.actions, { onlyAuto: false });
    const changedKeys: CopilotSourceKey[] = [...result.changedKeys];
    const extracted = await extractPdfTextDetailed(buffer, { fileName });
    const current = result.sourceBlocks.carvertical;
    const filled = upsertVendorPdfAiContext(current, extracted.text ?? "", {
      sourceLabel: "CarVertical",
      previousAutoTexts: [current.mileagePasteRaw],
    });
    if (filled !== current) {
      result.sourceBlocks = { ...result.sourceBlocks, carvertical: filled };
      if (!changedKeys.includes("carvertical")) changedKeys.push("carvertical");
    }
    // Arhīva foto «Sludinājuma vēsturē» - tikai pirmajā automātiskajā ievietošanā; vēlāk ar pogu «Ielādēt arhīva foto».
    const archive = status.appliedAt
      ? null
      : await tryImportVendorArchivePhotosFromPdf({ sessionId, source: "carvertical", pdfBytes: bytes, vin: status.vin, sourceBlocks: result.sourceBlocks, relayTimeoutMs: 90_000 });
    const next = await markCarverticalAutoApplied(sessionId);
    return NextResponse.json({
      ok: true,
      summary: agent.summary,
      notes: useAi ? agent.notes : [...agent.notes, "AI izlaists - izmantots tikai PDF teksta slānis."],
      patchedSourceBlocks: {
        ...Object.fromEntries(changedKeys.map((k) => [k, result.sourceBlocks[k]])),
        ...(archive?.changed ? { tirgus: archive.tirgus } : {}),
      },
      changedKeys: archive?.changed ? [...changedKeys, "tirgus"] : changedKeys,
      ...(archive ? { archivePhotos: { added: archive.added, duplicates: archive.duplicates, notes: archive.notes } } : {}),
      status: next,
    });
  } catch (e) {
    console.error("[admin/carvertical/apply] failed", e instanceof Error ? e.message.slice(0, 200) : "unknown");
    return NextResponse.json({ error: "extraction_failed" }, { status: 502 });
  }
}
