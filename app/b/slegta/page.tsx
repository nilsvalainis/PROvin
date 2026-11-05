import type { Metadata } from "next";
import { ClientLinkNeutralPage } from "@/components/client-link/ClientLinkNeutralPage";

export const metadata: Metadata = {
  title: "PROVIN BUSINESS",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

/** Partnera saite atvērta ne no partnera sludinājuma. Dizains: docs/makets-business-poga/GALA-lapa.md. */
export default function BusinessLinkClosedPage() {
  return <ClientLinkNeutralPage />;
}
