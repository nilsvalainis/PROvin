import type { Metadata } from "next";
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
import { checkRateLimit } from "@/lib/rate-limit-memory";
import { getCompanyLegal, getCompanyPublicBrand } from "@/lib/company";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "PROVIN AUDITS PRO",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

function ClientLegalFooter() {
  const legal = getCompanyLegal();
  const brand = getCompanyPublicBrand();
  return (
    <address className="mx-auto max-w-[420px] px-4 pb-10 text-center text-[10px] not-italic leading-relaxed text-[#c7c7cc]">
      <p>{brand}</p>
      {legal.isComplete ? (
        <>
          <p className="mt-0.5">{legal.legalName}</p>
          <p>Reģ. nr. {legal.regNo}</p>
          <p>{legal.legalAddress}</p>
        </>
      ) : null}
    </address>
  );
}

export default async function ClientSecureLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw?.trim() ?? "";

  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || headerList.get("x-real-ip")?.trim() || "unknown";
  const ipRl = checkRateLimit(`client-link-get:${ip}`, 40, 10 * 60 * 1000);
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

  const hashRl = checkRateLimit(`client-link-hash:${hashClientLinkToken(token).slice(0, 16)}`, 40, 10 * 60 * 1000);
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
