import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { parseDataUrlPayload } from "@/lib/iriss-offer-attachment-blob";
import {
  normalizeIrissCompanySettings,
  settingsFormDefaults,
} from "@/lib/iriss-company-settings";
import {
  isIrissCompanySettingsStoreEnabled,
  readIrissCompanySettings,
  writeIrissCompanyLogo,
  writeIrissCompanySettings,
} from "@/lib/iriss-company-settings-store";

export const runtime = "nodejs";

export async function GET() {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const settings = await readIrissCompanySettings();
  return NextResponse.json({
    settings,
    form: settingsFormDefaults(settings),
    storeEnabled: isIrissCompanySettingsStoreEnabled(),
  });
}

export async function PUT(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isIrissCompanySettingsStoreEnabled()) {
    return NextResponse.json({ error: "store_disabled" }, { status: 503 });
  }
  let body: unknown = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text) as unknown;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const raw = o.settings && typeof o.settings === "object" ? o.settings : o;
  let settings = normalizeIrissCompanySettings(raw);
  const logoDataUrl = typeof o.logoDataUrl === "string" ? o.logoDataUrl : "";
  if (logoDataUrl) {
    const parsed = parseDataUrlPayload(logoDataUrl);
    if (!parsed || parsed.bytes.length > 2_500_000) {
      return NextResponse.json({ error: "invalid_logo" }, { status: 400 });
    }
    const uploaded = await writeIrissCompanyLogo(parsed.bytes, parsed.mimeType);
    if (!uploaded.ok) return NextResponse.json({ error: uploaded.error }, { status: 500 });
    settings = { ...settings, logoUrl: uploaded.url };
  }
  const saved = await writeIrissCompanySettings(settings);
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 500 });
  return NextResponse.json({ settings: saved.settings, form: settingsFormDefaults(saved.settings) });
}
