import { describe, expect, it } from "vitest";
import {
  acceptStaffInvite,
  authenticateStaffPassword,
  createStaffSession,
  deleteStaffUser,
  findStaffUserById,
  inviteStaffUser,
  isStaffSessionLive,
  listStaffAudit,
  listStaffUsersPublic,
  peekStaffInvite,
  recordStaffLoginFailure,
  resetStaffPassword,
  resolveLiveStaffSession,
  revokeAllStaffSessions,
  restoreStaffAccess,
  revokeStaffAccess,
  setStaffSections,
  STAFF_LOGIN_MAX_ATTEMPTS,
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

  it("grants a second section without killing the live session", async () => {
    const email = `multi.${suffix()}@example.lv`;
    const invited = await inviteStaffUser({
      name: "Jānis Paraugs",
      email,
      sections: ["logistika"],
      createdBy: "env-admin",
    });
    if (!invited.ok) throw new Error("invite");
    expect(invited.user.sections).toEqual(["logistika"]);
    await acceptStaffInvite({ token: invited.token, password: "pietiekami12x" });
    const auth = await authenticateStaffPassword(email, "pietiekami12x");
    if (!auth.ok) throw new Error("auth");
    const { session } = await createStaffSession({ user: auth.user, ip: "127.0.0.1", userAgent: "test" });
    const updated = await setStaffSections({
      userId: auth.user.id,
      sections: ["logistika", "pavadzimes"],
      actorId: "env-admin",
    });
    expect(updated?.sections).toEqual(["logistika", "pavadzimes"]);
    expect(await resolveLiveStaffSession(session.id, auth.user.id)).not.toBeNull();
  });

  it("removing a section ends live sessions (cookie sections cannot outlive the change)", async () => {
    const email = `narrow.${suffix()}@example.lv`;
    const invited = await inviteStaffUser({
      name: "Partneris Paraugs",
      email,
      sections: ["pavadzimes", "pasutijumi"],
      createdBy: "env-admin",
    });
    if (!invited.ok) throw new Error("invite");
    await acceptStaffInvite({ token: invited.token, password: "pietiekami12x" });
    const auth = await authenticateStaffPassword(email, "pietiekami12x");
    if (!auth.ok) throw new Error("auth");
    const { session } = await createStaffSession({ user: auth.user, ip: "127.0.0.1", userAgent: "test" });
    const updated = await setStaffSections({ userId: auth.user.id, sections: ["pavadzimes"], actorId: "env-admin" });
    expect(updated?.sections).toEqual(["pavadzimes"]);
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

  it("logs in with the non-revoked record when the same email was re-invited after revoke", async () => {
    const email = `atkartoti.${suffix()}@example.lv`;
    const first = await inviteStaffUser({ name: "Toms Pirmais", email, role: "logistics", createdBy: "env-admin" });
    if (!first.ok) throw new Error("invite 1");
    await acceptStaffInvite({ token: first.token, password: "vecaparole12x" });
    await revokeStaffAccess({ userId: first.user.id, actorId: "env-admin" });

    const second = await inviteStaffUser({ name: "Toms Otrais", email, role: "logistics", createdBy: "env-admin" });
    if (!second.ok) throw new Error("invite 2");
    await acceptStaffInvite({ token: second.token, password: "jaunaparole12x" });

    const fresh = await authenticateStaffPassword(email, "jaunaparole12x");
    expect(fresh.ok).toBe(true);
    if (fresh.ok) expect(fresh.user.id).toBe(second.user.id);

    // Apgrieztā secība: jaunākais ieraksts atsaukts, vecais atjaunots - jāatrod vecais, nevis "revoked".
    await revokeStaffAccess({ userId: second.user.id, actorId: "env-admin" });
    await restoreStaffAccess({ userId: first.user.id, actorId: "env-admin" });
    const restored = await authenticateStaffPassword(email, "vecaparole12x");
    expect(restored.ok).toBe(true);
    if (restored.ok) expect(restored.user.id).toBe(first.user.id);

    const wrong = await authenticateStaffPassword(email, "jaunaparole12x");
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error).toBe("invalid");
  });

  it("resets password: old hash dies, lock clears, new invite sets a new password", async () => {
    const email = `reset.${suffix()}@example.lv`;
    const invited = await inviteStaffUser({
      name: "Toms Reset",
      email,
      sections: ["pavadzimes"],
      createdBy: "env-admin",
    });
    if (!invited.ok) throw new Error("invite");
    const firstToken = invited.token;
    await acceptStaffInvite({ token: firstToken, password: "vecaparole12x" });
    const auth = await authenticateStaffPassword(email, "vecaparole12x");
    if (!auth.ok) throw new Error("auth");
    const { session } = await createStaffSession({ user: auth.user, ip: "127.0.0.1", userAgent: "test" });
    for (let i = 0; i < STAFF_LOGIN_MAX_ATTEMPTS; i += 1) {
      await recordStaffLoginFailure(auth.user.id);
    }
    const locked = await findStaffUserById(auth.user.id);
    expect(locked?.failedLoginCount).toBeGreaterThanOrEqual(STAFF_LOGIN_MAX_ATTEMPTS);
    expect(locked?.lockedUntil).toBeTruthy();

    const reset = await resetStaffPassword({ userId: auth.user.id, actorId: "env-admin" });
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;
    expect(reset.user.status).toBe("invited");
    expect(reset.user.failedLoginCount).toBe(0);
    expect(reset.user.lockedUntil).toBeNull();
    expect(await resolveLiveStaffSession(session.id, auth.user.id)).toBeNull();
    expect(await peekStaffInvite(firstToken)).toBeNull();

    const oldPass = await authenticateStaffPassword(email, "vecaparole12x");
    expect(oldPass.ok).toBe(false);
    if (!oldPass.ok) expect(oldPass.error).toBe("invited");

    const peek = await peekStaffInvite(reset.token);
    expect(peek?.email).toBe(email);
    const accepted = await acceptStaffInvite({ token: reset.token, password: "jaunaparole12x" });
    expect(accepted.ok).toBe(true);
    const fresh = await authenticateStaffPassword(email, "jaunaparole12x");
    expect(fresh.ok).toBe(true);
    const stillOld = await authenticateStaffPassword(email, "vecaparole12x");
    expect(stillOld.ok).toBe(false);
    const audit = await listStaffAudit(40);
    expect(audit.some((row) => row.action === "password_reset" && row.target === auth.user.id)).toBe(true);
  });

  it("reissues an invite token for a user who has not accepted yet", async () => {
    const email = `resend.${suffix()}@example.lv`;
    const invited = await inviteStaffUser({ name: "Gaida Saiti", email, role: "logistics", createdBy: "env-admin" });
    if (!invited.ok) throw new Error("invite");
    const reset = await resetStaffPassword({ userId: invited.user.id, actorId: "env-admin" });
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;
    expect(await peekStaffInvite(invited.token)).toBeNull();
    expect((await peekStaffInvite(reset.token))?.email).toBe(email);
    expect(await inviteStaffUser({ name: "Cits", email, role: "logistics", createdBy: "env-admin" })).toEqual({
      ok: false,
      error: "duplicate_email",
    });
  });

  it("returns not_found for unknown reset or delete ids", async () => {
    const missing = "usr_deadbeefcafebabe";
    expect(await resetStaffPassword({ userId: missing, actorId: "env-admin" })).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await deleteStaffUser({ userId: missing, actorId: "env-admin" })).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("refuses password reset for a revoked user", async () => {
    const email = `reset.revoked.${suffix()}@example.lv`;
    const invited = await inviteStaffUser({ name: "Revokēts", email, role: "logistics", createdBy: "env-admin" });
    if (!invited.ok) throw new Error("invite");
    await acceptStaffInvite({ token: invited.token, password: "pietiekami12x" });
    await revokeStaffAccess({ userId: invited.user.id, actorId: "env-admin" });
    const reset = await resetStaffPassword({ userId: invited.user.id, actorId: "env-admin" });
    expect(reset.ok).toBe(false);
    if (!reset.ok) expect(reset.error).toBe("revoked");
  });

  it("hard-deletes a staff user so the same email can be invited again", async () => {
    const email = `dzest.${suffix()}@example.lv`;
    const first = await inviteStaffUser({
      name: "Toms Dzēšamais",
      email,
      sections: ["pavadzimes"],
      createdBy: "env-admin",
    });
    if (!first.ok) throw new Error("invite");
    await acceptStaffInvite({ token: first.token, password: "pietiekami12x" });
    const auth = await authenticateStaffPassword(email, "pietiekami12x");
    if (!auth.ok) throw new Error("auth");
    const { session } = await createStaffSession({ user: auth.user, ip: "10.0.0.3", userAgent: "test" });

    const blocked = await inviteStaffUser({ name: "Toms Otrais", email, role: "logistics", createdBy: "env-admin" });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toBe("duplicate_email");

    const removed = await deleteStaffUser({ userId: first.user.id, actorId: "env-admin" });
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.email).toBe(email);
    expect(await findStaffUserById(first.user.id)).toBeNull();
    expect(await resolveLiveStaffSession(session.id, first.user.id)).toBeNull();
    expect((await listStaffUsersPublic()).some((u) => u.id === first.user.id)).toBe(false);
    expect(await peekStaffInvite(first.token)).toBeNull();

    const second = await inviteStaffUser({ name: "Toms Jauns", email, role: "logistics", createdBy: "env-admin" });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.user.id).not.toBe(first.user.id);
    expect(second.user.email).toBe(email);
    const audit = await listStaffAudit(40);
    expect(audit.some((row) => row.action === "user_deleted" && row.meta.email === email)).toBe(true);
  });
});
