import "server-only";

import { headers } from "next/headers";

/** Pilna bāzes adrese no pašreizējā pieprasījuma (noderīgi dev ar citu portu). */
export async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "http://localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
