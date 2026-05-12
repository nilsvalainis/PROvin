"use client";

import { useEffect } from "react";
import { markSessionOpened } from "@/lib/admin-opened-sessions";

/** Atzīmē Stripe Checkout sesiju kā atvērtu (noņem no nelasīto skaita augšējā badge). */
export function MarkAdminStripeSessionOpened({ sessionId }: { sessionId: string }) {
  useEffect(() => {
    markSessionOpened(sessionId);
  }, [sessionId]);
  return null;
}
