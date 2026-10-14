import { redirect } from "next/navigation";
import { B2B_DEMO_APP_PREFIX } from "@/lib/b2b-demo-host";
import { resolveB2bDemoActor } from "@/lib/b2b-demo-auth";
import { ensureB2bDemoSeed } from "@/lib/b2b-demo-seed";

export const dynamic = "force-dynamic";

export default async function B2bDemoHomePage() {
  await ensureB2bDemoSeed();
  const actor = await resolveB2bDemoActor();
  redirect(actor ? `${B2B_DEMO_APP_PREFIX}/pasutijumi` : `${B2B_DEMO_APP_PREFIX}/login`);
}
