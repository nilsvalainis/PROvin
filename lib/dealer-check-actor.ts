import "server-only";

import { cookies } from "next/headers";
import { decodeAdminToken } from "@/lib/admin-auth";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/admin-session-token";
import { dealerCheckCreatorId } from "@/lib/dealer-check-history";

/** Pašreizējā admin sesija. Darbinieka sīkdatne šeit nenonāk. */
export async function currentDealerCheckCreatorId(): Promise<string> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE_NAME)?.value;
  const payload = token ? decodeAdminToken(token) : null;
  return dealerCheckCreatorId(payload);
}
