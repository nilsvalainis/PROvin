import { NextResponse } from "next/server";
import { B2bDemoIsolationError } from "@/lib/b2b-demo-isolation";
import { resolveB2bDemoActor, type B2bDemoActor } from "@/lib/b2b-demo-auth";

export async function requireB2bDemoActor(): Promise<
  { ok: true; actor: B2bDemoActor } | { ok: false; response: NextResponse }
> {
  const actor = await resolveB2bDemoActor();
  if (!actor) {
    return { ok: false, response: NextResponse.json({ error: "Nepieciešama pieteikšanās." }, { status: 401 }) };
  }
  return { ok: true, actor };
}

export function b2bDemoErrorResponse(error: unknown, fallback = "Neizdevās izpildīt pieprasījumu."): NextResponse {
  if (error instanceof B2bDemoIsolationError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status: 400 });
}
