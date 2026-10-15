/**
 * Bezmaksas VIN SCAN atkārtota palaišana no pasūtījuma kartītes.
 * Maksas avotus (CarVertical / AutoDNA / OutVin) šeit nesauc.
 */
import { NextResponse, after } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { readOrderDraft } from "@/lib/admin-order-draft-store";
import { isPlaceholderVin, isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { ORDER_VIN_SCAN_BROWSER_IMPORT_IDS, parseOrderVinScanRecord } from "@/lib/order-vin-scan";
import { applyBrowserArchiveHtml } from "@/lib/order-vin-scan-browser-html";
import { upsertOrderDraftVinScan } from "@/lib/admin-order-draft-store";
import { runOrderFreeVinScan } from "@/lib/order-vin-scan-run";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const ok = await getAdminSession();
    if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
    const b = body as Record<string, unknown>;
    const sessionId = typeof b.sessionId === "string" ? b.sessionId.trim() : "";
    if (!sessionId) return NextResponse.json({ error: "missing_sessionId" }, { status: 400 });

    const draft = await readOrderDraft(sessionId);
    const existing = parseOrderVinScanRecord(draft?.vinScan);
    const vin = normalizeVin(
      (typeof b.vin === "string" && b.vin) || existing?.vin || draft?.orderEdits?.vin || "",
    );
    if (!vin || !isValidVin(vin) || isPlaceholderVin(vin)) {
      return NextResponse.json({ error: "invalid_vin" }, { status: 400 });
    }
    const listingUrl =
      (typeof b.listingUrl === "string" && b.listingUrl.trim()) || draft?.orderEdits?.listingUrl || null;
    const sourceId = typeof b.sourceId === "string" ? b.sourceId.trim() : "";

    // „Atvērt + importēt”: PROVIN skripts nolasīja bloķēto avotu pārlūkā.
    // Ja ir lapas HTML, serveris parsē foto un izsoles. Bez HTML paliek tikai statuss.
    const br = b.browserResult as Record<string, unknown> | undefined;
    if (br && typeof br === "object") {
      const id = typeof br.id === "string" ? br.id : "";
      const html = typeof br.html === "string" ? br.html : "";
      const pageUrl = typeof br.pageUrl === "string" ? br.pageUrl.trim().slice(0, 500) : "";
      if (!existing || !ORDER_VIN_SCAN_BROWSER_IMPORT_IDS.includes(id) || existing.vin !== vin) {
        return NextResponse.json({ error: "invalid_browser_result" }, { status: 400 });
      }
      if (html.trim()) {
        const applied = applyBrowserArchiveHtml({ record: existing, id, html, pageUrl, vin });
        if (!applied.ok) return NextResponse.json({ error: applied.error }, { status: 400 });
        const saved = await upsertOrderDraftVinScan(sessionId, applied.record);
        if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 500 });
        return NextResponse.json({ ok: true, vinScan: applied.record });
      }
      const status: "found" | "none" | "" = br.status === "found" || br.status === "none" ? br.status : "";
      if (!status) {
        return NextResponse.json({ error: "invalid_browser_result" }, { status: 400 });
      }
      const summary = (typeof br.summary === "string" ? br.summary : "").trim().slice(0, 300);
      const next = {
        ...existing,
        indicators: existing.indicators.map((row) =>
          row.id === id ? { ...row, status: status as "found" | "none", summary: summary || (status === "found" ? "Atrasts (pārlūkā)" : "Nav datu (pārlūkā)") } : row,
        ),
      };
      const saved = await upsertOrderDraftVinScan(sessionId, next);
      if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 500 });
      return NextResponse.json({ ok: true, vinScan: next });
    }

    const force = b.force === true || Boolean(sourceId);

    after(() =>
      runOrderFreeVinScan(sessionId, {
        vin,
        listingUrl,
        force,
        ...(sourceId ? { sourceIds: [sourceId] } : {}),
      }).then(
        (r) => console.info("[order-vin-scan] retry", { sessionId, sourceId: sourceId || "all", ...r }),
        (err) => console.error("[order-vin-scan] retry:", err),
      ),
    );

    return NextResponse.json({
      ok: true,
      started: true,
      vinScan: existing
        ? { ...existing, status: "running", vin, at: new Date().toISOString() }
        : { at: new Date().toISOString(), vin, status: "running", indicators: [] },
    });
  } catch (e) {
    console.error("[order-vin-scan] POST", e);
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: "server_error", detail: msg }, { status: 500 });
  }
}
