import "server-only";

import { readGoogleContactsConfig, upsertGoogleContactForOrder } from "@/lib/google-contacts";
import { applyGoogleContactSync, shouldSyncGoogleContact } from "@/lib/iriss-google-contact-fields";
import { writeIrissPasutijums } from "@/lib/iriss-pasutijumi-store";
import type { IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

export async function maybeSyncGoogleContact(
  saved: IrissPasutijumsRecord | null,
  previous: IrissPasutijumsRecord | null,
): Promise<IrissPasutijumsRecord | null> {
  if (!saved || !shouldSyncGoogleContact(previous, saved)) return saved;
  if (!readGoogleContactsConfig()) return saved;
  const result = await upsertGoogleContactForOrder(saved);
  const next = applyGoogleContactSync(saved, result);
  const w = await writeIrissPasutijums(next, { expectedWorkspaceRevision: saved.workspaceRevision });
  return w.ok ? w.record : saved;
}
