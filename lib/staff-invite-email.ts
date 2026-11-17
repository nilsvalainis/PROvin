import "server-only";

import { isSmtpConfigured, sendStaffInviteEmail } from "@/lib/email/send-transactional";

export async function trySendStaffInviteEmail(opts: {
  to: string;
  name: string;
  inviteUrl: string;
  kind?: "invite" | "reset";
}): Promise<boolean> {
  if (!isSmtpConfigured()) {
    console.warn("[iriss-staff] SMTP nav iestatīts, uzaicinājums nav nosūtīts");
    return false;
  }
  try {
    await sendStaffInviteEmail(opts);
    return true;
  } catch (err) {
    console.error("[iriss-staff] uzaicinājuma e-pasts neizdevās", err);
    return false;
  }
}
