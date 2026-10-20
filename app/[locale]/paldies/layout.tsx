import type { ReactNode } from "react";
import { THANKS_SESSION_URL_CLEANUP_SNIPPET } from "@/lib/thanks-session";

/**
 * Inline pirms afterInteractive GA/Meta: noņem session_id no adreses joslas.
 * httpOnly sīkdatni uzstāda middleware / lapa; šis skripts tikai tīra URL.
 */
export default function ThanksLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THANKS_SESSION_URL_CLEANUP_SNIPPET }} />
      {children}
    </>
  );
}
