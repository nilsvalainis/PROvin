import { NextResponse } from "next/server";
import { resolveActiveB2bPartner } from "@/lib/b2b-partner-auth";
import {
  classifyBulkVinTokens,
  splitVinPaste,
  summarizeBulkVinKinds,
} from "@/lib/b2b-partner-bulk-vin";
import { parseSpreadsheetFirstColumn } from "@/lib/b2b-partner-bulk-vin-xlsx";
import { findPartnerVinOrdersMap } from "@/lib/b2b-partner-vin-dedup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE_MAX = 1_000_000;

async function readInput(req: Request): Promise<
  { ok: true; text: string; fileTokens: string[]; parseOnly: boolean } | { ok: false; error: string; status: number }
> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const text = String(form.get("text") ?? "");
    const parseOnly = form.get("parseOnly") === "1" || form.get("parseOnly") === "true";
    const file = form.get("file");
    let fileTokens: string[] = [];
    if (file && typeof file === "object" && "arrayBuffer" in file && "size" in file) {
      const blob = file as File;
      if (blob.size > 0) {
        const name = (blob.name ?? "").toLowerCase();
        if (blob.size > FILE_MAX) return { ok: false, error: "file_too_large", status: 400 };
        if (name.endsWith(".xls") && !name.endsWith(".xlsx")) {
          return { ok: false, error: "file_type", status: 400 };
        }
        const buf = Buffer.from(await blob.arrayBuffer());
        fileTokens = parseSpreadsheetFirstColumn(buf, blob.name ?? "");
      }
    }
    return { ok: true, text, fileTokens, parseOnly };
  }
  let raw: { text?: unknown; tokens?: unknown; parseOnly?: unknown };
  try {
    raw = (await req.json()) as typeof raw;
  } catch {
    return { ok: false, error: "bad_request", status: 400 };
  }
  const text = typeof raw.text === "string" ? raw.text : "";
  const extra = Array.isArray(raw.tokens)
    ? raw.tokens
        .filter((item): item is string => typeof item === "string")
        .flatMap((item) => splitVinPaste(item))
    : [];
  return {
    ok: true,
    text,
    fileTokens: extra,
    parseOnly: raw.parseOnly === true,
  };
}

export async function POST(req: Request) {
  const partner = await resolveActiveB2bPartner();
  if (!partner) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const input = await readInput(req);
  if (!input.ok) {
    return NextResponse.json({ error: input.error }, { status: input.status });
  }

  const tokens = [...splitVinPaste(input.text), ...input.fileTokens];
  if (input.parseOnly) {
    return NextResponse.json({ ok: true, tokens });
  }

  const uniqueForLookup = [...new Set(tokens.map((token) => token.trim()).filter(Boolean))];
  const already = await findPartnerVinOrdersMap({
    partnerId: partner.id,
    vins: uniqueForLookup,
  });
  const classified = classifyBulkVinTokens(tokens, already);
  return NextResponse.json({
    ok: true,
    rows: classified.rows,
    truncated: classified.truncated,
    counts: summarizeBulkVinKinds(classified.rows),
  });
}
