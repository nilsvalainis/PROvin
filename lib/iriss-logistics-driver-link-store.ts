/**
 * Šofera saišu žetoni (nejauši, 14 dienas). Atsaukšana dzēš visas kravas saites.
 */
import "server-only";

import { randomBytes } from "node:crypto";
import { readLogisticsJsonFile, writeLogisticsJsonFile } from "@/lib/iriss-logistics-store";
import {
  DRIVER_LINK_TTL_DAYS,
  driverLinkExpired,
  isDriverLinkToken,
  type DriverLinkBucket,
  type DriverLinkRecord,
} from "@/lib/iriss-logistics-driver-link";

const FILE = "driver-links.json";

async function readAll(): Promise<DriverLinkRecord[]> {
  const raw = await readLogisticsJsonFile(FILE).catch(() => null);
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is DriverLinkRecord =>
      Boolean(r) &&
      typeof r === "object" &&
      typeof (r as DriverLinkRecord).token === "string" &&
      ((r as DriverLinkRecord).bucket === "next" || (r as DriverLinkRecord).bucket === "after") &&
      typeof (r as DriverLinkRecord).expiresAt === "string",
  );
}

export async function createDriverLink(bucket: DriverLinkBucket, nowMs = Date.now()): Promise<DriverLinkRecord> {
  const rec: DriverLinkRecord = {
    token: randomBytes(24).toString("base64url"),
    bucket,
    createdAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + DRIVER_LINK_TTL_DAYS * 86_400_000).toISOString(),
  };
  const live = (await readAll()).filter((r) => !driverLinkExpired(r, nowMs));
  await writeLogisticsJsonFile(FILE, [rec, ...live].slice(0, 100));
  return rec;
}

export async function findDriverLink(token: string, nowMs = Date.now()): Promise<DriverLinkRecord | null> {
  if (!isDriverLinkToken(token)) return null;
  const rec = (await readAll()).find((r) => r.token === token) ?? null;
  return rec && !driverLinkExpired(rec, nowMs) ? rec : null;
}

export async function revokeDriverLinks(bucket: DriverLinkBucket): Promise<number> {
  const all = await readAll();
  const keep = all.filter((r) => r.bucket !== bucket);
  if (keep.length !== all.length) await writeLogisticsJsonFile(FILE, keep);
  return all.length - keep.length;
}
