import { redirect } from "next/navigation";
import { B2B_DEMO_APP_PREFIX } from "@/lib/b2b-demo-host";
import { resolveB2bDemoActor, type B2bDemoActor } from "@/lib/b2b-demo-auth";
import { ensureB2bDemoSeed } from "@/lib/b2b-demo-seed";

export async function requireB2bDemoPageActor(): Promise<B2bDemoActor> {
  await ensureB2bDemoSeed();
  const actor = await resolveB2bDemoActor();
  if (!actor) redirect(`${B2B_DEMO_APP_PREFIX}/login`);
  return actor;
}
