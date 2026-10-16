import { NextResponse } from "next/server";
import { requireB2bDemoPlatformAdmin } from "@/lib/b2b-demo-admin-gate";
import { b2bDemoErrorResponse } from "@/lib/b2b-demo-api";
import { adminCreateB2bDemoTenant, listB2bDemoAdminTenants } from "@/lib/b2b-demo-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireB2bDemoPlatformAdmin(req);
  if (!gate.ok) return gate.response;
  const tenants = await listB2bDemoAdminTenants();
  return NextResponse.json({ tenants });
}

export async function POST(req: Request) {
  const gate = await requireB2bDemoPlatformAdmin(req);
  if (!gate.ok) return gate.response;

  let body: {
    name?: string;
    slug?: string;
    ownerEmail?: string;
    ownerName?: string;
    ownerPassword?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Nederīgs JSON." }, { status: 400 });
  }

  try {
    const created = await adminCreateB2bDemoTenant({
      name: typeof body.name === "string" ? body.name : "",
      slug: typeof body.slug === "string" ? body.slug : undefined,
      ownerEmail: typeof body.ownerEmail === "string" ? body.ownerEmail : "",
      ownerName: typeof body.ownerName === "string" ? body.ownerName : undefined,
      ownerPassword: typeof body.ownerPassword === "string" ? body.ownerPassword : undefined,
    });
    return NextResponse.json(
      {
        tenant: created.tenant,
        owner: created.owner,
        generatedPassword: created.generatedPassword,
      },
      { status: 201 },
    );
  } catch (e) {
    return b2bDemoErrorResponse(e);
  }
}
