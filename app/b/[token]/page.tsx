import type { Metadata } from "next";
import { headers } from "next/headers";
import { BusinessLinkForm } from "@/components/business-link/BusinessLinkForm";
import { ClientLinkNeutralPage } from "@/components/client-link/ClientLinkNeutralPage";
import { businessLinkPublicView, isBusinessLinkUsable, isSafeBusinessLinkToken } from "@/lib/business-link";
import { readBusinessLinkByToken } from "@/lib/business-link-store";
import { getClientIpFromHeaders } from "@/lib/client-ip";
import { hashClientLinkToken } from "@/lib/client-link-crypto";
import { getCompanyLegal, getCompanyPublicBrand } from "@/lib/company";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "PROVIN BUSINESS",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

function LegalFooter() {
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

function Unavailable() {
  return (
    <>
      <ClientLinkNeutralPage />
      <LegalFooter />
    </>
  );
}

export default async function BusinessLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw?.trim() ?? "";

  const ip = getClientIpFromHeaders(await headers());
  if (!(await checkRateLimit(`business-link-get:${ip}`, 40, 10 * 60 * 1000)).ok) return <Unavailable />;
  if (!isSafeBusinessLinkToken(token)) return <Unavailable />;
  const hashRl = await checkRateLimit(`business-link-hash:${hashClientLinkToken(token).slice(0, 16)}`, 40, 10 * 60 * 1000);
  if (!hashRl.ok) return <Unavailable />;

  const record = await readBusinessLinkByToken(token);
  if (!record || !isBusinessLinkUsable(record)) return <Unavailable />;

  return (
    <>
      <BusinessLinkForm token={token} view={businessLinkPublicView(record)} />
      <LegalFooter />
    </>
  );
}
