import { describe, expect, it } from "vitest";
import {
  buildArtisMilicinsRecoveryOrderEdits,
  readConsultationRecoveryEmail,
  readConsultationRecoveryPhone,
} from "./consultation-recovery-artis-milicins";
import { testEnv } from "@/lib/test-process-env";

describe("consultation recovery contacts", () => {
  it("bez env neatgriež e-pastu vai tālruni", () => {
    expect(readConsultationRecoveryEmail(testEnv())).toBe("");
    expect(readConsultationRecoveryPhone(testEnv())).toBe("");
  });

  it("ņem kontaktus tikai no env", () => {
    const env = testEnv({
      CONSULTATION_RECOVERY_EMAIL: "  recovery@example.lv ",
      CONSULTATION_RECOVERY_PHONE: " 20000000 ",
    });
    expect(readConsultationRecoveryEmail(env)).toBe("recovery@example.lv");
    expect(readConsultationRecoveryPhone(env)).toBe("20000000");
  });

  it("order edits ņem kontaktus no env, ne no hardcoded vērtībām", () => {
    const edits = buildArtisMilicinsRecoveryOrderEdits();
    expect(edits.customerEmail).toBe(readConsultationRecoveryEmail());
    expect(edits.customerPhone).toBe(readConsultationRecoveryPhone());
  });
});
