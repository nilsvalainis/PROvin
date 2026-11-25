/**
 * Admin: nopirktie kfzgutachten.at §57a atzinumi (PDF) -> strukturēti dati.
 * Lokāls parsētājs, bez AI un bez maksas. Pasūtījumā datus ieliek klients (Citi avoti sadaļa).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { extractKfzGutachtenPdfText } from "@/lib/kfzgutachten/pdf-text-server";
import { parseKfzGutachtenText, type KfzGutachtenReport } from "@/lib/kfzgutachten/parse-gutachten";
import { PDF_MAX_FILE_BYTES } from "@/lib/pdf-api-limits";

export const maxDuration = 60;
export const runtime = "nodejs";

const MAX_FILES = 20;

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "payload_too_large", detail: "Augšupielāde pārāk liela" }, { status: 413 });
  }
  const files = form.getAll("files").filter((f): f is File => f instanceof File).slice(0, MAX_FILES);
  if (files.length === 0) return NextResponse.json({ error: "missing_file" }, { status: 400 });

  const reports: KfzGutachtenReport[] = [];
  const warnings: string[] = [];
  for (const file of files) {
    const name = file.name || "atzinums.pdf";
    const isPdf = (file.type || "").toLowerCase().includes("pdf") || name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      warnings.push(`${name}: nav PDF`);
      continue;
    }
    if (file.size <= 0 || file.size > PDF_MAX_FILE_BYTES) {
      warnings.push(`${name}: tukšs vai pārāk liels fails`);
      continue;
    }
    try {
      const text = await extractKfzGutachtenPdfText(await file.arrayBuffer(), name);
      const parsed = parseKfzGutachtenText(text);
      if (parsed.length === 0) warnings.push(`${name}: nav atpazīts kā §57a atzinums`);
      reports.push(...parsed);
    } catch (e) {
      console.warn("[kfzgutachten/parse] failed", { name, message: e instanceof Error ? e.message.slice(0, 200) : "?" });
      warnings.push(`${name}: neizdevās nolasīt`);
    }
  }
  console.info("[kfzgutachten/parse] ok", { files: files.length, reports: reports.length, warnings: warnings.length });
  return NextResponse.json({ ok: reports.length > 0, reports, warnings });
}
