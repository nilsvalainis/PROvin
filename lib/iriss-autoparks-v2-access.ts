import "server-only";

import { NextResponse } from "next/server";
import { autoparksV2StaffEnabled } from "@/lib/iriss-autoparks-v2-flag";
import {
  autoparksV2CanCategory,
  autoparksV2CanOpen,
  autoparksV2PermsFor,
  type AutoparksV2Category,
  type AutoparksV2Perms,
} from "@/lib/iriss-autoparks-v2-perms";
import { getAdminOrStaffActor, type AdminOrStaffActor } from "@/lib/staff-auth";
import { ENV_ADMIN_USER_ID } from "@/lib/staff-roles";

export type AutoparksV2Gate =
  | { ok: true; actor: AdminOrStaffActor; perms: AutoparksV2Perms; actorId: string; actorName: string }
  | { ok: false; response: NextResponse };

const NO_STORE = { "Cache-Control": "private, no-store" };

export function autoparksV2Perms(actor: AdminOrStaffActor): AutoparksV2Perms {
  return autoparksV2PermsFor(
    actor.kind === "admin" ? { kind: "admin" } : { kind: "staff", sections: actor.user.sections },
    autoparksV2StaffEnabled(),
  );
}

function actorIdentity(actor: AdminOrStaffActor): { actorId: string; actorName: string } {
  return actor.kind === "admin"
    ? { actorId: ENV_ADMIN_USER_ID, actorName: actor.name }
    : { actorId: actor.user.id, actorName: actor.user.name || actor.user.email };
}

export function autoparksV2Json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * Otrā pārbaude pēc middleware kartes: route pats pārbauda kategoriju (un karogu).
 * `category: "vesture"` = tikai administrators.
 */
export async function requireAutoparksV2Api(category: AutoparksV2Category | "vesture"): Promise<AutoparksV2Gate> {
  const actor = await getAdminOrStaffActor();
  if (!actor) return { ok: false, response: autoparksV2Json({ error: "unauthorized" }, 401) };
  const perms = autoparksV2Perms(actor);
  const allowed = category === "vesture" ? perms.vesture : autoparksV2CanCategory(perms, category);
  if (!allowed) return { ok: false, response: autoparksV2Json({ error: "forbidden" }, 403) };
  return { ok: true, actor, perms, ...actorIdentity(actor) };
}

export async function getAutoparksV2PageActor(): Promise<{ actor: AdminOrStaffActor; perms: AutoparksV2Perms } | null> {
  const actor = await getAdminOrStaffActor();
  if (!actor) return null;
  const perms = autoparksV2Perms(actor);
  return autoparksV2CanOpen(perms) ? { actor, perms } : null;
}
