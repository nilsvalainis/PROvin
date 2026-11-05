import type { Metadata } from "next";
import { headers } from "next/headers";
import { BusinessLinkForm } from "@/components/business-link/BusinessLinkForm";
import { BusinessPartnerLinkPage } from "@/components/business-link/BusinessPartnerLinkPage";
import { getB2bPartnerById } from "@/lib/b2b-partner-store";
import { hasBusinessPartnerCookie } from "@/lib/business-partner-cookie";
import { ClientLinkNeutralPage } from "@/components/client-link/ClientLinkNeutralPage";
import {
  BUSINESS_LINK_AMOUNT_CENTS,
  businessLinkPublicView,
  isBusinessLinkUsable,
  isSafeBusinessLinkToken,
  parseBusinessLinkCar,
} from "@/lib/business-link";
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

  const h = await headers();
  const ip = getClientIpFromHeaders(h);
  if (!(await checkRateLimit(`business-link-get:${ip}`, 40, 10 * 60 * 1000)).ok) return <Unavailable />;
  if (!isSafeBusinessLinkToken(token)) return <Unavailable />;
  const hashRl = await checkRateLimit(`business-link-hash:${hashClientLinkToken(token).slice(0, 16)}`, 40, 10 * 60 * 1000);
  if (!hashRl.ok) return <Unavailable />;

  const record = await readBusinessLinkByToken(token);
  if (!record || !isBusinessLinkUsable(record)) return <Unavailable />;

  /** Saite no partnera pogas: PROVIN Business lapa ar partnera logo (GALA-lapa.md). */
  if (record.partnerId) {
    /** Pārsūtīta partnera saite (bez pogas sīkdatnes) neatveras. */
    if (!hasBusinessPartnerCookie(h.get("cookie"), record.tokenHash)) return <Unavailable />;
    const partner = await getB2bPartnerById(record.partnerId);
    if (!partner || partner.status !== "active" || !partner.businessEmbed.enabled) return <Unavailable />;
    const legal = getCompanyLegal();
    return (
      <BusinessPartnerLinkPage
        token={token}
        view={{
          amountCents: BUSINESS_LINK_AMOUNT_CENTS,
          vin: record.prefillVin,
          car: record.car ?? parseBusinessLinkCar({}),
          partnerName: partner.businessEmbed.displayName || partner.companyName,
          partnerLogoOnDarkUrl: partner.businessEmbed.logoOnDarkUrl,
          legal: { brand: getCompanyPublicBrand(), ...legal },
        }}
      />
    );
  }

  return (
    <>
      <BusinessLinkForm token={token} view={businessLinkPublicView(record)} />
      <LegalFooter />
    </>
  );
}
