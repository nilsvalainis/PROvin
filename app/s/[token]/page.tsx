import type { Metadata } from "next";
import { LegalReveal, companyLegalLine } from "@/components/LegalReveal";
import { headers } from "next/headers";
import { ClientLinkForm } from "@/components/client-link/ClientLinkForm";
import { ClientLinkNeutralPage } from "@/components/client-link/ClientLinkNeutralPage";
import { hashClientLinkToken } from "@/lib/client-link-crypto";
import {
  clientLinkPublicView,
  isClientLinkUsable,
  isSafeClientLinkToken,
} from "@/lib/client-link";
import { readClientLinkByToken } from "@/lib/client-link-store";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCompanyLegal } from "@/lib/company";
import { getClientIpFromHeaders } from "@/lib/client-ip";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "PROVIN AUDITS PRO",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

function ClientLegalFooter() {
  return (
    <div className="mx-auto max-w-[420px] px-4 pb-10">
      <LegalReveal line={companyLegalLine(getCompanyLegal())} tone="light" align="center" />
    </div>
  );
}

export default async function ClientSecureLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw?.trim() ?? "";

  const headerList = await headers();
  const ip = getClientIpFromHeaders(headerList);
  const ipRl = await checkRateLimit(`client-link-get:${ip}`, 40, 10 * 60 * 1000);
  if (!ipRl.ok) {
    return (
      <>
        <ClientLinkNeutralPage />
        <ClientLegalFooter />
      </>
    );
  }

  if (!isSafeClientLinkToken(token)) {
    return (
      <>
        <ClientLinkNeutralPage />
        <ClientLegalFooter />
      </>
    );
  }

  const hashRl = await checkRateLimit(`client-link-hash:${hashClientLinkToken(token).slice(0, 16)}`, 40, 10 * 60 * 1000);
  if (!hashRl.ok) {
    return (
      <>
        <ClientLinkNeutralPage />
        <ClientLegalFooter />
      </>
    );
  }

  const record = await readClientLinkByToken(token);
  if (!record || !isClientLinkUsable(record)) {
    return (
      <>
        <ClientLinkNeutralPage />
        <ClientLegalFooter />
      </>
    );
  }

  return (
    <>
      <ClientLinkForm token={token} view={clientLinkPublicView(record)} />
      <ClientLegalFooter />
    </>
  );
}
