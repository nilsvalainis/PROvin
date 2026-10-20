import { describe, expect, it } from "vitest";
import {
  acceptStaffInvite,
  authenticateStaffPassword,
  createStaffSession,
  inviteStaffUser,
  isStaffSessionLive,
  resolveLiveStaffSession,
  revokeAllStaffSessions,
  revokeStaffAccess,
} from "@/lib/staff-store";

const suffix = () => `${Date.now()}${Math.random().toString(16).slice(2)}`;

describe("staff store access lifecycle", () => {
  it("invites, accepts, logs in, then revokes sessions immediately", async () => {
    const email = `anna.${suffix()}@example.lv`;
    const invited = await inviteStaffUser({
      name: "Anna Piemere",
      email,
      role: "logistics",
      createdBy: "env-admin",
    });
    expect(invited.ok).toBe(true);
    if (!invited.ok) return;

    const accepted = await acceptStaffInvite({ token: invited.token, password: "pietiekami12x" });
    expect(accepted.ok).toBe(true);

    const auth = await authenticateStaffPassword(email, "pietiekami12x");
    expect(auth.ok).toBe(true);
    if (!auth.ok) return;

    const { session } = await createStaffSession({
      user: auth.user,
      ip: "127.0.0.1",
      userAgent: "Mozilla/5.0 Chrome/120 Windows",
    });
    expect(isStaffSessionLive(session)).toBe(true);
    const live = await resolveLiveStaffSession(session.id, auth.user.id);
    expect(live?.user.email).toBe(email);

    const count = await revokeAllStaffSessions({ userId: auth.user.id, actorId: "env-admin" });
    expect(count).toBeGreaterThan(0);
    expect(await resolveLiveStaffSession(session.id, auth.user.id)).toBeNull();
  });

  it("revoking access kills the session and blocks login", async () => {
    const email = `peteris.${suffix()}@example.lv`;
    const invited = await inviteStaffUser({
      name: "Peteris Testa",
      email,
      role: "logistics",
      createdBy: "env-admin",
    });
    if (!invited.ok) throw new Error("invite");
    await acceptStaffInvite({ token: invited.token, password: "pietiekami12x" });
    const auth = await authenticateStaffPassword(email, "pietiekami12x");
    if (!auth.ok) throw new Error("auth");
    const { session } = await createStaffSession({ user: auth.user, ip: "10.0.0.2", userAgent: "test" });
    const revoked = await revokeStaffAccess({ userId: auth.user.id, actorId: "env-admin" });
    expect(revoked?.status).toBe("revoked");
    expect(await resolveLiveStaffSession(session.id, auth.user.id)).toBeNull();
    const again = await authenticateStaffPassword(email, "pietiekami12x");
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toBe("revoked");
  });
});
