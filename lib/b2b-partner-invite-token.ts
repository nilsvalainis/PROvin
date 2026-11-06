import "server-only";

import { randomBytes } from "node:crypto";

export function newB2bInviteToken(): string {
  return `inv_${randomBytes(16).toString("hex")}`;
}
